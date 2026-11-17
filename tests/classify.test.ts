import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  erasFor,
  firstYear,
  keywordFacet,
  placeWords,
  plainText,
  themeWords,
} from "../scripts/classify-core.ts";
import {
  checkClassification,
  vocabularySchema,
} from "../src/editorial/vocabulary.ts";

const vocabulary = vocabularySchema.parse(
  JSON.parse(await readFile("data/vocabulary.json", "utf8")),
);

test("the approved vocabulary has 18 eras, 13 places and 16 themes", () => {
  assert.equal(vocabulary.eras.length, 18);
  assert.equal(vocabulary.places.length, 13);
  assert.equal(vocabulary.themes.length, 16);
  assert.equal(vocabulary.approved.by, "owner");
});

test("first year in the opening, with BC and quantities", () => {
  assert.deepEqual(
    firstYear("Nel 1281 la seconda invasione mongola fallisce")?.year,
    1281,
  );
  assert.equal(firstYear("52 a.C.: Giulio Cesare assedia Alesia")?.year, -52);
  assert.equal(
    firstYear("Con 1500 soldati e 300 navi, nel 1571 a Lepanto")?.year,
    1571,
  );
  assert.equal(firstYear("Una storia senza date."), undefined);
});

test("eras by year follow the approved ranges", () => {
  assert.deepEqual(erasFor(vocabulary, 1814), ["1700s"]);
  assert.deepEqual(erasFor(vocabulary, 1815), ["1800s"]);
  assert.deepEqual(erasFor(vocabulary, 1933), ["second-world-war"]);
  assert.deepEqual(erasFor(vocabulary, -44), ["ancient", "roman"]);
  assert.deepEqual(erasFor(vocabulary, 2030), ["present-future"]);
});

test("keyword evidence needs recurrence and keeps a quotation", () => {
  const text = plainText(
    '---\ntitle: "x"\n---\n<p>Napoleone vince a Waterloo. Bonaparte entra a Londra.</p><p>Napoleone governa la Francia e Parigi festeggia.</p>',
  );
  const themes = keywordFacet(themeWords, "Napoleone trionfa", text);
  assert.equal(themes[0].id, "napoleon");
  assert.match(themes[0].quote, /Napoleone/);
  assert.deepEqual(keywordFacet(placeWords, "", "Una sola Cina."), []);
});

test("an assignment outside the vocabulary is rejected", () => {
  const review = {
    by: "agent",
    state: "proposed",
    reason: "r",
    quote: "q",
  } as const;
  assert.throws(() =>
    checkClassification(vocabulary, {
      version: 1,
      items: { "item-a": { eras: { value: ["middle-earth"], review } } },
    }),
  );
});
