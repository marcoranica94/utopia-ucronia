import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  contentsChapters,
  linkTarget,
  mergeOrders,
  navigationList,
  navigationMembers,
  numberedPages,
  numberedParts,
  reciprocalClusters,
} from "../scripts/worlds-core.ts";
import { worldsFileSchema } from "../src/editorial/worlds.ts";

test("links resolve case-insensitively inside the archive only", () => {
  assert.equal(
    linkTarget(
      "Roma_in_America_2.htm",
      "racconti/roma_in_america/intestazione.htm",
    ),
    "racconti/roma_in_america/roma_in_america_2.htm",
  );
  assert.equal(
    linkTarget("../../Utopiaucronia/VSSA.htm#x", "racconti/a/b.htm"),
    "utopiaucronia/vssa.htm",
  );
  assert.equal(
    linkTarget(
      "http://www.fmboschetto.it/Utopiaucronia/Keikyo.htm",
      "racconti/x.htm",
    ),
    "utopiaucronia/keikyo.htm",
  );
  assert.equal(linkTarget("mailto:someone@example.org", "a/b.htm"), undefined);
  assert.equal(linkTarget("https://example.org/x.htm", "a/b.htm"), undefined);
  assert.equal(linkTarget("#top", "a/b.htm"), undefined);
});

test("a contents page lists its chapters in order, once each", () => {
  const html =
    '<body><a href="Introduzione.htm">Intro</a> - <a href="cap1.htm">1</a> <a href="cap1.htm">again</a> <a href="Cap2.htm">2</a> <a href="mailto:x@y.z">mail</a> <a href="intestazione.htm#a">self</a></body>';
  assert.deepEqual(contentsChapters(html, "w/intestazione.htm"), [
    "w/introduzione.htm",
    "w/cap1.htm",
    "w/cap2.htm",
  ]);
});

test("a navigation list is the block under its heading, self anchors included", () => {
  const html = `<body><p>Testo con <a href="other.htm">un link</a> qualsiasi.</p>
    <table><tr><td><p><b>Come si fa a creare
    una superpotenza</b></p><p><a href="#su">Lombardia</a> – <a href="Andalusia.htm">Andalusia</a> – <a href="VSSA.htm">VSSA</a></p></td></tr></table>
    <a href="index.htm">Torna</a></body>`;
  assert.deepEqual(
    navigationList(
      html,
      "u/lombarda.htm",
      "Come si fa a creare una superpotenza",
    ),
    ["u/lombarda.htm", "u/andalusia.htm", "u/vssa.htm"],
  );
  assert.equal(navigationList(html, "u/lombarda.htm", "Assente"), undefined);
});

test("merged order agrees with every partial list", () => {
  assert.deepEqual(
    mergeOrders([
      ["b", "c", "d"],
      ["a", "c", "d"],
      ["a", "b", "d"],
    ]),
    ["a", "b", "c", "d"],
  );
  // Contradictions do not loop: the member seen first wins.
  assert.deepEqual(
    mergeOrders([
      ["x", "y"],
      ["y", "x"],
    ]),
    ["x", "y"],
  );
});

test("unlisted carriers follow their first part, others go last", () => {
  const lists = new Map([
    ["m.htm", ["a.htm", "b.htm"]],
    ["a.htm", ["m.htm", "b.htm"]],
    ["a_2.htm", ["m.htm", "b.htm"]],
    ["z.htm", ["m.htm", "a.htm"]],
    ["b.htm", ["m.htm", "a.htm"]],
  ]);
  assert.deepEqual(navigationMembers(lists), [
    "m.htm",
    "a.htm",
    "a_2.htm",
    "b.htm",
    "z.htm",
  ]);
});

test("reciprocal clusters skip site menus; numbered parts are recognised", () => {
  const menu = Array.from({ length: 20 }, (_, i) => `p${i}.htm`);
  const links = new Map<string, string[]>([
    ["menu.htm", menu],
    ["p0.htm", ["p1.htm", "menu.htm"]],
    ["p1.htm", ["p0.htm", "p2.htm", "menu.htm"]],
    ["p2.htm", ["p1.htm"]],
    ["q.htm", ["menu.htm"]],
  ]);
  assert.deepEqual(reciprocalClusters(links), [["p0.htm", "p1.htm", "p2.htm"]]);
  assert.equal(numberedParts(["u/x.htm", "u/x_2.htm", "u/x_3.htm"]), true);
  assert.equal(numberedParts(["r/iperimp1.htm", "r/iperimp12.htm"]), true);
  assert.equal(numberedParts(["u/x.htm", "u/y.htm"]), false);
});

test("numbered pages follow their number, the unnumbered page first", () => {
  const paths = [
    "u/x_10.htm",
    "u/x_2.htm",
    "u/x.htm",
    "u/x_extra.htm",
    "u/xy.htm",
    "v/x_3.htm",
    "u/x_3.htm",
  ];
  assert.deepEqual(numberedPages(paths, "u/x.htm"), [
    "u/x.htm",
    "u/x_2.htm",
    "u/x_3.htm",
    "u/x_10.htm",
  ]);
  assert.deepEqual(numberedPages(paths, "u/missing.pdf"), []);
});

test("data/worlds.json is valid, approvals only by the owner, no shared chapters", async () => {
  const file = worldsFileSchema.parse(
    JSON.parse(await readFile("data/worlds.json", "utf8")),
  );
  const seen = new Set<string>();
  for (const world of file.worlds) {
    assert.ok(world.chapters.length >= 2, world.id);
    // Nothing is approved without the owner.
    if (world.review.state === "approved")
      assert.equal(world.review.by, "owner", world.id);
    for (const c of world.chapters) {
      // A zip's files are separate chapters of one document.
      const key = `${c.documentId}::${c.entry ?? ""}`;
      assert.ok(!seen.has(key), `${c.path} ${c.entry ?? ""} in two worlds`);
      seen.add(key);
    }
  }
});
