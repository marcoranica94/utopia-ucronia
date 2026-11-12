import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { downloadArchiveFromR2 } from "./r2.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  verifyDocument,
  writeJson,
} from "./recovery/core.ts";

const { values } = parseArgs({
  options: {
    from: { type: "string" },
    r2: { type: "boolean" },
    offline: { type: "boolean" },
  },
});
if (Boolean(values.from) === Boolean(values.r2))
  throw new Error("Give exactly one source: --from /path/to/backup or --r2");
const temp = await mkdtemp(path.join(os.tmpdir(), "utopia-ucronia-restore-"));
const checkout = path.join(temp, "project");
function run(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
  });
  if (r.status !== 0)
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
}
try {
  const source = values.r2
    ? path.join(temp, "backup-r2")
    : path.resolve(values.from ?? "");
  if (values.r2) await downloadArchiveFromR2(source);
  const manifest = await readManifest(source);
  const documents = manifest.documents.filter(isRecovered);
  if (!documents.length)
    throw new Error("An empty archive does not prove a restore");
  run(
    "git",
    ["clone", "--no-hardlinks", path.resolve("."), checkout],
    path.resolve("."),
  );
  // Rebuild the archive only from the selected copy.
  await rm(path.join(checkout, "archive"), { recursive: true, force: true });
  for (const d of documents) {
    if (!(await verifyDocument(d, source)))
      throw new Error(`Backup not intact: ${d.url}`);
    const dest = safePath(
      path.join(checkout, "archive/original"),
      d.path ?? "",
    );
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(safePath(path.join(source, "original"), d.path ?? ""), dest);
  }
  await copyFile(
    path.join(source, "manifest.json"),
    path.join(checkout, "archive/manifest.json"),
  );
  run(
    "pnpm",
    ["install", "--frozen-lockfile", ...(values.offline ? ["--offline"] : [])],
    checkout,
  );
  run("pnpm", ["recovery", "verify"], checkout);
  run("pnpm", ["build"], checkout);
  await writeJson(`reports/restore-${Date.now()}.json`, {
    date: new Date().toISOString(),
    source: values.r2 ? "R2:utopia-ucronia-archivio" : source,
    files: documents.length,
    cleanClone: true,
    hashes: "ok",
    build: "ok",
  });
  console.log(
    `Restore succeeded: ${documents.length} files, clean clone, dependencies reinstalled and build verified.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
