import assert from "node:assert/strict";
import { test } from "node:test";
import { plainSourceBlocks } from "../scripts/source-text.ts";

test("source text preserves prose and table text while removing active source content and contact addresses", () => {
  const text = plainSourceBlocks(
    '<html><body><script>secretActiveText()</script><style>.hidden{display:none}</style><p onclick="bad()">La città di Roma &amp; Bisanzio.</p><p>di <a href="mailto:author@example.org">Ada</a> · mailto:author@example.org</p><table><tr><td>Anno 1453</td><td>Un diverso esito</td></tr></table><iframe>untrustedFrame</iframe></body></html>',
  ).join(" ");
  assert.ok(text.includes("La città di Roma & Bisanzio."));
  assert.ok(text.includes("Ada"));
  assert.ok(text.includes("Anno 1453"));
  assert.ok(text.includes("Un diverso esito"));
  assert.ok(
    !/mailto:|example\.org|secretActiveText|untrustedFrame|display:none|onclick/.test(
      text,
    ),
  );
});
