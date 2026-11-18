import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildEraTimeline, openingYear } from "../src/era-timeline.ts";
import type { ClassifiedItem } from "../src/facet-index.ts";

const eras = JSON.parse(readFileSync("data/vocabulary.json", "utf8")).eras;
const review = (
  reason: string,
  state: "approved" | "proposed" = "approved",
) => ({
  by: state === "approved" ? ("owner" as const) : ("agent" as const),
  state,
  reason,
  quote: "q",
});
const item = (
  id: string,
  title: string,
  eras: string[] | "unknown",
  reason = "No year.",
): ClassifiedItem => ({
  id,
  data: {
    title,
    level: "work",
    editorialId: `item-${id}`,
    authors: ["A"],
    language: "it",
    classification: { eras: { value: eras, review: review(reason) } },
  },
});

test("openingYear reads AD and BC years from the era reason", () => {
  assert.equal(
    openingYear("First year cited in the opening (1804) falls"),
    1804,
  );
  assert.equal(
    openingYear("First year cited in the opening (44 BC) falls"),
    -44,
  );
  assert.equal(openingYear("First year in the opening (1915) disagrees"), 1915);
  assert.equal(openingYear("No year in the opening."), undefined);
});

test("eras keep vocabulary order, works sort by year then title, unknown is unplaced", () => {
  const t = buildEraTimeline(
    [
      item("b", "Beta", ["roman"], "First year cited in the opening (100) x"),
      item("a", "Alfa", ["roman"], "First year cited in the opening (44 BC) x"),
      item("c", "Gamma", ["roman", "1700s"]),
      item("u", "Utopia", ["outside-time"]),
      item("z", "Zeta", "unknown"),
    ],
    eras,
  );
  assert.equal(t.eras[0].id, "prehistory");
  assert.ok(!t.eras.some((e) => e.id === "outside-time"));
  const roman = t.eras.find((e) => e.id === "roman");
  assert.deepEqual(
    roman?.works.map((w) => w.title),
    ["Alfa", "Beta", "Gamma"],
  );
  assert.equal(t.eras.find((e) => e.id === "1700s")?.works.length, 1);
  assert.deepEqual(
    t.outsideTime.works.map((w) => w.title),
    ["Utopia"],
  );
  assert.deepEqual(
    t.unplaced.map((w) => w.title),
    ["Zeta"],
  );
});
