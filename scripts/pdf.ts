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
    // Recently drawn items: fake bold may interleave its copies (A B A B).
    const recent: { str: string; x: number; y: number }[] = [];
    for (const raw of items) {
      if (!("str" in raw)) continue;
      const item = raw as TextItem;
      const [, , , , x, y] = item.transform;
      const size = Math.abs(item.transform[3]) || item.height;
      // Fake bold: the same glyphs drawn twice a hair apart ("CCiinnaa").
      const overprint =
        item.str.trim() &&
        recent.some(
          (r) =>
            r.str === item.str &&
            Math.abs(x - r.x) < size * 0.12 &&
            Math.abs(y - r.y) < size * 0.12,
        );
      recent.push({ str: item.str, x, y });
      if (recent.length > 8) recent.shift();
      if (overprint) continue;
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
  const cleaned = lines
    .map((l) => ({
      ...l,
      // Ornamental rules typed as a run of one symbol ("@@@@@@…") are layout.
      text: undouble(
        l.text
          .replace(/([^\p{L}\p{N}\s])\1{7,}/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    }))
    .filter((l) => l.text);
  // A bare number opening or closing a page is its page number.
  return cleaned.filter(
    (l, i) =>
      !(
        /^\d{1,3}$/.test(l.text) &&
        (cleaned[i - 1]?.page !== l.page || cleaned[i + 1]?.page !== l.page)
      ),
  );
}

/** The raw text layer (one string per page) with only the layout removals
 * the reading edition declares: ornamental symbol runs, fake-bold doubling,
 * a bare number opening or closing a page, and words cut by a hyphen at a
 * line end when the next line starts in lower case. The fidelity check
 * compares the edition against this, so nothing else may differ. */
export function pdfLayoutText(pages: string[]): string {
  return pages
    .map((page) => {
      const lines = page
        .split("\n")
        .map((line) =>
          undouble(
            line
              .replace(/([^\p{L}\p{N}\s])\1{7,}/gu, " ")
              .replace(/\s+/g, " ")
              .trim(),
          ),
        )
        .filter(Boolean);
      return lines
        .filter(
          (line, i) =>
            !(/^\d{1,3}$/.test(line) && (i === 0 || i === lines.length - 1)),
        )
        .join("\n");
    })
    .join("\n")
    .replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, "$1$2");
}

/** Fake bold written into the text itself: every character twice
 * ("CCiinnaa nnaazziioonnaallee" → "Cina nazionale"). Only a line where every
 * word is made of doubled characters is changed. */
export function undouble(text: string): string {
  const words = text.split(" ");
  const doubled = (w: string) => {
    const c = [...w];
    if (c.length < 2 || c.length % 2) return false;
    for (let i = 0; i < c.length; i += 2) if (c[i] !== c[i + 1]) return false;
    return true;
  };
  if ([...text].length < 6 || !words.every(doubled)) return text;
  return words
    .map((w) => [...w].filter((_, i) => i % 2 === 0).join(""))
    .join(" ");
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
    // A word split by a hyphen always continues on the next line, whatever
    // the layout says (lines beside a drop cap are indented and look apart).
    const continues =
      open !== undefined &&
      HYPHENATED.test(open.text) &&
      /^\p{Ll}/u.test(line.text);
    // A heading is a larger line, never a long running one.
    // A date line ("1985-1992:") opens a chronology entry, not a heading.
    const heading =
      line.size >= body * 1.18 &&
      line.text.length <= 90 &&
      !/^\d{3,4}(?:\s*[-–]\s*\d{2,4})?\s*[:.]?$/.test(line.text) &&
      !BYLINE.test(line.text);
    const tag = heading ? "h2" : "p";
    const gap = prev && prev.page === line.page ? prev.y - line.y : spacing;
    const startsNew =
      !continues &&
      (!open ||
        open.tag !== tag ||
        open.page !== line.page ||
        gap > spacing * 1.45 ||
        (!heading && line.x > left + body * 1.2) ||
        /^[•▪●\-–]\s/.test(line.text) ||
        // Timeline lines open with a year.
        (/^\d{3,4}\b/.test(line.text) && !heading));
    if (startsNew) {
      open = { tag, text: line.text, lines: 1, page: line.page };
      blocks.push(open);
    } else if (open) {
      open.lines++;
      // A hyphen at the end of a line joins a word split across lines.
      open.text = continues
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
      !/[.;,:!?»”"-]$/.test(b.text) &&
      !/^[•▪●\-–]/.test(b.text) &&
      !BYLINE.test(b.text) &&
      !/^\d{3,4}\b/.test(b.text) &&
      blocks[i + 1]?.tag === "p"
    )
      b.tag = "h3";
  const title =
    metadataTitle?.trim() ||
    blocks.find((b) => b.tag === "h2")?.text ||
    blocks[0]?.text.split(" ").slice(0, 12).join(" ") ||
    "Documento PDF";
  // Each illustration precedes the text of its page; illustrations on pages
  // without text come before the next page that has text, or at the end.
  const figure = (image: PdfImage) =>
    `<p><img src="#${image.id}" alt="@pdf.image.${image.page}" width="${Math.min(image.width, 480)}" height="${Math.round(image.height * Math.min(1, 480 / image.width))}"></p>`;
  const html: string[] = [];
  let shown = 0;
  for (const [i, b] of blocks.entries()) {
    const before =
      i === 0 || blocks[i - 1].page !== b.page
        ? images
            .filter((image) => image.page > shown && image.page <= b.page)
            .map(figure)
            .join("\n")
        : "";
    shown = b.page;
    html.push(`${before}<${b.tag}>${escapeHtml(b.text)}</${b.tag}>`);
  }
  const trailing = images.filter((image) => image.page > shown).map(figure);
  if (trailing.length) html.push(trailing.join("\n"));
  return `<html><head><title>${escapeHtml(title)}</title></head><body>${html.join("\n")}</body></html>`;
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
export const MIN_ILLUSTRATION = 300;
/** A line ending in a word cut by a hyphen ("vitto-" + "rioso"). */
export const HYPHENATED = /\p{L}-$/u;
/** "di Dario Carcano" next to the title is a byline, never a heading. */
const BYLINE = /^(?:di|by|par|por)\s+\p{Lu}[^:!?]{1,60}$/u;

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
    !/^(?:documento|document|microsoft|untitled)|\.docx?$/i.test(info.Title)
      ? info.Title
      : undefined;
  const images: PdfImage[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= pdf.numPages; page++) {
    const extracted = await lib.extractImages(pdf, page);
    for (const [index, image] of extracted.entries()) {
      // Owner decision of 18/11/2026 (Cloudflare free plan file limit):
      // only illustrations at least MIN_ILLUSTRATION px on their shorter
      // side, each distinct picture once per PDF. Rules, logos and
      // decorations repeated on every page are left out.
      if (Math.min(image.width, image.height) < MIN_ILLUSTRATION) continue;
      const pixels = createHash("sha256")
        .update(`${image.width}x${image.height}`)
        .update(image.data)
        .digest("hex");
      if (seen.has(pixels)) continue;
      seen.add(pixels);
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
