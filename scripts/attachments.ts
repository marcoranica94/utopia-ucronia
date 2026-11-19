import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  isRecovered,
  readManifest,
  safePath,
  urlKey,
  writeJson,
} from "./recovery/core.ts";
import { zipEntries, zipRead } from "./zip.ts";

/**
 * S7 attachments: `pnpm attachments inventory` describes every recovered PDF
 * and zip without changing anything: for a PDF its pages, text layer, images
 * and title; for a zip its files and formats; for both the pages that link to
 * them. Output: reports/attachments-inventory.json and a short summary.
 */

const { positionals } = parseArgs({
  allowPositionals: true,
  options: { zips: { type: "boolean" } },
  strict: false,
});
const command = positionals[0] ?? "inventory";
if (command === "ocr") {
  await import("./attachments-ocr.ts");
  process.exit(0);
}
if (command === "coverage") {
  await import("./attachments-coverage.ts");
  process.exit(0);
}
if (command === "propose") {
  await import("./attachments-propose.ts");
  process.exit(0);
}
if (command !== "inventory") throw new Error(`Unknown command: ${command}`);

const { documents } = await readManifest();
const recovered = documents.filter(isRecovered).filter((d) => d.path);
const ext = (p: string) => (/\.([a-z0-9]+)$/i.exec(p)?.[1] ?? "").toLowerCase();
const attachments = recovered.filter((d) =>
  ["pdf", "zip"].includes(ext(d.path ?? "")),
);
const byKey = new Map(attachments.map((d) => [urlKey(d.url), d]));

// Pages linking to each attachment, resolved like IIS did (case-insensitive).
const referrers = new Map<string, Set<string>>();
for (const page of recovered.filter((d) => /^html?$/.test(ext(d.path ?? "")))) {
  const html = (
    await readFile(safePath("archive/original", page.path ?? ""))
  ).toString("latin1");
  for (const match of html.matchAll(
    /\b(?:href|src)\s*=\s*["']?([^"'\s>]+\.(?:pdf|zip))\b/gi,
  )) {
    let target: string;
    try {
      target = urlKey(new URL(match[1], page.url).href);
    } catch {
      continue;
    }
    if (!byKey.has(target)) continue;
    if (!referrers.has(target)) referrers.set(target, new Set());
    referrers.get(target)?.add(page.path ?? "");
  }
}

type Lib = {
  getDocumentProxy(data: Uint8Array): Promise<{
    numPages: number;
    getMetadata(): Promise<{ info?: { Title?: string; Producer?: string } }>;
  }>;
  extractText(
    pdf: unknown,
    options: { mergePages: false },
  ): Promise<{ text: string[] }>;
  extractImages(
    pdf: unknown,
    page: number,
  ): Promise<{ data: Uint8ClampedArray; width: number; height: number }[]>;
};
const lib = (await import("unpdf")) as unknown as Lib;

// Illustrations: an image counts if both sides are at least MIN_SIDE pixels;
// identical images (same pixels) count once across the whole archive.
const MIN_SIDE = 64;
const uniqueImages = new Map<string, number>();
/** Pages, text layer and illustrations of one PDF (loose or inside a zip). */
async function describePdf(data: Uint8Array) {
  const pdf = await lib.getDocumentProxy(new Uint8Array(data));
  const { info } = await pdf.getMetadata();
  const { text } = await lib.extractText(pdf, { mergePages: false });
  const chars = text.map((t) => t.replace(/\s+/g, "").length);
  let images = 0;
  let illustrations = 0;
  const own = new Set<string>();
  for (let page = 1; page <= pdf.numPages; page++)
    for (const image of await lib.extractImages(pdf, page)) {
      images++;
      if (image.width < MIN_SIDE || image.height < MIN_SIDE) continue;
      illustrations++;
      const hash = createHash("sha256")
        .update(`${image.width}x${image.height}`)
        .update(image.data)
        .digest("hex");
      own.add(hash);
      uniqueImages.set(hash, Math.min(image.width, image.height));
    }
  const textPages = chars.filter((c) => c >= 40).length;
  return {
    pages: pdf.numPages,
    textChars: chars.reduce((a, b) => a + b, 0),
    textPages,
    images,
    illustrations,
    distinctIllustrations: own.size,
    kind:
      textPages === 0
        ? "scan"
        : textPages < pdf.numPages * 0.5
          ? "mixed"
          : "text",
    title: info?.Title?.trim() || undefined,
    producer: info?.Producer?.trim() || undefined,
    opening: text.join(" ").replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

type Described = Awaited<ReturnType<typeof describePdf>>;
const pdfs: ({ path: string; size: number; linkedFrom: string[] } & (
  | Described
  | { error: string }
))[] = [];
const zips: {
  path: string;
  size: number;
  linkedFrom: string[];
  error?: string;
  formats?: Record<string, number>;
  files?: ({ name: string; size: number } & (
    | Partial<Described>
    | { error: string }
  ))[];
}[] = [];
for (const d of attachments) {
  const path = d.path ?? "";
  const data = await readFile(safePath("archive/original", path));
  const linkedFrom = [...(referrers.get(urlKey(d.url)) ?? [])].sort();
  if (ext(path) === "pdf") {
    try {
      pdfs.push({
        path,
        size: d.size ?? 0,
        linkedFrom,
        ...(await describePdf(data)),
      });
    } catch (error) {
      pdfs.push({ path, size: d.size ?? 0, error: String(error), linkedFrom });
    }
    process.stdout.write(".");
    continue;
  }
  try {
    const entries = zipEntries(data).filter((e) => !e.directory);
    const formats: Record<string, number> = {};
    const files = [];
    for (const e of entries) {
      const x = ext(e.name) || "(none)";
      formats[x] = (formats[x] ?? 0) + 1;
      let detail = {};
      if (x === "pdf")
        try {
          detail = await describePdf(zipRead(data, e));
        } catch (error) {
          detail = { error: String(error) };
        }
      files.push({ name: e.name, size: e.size, ...detail });
    }
    zips.push({ path, size: d.size ?? 0, files, formats, linkedFrom });
  } catch (error) {
    zips.push({ path, size: d.size ?? 0, error: String(error), linkedFrom });
  }
  process.stdout.write(":");
}
process.stdout.write("\n");

const count = <T>(items: T[], key: (item: T) => string) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
const zipFormats: Record<string, number> = {};
for (const z of zips)
  for (const [k, v] of Object.entries(z.formats ?? {}))
    zipFormats[k] = (zipFormats[k] ?? 0) + v;
const zipPdfs = zips.flatMap((z) =>
  (z.files ?? []).filter((f) => /\.pdf$/i.test(f.name)),
);
const allPdfs = [...pdfs, ...zipPdfs];
const summary = {
  pdf: {
    loose: pdfs.length,
    insideZips: zipPdfs.length,
    byKind: count(allPdfs, (p) => ("kind" in p ? String(p.kind) : "error")),
    pages: allPdfs.reduce(
      (a, p) => a + ("pages" in p ? Number(p.pages) : 0),
      0,
    ),
    images: allPdfs.reduce(
      (a, p) => a + ("images" in p ? Number(p.images) : 0),
      0,
    ),
    distinctIllustrations: uniqueImages.size,
    illustrationsBySmallerSide: Object.fromEntries(
      [64, 100, 150, 200, 300].map((side) => [
        `>=${side}px`,
        [...uniqueImages.values()].filter((v) => v >= side).length,
      ]),
    ),
    unlinkedLoose: pdfs.filter((p) => !p.linkedFrom.length).length,
  },
  zip: {
    total: zips.length,
    errors: zips.filter((z) => z.error).length,
    files: zips.reduce((a, z) => a + (z.files?.length ?? 0), 0),
    formats: Object.fromEntries(
      Object.entries(zipFormats).sort(([, a], [, b]) => b - a),
    ),
    unlinked: zips.filter((z) => !z.linkedFrom.length).length,
  },
};
await writeJson("reports/attachments-inventory.json", {
  date: new Date().toISOString().slice(0, 10),
  summary,
  pdfs,
  zips,
});
console.log(JSON.stringify(summary, null, 2));
