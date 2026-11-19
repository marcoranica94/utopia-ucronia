import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  classificationFileSchema,
  vocabularySchema,
} from "../src/editorial/vocabulary.ts";
import { writeJson } from "./recovery/core.ts";

/**
 * Owner-delegated approval of agent classification proposals (S8). The owner
 * asked on 19/11/2026: "fai tu. approvatele da solo con un controllo". Only
 * proposals that pass every check below become owner-approved; the others
 * stay proposals. `unknown` values are never approved.
 *
 * Checks, per facet value:
 * - the value exists in data/vocabulary.json;
 * - the quotation is found in the work's text;
 * - eras: the year the reason cites appears in the text and falls inside the
 *   era's years (or the reason quotes the original catalog section);
 * - places and themes: the words the reason gives as evidence for the value
 *   occur at least MIN_EVIDENCE times in the text, all together.
 *
 *   node scripts/classify-approve.ts --items <ids.json> --quote "<owner words>"
 *     [--dry-run]
 */

const MIN_EVIDENCE = 3;
const { values } = parseArgs({
  options: {
    items: { type: "string" },
    quote: { type: "string" },
    report: { type: "string", default: "reports/classification-approval.json" },
    "dry-run": { type: "boolean" },
  },
});
if (!values.items || !values.quote)
  throw new Error("Give --items <ids.json> and --quote <owner words>");

const vocabulary = vocabularySchema.parse(
  JSON.parse(await readFile("data/vocabulary.json", "utf8")),
);
const file = classificationFileSchema.parse(
  JSON.parse(await readFile("data/classification.json", "utf8")),
);
const wanted = new Set(
  JSON.parse(await readFile(values.items, "utf8")) as string[],
);
const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as { slug: string; editorialId?: string }[];
const slugOf = new Map(
  conversions
    .filter((c) => c.editorialId)
    .map((c) => [c.editorialId as string, c.slug]),
);

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const count = (text: string, word: string) =>
  text.split(` ${fold(word)} `).length - 1;

type Outcome = { item: string; facet: string; value: string[]; why: string };
const approved: Outcome[] = [];
const kept: Outcome[] = [];
for (const item of wanted) {
  const entry = file.items[item];
  const slug = slugOf.get(item);
  if (!entry || !slug) throw new Error(`Unknown item ${item}`);
  const markdown = await readFile(`src/content/works/${slug}.md`, "utf8");
  const text = ` ${fold(markdown.replace(/^---[\s\S]*?\n---\n/, ""))} `;
  const title = JSON.parse(/^title: (.+)$/m.exec(markdown)?.[1] ?? '""');
  for (const facet of ["eras", "places", "themes"] as const) {
    const assignment = entry[facet];
    if (
      !assignment ||
      assignment.value === "unknown" ||
      assignment.review.by === "owner"
    )
      continue;
    const value = assignment.value;
    const reason = assignment.review.reason;
    const fail = (why: string) => kept.push({ item, facet, value, why });
    const known = new Set(vocabulary[facet].map((v) => v.id));
    if (!value.every((id) => known.has(id))) {
      fail("value not in the vocabulary");
      continue;
    }
    // Quotations are windows of the text, often cut inside a word at either
    // end: no word boundary is required.
    // An era taken from the original catalog section quotes the catalog
    // title, which is the work's title rather than a line of its text.
    const quotesTitle =
      /original catalog/.test(reason) &&
      fold(assignment.review.quote) === fold(title);
    if (!quotesTitle && !text.includes(fold(assignment.review.quote))) {
      fail("quotation not found in the text");
      continue;
    }
    if (facet === "eras") {
      const year = /\((\d{1,4})( BC)?\)/.exec(reason);
      const fromCatalog = /original catalog/.test(reason);
      if (year) {
        const n = Number(year[1]) * (year[2] ? -1 : 1);
        const inEra = value.some((id) => {
          const era = vocabulary.eras.find((e) => e.id === id);
          return (
            era?.start !== undefined &&
            era.end !== undefined &&
            n >= era.start &&
            n <= era.end
          );
        });
        if (!count(text, year[1]) || (!inEra && !fromCatalog)) {
          fail(`cited year ${year[1]} not in the text or outside the era`);
          continue;
        }
      } else if (!fromCatalog) {
        fail("no cited year and no catalog section");
        continue;
      }
    } else {
      const evidence = new Map(
        [...reason.matchAll(/([a-z-]+) \(([^)]+)\)/g)].map((m) => [
          m[1],
          m[2].split(/,\s*/),
        ]),
      );
      const weak = value.find((id) => {
        const words = evidence.get(id);
        if (!words) return true;
        return (
          words.reduce((sum, word) => sum + count(text, word), 0) < MIN_EVIDENCE
        );
      });
      if (weak) {
        fail(`fewer than ${MIN_EVIDENCE} occurrences of the words for ${weak}`);
        continue;
      }
    }
    approved.push({ item, facet, value, why: "all checks passed" });
    if (!values["dry-run"])
      entry[facet] = {
        value,
        review: { ...assignment.review, by: "owner", state: "approved" },
      };
  }
}
if (!values["dry-run"])
  await writeJson(
    "data/classification.json",
    classificationFileSchema.parse(file),
  );
const tally = (rows: Outcome[]) =>
  Object.fromEntries(
    ["eras", "places", "themes"].map((f) => [
      f,
      rows.filter((r) => r.facet === f).length,
    ]),
  );
await writeJson(values.report, {
  date: new Date().toISOString().slice(0, 10),
  ownerInstruction: values.quote,
  authorization:
    "Owner-delegated approval: only agent proposals passing every automated check become owner-approved; the rest stay proposals; unknown values are never approved.",
  checks: [
    "value in data/vocabulary.json",
    "quotation found in the work's text",
    "eras: cited year in the text and inside the era, or the original catalog section",
    `places/themes: the evidence words for each value occur at least ${MIN_EVIDENCE} times`,
  ],
  dryRun: Boolean(values["dry-run"]),
  approved: tally(approved),
  keptProposed: tally(kept),
  kept,
  approvedAssignments: approved,
});
console.log(
  `approved ${JSON.stringify(tally(approved))}, kept as proposals ${JSON.stringify(tally(kept))}`,
);
