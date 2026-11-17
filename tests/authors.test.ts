import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type AttributedItem,
  authorPath,
  buildAuthorIndex,
} from "../src/author-index.ts";

function item(
  id: string,
  data: Partial<AttributedItem["data"]> = {},
): AttributedItem {
  return {
    id,
    data: {
      title: id,
      level: "work",
      language: "it",
      editorialId: id,
      authors: [],
      ...data,
    },
  };
}

test("author identities preserve aliases, case and punctuation with stable safe URLs", () => {
  assert.equal(authorPath("  André  "), authorPath("Andre\u0301"));
  for (const variant of ["Andre", "andré", "André!", "A/../André"]) {
    assert.notEqual(authorPath("André"), authorPath(variant));
    assert.match(authorPath(variant), /^\/authors\/[a-z0-9-]+\/$/);
  }
  const first = buildAuthorIndex([item("a", { authors: ["Ada", "A.D.A."] })]);
  const second = buildAuthorIndex([
    item("b", { authors: ["Other"] }),
    item("a", { authors: ["Ada", "A.D.A."] }),
  ]);
  assert.deepEqual(
    first.map((a) => a.path),
    second.filter((a) => a.name !== "Other").map((a) => a.path),
  );
});

test("principal attribution and signed contributions stay distinct without duplicate texts or anchors", () => {
  const authors = buildAuthorIndex([
    item("story", {
      authors: ["Ada", "Ada"],
      contributors: ["Ada", "Bob", "Bob"],
      outline: [
        { id: "a", kind: "contribution", author: "Ada" },
        { id: "b", kind: "contribution", author: "Bob" },
        { id: "b", kind: "contribution", author: "Bob" },
        { id: "c", kind: "contribution", author: "Clara" },
        { id: "year", kind: "entry", author: "Not a signature" },
      ],
    }),
    item("prompt", { level: "divergence", authors: ["Bob"] }),
    item("legacy", { editorialId: undefined, authors: ["Preview only"] }),
    item("unknown", { authors: [] }),
  ]);
  assert.deepEqual(
    authors.map((a) => a.name),
    ["Ada", "Bob", "Clara"],
  );
  assert.deepEqual(
    authors[0].entries.map((e) => [e.principal, e.anchors]),
    [[true, ["a"]]],
  );
  assert.deepEqual(
    authors[1].entries.map((e) => [e.principal, e.path, e.anchors]),
    [
      [false, "/works/story/", ["b"]],
      [true, "/divergences/prompt/", []],
    ],
  );
  assert.equal(authors[2].entries[0].anchors[0], "c");
});

test("unknown attributions remain absent and canonically equivalent spellings group once", () => {
  assert.deepEqual(buildAuthorIndex([item("unknown", { authors: [" "] })]), []);
  const authors = buildAuthorIndex([
    item("a", { authors: ["Andre\u0301", "André"] }),
  ]);
  assert.equal(authors.length, 1);
  assert.equal(authors[0].entries.length, 1);
});
