import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import type {
  EditorialItem,
  EditorialMap,
  EditorialSource,
  Review,
} from "../src/editorial/model.ts";
import { correctionSchema, mapSchema } from "../src/editorial/model.ts";
import { blocks } from "./anatomy.ts";
import { decode, titleSlug } from "./conversion.ts";
import { pdfToHtml } from "./pdf.ts";
import { safePath, sha256, urlKey } from "./recovery/core.ts";

export const redact = (text: string) =>
  text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/\s+/g, " ")
    .trim();
export const documentId = (url: string) =>
  `doc-${sha256(Buffer.from(urlKey(url))).slice(0, 12)}`;
export const authorId = (name: string) =>
  `author-${sha256(Buffer.from(name.normalize("NFC").toLocaleLowerCase())).slice(0, 12)}`;
export const itemId = (url: string, selector = "whole") =>
  `item-${sha256(Buffer.from(`${urlKey(url)}:${selector}`)).slice(0, 12)}`;
export const itemSlug = (title: string, url: string, selector = "whole") =>
  `${titleSlug(title)}-${sha256(Buffer.from(selector === "whole" ? urlKey(url) : `${urlKey(url)}:${selector}`)).slice(0, 8)}`;
export const proposed = (reason: string, quote: string): Review => ({
  by: "agent",
  state: "proposed",
  reason: redact(reason),
  quote: redact(quote).slice(0, 500),
});
export const unknownClassification = (quote: string) => {
  const unknown = (field: string) => ({
    value: "unknown" as const,
    review: proposed(
      `No verified ${field} assignment; retained as unknown for progressive review.`,
      quote,
    ),
  });
  return {
    divergences: unknown("point of divergence"),
    eras: unknown("era"),
    places: unknown("place"),
    themes: unknown("theme"),
    kind: unknown("genre"),
    world: unknown("world"),
  };
};
export const itemPath = (item: Pick<EditorialItem, "slug" | "level">) =>
  `/${item.level === "divergence" ? "divergences" : item.level === "world" ? "worlds" : "works"}/${item.slug}/`;
export async function readMap(): Promise<EditorialMap> {
  // JSON is the deliberately restricted YAML 1.2 serialization used by this file.
  const raw = JSON.parse(await readFile("data/map.yaml", "utf8"));
  for (const item of raw.items)
    if (!item.composition && item.sources.length > 1)
      item.composition = "chapters";
  return mapSchema.parse(raw);
}
export async function sourceHtml(
  source: EditorialSource,
  map: EditorialMap,
  archiveRoot = "archive/original",
): Promise<string> {
  const document = map.documents.find((d) => d.id === source.documentId);
  if (!document) throw new Error(`Unknown source: ${source.documentId}`);
  const raw = await readFile(safePath(archiveRoot, document.path));
  if (sha256(raw) !== document.sha256)
    throw new Error(`Original changed: ${document.path}`);
  const html = document.mediaType.includes("pdf")
    ? await pdfToHtml(raw)
    : decode(raw);
  if (!html)
    throw new Error(`Required PDF converter unavailable: ${document.path}`);
  if (source.selection.kind === "whole") return html;
  const selected = blocks(html).slice(
    source.selection.start,
    source.selection.end,
  );
  if (selected.length !== source.selection.end - source.selection.start)
    throw new Error(`Source selection no longer applies: ${document.path}`);
  if (
    sha256(Buffer.from(selected.map((b) => b.html).join("\n"))) !==
    source.selection.digest
  )
    throw new Error(`Source fragment changed: ${document.path}`);
  return `<html><head><title>${load(html)("title").text().replace(/[<>&]/g, "")}</title></head><body>${selected.map((b) => b.html).join("\n")}</body></html>`;
}
export async function correctionsFor(slug: string) {
  try {
    return correctionSchema.parse(
      JSON.parse(
        await readFile(safePath("data/corrections", `${slug}.json`), "utf8"),
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export function applyCorrections(
  text: string,
  corrections: { from: string; to: string }[],
  slug: string,
): string {
  for (const correction of corrections) {
    if (!correction.from || !text.includes(correction.from))
      throw new Error(`Correction does not apply: ${slug}`);
    text = text.replaceAll(correction.from, correction.to);
  }
  return text;
}

export async function writeMap(map: EditorialMap): Promise<void> {
  mapSchema.parse(map);
  const serialized =
    "{\n" +
    Object.entries(map)
      .map(
        ([key, value]) =>
          `  ${JSON.stringify(key)}: ${Array.isArray(value) ? `[\n${value.map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]` : JSON.stringify(value)}`,
      )
      .join(",\n") +
    "\n}\n";
  await writeFile("data/map.yaml", serialized);
}

/** Match complete names in an attribution, preferring the longest match at
 * each position. A short alias elsewhere in the sentence remains independent.
 */
export function attributionNames(
  explicit: string[],
  tail: string,
  known: string[],
): string[] {
  const signedNames = explicit.filter((name) => name.length > 1);
  if (signedNames.length) return [...new Set(signedNames)];
  // A dedication can name somebody before the actual author attribution.
  tail = tail.replace(/^.*?\b(?:di|de|by|par|por)\s+/iu, "");
  const matches: { name: string; start: number; end: number }[] = [];
  for (const name of known.filter((name) => name.length > 1)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      "giu",
    );
    for (const match of tail.matchAll(re))
      matches.push({
        name,
        start: match.index,
        end: match.index + match[0].length,
      });
  }
  return [
    ...new Set([
      ...explicit.filter((name) => name.length > 1),
      ...matches
        .filter(
          (match) =>
            !matches.some(
              (other) =>
                other.start <= match.start &&
                other.end >= match.end &&
                other.end - other.start > match.end - match.start,
            ),
        )
        .map((match) => match.name),
    ]),
  ];
}
