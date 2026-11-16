import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { anatomy } from "./anatomy.ts";
import {
  authorId,
  itemId,
  itemSlug,
  proposed,
  readMap,
  redact,
  sourceHtml,
  unknownClassification,
  writeMap,
} from "./editorial-core.ts";
import { urlKey, writeJson } from "./recovery/core.ts";

const map = await readMap();
const selected = JSON.parse(
  await readFile("data/validation-sample.json", "utf8"),
) as { items: string[] };
const trial = JSON.parse(await readFile("data/trial.json", "utf8")) as {
  documents: { url: string }[];
};
const legacy = (
  JSON.parse(await readFile("data/legacy-edition.json", "utf8")) as {
    items: { source: string; slug: string; title: string }[];
  }
).items;
const legacyKeys = new Map(legacy.map((i) => [urlKey(i.source), i]));
const required = new Set([
  ...selected.items,
  ...map.items
    .filter(
      (i) =>
        i.sources.some(
          (s) => s.selection.kind === "whole" && legacyKeys.has(urlKey(s.url)),
        ) || i.composition === "chapters",
    )
    .map((i) => i.id),
]);
// The existing PDF trial is a prepared text item, distinct from its raw attachment.
for (const d of map.documents.filter(
  (d) =>
    d.mediaType.includes("pdf") &&
    trial.documents.some((t) => urlKey(t.url) === urlKey(d.url)),
)) {
  if (map.items.some((i) => i.sources.some((s) => s.documentId === d.id)))
    continue;
  const source = {
    documentId: d.id,
    url: d.url,
    selection: { kind: "whole" as const },
    ...(d.timestamp ? { timestamp: d.timestamp } : {}),
  };
  const html = await sourceHtml(source, map);
  const title = redact(load(html)("title").text());
  const old = legacyKeys.get(urlKey(d.url));
  const item = {
    id: itemId(d.url),
    slug: old?.slug ?? itemSlug(title, d.url),
    title: old?.title ?? title,
    level: "work" as const,
    authors: [],
    language: {
      value: "it" as const,
      review: proposed("Language verified from the prepared PDF trial.", title),
    },
    sources: [source],
    composition: "single" as const,
    classification: unknownClassification(title),
    contributions: [],
    developedIn: [],
    review: proposed(
      "Prepared PDF text layer; the original binary remains an unserved archive attachment.",
      title,
    ),
  };
  map.items.push(item);
  required.add(item.id);
  const proposal = map.proposals.find((p) => p.documents.includes(d.id));
  if (proposal) {
    proposal.action = "work";
    proposal.level = "work";
    proposal.targets = [item.id];
    proposal.review = item.review;
  }
}
// A redacted address is not an author identity.
const placeholders = new Set(
  map.authors.filter((a) => a.name === "[email removed]").map((a) => a.id),
);
map.authors = map.authors.filter((a) => !placeholders.has(a.id));
for (const item of map.items)
  item.authors = item.authors.filter((id) => !placeholders.has(id));
let count = 0;
for (const item of map.items.filter((i) => required.has(i.id))) {
  if (item.review.by === "owner") continue;
  const previousContributions = item.contributions;
  const contributions: typeof item.contributions = [];
  for (const [part, source] of item.sources.entries()) {
    const html = await sourceHtml(source, map);
    const parsed = anatomy(html, item.title);
    const prefix =
      item.composition === "chapters" ? `chapter-${part + 1}-` : "";
    const registry = (name: string, quote: string) => {
      const display = redact(name);
      if (!display || display === "[email removed]" || display.length > 90)
        return;
      const id = authorId(display);
      let author = map.authors.find((a) => a.id === id);
      if (!author) {
        author = {
          id,
          name: display,
          documents: [source.documentId],
          review: proposed(
            "Explicit source name retained as a proposed attribution; no aliases are merged.",
            quote,
          ),
        };
        map.authors.push(author);
      } else if (!author.documents.includes(source.documentId))
        author.documents.push(source.documentId);
      return id;
    };
    for (const name of parsed.authors) {
      const id = registry(
        name,
        parsed.blocks.find((b) => b.text.includes(name))?.text ?? name,
      );
      if (id && !item.authors.includes(id)) item.authors.push(id);
    }
    const segIds = new Map(
      parsed.segments
        .filter((s) => s.role === "contribution")
        .map((s) => [s.id, `${item.id}-${part + 1}-${s.id}`]),
    );
    for (const segment of parsed.segments.filter(
      (s) => s.role === "contribution",
    )) {
      const author = segment.author
        ? registry(segment.author, segment.intro ?? segment.author)
        : undefined;
      contributions.push({
        id: `${item.id}-${part + 1}-${segment.id}`,
        localId: `${prefix}${segment.id}`,
        itemId: item.id,
        documentId: source.documentId,
        ...(author ? { authorId: author } : {}),
        kind: {
          value: segment.kind ?? "comment",
          review: proposed(
            "Contribution type inferred from its original opening line; not yet owner-approved.",
            segment.intro ?? "",
          ),
        },
        ...(segment.replyTo
          ? {
              replyTo: segIds.get(segment.replyTo) ?? item.id,
              replyToLocalId: `${prefix}${segment.replyTo}`,
              replyReview: proposed(
                "Proposed reply target is the nearest preceding different speaker in this source; the relation remains unverified.",
                segment.intro ?? "",
              ),
            }
          : {}),
        quote: redact(segment.intro ?? ""),
        ...(segment.anchor ? { anchor: segment.anchor } : {}),
      });
    }
    if (
      item.classification.kind.review.by !== "owner" &&
      item.level !== "divergence"
    )
      item.classification.kind = {
        value:
          parsed.shape === "chronology"
            ? "chronology"
            : parsed.shape === "narrative"
              ? "story"
              : "unknown",
        review: proposed(
          "Source format recognized from dated entries and section structure; genre remains proposed.",
          parsed.blocks.find((b) => b.text.length > 30)?.text ?? item.title,
        ),
      };
  }
  for (const contribution of contributions) {
    const old = previousContributions.find((c) => c.id === contribution.id);
    if (old?.kind.review.by === "owner") contribution.kind = old.kind;
    if (old?.replyReview?.by === "owner") {
      contribution.replyTo = old.replyTo;
      contribution.replyToLocalId = old.replyToLocalId;
      contribution.replyReview = old.replyReview;
    }
  }
  item.contributions = contributions;
  const old =
    item.sources.length === 1 && item.sources[0].selection.kind === "whole"
      ? legacyKeys.get(urlKey(item.sources[0].url))
      : undefined;
  if (old) {
    item.slug = old.slug;
    item.title = old.title;
  }
  count++;
  if (count % 10 === 0)
    console.log(`Enriched ${count} selected or trial items`);
}
map.items.sort((a, b) => a.id.localeCompare(b.id));
map.authors.sort((a, b) => a.id.localeCompare(b.id));
await writeMap(map);
await writeJson("reports/editorial-selection.json", {
  selectedRandom: selected.items,
  additional: map.items
    .filter((i) => required.has(i.id) && !selected.items.includes(i.id))
    .map((i) => ({
      id: i.id,
      slug: i.slug,
      title: i.title,
      reason:
        i.composition === "chapters"
          ? "Explicit multi-document merge"
          : "Existing trial or prepared PDF",
    })),
  enriched: count,
  contributions: map.items
    .filter((i) => required.has(i.id))
    .reduce((n, i) => n + i.contributions.length, 0),
});
await writeJson("reports/editorial-map.json", {
  documents: map.documents.length,
  html: map.documents.filter((d) => d.mediaType.includes("html")).length,
  items: map.items.length,
  authors: map.authors.length,
  prompts: map.items.filter((i) => i.level === "divergence").length,
  pieces: map.items.filter((i) => i.parent).length,
  mergedFamilies: map.items.filter((i) => i.composition === "chapters").length,
  actions: Object.fromEntries(
    [...new Set(map.proposals.map((p) => p.action))].map((action) => [
      action,
      map.proposals.filter((p) => p.action === action).length,
    ]),
  ),
  ownerApproved: map.proposals.filter(
    (p) => p.review.by === "owner" && p.review.state === "approved",
  ).length,
});
console.log(
  `Enriched ${count} selected/trial items; map schema and references valid.`,
);
