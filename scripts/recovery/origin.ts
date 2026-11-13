import {
  appendFile,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import {
  type ArchiveDocument,
  isRecovered,
  originalPath,
  prepareData,
  readManifest,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
  writeJson,
} from "./core.ts";
import { coverage } from "./coverage.ts";
import { discover } from "./discover.ts";

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    "dry-run": { type: "boolean" },
    "retry-missing-once": { type: "boolean" },
  },
});
const limit = values.limit ? Number(values.limit) : Infinity;
if (!(limit > 0) || (limit !== Infinity && !Number.isInteger(limit)))
  throw new Error("Use a positive integer --limit");
const batchSize = 20;
const finalRetry = values["retry-missing-once"] ?? false;
const maxAttempts = finalRetry ? 1 : 2;
const manifest = await readManifest();
let stop = false;
let blocked = false;
let attempted = 0;
let recovered = 0;
let total = 0;
let completed = 0;
let saving = Promise.resolve();
const lock = "archive/origin.lock";
const startedAt = new Date().toISOString();
const byKey = new Map(manifest.documents.map((d) => [urlKey(d.url), d]));
const tries = new Map<string, number>();
const progress = () => {
  const pct = total ? Math.min(100, (100 * completed) / total) : 100;
  const filled = Math.floor(pct / 5);
  console.log(
    `${new Date().toLocaleTimeString("it-IT")} [${"█".repeat(filled)}${"░".repeat(20 - filled)}] ${pct.toFixed(1)}% ${completed}/${total} | ${recovered} recovered this run | ${attempted} attempts${blocked ? " | SERVER BLOCK: stopping" : ""}`,
  );
};
async function save(doc: ArchiveDocument) {
  saving = saving.then(async () => {
    const key = urlKey(doc.url);
    const index = manifest.documents.findIndex((d) => urlKey(d.url) === key);
    if (index < 0) manifest.documents.push(doc);
    else manifest.documents[index] = doc;
    byKey.set(key, doc);
    await writeJson("archive/manifest.json", manifest);
    await appendFile(
      "archive/download.log",
      `${new Date().toISOString()} origin ${doc.outcome}: ${doc.url}${doc.error ? ` ${doc.error}` : ""}${doc.defects ? ` defects: ${doc.defects.join("; ")}` : ""}\n`,
    );
  });
  await saving;
}
async function download(url: string) {
  const target = new URL(url);
  target.protocol = "https:";
  target.port = "";
  const previous = byKey.get(urlKey(url));
  const doc: ArchiveDocument = {
    url,
    variants: [...new Set([...(previous?.variants ?? []), url])],
    outcome: "failed attempt",
    source: "origin",
    retrievedAt: new Date().toISOString(),
    fetchedFrom: target.href,
  };
  attempted++;
  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "UtopiaUcroniaArchive/0.1 (personal historical archive)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
    });
    doc.httpStatus = response.status;
    if ([403, 429, 999].includes(response.status)) {
      blocked = true;
      stop = true;
    }
    if (response.status === 404 || response.status === 410)
      doc.outcome = "missing";
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    // fetch rejects a body shorter than Content-Length, so a completed
    // response is the file as the server holds it: keep it, noting defects.
    const { data, compressed, defects } = prepareData(
      new Uint8Array(await response.arrayBuffer()),
      target.href,
      type,
      { lenient: true },
    );
    const relative = originalPath(url);
    const dest = safePath("archive/original", relative);
    await mkdir(path.dirname(dest), { recursive: true });
    try {
      await writeFile(dest, data, { flag: "wx" });
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        sha256(await readFile(dest)) !== sha256(data)
      ) {
        stop = true;
        throw new Error(
          `Existing original differs: ${relative}; restore or review it before continuing`,
        );
      }
    }
    Object.assign(doc, {
      outcome: "recovered",
      path: relative,
      type,
      size: data.length,
      sha256: sha256(data),
      compressed,
      lastModified: response.headers.get("last-modified") ?? undefined,
      defects: defects.length ? defects : undefined,
    });
    delete doc.error;
    recovered++;
  } catch (error) {
    const cause =
      error instanceof Error && error.cause
        ? `; cause: ${String(error.cause)}`
        : "";
    doc.error = `${String(error)}${cause}`;
  }
  await save(doc);
  completed++;
}

await mkdir("archive", { recursive: true });
try {
  await writeFile(lock, String(process.pid), { flag: "wx" });
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  const pid = Number(await readFile(lock, "utf8"));
  let active = false;
  try {
    process.kill(pid, 0);
    active = true;
  } catch {
    /* stale lock */
  }
  if (active) throw new Error(`Origin recovery already active (PID ${pid})`);
  await unlink(lock);
  await writeFile(lock, String(process.pid), { flag: "wx" });
}
process.on("SIGINT", () => {
  stop = true;
  console.log("Finishing active saves. Run the same command to resume.");
});
process.on("SIGTERM", () => {
  stop = true;
});
const timer = setInterval(progress, 60000);
try {
  console.log(
    `Original server recovery: batches of ${batchSize}, up to ${batchSize} overlapping operations, starts 2 seconds apart, 30 seconds between batches.`,
  );
  for (const doc of manifest.documents.filter(isRecovered))
    if (!(await verifyDocument(doc)))
      throw new Error(`Original hash/size mismatch: ${doc.url}`);
  // Iterate until newly recovered HTML/CSS adds no further URLs.
  for (let round = 0; !stop && attempted < limit; round++) {
    await discover(1, 2);
    const queue = JSON.parse(await readFile("archive/queue.json", "utf8")) as {
      documents: { url: string }[];
    };
    const pending = queue.documents
      .filter(({ url }) => {
        const doc = byKey.get(urlKey(url));
        if (doc && isRecovered(doc)) return false;
        if (
          !finalRetry &&
          doc?.source === "origin" &&
          doc.outcome === "missing"
        )
          return false;
        return (tries.get(urlKey(url)) ?? 0) < maxAttempts;
      })
      .slice(0, limit - attempted);
    total = pending.length;
    completed = 0;
    if (!total) break;
    console.log(`Round ${round + 1}: ${total} resources to check.`);
    progress();
    if (values["dry-run"]) break;
    for (
      let offset = 0;
      offset < pending.length && !stop;
      offset += batchSize
    ) {
      const jobs: Promise<void>[] = [];
      for (const { url } of pending.slice(offset, offset + batchSize)) {
        if (stop) break;
        tries.set(urlKey(url), (tries.get(urlKey(url)) ?? 0) + 1);
        jobs.push(download(url));
        await sleep(2000);
      }
      const results = await Promise.allSettled(jobs);
      const failed = results.find((r) => r.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      progress();
      if (!stop && offset + batchSize < pending.length) await sleep(30000);
    }
  }
  await saving;
  await coverage();
  for (const doc of manifest.documents.filter(isRecovered))
    if (!(await verifyDocument(doc)))
      throw new Error(`Final hash/size mismatch: ${doc.url}`);
  await writeJson("archive/origin-run.json", {
    startedAt,
    endedAt: new Date().toISOString(),
    attempted,
    recovered,
    stopped: stop,
    blocked,
    failures: manifest.documents.filter((d) => d.outcome === "failed attempt")
      .length,
  });
  progress();
  console.log(
    `Saved and verified. ${recovered} recovered this run. See archive/origin-run.json and archive/coverage.md. ${stop ? "Interrupted: run the same command to resume." : "Run finished."}`,
  );
} finally {
  clearInterval(timer);
  await unlink(lock);
}
