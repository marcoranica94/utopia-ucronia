import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { readMap } from "./editorial-core.ts";
import {
  baselineIds,
  publicationItems,
  readPublication,
} from "./publication-core.ts";
import { writeJson } from "./recovery/core.ts";
import { readDecisions } from "./review-decisions.ts";

const baseline = await baselineIds(),
  selection = await readPublication();
const expected = publicationItems(
  await readMap(),
  await readDecisions(),
  selection,
  baseline,
);
const converted = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as { editorialId?: string; slug: string; publicationSelection: boolean }[];
const compared = JSON.parse(
  await readFile("reports/sample-comparison.json", "utf8"),
) as { slug: string; text: string }[];
assert.deepEqual(
  converted
    .filter((item) => item.editorialId)
    .map((item) => item.editorialId)
    .sort(),
  expected.items.map((item) => item.id).sort(),
);
assert.deepEqual(
  converted
    .filter((item) => item.publicationSelection)
    .map((item) => item.editorialId)
    .sort(),
  expected.extraIds.toSorted(),
);
assert.deepEqual(
  converted.map((item) => item.slug).sort(),
  compared.map((item) => item.slug).sort(),
);
assert.ok(compared.every((item) => item.text.startsWith("identical")));
assert.ok(
  !(await readdir("dist", { recursive: true })).some((file) =>
    /(?:^|\/)(?:publication(?:-baseline)?\.json|publication-next\.(?:json|md))$/.test(
      file,
    ),
  ),
);
await writeJson("reports/publication-validation.json", {
  passed: true,
  baselineItems: baseline.length,
  additionalItems: expected.extraIds.length,
  canonicalItems: expected.items.length,
  comparedReadingItems: compared.length,
  selectedProposals: selection.selections.map((s) => s.proposalId),
  scope:
    "Explicit owner approvals plus persistent publication selections; every selected item is converted and source-compared. Selection and review data remain absent from the site.",
});
console.log(
  `Publication verified: ${baseline.length} baseline items + ${expected.extraIds.length} selected additions; all ${compared.length} reading editions source-compared.`,
);
