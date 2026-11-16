import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Rebuilds simple HTML from a PDF's text layer, so that PDFs go through the
 * same anatomy and conversion as the pages. Line positions and sizes decide
 * the structure: larger lines are headings, a wider gap or an indent opens a
 * paragraph, bare page numbers are dropped. unpdf is loaded on demand:
 * without it the PDF stays an archive attachment.
 */
type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};
type PdfPage = {
  getTextContent(): Promise<{ items: (TextItem | { type: string })[] }>;
};
type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  getMetadata(): Promise<unknown>;
};
type PdfLibrary = {
  getDocumentProxy(data: Uint8Array): Promise<PdfDocument>;
  extractImages(
    pdf: PdfDocument,
    page: number,
  ): Promise<
    {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      channels: 1 | 3 | 4;
      key: string;
    }[]
  >;
  extractText(
    pdf: PdfDocument,
    options: { mergePages: false },
  ): Promise<{ text: string[]; totalPages: number }>;
};
type Line = { text: string; x: number; y: number; size: number; page: number };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
};

export async function pdfLines(pdf: PdfDocument): Promise<Line[]> {
  const lines: Line[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { items } = await page.getTextContent();
    let current: Line | undefined;
    let lastEnd = 0;
    for (const raw of items) {
      if (!("str" in raw)) continue;
      const item = raw as TextItem;
      const [, , , , x, y] = item.transform;
      const size = Math.abs(item.transform[3]) || item.height;
      const sameLine =
        current &&
        Math.abs(current.y - y) <= Math.max(size, current.size) * 0.5;
      if (!current || !sameLine) {
        if (current?.text.trim()) lines.push(current);
        current = { text: "", x, y, size, page: n };
        lastEnd = x;
      }
      // A visible gap between two items on the same line is a space.
      if (
        current.text &&
        x - lastEnd > size * 0.15 &&
        !current.text.endsWith(" ")
      )
        current.text += " ";
      current.text += item.str;
      current.size = Math.max(current.size, size);
      lastEnd = x + item.width;
      if (item.hasEOL) {
        if (current.text.trim()) lines.push(current);
        current = undefined;
      }
    }
    if (current?.text.trim()) lines.push(current);
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text && !(/^\d{1,3}$/.test(l.text) && l.y < 40));
}

export function linesToHtml(
  lines: Line[],
  metadataTitle?: string,
  images: PdfImage[] = [],
): string {
  // A narrow year column can wrap a range onto two text-layer lines.
  lines = lines.flatMap((line, index) => {
    const previous = lines[index - 1];
    if (
      previous &&
      /^\d{3,4}\s*[-–]\s*$/.test(previous.text) &&
      /^\d{3,4}\b/.test(line.text) &&
      previous.page === line.page
    )
      return [];
    const next = lines[index + 1];
    if (
      next &&
      /^\d{3,4}\s*[-–]\s*$/.test(line.text) &&
      /^\d{3,4}\b/.test(next.text) &&
      next.page === line.page
    )
      return [{ ...line, text: line.text.trimEnd() + next.text }];
    return [line];
  });
  const body = median(lines.map((l) => Math.round(l.size * 10) / 10));
  const left = median(lines.map((l) => Math.round(l.x)));
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++)
    if (lines[i].page === lines[i - 1].page)
      gaps.push(Math.round(lines[i - 1].y - lines[i].y));
  const spacing = median(gaps.filter((g) => g > 0)) || body * 1.2;
  type Block = {
    tag: "h2" | "h3" | "p";
    text: string;
    lines: number;
    page: number;
  };
  const blocks: Block[] = [];
  let open: Block | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = lines[i - 1];
    const heading = line.size >= body * 1.18;
    const tag = heading ? "h2" : "p";
    const gap = prev && prev.page === line.page ? prev.y - line.y : spacing;
    const startsNew =
      !open ||
      open.tag !== tag ||
      open.page !== line.page ||
      gap > spacing * 1.45 ||
      (!heading && line.x > left + body * 1.2) ||
      /^[•▪●\-–]\s/.test(line.text) ||
      // Timeline lines open with a year.
      (/^\d{3,4}\b/.test(line.text) && !heading);
    if (startsNew) {
      open = { tag, text: line.text, lines: 1, page: line.page };
      blocks.push(open);
    } else if (open) {
      open.lines++;
      // A hyphen at the end of a line joins a word split across lines.
      open.text =
        /[a-zà-ú]-$/i.test(open.text) && /^[a-zà-ú]/.test(line.text)
          ? open.text.slice(0, -1) + line.text
          : `${open.text} ${line.text}`;
    }
  }
  // A short line standing alone without final punctuation is a subheading,
  // even when the PDF sets it at body size (bold is not in the text layer).
  for (const [i, b] of blocks.entries())
    if (
      b.tag === "p" &&
      b.lines === 1 &&
      b.text.length < 90 &&
      !/[.;,:!?»”"]$/.test(b.text) &&
      !/^[•▪●\-–]/.test(b.text) &&
      !/^\d{3,4}\b/.test(b.text) &&
      blocks[i + 1]?.tag === "p"
    )
      b.tag = "h3";
  const title =
    metadataTitle?.trim() ||
    blocks.find((b) => b.tag === "h2")?.text ||
    blocks[0]?.text.split(" ").slice(0, 12).join(" ") ||
    "Documento PDF";
  return `<html><head><title>${escapeHtml(title)}</title></head><body>${blocks
    .map(
      (b, i) =>
        `${
          i === 0 || blocks[i - 1].page !== b.page
            ? images
                .filter((image) => image.page === b.page)
                .map(
                  (image) =>
                    `<p><img src="#${image.id}" alt="@pdf.image.${image.page}" width="${Math.min(image.width, 480)}" height="${Math.round(image.height * Math.min(1, 480 / image.width))}"></p>`,
                )
                .join("\n")
            : ""
        }<${b.tag}>${escapeHtml(b.text)}</${b.tag}>`,
    )
    .join("\n")}</body></html>`;
}

export type PdfImage = {
  id: string;
  page: number;
  bytes: Buffer;
  width: number;
  height: number;
};
export type PdfEdition = {
  html: string;
  images: PdfImage[];
  pages: number;
  rawText: string[];
};
const cache = new Map<string, Promise<PdfEdition | undefined>>();

/** Text-layer edition; illustrations precede the text on their original page.
 * This is deliberately a reading edition, not a reproduction of PDF geometry.
 */
export function pdfEdition(data: Buffer): Promise<PdfEdition | undefined> {
  const key = createHash("sha256").update(data).digest("hex");
  const existing = cache.get(key);
  if (existing) return existing;
  const result = extractEdition(data);
  cache.set(key, result);
  return result;
}
async function extractEdition(data: Buffer): Promise<PdfEdition | undefined> {
  let lib: PdfLibrary;
  try {
    const name = "unpdf";
    lib = (await import(name)) as PdfLibrary;
  } catch {
    return undefined;
  }
  const pdf = await lib.getDocumentProxy(new Uint8Array(data));
  const { info } = (await pdf.getMetadata()) as { info?: { Title?: string } };
  const meta =
    info?.Title &&
    !/^(documento|document|microsoft|untitled)\b|\.docx?$/i.test(info.Title)
      ? info.Title
      : undefined;
  const images: PdfImage[] = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const extracted = await lib.extractImages(pdf, page);
    for (const [index, image] of extracted.entries()) {
      const bytes = await sharp(Buffer.from(image.data), {
        raw: {
          width: image.width,
          height: image.height,
          channels: image.channels,
        },
      })
        .png()
        .toBuffer();
      images.push({
        id: `pdf-image-${page}-${index + 1}`,
        page,
        bytes,
        width: image.width,
        height: image.height,
      });
    }
  }
  const raw = await lib.extractText(pdf, { mergePages: false });
  return {
    html: linesToHtml(await pdfLines(pdf), meta, images),
    images,
    pages: pdf.numPages,
    rawText: raw.text,
  };
}
export async function pdfToHtml(data: Buffer): Promise<string | undefined> {
  return (await pdfEdition(data))?.html;
}
