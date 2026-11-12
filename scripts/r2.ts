import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  isRecovered,
  readManifest,
  safePath,
  verifyDocument,
} from "./recovery/core.ts";

export type ReadObject = (key: string, file: string) => Promise<void>;
const readRemote: ReadObject = async (key, file) => {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error("Missing Cloudflare credentials: no R2 download performed");
  const r = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "r2",
      "object",
      "get",
      `utopia-ucronia-archivio/${key}`,
      "--file",
      file,
      "--remote",
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`R2 download failed: ${key}`);
};

export async function downloadArchiveFromR2(
  destination: string,
  read: ReadObject = readRemote,
): Promise<void> {
  // The destination must be new: never overwrite an archive or an earlier copy.
  await mkdir(destination, { recursive: false });
  await read("manifest.json", path.join(destination, "manifest.json"));
  const manifest = await readManifest(destination);
  const documents = manifest.documents.filter(isRecovered);
  if (!documents.length)
    throw new Error("The R2 manifest contains no recovered files");
  for (const d of documents) {
    if (!d.path || !d.sha256 || d.size === undefined)
      throw new Error("Incomplete R2 metadata");
    const target = safePath(path.join(destination, "original"), d.path);
    await mkdir(path.dirname(target), { recursive: true });
    await read(`original/${d.path}`, target);
    if (!(await verifyDocument(d, destination)))
      throw new Error(`R2 object not intact: ${d.path}`);
  }
}
