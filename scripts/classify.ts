import { readFile } from "node:fs/promises";
import {
  type ClassificationFile,
  checkClassification,
  classificationFileSchema,
  type Facet,
  vocabularySchema,
} from "../src/editorial/vocabulary.ts";
import {
  categoryEras,
  categoryOnly,
  erasFor,
  firstYear,
  keywordFacet,
  placeWords,
  plainText,
  sentenceAt,
  themeWords,
} from "./classify-core.ts";
import { writeJson } from "./recovery/core.ts";

/**
 * Proposes eras, places and themes for every published reading item, as
 * agent proposals with one line of reasoning and a quotation from the text.
 * Owner decisions already in data/classification.json are never replaced.
 * Reads the converted texts, so run it after `pnpm convert` (or a build).
 */

type Assignment = NonNullable<ClassificationFile["items"][string]["eras"]>;

const vocabulary = vocabularySchema.parse(
  JSON.parse(await readFile("data/vocabulary.json", "utf8")),
);
const previous: ClassificationFile = await readFile(
  "data/classification.json",
  "utf8",
)
  .then((text) => classificationFileSchema.parse(JSON.parse(text)))
  .catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, items: {} };
    throw error;
  });
const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as { slug: string; path: string; editorialId?: string; title?: string }[];
const browse = JSON.parse(
  await readFile("src/generated/browse.json", "utf8"),
) as {
  workGroups: { id: string; title: { it: string } }[];
  entries: { title: string; group: string; targets: string[] }[];
  targets: { id: string; readingHref?: string }[];
};

const proposal = (
  value: string[] | "unknown",
  reason: string,
  quote: string,
): Assignment => ({
  value: value === "unknown" || value.length ? value : "unknown",
  review: {
    by: "agent",
    state: "proposed",
    reason,
    quote: quote.slice(0, 300),
  },
});

const categoriesByHref = new Map<string, { group: string; title: string }[]>();
const targetHref = new Map(
  browse.targets.map((t) => [t.id, t.readingHref] as const),
);
for (const entry of browse.entries)
  for (const id of entry.targets) {
    const href = targetHref.get(id);
    if (!href) continue;
    const list = categoriesByHref.get(href) ?? [];
    list.push({ group: entry.group, title: entry.title });
    categoriesByHref.set(href, list);
  }
const groupTitle = new Map(browse.workGroups.map((g) => [g.id, g.title.it]));
const eraLabel = new Map(vocabulary.eras.map((e) => [e.id, e.label.it]));

const items: ClassificationFile["items"] = {};
const counts = { eras: 0, places: 0, themes: 0, total: 0 };
for (const c of conversions) {
  if (!c.editorialId) continue;
  const markdown = await readFile(`src/content/works/${c.slug}.md`, "utf8");
  const title = /^title: (".*")$/m.exec(markdown)?.[1];
  const titleText = title ? (JSON.parse(title) as string) : (c.title ?? "");
  const text = plainText(markdown);
  const kept = previous.items[c.editorialId] ?? {};
  const entry: ClassificationFile["items"][string] = {};

  // Eras: first year in the opening, checked against the original catalog section.
  const categories = categoriesByHref.get(c.path) ?? [];
  const allowed = new Set(
    categories.flatMap((cat) => categoryEras[cat.group] ?? []),
  );
  const found = firstYear(text);
  let eras: Assignment;
  if (found) {
    let ids = erasFor(vocabulary, found.year);
    // Ancient and Roman overlap by date: Rome only with Roman evidence.
    if (ids.includes("roman") && ids.includes("ancient")) {
      themeWords.rome.lastIndex = 0;
      const roman =
        categories.some((cat) => cat.group === "roman") ||
        themeWords.rome.test(sentenceAt(text, found.index));
      themeWords.rome.lastIndex = 0;
      ids = roman ? ["roman"] : ["ancient"];
    }
    const consistent = !allowed.size || ids.some((id) => allowed.has(id));
    if (consistent)
      eras = proposal(
        ids,
        `First year cited in the opening (${found.year < 0 ? `${-found.year} BC` : found.year}) falls in ${ids.map((id) => eraLabel.get(id)).join(", ")}${categories.length ? `, consistent with the original catalog section "${groupTitle.get(categories[0].group)}"` : ""}.`,
        sentenceAt(text, found.index),
      );
    else {
      const only = categories
        .map((cat) => categoryOnly[cat.group])
        .find(Boolean);
      eras = only
        ? proposal(
            [only],
            `The original catalog lists it under "${groupTitle.get(categories[0].group)}"; the first year in the opening (${found.year}) is not its divergence.`,
            categories[0].title,
          )
        : proposal(
            "unknown",
            `First year in the opening (${found.year}) disagrees with the original catalog section "${groupTitle.get(categories[0].group)}"; left for review.`,
            sentenceAt(text, found.index),
          );
    }
  } else {
    const only = categories.map((cat) => categoryOnly[cat.group]).find(Boolean);
    eras = only
      ? proposal(
          [only],
          `No year in the opening; the original catalog lists it under "${groupTitle.get(categories[0].group)}".`,
          categories[0].title,
        )
      : proposal(
          "unknown",
          "No year in the opening and no single-era catalog section.",
          titleText,
        );
  }
  entry.eras = kept.eras?.review.by === "owner" ? kept.eras : eras;

  for (const [facet, words] of [
    ["places", placeWords],
    ["themes", themeWords],
  ] as [Facet, Record<string, RegExp>][]) {
    if (kept[facet]?.review.by === "owner") {
      entry[facet] = kept[facet];
      continue;
    }
    const hits = keywordFacet(words, titleText, text);
    entry[facet] = hits.length
      ? proposal(
          hits.map((h) => h.id),
          `Recurring terms: ${hits.map((h) => `${h.id} (${h.terms})`).join("; ")}.`,
          hits[0].quote,
        )
      : proposal("unknown", "No recurring place or theme terms.", titleText);
  }
  for (const facet of ["eras", "places", "themes"] as const)
    if (entry[facet]?.value !== "unknown") counts[facet]++;
  counts.total++;
  items[c.editorialId] = entry;
}
const file = checkClassification(
  vocabulary,
  classificationFileSchema.parse({ version: 1, items }),
);
await writeJson("data/classification.json", file);
console.log(
  `Classification proposals for ${counts.total} items: eras ${counts.eras}, places ${counts.places}, themes ${counts.themes} (the rest unknown). Owner decisions kept.`,
);
