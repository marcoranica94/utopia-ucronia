import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { EditorialMap, EditorialSource } from "../src/editorial/model.ts";
import { safePath, sha256 } from "./recovery/core.ts";
import { type ZipEntry, zipEntries, zipRead } from "./zip.ts";

/**
 * The bytes behind a reading source (S7): the archive file itself, or one
 * file inside a zip document. The zip is verified against its hash first;
 * the entry is found by its exact name and read in memory only.
 */
export type SourceFile = {
  kind: "html" | "pdf" | "doc";
  bytes: Buffer;
  /** For an entry: the other files of its zip (illustrations). */
  siblings?: { entry: ZipEntry; bytes: () => Buffer }[];
};

const kindOf = (name: string, mediaType = "") =>
  /\.pdf$/i.test(name) || mediaType.includes("pdf")
    ? "pdf"
    : /\.doc$/i.test(name)
      ? "doc"
      : "html";

export async function sourceFile(
  source: Pick<EditorialSource, "documentId" | "entry">,
  map: Pick<EditorialMap, "documents">,
  archiveRoot = "archive/original",
): Promise<SourceFile> {
  const document = map.documents.find((d) => d.id === source.documentId);
  if (!document) throw new Error(`Unknown source: ${source.documentId}`);
  const raw = await readFile(safePath(archiveRoot, document.path));
  if (sha256(raw) !== document.sha256)
    throw new Error(`Original changed: ${document.path}`);
  if (!source.entry)
    return { kind: kindOf(document.path, document.mediaType), bytes: raw };
  const entries = zipEntries(raw);
  const entry = entries.find((e) => e.name === source.entry);
  if (!entry)
    throw new Error(`Missing zip entry: ${document.path} :: ${source.entry}`);
  return {
    kind: kindOf(entry.name),
    bytes: zipRead(raw, entry),
    siblings: entries
      .filter((e) => e !== entry && !e.directory)
      .map((e) => ({ entry: e, bytes: () => zipRead(raw, e) })),
  };
}

/** A short stable prefix that keeps image ids of different entries of one
 * zip apart ("#pdf-image-1-1" exists in each of its PDFs). */
export const entryPrefix = (entry: string) =>
  `z${createHash("sha256").update(entry).digest("hex").slice(0, 8)}-`;

export type Illustration = {
  id: string;
  bytes: Buffer;
  ext: "png" | "jpg" | "gif";
  width: number;
  height: number;
};
export type AttachmentEdition = {
  html: string;
  illustrations: Illustration[];
  /** The PDF's raw text layer, for the independent fidelity check. */
  rawText?: string[];
};

/** Reading HTML and illustrations of a PDF or Word source, loose or inside
 * a zip. Images of an entry take a prefix unique to the entry; the image
 * files beside a PDF in its zip (the maps of a chronology) follow its text,
 * with the same size rule as PDF illustrations. */
export async function attachmentEdition(
  source: Pick<EditorialSource, "documentId" | "entry">,
  map: Pick<EditorialMap, "documents">,
  archiveRoot = "archive/original",
): Promise<AttachmentEdition | undefined> {
  const file = await sourceFile(source, map, archiveRoot);
  if (file.kind === "html") return undefined;
  const { pdfEdition, MIN_ILLUSTRATION } = await import("./pdf.ts");
  let html: string;
  let illustrations: Illustration[] = [];
  let rawText: string[] | undefined;
  if (file.kind === "pdf") {
    const edition = await pdfEdition(file.bytes);
    if (!edition) throw new Error("Required PDF converter unavailable");
    html = edition.html;
    rawText = edition.rawText;
    illustrations = edition.images.map((image) => ({
      id: image.id,
      bytes: image.bytes,
      ext: "png",
      width: image.width,
      height: image.height,
    }));
  } else {
    const { docToHtml } = await import("./doc.ts");
    html = await docToHtml(
      file.bytes,
      (source.entry ?? "")
        .replace(/\.doc$/i, "")
        .split("/")
        .pop() ?? "",
    );
  }
  if (!source.entry) return { html, illustrations, rawText };
  const prefix = entryPrefix(source.entry);
  html = html.replaceAll('src="#pdf-image-', `src="#${prefix}pdf-image-`);
  illustrations = illustrations.map((i) => ({ ...i, id: `${prefix}${i.id}` }));
  if (file.kind === "pdf") {
    const sharp = (await import("sharp")).default;
    const figures: string[] = [];
    for (const [n, sibling] of (file.siblings ?? [])
      .filter((s) => /\.(?:jpe?g|png|gif)$/i.test(s.entry.name))
      .sort((a, b) =>
        a.entry.name.localeCompare(b.entry.name, "it", { numeric: true }),
      )
      .entries()) {
      const bytes = sibling.bytes();
      const { width = 0, height = 0 } = await sharp(bytes).metadata();
      if (Math.min(width, height) < MIN_ILLUSTRATION) continue;
      const ext = /\.png$/i.test(sibling.entry.name)
        ? "png"
        : /\.gif$/i.test(sibling.entry.name)
          ? "gif"
          : "jpg";
      const id = `${prefix}zip-image-${n + 1}`;
      illustrations.push({ id, bytes, ext, width, height });
      figures.push(
        `<p><img src="#${id}" alt="@source.image" width="${Math.min(width, 480)}" height="${Math.round(height * Math.min(1, 480 / width))}"></p>`,
      );
    }
    if (figures.length)
      html = html.replace("</body>", `${figures.join("\n")}</body>`);
  }
  return { html, illustrations, rawText };
}
