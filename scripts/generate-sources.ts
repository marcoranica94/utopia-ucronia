import { mkdir, readFile } from "node:fs/promises";
import { load } from "cheerio";
import { documentTitle } from "./conversion.ts";
import { documentId, readMap, redact, sourceHtml } from "./editorial-core.ts";
import type { Gap } from "./link-resolution.ts";
import { writeJson } from "./recovery/core.ts";
import { plainSourceBlocks } from "./source-text.ts";

const map = await readMap();
const converted = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as {
  slug: string;
  path: string;
  title: string;
  sources: {
    documentId: string;
    url: string;
    timestamp?: string;
    selection: unknown;
  }[];
}[];
const gaps = JSON.parse(
  await readFile("reports/link-gaps.json", "utf8"),
) as Gap[];
const ids = [
  ...new Set(
    converted.flatMap((item) =>
      item.sources.map((source) => source.documentId),
    ),
  ),
];
const records = [];
for (const id of ids) {
  const document = map.documents.find((d) => d.id === id);
  if (!document) throw Error(`Missing source ${id}`);
  const html = await sourceHtml(
    { documentId: id, url: document.url, selection: { kind: "whole" } },
    map,
  );
  const $ = load(html);
  $("script,style,iframe,object,embed,form,noscript").remove();
  const text = plainSourceBlocks($.html());
  const items = converted
    .filter((item) => item.sources.some((source) => source.documentId === id))
    .map((item) => ({
      title: item.title,
      href: item.path,
      selections: item.sources
        .filter((source) => source.documentId === id)
        .map((source) => source.selection),
    }));
  const edition = await readFile(
    `src/content/works/${converted.find((item) => item.sources.some((source) => source.documentId === id))?.slug}.md`,
    "utf8",
  );
  const language = JSON.parse(
    /^language: (.+)$/m.exec(edition)?.[1] ?? '"unknown"',
  );
  records.push({
    language,
    id: documentId(document.url),
    title: redact(documentTitle($.html())),
    url: redact(document.url),
    sha256: document.sha256,
    mediaType: document.mediaType,
    timestamp: document.timestamp,
    retrievedAt: document.retrievedAt,
    text,
    items,
    gaps: gaps.filter((gap) => documentId(gap.source) === id),
  });
}
await mkdir("src/generated", { recursive: true });
await writeJson("src/generated/sources.json", records);
console.log(
  `Local source text/provenance pages prepared for ${ids.length} documents backing all ${converted.length} reading items.`,
);
