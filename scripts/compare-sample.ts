import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { decode } from "./conversion.ts";
import { readManifest, safePath, writeJson } from "./recovery/core.ts";

// The text must match after only the declared removals, with whitespace normalized.
function normalize(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/mailto:/gi, "")
    .replace(/\s/g, "")
    .normalize("NFC");
}
const manifest = await readManifest();
const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as { slug: string; source: string }[];
assert.ok(
  conversions.length > 0,
  "The comparison cannot pass on an empty sample",
);
const reports = [];
for (const c of conversions) {
  const document = manifest.documents.find((d) => d.url === c.source);
  assert.ok(document?.path);
  const source = load(
    decode(await readFile(safePath("archive/original", document.path))),
  );
  source(
    "script,style,iframe,input,button,select,textarea,object,embed,applet,bgsound,noscript",
  ).remove();
  const page = load(
    await readFile(safePath("dist/works", `${c.slug}/index.html`), "utf8"),
  );
  const original = normalize(source("body").text());
  const converted = normalize(page("article").text());
  assert.ok(original.length > 0, `Empty source: ${c.slug}`);
  assert.equal(converted, original, `Converted text does not match: ${c.slug}`);
  const anchors = [
    ...new Set(
      source("a[name]")
        .toArray()
        .map((e) => source(e).attr("name")),
    ),
  ];
  const ids = page("article [id]")
    .toArray()
    .map((e) => page(e).attr("id"));
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${c.slug}`);
  for (const anchor of anchors)
    assert.ok(ids.includes(anchor), `Anchor lost in ${c.slug}`);
  assert.equal(
    page("article table").length,
    source("table").length,
    `Table lost: ${c.slug}`,
  );
  const sourceImages = source("img").length;
  const convertedImages = page("article img").length;
  reports.push({
    slug: c.slug,
    characters: original.length,
    text: "identical after whitespace normalization and declared removals",
    anchors: anchors.length,
    tables: source("table").length,
    images: {
      source: sourceImages,
      viewable: convertedImages,
      excludedFromSample: sourceImages - convertedImages,
    },
    visualCheck: "to run in the browser",
    editorialAttributions: "to verify",
  });
}
await writeJson("reports/sample-comparison.json", reports);
console.log(
  `${reports.length} texts compared in full: text, accents, anchors and tables preserved. Visual check still needed.`,
);
