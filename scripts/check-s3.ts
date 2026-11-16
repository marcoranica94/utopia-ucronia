import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { load } from "cheerio";
import { documentId } from "./editorial-core.ts";
import { safePath, writeJson } from "./recovery/core.ts";

const items = JSON.parse(await readFile("reports/conversion.json", "utf8")) as {
  path: string;
  sources: { documentId: string; url: string }[];
}[];
const records = JSON.parse(
  await readFile("src/generated/sources.json", "utf8"),
) as { id: string; sha256: string; text: string[] }[];
const gaps = JSON.parse(await readFile("reports/link-gaps.json", "utf8")) as {
  id: string;
  reason: string;
}[];
const search = JSON.parse(await readFile("reports/search-index.json", "utf8"));
let sourceLinks = 0,
  notes = 0;
for (const lang of ["it", "en"]) {
  const prefix = lang === "en" ? "/en" : "";
  const index = search.indexes.find(
    (entry: { lang: string }) => entry.lang === lang,
  );
  assert.equal(index.count, items.length);
  assert.deepEqual(
    index.entries.map((entry: { url: string }) => entry.url),
    items.map((item) => prefix + item.path),
  );
  for (const item of items) {
    const $ = load(
      await readFile(
        safePath(
          "dist",
          `${prefix.slice(1)}${item.path}index.html`.replace(/^\//, ""),
        ),
        "utf8",
      ),
    );
    const sources = $("a[data-reading-source]")
      .toArray()
      .map((el) => $(el).attr("href"));
    assert.deepEqual(
      sources,
      item.sources.map(
        (source) =>
          `${prefix}/sources/${source.documentId ?? documentId(source.url)}/`,
      ),
    );
    sourceLinks += sources.length;
    const ids = new Set(
      $("[id]")
        .toArray()
        .map((el) => $(el).attr("id")),
    );
    for (const link of $("article.reading-copy a[href^='#']").toArray()) {
      assert.ok(ids.has($(link).attr("href")?.slice(1)));
      notes++;
    }
  }
  for (const record of records) {
    const $ = load(
      await readFile(`dist${prefix}/sources/${record.id}/index.html`, "utf8"),
    );
    assert.deepEqual(
      $(".source-text p")
        .toArray()
        .map((el) => $(el).text()),
      record.text,
    );
    assert.ok($(".source-facts").text().includes(record.sha256));
    assert.equal(
      $(
        ".source-text script,.source-text iframe,.source-text object,.source-text a",
      ).length,
      0,
    );
  }
  const gapPage = load(await readFile(`dist${prefix}/gaps/index.html`, "utf8"));
  for (const gap of gaps)
    assert.equal(
      gapPage(`#${gap.id}`).length,
      1,
      `Explained reference ${gap.id}`,
    );
  await access(`dist/pagefind/${lang}/pagefind.js`);
  await assert.rejects(access(`dist${prefix}/review/index.html`));
}
const files = await readdir("dist", { recursive: true });
assert.ok(
  !files.some((file) =>
    /(?:^|\/)(?:review|review-decisions|map\.yaml)(?:[/.]|$)/.test(file),
  ),
);
await writeJson("reports/s3-validation.json", {
  passed: true,
  readingItems: items.length,
  sourceDocuments: records.length,
  sourceLinks,
  localNoteLinks: notes,
  searchIndexCountPerInterface: items.length,
  reviewExcludedFromProduction: true,
  explainedResources: Object.fromEntries(
    [...new Set(gaps.map((g) => g.reason))].map((reason) => [
      reason,
      gaps.filter((g) => g.reason === reason).length,
    ]),
  ),
});
console.log(
  `S3: ${items.length} reading items, ${sourceLinks} local source links and ${notes} in-page note links checked; review excluded from production.`,
);
