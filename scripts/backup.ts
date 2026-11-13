import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  isRecovered,
  readManifest,
  safePath,
  verifyDocument,
} from "./recovery/core.ts";

const { values } = parseArgs({
  options: { destination: { type: "string" }, r2: { type: "boolean" } },
});
if (values.r2)
  throw new Error(
    "R2 backup is paused until a selective upload policy is agreed",
  );
const manifest = await readManifest();
const documents = manifest.documents.filter(isRecovered);
if (!documents.length)
  throw new Error("No recovered files: an empty backup proves no preservation");
for (const d of documents)
  if (!(await verifyDocument(d)))
    throw new Error(`Original not intact: ${d.url}`);
const base = values.destination ?? process.env.BACKUP_DESTINATION ?? "backup";
const dest = path.resolve(
  base,
  `utopia-ucronia-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`,
);
if (dest.startsWith(`${path.resolve("archive")}${path.sep}`))
  throw new Error("The backup must be outside the archive");
await mkdir(dest, { recursive: true });
for (const d of documents) {
  const target = safePath(path.join(dest, "original"), d.path ?? "");
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(
    safePath("archive/original", d.path ?? ""),
    target,
    constants.COPYFILE_EXCL,
  );
  if (!(await verifyDocument(d, dest)))
    throw new Error(`Copy not intact: ${d.path}`);
}
await copyFile(
  "archive/manifest.json",
  path.join(dest, "manifest.json"),
  constants.COPYFILE_EXCL,
);
console.log(
  `Backup verified (${documents.length} files): ${dest}\nCopy this folder to your drive. As long as it stays here it is not an independent copy.`,
);
