import assert from "node:assert/strict";
import test from "node:test";
import { opening, pick } from "../src/whatif.ts";

test("opening drops interface markup, images and the repeated title", () => {
  const body = `<section id="start">
<header class="part-head" data-ui><span data-t="part.main.narrative"></span></header>
JEEG BUSH

<img src="/sample/x.jpg" alt="Jeeg">

Corri, *ragazzo*, laggiù,&nbsp;vola tra [lampi](#blu) di blu.`;
  assert.equal(
    opening(body, "Jeeg Bush"),
    "Corri, ragazzo, laggiù, vola tra lampi di blu.",
  );
});

test("opening cuts long text at a word boundary with an ellipsis", () => {
  const text = "parola ".repeat(100);
  const result = opening(text, "Titolo", 50);
  assert.ok(result.length <= 51, result);
  assert.ok(result.endsWith("parola…"), result);
});

test("pick is deterministic and stays in range", () => {
  const items = ["a", "b", "c", "d"];
  assert.equal(pick(items, "seed"), pick(items, "seed"));
  assert.ok(items.includes(pick(items, "other")));
});
