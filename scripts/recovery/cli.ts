import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import type { ArchiveDocument } from "./core.ts";
import {
  captures,
  isRecovered,
  originalPath,
  prepareData,
  readManifest,
  request,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
  writeJson,
} from "./core.ts";
import { coverage } from "./coverage.ts";
import { discover } from "./discover.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    only: { type: "string" },
    batch: { type: "string", default: "10" },
    pause: { type: "string", default: "30" },
    delay: { type: "string", default: "2" },
    concurrency: { type: "string", default: "1" },
    "max-batches": { type: "string" },
    "max-pages": { type: "string" },
  },
});
const manifest = await readManifest();
if (positionals[0] === "discover") {
  await discover(
    values["max-pages"] ? Number(values["max-pages"]) : Infinity,
    Number(values.delay),
  );
} else if (positionals[0] === "coverage") {
  await coverage();
} else if (positionals[0] === "verify") {
  const recovered = manifest.documents.filter(isRecovered);
  for (const d of recovered)
    if (!(await verifyDocument(d)))
      throw new Error(`Wrong hash or size: ${d.url}`);
  console.log(
    `${recovered.length} files verified; ${manifest.documents.length - recovered.length} URLs not recovered`,
  );
} else if (positionals[0] === "download") {
  const selection = JSON.parse(
    await readFile(values.only ?? "archive/queue.json", "utf8"),
  ) as {
    documents: {
      url: string;
      variants?: string[];
      captures?: { url: string; timestamp: string; type: string }[];
    }[];
    complete?: boolean;
  };
  if (!values.only && !selection.complete)
    throw new Error(
      "Discovery is incomplete; finish it before downloading the full queue",
    );
  const batch = Number(values.batch),
    delay = Number(values.delay),
    batchPause = Number(values.pause),
    concurrency = Number(values.concurrency);
  const maxBatches = values["max-batches"]
    ? Number(values["max-batches"])
    : Infinity;
  if (
    ![batch, delay, batchPause].every(Number.isFinite) ||
    !Number.isInteger(batch) ||
    batch < 1 ||
    batch > 30 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 10 ||
    delay < 2 ||
    batchPause < 30 ||
    maxBatches < 1
  )
    throw new Error(
      "Limits: batch 1–30, concurrency 1–10, delay ≥ 2 s, pause ≥ 30 s",
    );
  let stop = false,
    done = 0;
  process.on("SIGINT", () => {
    stop = true;
    console.log("Finishing the current save before stopping.");
  });
  const seen = new Set<string>();
  let save = Promise.resolve();
  const downloadOne = async (
    item: (typeof selection.documents)[number],
    existing: ArchiveDocument | undefined,
  ) => {
    const { url } = item;
    const document: ArchiveDocument = {
      url,
      variants: [...new Set([...(existing?.variants ?? []), url])],
      outcome: "failed attempt",
    };
    try {
      const indexed = (item.captures ?? []).map((c) => ({
        timestamp: c.timestamp,
        original: c.url,
        mimetype: c.type,
      }));
      const available = await captures(url);
      for (const c of indexed)
        if (
          !available.some(
            (v) => v.timestamp === c.timestamp && v.original === c.original,
          )
        )
          available.push(c);
      available.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      await sleep(delay * 1000);
      let transient = false;
      // Most recent capture that only passes the lenient check: used when no
      // capture is clean, so an incomplete original is kept rather than lost.
      let fallback:
        | {
            i: number;
            c: (typeof available)[number];
            type: string;
            prepared: ReturnType<typeof prepareData>;
          }
        | undefined;
      const store = async (
        i: number,
        c: (typeof available)[number],
        type: string,
        { data, compressed, defects }: ReturnType<typeof prepareData>,
      ) => {
        const relative = originalPath(url),
          dest = safePath("archive/original", relative);
        await mkdir(path.dirname(dest), { recursive: true });
        try {
          await writeFile(dest, data, { flag: "wx" });
        } catch (error) {
          if (
            (error as NodeJS.ErrnoException).code !== "EEXIST" ||
            sha256(await readFile(dest)) !== sha256(data)
          )
            throw error;
        }
        Object.assign(document, {
          outcome: i ? "recovered from earlier copy" : "recovered",
          path: relative,
          timestamp: c.timestamp,
          httpStatus: 200,
          type,
          size: data.length,
          sha256: sha256(data),
          compressed,
          defects: defects.length ? defects : undefined,
        });
        delete document.error;
      };
      for (let i = 0; i < available.length && !stop; i++) {
        const c = available[i];
        document.variants = [...new Set([...document.variants, c.original])];
        try {
          const r = await request(
            `https://web.archive.org/web/${c.timestamp}id_/${c.original}`,
          );
          if (r.status === 404 || r.status === 410) continue;
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const type = r.headers.get("content-type") ?? c.mimetype;
          const bytes = new Uint8Array(await r.arrayBuffer());
          let prepared: ReturnType<typeof prepareData>;
          try {
            prepared = prepareData(bytes, c.original, type);
          } catch (error) {
            if (!fallback)
              try {
                fallback = {
                  i,
                  c,
                  type,
                  prepared: prepareData(bytes, c.original, type, {
                    lenient: true,
                  }),
                };
              } catch {
                /* not even a damaged original: discard */
              }
            throw error;
          }
          await store(i, c, type, prepared);
          break;
        } catch (error) {
          document.error = String(error);
          if (/HTTP|fetch|timeout|network|Redirect/i.test(String(error)))
            transient = true;
        } finally {
          await sleep(delay * 1000);
        }
      }
      if (!document.sha256 && fallback && !transient && !stop)
        await store(fallback.i, fallback.c, fallback.type, fallback.prepared);
      if (!document.sha256)
        document.outcome = transient || stop ? "failed attempt" : "missing";
    } catch (error) {
      document.error = String(error);
    }
    save = save.then(async () => {
      const index = manifest.documents.findIndex(
        (d) => urlKey(d.url) === urlKey(url),
      );
      if (index < 0) manifest.documents.push(document);
      else manifest.documents[index] = document;
      await writeJson("archive/manifest.json", manifest);
      const line = `${new Date().toISOString()} ${document.outcome}: ${url}`;
      await appendFile("archive/download.log", `${line}\n`);
      console.log(line);
    });
    await save;
  };
  let active: Promise<void>[] = [];
  const finish = async () => {
    const results = await Promise.allSettled(active);
    active = [];
    const failure = results.find((r) => r.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  };
  try {
    for (const item of selection.documents) {
      const { url } = item;
      if (stop || done >= batch * maxBatches) break;
      const key = urlKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = manifest.documents.find((d) => urlKey(d.url) === key);
      if (!values.only && existing?.outcome === "missing") continue;
      if (existing && (await verifyDocument(existing))) continue;
      if (existing?.sha256 && isRecovered(existing))
        throw new Error(
          `Original altered or missing: ${url}. Restore it from the backup, without overwriting it.`,
        );
      if (active.length) await sleep(delay * 1000);
      if (stop) break;
      active.push(downloadOne(item, existing));
      done++;
      if (active.length >= concurrency || done % batch === 0) await finish();
      if (done % batch === 0 && !stop && done < batch * maxBatches)
        await sleep(batchPause * 1000);
    }
  } finally {
    await finish();
  }
} else
  throw new Error(
    "Commands: download --only data/sample.json | verify | discover [--max-pages N]. coverage and probe are planned for S1.",
  );
