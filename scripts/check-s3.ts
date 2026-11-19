import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { load } from "cheerio";
import { hasSourcePage } from "../src/source-pages.ts";
import { fileFacts, openCache } from "./build-cache.ts";
import { documentId } from "./editorial-core.ts";
import { safePath, writeJson } from "./recovery/core.ts";

/** What this check reads from a page, extracted once per page content
 * (cached by its bytes); every assertion runs on each build. */
type Facts = {
  sources: (string | null)[];
  ids: (string | null)[];
  notes: (string | null)[];
  paragraphs: string[];
  sourceFacts: string;
  activeInSource: number;
};
const cache = await openCache<Facts>("s3");
const page = (file: string) =>
  fileFacts(cache, file, (bytes): Facts => {
    const $ = load(bytes.toString("utf8"));
    return {
      sources: $("a[data-reading-source]")
        .toArray()
        .map((el) => $(el).attr("href") ?? null),
      ids: $("[id]")
        .toArray()
        .map((el) => $(el).attr("id") ?? null),
      notes: $("article.reading-copy a[href^='#']")
        .toArray()
        .map((el) => $(el).attr("href")?.slice(1) ?? null),
      paragraphs: $(".source-text p")
        .toArray()
        .map((el) => $(el).text()),
      sourceFacts: $(".source-facts").text(),
      activeInSource: $(
        ".source-text script,.source-text iframe,.source-text object,.source-text a",
      ).length,
    };
  });

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
    const $ = await page(
      safePath(
        "dist",
        `${prefix.slice(1)}${item.path}index.html`.replace(/^\//, ""),
      ),
    );
    const sources = $.sources;
    assert.deepEqual(
      sources,
      item.sources
        .filter((source) => hasSourcePage(source.url))
        .map(
          (source) =>
            `${prefix}/sources/${source.documentId ?? documentId(source.url)}/`,
        ),
    );
    sourceLinks += sources.length;
    const ids = new Set($.ids);
    for (const target of $.notes) {
      assert.ok(target !== null && ids.has(target));
      notes++;
    }
  }
  for (const record of records) {
    const $ = await page(`dist${prefix}/sources/${record.id}/index.html`);
    assert.deepEqual($.paragraphs, record.text);
    assert.ok($.sourceFacts.includes(record.sha256));
    assert.equal($.activeInSource, 0);
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
await cache.prune();
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
console.log(cache.summary());
