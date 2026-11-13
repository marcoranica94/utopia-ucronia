import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { gunzipSync } from "node:zlib";
import { z } from "zod";

export const documentSchema = z.object({
  url: z.url(),
  variants: z.array(z.url()),
  outcome: z.enum([
    "recovered",
    "recovered from earlier copy",
    "failed attempt",
    "missing",
  ]),
  path: z.string().optional(),
  timestamp: z
    .string()
    .regex(/^\d{14}$/)
    .optional(),
  httpStatus: z.number().optional(),
  type: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  compressed: z.boolean().optional(),
  error: z.string().optional(),
  source: z.enum(["wayback", "origin"]).optional(),
  retrievedAt: z.iso.datetime().optional(),
  fetchedFrom: z.url().optional(),
  lastModified: z.string().optional(),
  defects: z.array(z.string()).optional(),
});
export const manifestSchema = z.object({
  version: z.literal(1),
  documents: z.array(documentSchema),
});
export type ArchiveDocument = z.infer<typeof documentSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Capture = { timestamp: string; original: string; mimetype: string };
export const userAgent =
  "UtopiaUcroniaArchive/0.1 (personal archive; recovery from Internet Archive)";
export const sha256 = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

export const isRecovered = (d: ArchiveDocument) =>
  d.outcome.startsWith("recovered");

export function urlKey(url: string): string {
  const u = new URL(url);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !["www.fmboschetto.it", "fmboschetto.it"].includes(u.hostname)
  )
    throw new Error(`Origin not allowed: ${url}`);
  if (u.search) throw new Error(`Query not supported: ${url}`);
  return decodeURIComponent(u.pathname).toLowerCase();
}
export function originalPath(url: string): string {
  const p = urlKey(url);
  if (!p.startsWith("/utopiaucronia/") && !p.startsWith("/racconti/"))
    throw new Error(`Path outside the archive: ${p}`);
  if (
    p.includes("\\") ||
    p.includes("\0") ||
    p.split("/").some((v) => v === ".." || v === ".")
  )
    throw new Error("Unsafe path");
  return p.slice(1) + (p.endsWith("/") ? "index.htm" : "");
}
export function safePath(root: string, relative: string): string {
  const dest = path.resolve(root, relative);
  if (!dest.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error(`Unsafe path: ${relative}`);
  return dest;
}
export async function readManifest(root = "archive"): Promise<Manifest> {
  return manifestSchema.parse(
    JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")),
  );
}
export async function writeJson(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${file}.tmp`, file);
}
export async function verifyDocument(
  d: ArchiveDocument,
  root = "archive",
): Promise<boolean> {
  if (!d.path || !d.sha256 || !isRecovered(d)) return false;
  try {
    const data = await readFile(safePath(path.join(root, "original"), d.path));
    return sha256(data) === d.sha256 && data.length === d.size;
  } catch {
    return false;
  }
}
const imageFormats: [string, (d: Buffer) => boolean][] = [
  ["JPEG", (d) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff],
  [
    "PNG",
    (d) =>
      d.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  ],
  ["GIF", (d) => /^GIF8[79]a/.test(d.subarray(0, 6).toString("latin1"))],
  ["BMP", (d) => d[0] === 0x42 && d[1] === 0x4d],
];
const expectedImage: Record<string, string> = {
  ".jpg": "JPEG",
  ".jpeg": "JPEG",
  ".png": "PNG",
  ".gif": "GIF",
};
/**
 * Checks a downloaded file. Strict mode rejects anything incomplete or
 * mismatched, so that an earlier, clean capture is preferred. Lenient mode is
 * for when no clean copy exists: it still rejects error pages and files of the
 * wrong kind, but accepts the file as the server holds it and lists its
 * defects, so the archive keeps it with an honest note.
 */
export function prepareData(
  input: Uint8Array,
  url: string,
  type: string,
  { lenient = false }: { lenient?: boolean } = {},
): { data: Buffer; compressed: boolean; defects: string[] } {
  const compressed = input[0] === 0x1f && input[1] === 0x8b;
  const data = compressed ? gunzipSync(input) : Buffer.from(input);
  if (!data.length) throw new Error("Empty file");
  const text = data.toString("latin1");
  if (
    /bot blocked|AW Special Error|HTTP Error \d|IIS.*Detailed Error/i.test(
      text.slice(0, 15000),
    )
  )
    throw new Error("Archived error page");
  const defects: string[] = [];
  const defect = (message: string) => {
    if (!lenient) throw new Error(message);
    defects.push(message);
  };
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (ext === ".pdf") {
    if (!text.startsWith("%PDF-")) throw new Error("Invalid PDF");
    if (!text.slice(-2048).includes("%%EOF"))
      defect("Truncated PDF: no %%EOF marker");
  }
  if ([".htm", ".html", ""].includes(ext)) {
    if (!/<(?:html|head|title|frameset|body)[\s>]/i.test(text.slice(0, 4000)))
      throw new Error("Invalid HTML");
    if (!/text\/html|application\/xhtml/i.test(type))
      defect(`HTML served as ${type || "no content type"}`);
    if (!/<(?:html|frameset|body)[\s>]/i.test(text))
      defect("HTML without <html>, <body> or <frameset>");
    if (!/<\/(?:html|frameset|body)\s*>/i.test(text))
      defect(
        "HTML without closing </html>, </body> or </frameset> (content may still be complete)",
      );
  }
  const expected = expectedImage[ext];
  if (expected) {
    const found = imageFormats.find(([, test]) => test(data))?.[0];
    if (!found) throw new Error(`Invalid ${expected}: not an image`);
    if (found !== expected) defect(`${found} data with ${ext} extension`);
    if (found === "JPEG") {
      const end = data.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (end < 0) defect("Truncated JPEG: no end marker");
      else if (end !== data.length - 2)
        defect(
          `Truncated JPEG or ${data.length - end - 2} bytes after the end marker`,
        );
    }
  }
  return { data, compressed, defects };
}
export function retryDelay(
  header: string | null,
  attempt: number,
  now = Date.now(),
): number {
  const ms =
    header && /^\d+$/.test(header)
      ? Number(header) * 1000
      : header
        ? Date.parse(header) - now
        : NaN;
  return Math.min(
    600000,
    Math.max(0, Number.isFinite(ms) ? ms : 2000 * 2 ** attempt),
  );
}
export async function request(url: string): Promise<Response> {
  if (new URL(url).hostname !== "web.archive.org")
    throw new Error("Recovery only allows web.archive.org");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": userAgent },
        redirect: "manual",
        signal: AbortSignal.timeout(45000),
      });
      if (r.status >= 300 && r.status < 400)
        throw new Error(`Redirect not followed: ${r.headers.get("location")}`);
      if (r.status !== 429 && r.status < 500) return r;
      if (attempt === 2)
        throw new Error(`HTTP ${r.status} after three attempts`);
      const ms = retryDelay(r.headers.get("retry-after"), attempt);
      await r.body?.cancel();
      console.log(`HTTP ${r.status}; waiting ${Math.round(ms / 1000)} s`);
      await sleep(ms);
    } catch (error) {
      if (attempt === 2) throw error;
      await sleep(retryDelay(null, attempt));
    }
  }
  throw new Error("Attempts exhausted");
}
export async function captures(url: string): Promise<Capture[]> {
  originalPath(url);
  const query = new URLSearchParams({
    url,
    output: "json",
    fl: "timestamp,original,mimetype",
    filter: "statuscode:200",
  });
  const r = await request(`https://web.archive.org/cdx/search/cdx?${query}`);
  if (!r.ok) throw new Error(`CDX HTTP ${r.status}`);
  const rows = (await r.json()) as string[][];
  return rows
    .slice(1)
    .map(([timestamp, original, mimetype]) => ({
      timestamp,
      original,
      mimetype,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
