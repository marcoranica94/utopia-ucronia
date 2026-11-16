import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterEntries,
  normalizeSearch,
  paginateEntries,
} from "../public/browse-filter.js";
import { isDocumentedDevelopment } from "../scripts/browse-core.ts";

const entries = Array.from({ length: 95 }, (_, i) => ({
  id: i,
  search: normalizeSearch(i === 84 ? "Antichità Roma Cesare" : "Medioevo"),
  authors: [i === 84 ? "Ada" : "Bea"],
  statuses: [i === 84 ? "ready" : "recovered"],
  development: i === 84,
  related: i >= 80,
}));
test("filters search the whole period before pagination and normalize accents", () => {
  const result = paginateEntries(
    filterEntries(entries, {
      q: "antichita cesare",
      author: "Ada",
      availability: "ready",
      development: "documented",
    }),
    1,
    40,
  );
  assert.equal(result.total, 1);
  assert.equal(result.entries[0].id, 84);
  assert.equal(result.pages, 1);
});
test("development, other links and no links are separate filters", () => {
  assert.equal(filterEntries(entries, { development: "documented" }).length, 1);
  assert.equal(filterEntries(entries, { development: "related" }).length, 14);
  assert.equal(filterEntries(entries, { development: "unlinked" }).length, 80);
});
test("empty results and stale page numbers yield a valid range", () => {
  assert.deepEqual(paginateEntries([], 900, 20), {
    entries: [],
    total: 0,
    pages: 1,
    page: 1,
    start: 0,
    end: 0,
  });
  assert.equal(paginateEntries(entries, 900, 40).page, 3);
});
test("documented development excludes unavailable files and ancillary discussions", () => {
  const target = {
    status: "recovered",
    source: "https://www.fmboschetto.it/Utopiaucronia/story.htm",
  };
  assert.ok(
    isDocumentedDevelopment(
      "ucronia",
      "vedi l’ucronia realizzata da Ada",
      false,
      target,
    ),
  );
  assert.ok(isDocumentedDevelopment("titolo", "", true, target));
  for (const label of ["discussione", "schema", "appunti", "trailer"])
    assert.equal(isDocumentedDevelopment(label, "", true, target), false);
  for (const status of ["missing", "external"])
    assert.equal(
      isDocumentedDevelopment("racconto", "", true, { ...target, status }),
      false,
    );
  assert.equal(
    isDocumentedDevelopment("racconto", "", true, {
      ...target,
      fragmentMissing: true,
    }),
    false,
  );
});
