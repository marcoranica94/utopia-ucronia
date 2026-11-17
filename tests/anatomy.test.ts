import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anatomy,
  blocks,
  contributionKind,
  leadingDate,
  splitDatedLines,
  stripLeadingText,
} from "../scripts/anatomy.ts";

test("reads dates at the start of chronology entries", () => {
  assert.deepEqual(leadingDate("1155: Guerra Italica"), {
    start: 1155,
    label: "1155",
  });
  assert.deepEqual(leadingDate("1147-1149: Guerra di Corfù"), {
    start: 1147,
    end: 1149,
    label: "1147-1149",
  });
  assert.equal(leadingDate("753 a.C.: fondazione")?.start, -753);
  assert.equal(leadingDate("1379-1352 av. J-C. : Amenhotep")?.end, -1352);
  assert.equal(leadingDate("18 Aprile 1943 - Yamamoto")?.start, 1943);
  assert.equal(leadingDate("1147-49: guerra")?.end, 1149);
  // Not dates: counts, numbered proposals, plain sentences.
  assert.equal(leadingDate("100 soldati marciano"), undefined);
  assert.equal(leadingDate("1) L'impero batte gli Arabi"), undefined);
  assert.equal(leadingDate("Nel 1204 Costantinopoli cade"), undefined);
});

test("classifies contributions from their opening line", () => {
  assert.equal(contributionKind("Questo è il commento di X:"), "comment");
  assert.equal(contributionKind("Invece X vuole aggiungere:"), "addition");
  assert.equal(
    contributionKind("E ora, una variazione sul tema di X:"),
    "variant",
  );
  assert.equal(contributionKind("E Tommaso gli fa notare:"), "reply");
  assert.equal(contributionKind("Questa è la risposta di X:"), "reply");
  // "le idee" is an article, not a reply to someone.
  assert.equal(contributionKind("Ecco le idee di MAS:"), "variant");
});

const page = (body: string) =>
  `<html><head><title>[ucronia] Prova</title></head><body>${body}</body></html>`;
const mail = (name: string) => `<a href="mailto:x@example.org">${name}</a>`;

test("original header text retains a dated marquee when the catalog title omits the year", () => {
  const parsed = anatomy(
    page(
      "<marquee>1940: Italia neutrale, vittoria nazista</marquee><p>di Ada</p><hr><p>La storia continua.</p>",
    ),
    "Italia neutrale, vittoria nazista",
  );
  assert.deepEqual(parsed.headerText, [
    "1940: Italia neutrale, vittoria nazista",
    "di Ada",
  ]);
  assert.ok(
    parsed.segments[0].lead.some(
      (block) => block.text === "La storia continua.",
    ),
  );
});

test("splits a page into main text, contributions and replies", () => {
  const a = anatomy(
    page(`
      <p><marquee>Prova di ucronia</marquee></p>
      <p><b>di ${mail("Ada")}</b></p>
      <hr>
      <p>Testo della proposta.</p>
      <p><b>${mail("Ada")}</b></p>
      <p>.</p>
      <p>Questo è il commento di ${mail("Bruno")}:</p>
      <p>Bella idea.</p>
      <p>.</p>
      <p>E ora, una variazione sul tema di ${mail("Carla")}:</p>
      <p>1200: prima voce.</p><p>1210: seconda voce.</p><p>1220: terza voce.</p>
      <p>.</p>
      <p>Gli risponde ${mail("Bruno")}:</p>
      <p>Non sono d'accordo.</p>
      <p>Per suggerimenti scriveteci a ${mail("questo indirizzo")}.</p>
      <hr><p><a href="index.htm">Torna indietro</a></p>
    `),
    "[ucronia] Prova",
  );
  assert.equal(a.title, "Prova di ucronia");
  assert.deepEqual(a.authors, ["Ada"]);
  assert.equal(a.shape, "discussion");
  const [main, comment, variant, reply] = a.segments;
  assert.equal(main.signed, "Ada");
  assert.equal(comment.kind, "comment");
  assert.equal(comment.author, "Bruno");
  assert.equal(variant.kind, "variant");
  assert.deepEqual(
    variant.entries.map((e) => e.date?.start),
    [1200, 1210, 1220],
  );
  assert.equal(reply.kind, "reply");
  assert.equal(reply.replyTo, variant.id);
  assert.ok(a.dropped.some((t) => t.startsWith("Per suggerimenti")));
  assert.ok(a.dropped.includes("Torna indietro"));
  // Nothing outside the declared removals is lost.
  const kept = a.blocks.filter((b) => !a.removed.has(b)).map((b) => b.text);
  assert.ok(kept.includes("Bella idea."));
  assert.ok(kept.includes("Ada"));
});

test("keeps a BC era across entries that drop it", () => {
  const a = anatomy(
    page(
      "<p>1379-1352 av. J-C. : Amenhotep.</p><p>1352-1312 : Toutankhaton.</p><p>1312-1301 : Horemheb.</p>",
    ),
    "Akhenaton",
  );
  assert.deepEqual(
    a.segments[0].entries.map((e) => e.date?.start),
    [-1379, -1352, -1312],
  );
});

test("splits entries separated by a single line break and keeps formatting", () => {
  const parts = splitDatedLines(
    "<p><font><b>1147: primo.</b><br>1155: secondo.<br>e ancora.</font></p>",
  );
  assert.equal(parts.length, 2);
  assert.match(
    parts[1],
    /^<p><font>1155: secondo\.<br>e ancora\.<\/font><\/p>$/,
  );
  // Lines that do not open with a date stay together.
  assert.equal(splitDatedLines("<p>verso uno<br>verso due</p>").length, 1);
});

test("keeps names inside address links in the text", () => {
  const [b] = blocks(
    page(`<p>espresse da ${mail("Francesco")} e da ${mail("MAS")}.</p>`),
  );
  assert.equal(b.text, "espresse da Francesco e da MAS.");
  assert.deepEqual(b.names, ["Francesco", "MAS"]);
});

test("moves a leading date out of the text without losing characters", () => {
  const r = stripLeadingText("<b>1155</b>: Sebbene sfumi", "1155");
  assert.equal(r.html, "<b></b>Sebbene sfumi");
  assert.equal(r.separator, ":");
});
