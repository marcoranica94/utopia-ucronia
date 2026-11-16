import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "cheerio";
import { anatomy, blocks } from "../scripts/anatomy.ts";
import { convertHtml } from "../scripts/conversion.ts";
import {
  applyCorrections,
  proposed,
  unknownClassification,
} from "../scripts/editorial-core.ts";
import { explainedGap } from "../scripts/link-resolution.ts";
import { linesToHtml } from "../scripts/pdf.ts";
import { renderStructured } from "../scripts/structured.ts";
import { mapSchema } from "../src/editorial/model.ts";

const review = proposed("Explicit source attribution", "di Ada");
function fixture() {
  return {
    version: 1,
    manifestDigest: "a".repeat(64),
    documents: [
      {
        id: "doc-a",
        url: "https://www.fmboschetto.it/Utopiaucronia/a.htm",
        path: "a.htm",
        sha256: "b".repeat(64),
        mediaType: "text/html",
        source: "origin",
      },
    ],
    authors: [{ id: "ada", name: "Ada", documents: ["doc-a"], review }],
    eras: [],
    places: [],
    themes: [],
    proposals: [],
    items: [
      {
        id: "item-a",
        slug: "story",
        title: "Story",
        level: "work",
        authors: ["ada"],
        language: { value: "unknown", review },
        sources: [
          {
            documentId: "doc-a",
            url: "https://www.fmboschetto.it/Utopiaucronia/a.htm",
            selection: { kind: "whole" },
          },
        ],
        composition: "single",
        classification: unknownClassification("Story"),
        contributions: [],
        developedIn: [],
        review,
      },
    ],
  };
}
test("unknown metadata works; orphan authors and ambiguous merges fail", () => {
  const valid = mapSchema.parse(fixture());
  assert.equal(valid.items[0].classification.eras.value, "unknown");
  const orphan = fixture();
  orphan.items[0].authors = ["absent"];
  assert.equal(mapSchema.safeParse(orphan).success, false);
  const merge = fixture();
  merge.items[0].sources.push(merge.items[0].sources[0]);
  assert.equal(mapSchema.safeParse(merge).success, false);
  assert.equal(
    mapSchema.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] })
      .success,
    false,
  );
});
test("reply relationships require evidence and cannot refer to themselves", () => {
  const map = mapSchema.parse(fixture());
  const contribution = {
    id: "voice-a",
    localId: "voice-a",
    itemId: "item-a",
    documentId: "doc-a",
    kind: { value: "reply", review },
    replyTo: "item-a",
    quote: "Risponde Ada",
  };
  assert.equal(
    mapSchema.safeParse({
      ...map,
      items: [{ ...map.items[0], contributions: [contribution] }],
    }).success,
    false,
  );
  assert.equal(
    mapSchema.safeParse({
      ...map,
      items: [
        {
          ...map.items[0],
          contributions: [{ ...contribution, replyReview: review }],
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    mapSchema.safeParse({
      ...map,
      items: [
        {
          ...map.items[0],
          contributions: [
            { ...contribution, replyTo: "voice-a", replyReview: review },
          ],
        },
      ],
    }).success,
    false,
  );
});
test("persistent corrections are reproducible and stale corrections fail", () => {
  const corrections = [{ from: "Typo", to: "Corrected" }];
  assert.equal(
    applyCorrections("Typo Typo", corrections, "story"),
    "Corrected Corrected",
  );
  assert.equal(
    applyCorrections("Typo Typo", corrections, "story"),
    "Corrected Corrected",
  );
  assert.throws(() => applyCorrections("Changed source", corrections, "story"));
  assert.throws(() =>
    applyCorrections("Text", [{ from: "", to: "x" }], "story"),
  );
});
test("source prose before an early rule and trailing illustrations survive", () => {
  const html =
    '<title>Story</title><p>A substantive opening sentence.</p><hr><p>The rest of this story.</p><p><img src="flag.png" alt="Flag"></p>';
  const parsed = anatomy(html, "Story");
  assert.ok(
    parsed.blocks
      .filter((b) => !parsed.removed.has(b))
      .some((b) => b.text.includes("substantive")),
  );
  assert.ok(
    parsed.blocks.filter((b) => !parsed.removed.has(b)).some((b) => b.image),
  );
});
test("wrapper, empty and contribution-intro anchors survive while mail addresses disappear", () => {
  const html =
    '<title>Story</title><div id="wrapper"><p id="opening">Opening.</p></div><a name="empty"></a><p>Questo è il commento di <a href="mailto:a@example.org">Ada</a>: il <a name="detail">dettaglio</a>.</p><p>The comment text.</p>';
  const parsed = anatomy(html, "Story");
  const rendered = renderStructured(
    parsed,
    (source) => convertHtml(`<body>${source}</body>`, (href) => href).markdown,
  ).body;
  for (const id of ["wrapper", "opening", "empty", "detail"])
    assert.ok(rendered.includes(`id="${id}"`), id);
  assert.ok(!rendered.includes("a@example.org"));
  assert.equal(
    blocks(html)
      .map((b) => b.text)
      .join(""),
    parsed.blocks.map((b) => b.text).join(""),
  );
});
test("PDF page breaks keep source order and page-specific images", () => {
  const lines = [
    { text: "First page.", x: 20, y: 600, size: 12, page: 1 },
    { text: "Second page.", x: 20, y: 600, size: 12, page: 2 },
  ];
  const html = linesToHtml(lines, "PDF", [
    {
      id: "pdf-image-2-1",
      page: 2,
      width: 100,
      height: 80,
      bytes: Buffer.alloc(0),
    },
  ]);
  const $ = load(html);
  assert.equal($("body").text(), "First page.\nSecond page.");
  assert.ok(html.indexOf("First page.") < html.indexOf("pdf-image-2-1"));
  assert.ok(html.indexOf("pdf-image-2-1") < html.indexOf("Second page."));
});
test("unavailable links have explicit reasons and no public email", () => {
  const base = "https://www.fmboschetto.it/Utopiaucronia/a.htm";
  assert.equal(
    explainedGap("absent.htm", base, false, new Map()).reason,
    "archive-unlisted",
  );
  const gap = explainedGap("mailto:a@example.org", base, false, new Map());
  assert.equal(gap.reason, "external-excluded");
  assert.ok(!gap.resource.includes("a@example.org"));
});

test("removing a mailto retains its portrait and source anchor", () => {
  const result = convertHtml(
    '<p><a name="signature" href="mailto:a@example.org"><img src="portrait.png" alt="Ada" width="60" height="60">Ada</a></p>',
    (href) => href,
  );
  assert.ok(result.markdown.includes("portrait.png"));
  assert.ok(result.markdown.includes('width="60"'));
  assert.ok(result.markdown.includes('id="signature"'));
  assert.ok(!result.markdown.includes("example.org"));
});

test("map regeneration preserves owner metadata and rejects changed reviewed sources", async () => {
  const { preserveOwnerDecisions } = await import(
    "../scripts/editorial-review.ts"
  );
  const old = mapSchema.parse(fixture());
  old.items[0].language = {
    value: "fr",
    review: { ...review, by: "owner", state: "approved" },
  };
  old.authors[0].review = { ...review, by: "owner", state: "approved" };
  old.authors[0].name = "Ada, verified";
  const next = mapSchema.parse(fixture());
  preserveOwnerDecisions(next, old);
  assert.equal(next.items[0].language.value, "fr");
  assert.equal(next.authors[0].name, "Ada, verified");
  const changed = mapSchema.parse(fixture());
  changed.documents[0].sha256 = "c".repeat(64);
  assert.throws(
    () => preserveOwnerDecisions(changed, old),
    /reviewed source changed/,
  );
});

test("angle-bracket linguistic transcriptions remain text in Markdown", () => {
  const converted = convertHtml(
    "<p>Resa greca *Βεοργορ &lt;Beorgor&gt;, &amp; altri.</p>",
    (href) => href,
  );
  assert.ok(converted.markdown.includes("&lt;Beorgor&gt;"));
});

test("fragment selection fails if the source bytes or selected block digest change", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { sha256 } = await import("../scripts/recovery/core.ts");
  const { sourceHtml } = await import("../scripts/editorial-core.ts");
  const dir = await mkdtemp(join(tmpdir(), "ucronia-fragment-"));
  try {
    const html = "<title>Story</title><p>First.</p><p>Second.</p>";
    await writeFile(join(dir, "a.htm"), html);
    const map = mapSchema.parse(fixture());
    map.documents[0].sha256 = sha256(Buffer.from(html));
    const source = {
      ...map.items[0].sources[0],
      selection: {
        kind: "blocks" as const,
        start: 1,
        end: 2,
        digest: sha256(Buffer.from(blocks(html)[1].html)),
      },
    };
    assert.ok((await sourceHtml(source, map, dir)).includes("Second."));
    await assert.rejects(
      sourceHtml(
        {
          ...source,
          selection: { ...source.selection, digest: "f".repeat(64) },
        },
        map,
        dir,
      ),
      /fragment changed/,
    );
    await writeFile(join(dir, "a.htm"), `${html}Altered`);
    await assert.rejects(sourceHtml(source, map, dir), /Original changed/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("attributions do not invent abbreviated coauthors from a longer name", async () => {
  const { attributionNames } = await import("../scripts/editorial-core.ts");
  assert.deepEqual(
    attributionNames([], "idea di Enrica S., e di Federico Pozzi", [
      "i",
      "Fede",
      "Federico",
      "Enrica S.",
      "Federico Pozzi",
    ]),
    ["Enrica S.", "Federico Pozzi"],
  );
  assert.deepEqual(
    attributionNames([], "Marco Zucca", ["Marco", "Marco Zucca"]),
    ["Marco Zucca"],
  );
  assert.deepEqual(
    attributionNames([], "Marco e Marco Zucca", ["Marco", "Marco Zucca"]),
    ["Marco", "Marco Zucca"],
  );
});

test("PDF year ranges wrapped in a narrow column stay one timeline label", () => {
  const html = linesToHtml(
    [
      { text: "1915–", x: 20, y: 600, size: 12, page: 1 },
      { text: "1916 Fronti di guerra.", x: 20, y: 586, size: 12, page: 1 },
    ],
    "PDF",
  );
  assert.ok(load(html)("body").text().includes("1915–1916 Fronti di guerra."));
});

test("a dedication does not become a coauthor", async () => {
  const { attributionNames } = await import("../scripts/editorial-core.ts");
  assert.deepEqual(
    attributionNames(
      ["Pavel Tonkov"],
      "un tributo a Leonardo David di Pavel Tonkov",
      ["Leonardo", "Pavel Tonkov"],
    ),
    ["Pavel Tonkov"],
  );
  assert.deepEqual(
    attributionNames([], "un tributo a Leonardo David di Pavel Tonkov", [
      "Leonardo",
      "Pavel Tonkov",
    ]),
    ["Pavel Tonkov"],
  );
});

test("field-reviewed contributions survive proposal regeneration", async () => {
  const { preserveOwnerDecisions } = await import(
    "../scripts/editorial-review.ts"
  );
  const previous = mapSchema.parse(fixture());
  previous.items[0].contributions = [
    {
      id: "voice-a",
      localId: "voice-a",
      itemId: "item-a",
      documentId: "doc-a",
      authorId: "ada",
      kind: {
        value: "variant",
        review: { ...review, by: "owner", state: "approved" },
      },
      quote: "Invece Ada",
    },
  ];
  const next = mapSchema.parse(fixture());
  preserveOwnerDecisions(next, previous);
  assert.equal(next.items[0].contributions[0].kind.value, "variant");
  assert.equal(mapSchema.safeParse(next).success, true);
});
