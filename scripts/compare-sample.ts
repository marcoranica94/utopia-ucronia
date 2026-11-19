import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import type { EditorialItem, EditorialSource } from "../src/editorial/model.ts";
import { anatomy } from "./anatomy.ts";
import { attachmentEdition } from "./attachment-source.ts";
import { digest, openCache } from "./build-cache.ts";
import {
  applyCorrections,
  correctionsFor,
  readMap,
  redact,
  sourceHtml,
} from "./editorial-core.ts";
import type { Gap } from "./link-resolution.ts";
import { pdfLayoutText, readOcr } from "./pdf.ts";
import { safePath, sha256, urlKey, writeJson } from "./recovery/core.ts";
import { compareItemKey } from "./unit-keys.ts";

export const normalize = (text: string) =>
  text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/mailto:/gi, "")
    .replace(/[\s\p{Cc}\p{Cf}]/gu, "")
    .normalize("NFC");
function same(actual: string, expected: string, message: string) {
  if (actual === expected) return;
  let i = 0;
  while (i < actual.length && actual[i] === expected[i]) i++;
  const around = (s: string) => s.slice(Math.max(0, i - 70), i + 100);
  assert.fail(
    `${message} at ${i}\nconverted: ${around(actual)}\nexpected: ${around(expected)}`,
  );
}
const map = await readMap();
const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as {
  slug: string;
  path: string;
  editorialId?: string;
  structured: boolean;
  randomValidation: boolean;
  sources: EditorialSource[];
  removed: { source: string; text: string[] }[];
  gaps: string[];
}[];
const gaps = JSON.parse(
  await readFile("reports/link-gaps.json", "utf8"),
) as Gap[];
const validation = JSON.parse(
  await readFile("data/validation-sample.json", "utf8"),
) as { items: string[]; seed: string; method: string; groups: unknown[] };
assert.equal(validation.items.length, 30);
assert.equal(new Set(validation.items).size, 30);
assert.equal(
  conversions.filter((c) => c.randomValidation).length,
  30,
  "The fixed random sample must be fully converted",
);
type Conversion = (typeof conversions)[number];
type Report = Awaited<ReturnType<typeof compareItem>>;
const documentsDigest = digest(JSON.stringify(map.documents));
const cache = await openCache<Report>("compare");
const reports: Report[] = [];
const failures: string[] = [];
for (const c of conversions) {
  const pageBytes = await readFile(
    safePath("dist", `${c.path.slice(1)}index.html`),
  );
  const item = c.editorialId
    ? map.items.find((i) => i.id === c.editorialId)
    : undefined;
  const corrections = await correctionsFor(c.slug);
  // Every input of this item's verdict: rendered page, conversion record, map
  // item and its author names, all document records (illustrations are looked
  // up among them), the current bytes of each source original, the gap
  // entries the item can consult, and its corrections.
  const sourceBytes = [];
  for (const source of c.sources) {
    const document = map.documents.find((d) => d.id === source.documentId);
    sourceBytes.push(
      document
        ? digest(await readFile(safePath("archive/original", document.path)))
        : "missing",
      // A stored OCR is part of a scanned PDF's source (S8).
      document ? JSON.stringify((await readOcr(document.sha256)) ?? "") : "",
    );
  }
  const key = compareItemKey(cache, {
    page: pageBytes,
    conversion: c,
    item,
    authors: (item?.authors ?? []).map((id) =>
      map.authors.find((a) => a.id === id),
    ),
    documentsDigest,
    sourceDigests: sourceBytes,
    gaps: gaps.filter(
      (g) => c.gaps.includes(g.id) || c.sources.some((s) => s.url === g.source),
    ),
    corrections,
  });
  const cached = await cache.get(key);
  // A failing item throws before storing, so only verified reports are cached.
  // COMPARE_ALL=1 lists every failing item before failing, instead of the first.
  let report: Awaited<ReturnType<typeof compareItem>>;
  try {
    report = cached ?? (await compareItem(c, pageBytes, item, corrections));
  } catch (error) {
    if (!process.env.COMPARE_ALL) throw error;
    failures.push(
      String((error as Error).message)
        .split("\n")
        .slice(0, 3)
        .join("\n  "),
    );
    continue;
  }
  if (!cached) await cache.set(key, report);
  reports.push(report);
  if (reports.length % 10 === 0)
    console.log(
      `Fidelity: ${reports.length}/${conversions.length} items compared`,
    );
}
if (failures.length)
  throw new Error(`${failures.length} items failed:\n${failures.join("\n")}`);
async function compareItem(
  c: Conversion,
  pageBytes: Buffer,
  item: EditorialItem | undefined,
  corrections: Awaited<ReturnType<typeof correctionsFor>>,
) {
  const page = load(pageBytes.toString("utf8"));
  const fullPage = normalize(page("body").text());
  page("article [data-ui]").remove();
  const actual = normalize(page("article").text());
  const expectedParts: string[] = [];
  const originalParts: string[] = [];
  const parts = [];
  const ids = page("article [id]")
    .toArray()
    .map((el) => page(el).attr("id"));
  assert.equal(new Set(ids).size, ids.length, `Duplicate IDs: ${c.slug}`);
  let expectedTables = 0;
  const expectedImagePaths: string[] = [];
  let keptImages = 0;
  let explainedImageOccurrences = 0;
  let headings = 0;
  let anchors = 0;
  const removals = [];
  for (const [index, source] of c.sources.entries()) {
    const html = await sourceHtml(source, map);
    // PDFs and Word documents, loose or inside a zip (S7).
    const edition = await attachmentEdition(source, map);
    if (edition) {
      if (edition.rawText) {
        // The text layer read independently, with only declared removals.
        const reconstructed = load(edition.html)("body").text();
        same(
          normalize(reconstructed),
          normalize(pdfLayoutText(edition.rawText)),
          `Independent PDF text layer: ${c.slug}`,
        );
      }
      expectedImagePaths.push(
        ...edition.illustrations.map(
          (image) => `/sample/${sha256(image.bytes)}.${image.ext}`,
        ),
      );
      assert.equal(
        load(edition.html)("img").length,
        edition.illustrations.length,
        `PDF illustration placement: ${c.slug}`,
      );
      assert.equal(
        page("article img").length,
        edition.illustrations.length,
        `PDF image loss: ${c.slug}`,
      );
    }
    const original = load(html);
    original(
      "script,style,iframe,input,button,select,textarea,object,embed,applet,bgsound,noscript",
    ).remove();
    const originalText = normalize(original("body").text());
    originalParts.push(originalText);
    assert.ok(originalText.length, `Empty source: ${c.slug}`);
    const parsed = c.structured
      ? anatomy(html, item?.title ?? c.slug)
      : undefined;
    if (parsed)
      same(
        // Blocks are separate paragraphs: a space keeps word boundaries for
        // email redaction ("…@x.it" + "P.S." must not read as "x.itP").
        normalize(parsed.blocks.map((b) => b.text).join(" ")),
        originalText,
        `Parser coverage: ${c.slug}`,
      );
    const kept = parsed
      ? load(
          parsed.blocks
            .filter((b) => !parsed.removed.has(b))
            .map((b) => b.html)
            .join("\n"),
        )
      : original;
    expectedParts.push(
      parsed
        ? normalize(
            parsed.blocks
              .filter((b) => !parsed.removed.has(b))
              .map((b) => b.text)
              .join(" "),
          )
        : originalText,
    );
    if (parsed)
      for (const block of parsed.removed) {
        if (!block.text || /^[.*\s]*$/.test(block.text)) continue;
        let category: string;
        if (fullPage.includes(normalize(block.text)))
          category = "metadata-visible-in-page";
        else if (
          /^(?:di|de|by|par|por)\s+/iu.test(block.text) &&
          parsed.authors.some(
            (author) =>
              block.text.replace(/^(?:di|de|by|par|por)\s+/iu, "") === author &&
              fullPage.includes(normalize(author)),
          )
        )
          category = "source-byline-author-visible-in-page";
        else if (
          /^(?:torna(?:re)?|indietro|avanti|retour|volver|home)\b/i.test(
            block.text,
          ) &&
          load(block.html)("a[href]").length
        )
          category = "source-navigation";
        else if (
          /scrivete|scriveteci|scrivetemi|scrivi|écrivez|escribid|escríbanos|a quest[oa] indirizzo|per contribuire|per suggerimenti|se volete (?:farmi|fornirmi|farci|dirmi|commentare)/i.test(
            block.text,
          ) &&
          block.text.length < 250
        )
          category = "contact-invitation";
        else
          assert.fail(
            `Unexplained prose removal in ${c.slug}: ${block.text.slice(0, 250)}`,
          );
        removals.push({ source: source.url, category, text: block.text });
      }
    const prefix =
      item?.composition === "chapters" ? `chapter-${index + 1}-` : "";
    for (const anchor of new Set(
      original("a[name],[id]")
        .toArray()
        .map((el) => original(el).attr("name") ?? original(el).attr("id"))
        .filter(Boolean),
    )) {
      assert.ok(
        ids.includes(`${prefix}${anchor}`),
        `Source anchor lost in ${c.slug}: ${anchor}`,
      );
      anchors++;
    }
    expectedTables += kept("table").length;
    keptImages += kept("img").length;
    for (const image of kept("img").toArray()) {
      const resource = redact(
        new URL(kept(image).attr("src") ?? "", source.url).href,
      );
      if (
        gaps.some(
          (g) => g.image && g.source === source.url && g.resource === resource,
        )
      )
        explainedImageOccurrences++;
      else if (!edition) {
        const imageDocument = map.documents.find(
          (d) => urlKey(d.url) === urlKey(resource),
        );
        assert.ok(imageDocument, `Unmapped retained illustration: ${resource}`);
        expectedImagePaths.push(
          `/sample/${imageDocument.sha256}${path.extname(imageDocument.path).toLowerCase()}`,
        );
      }
    }
    headings += kept("h1,h2,h3,h4,h5,h6").length;
    parts.push({
      source: source.url,
      characters: originalText.length,
      parserCoverage: parsed
        ? "all source text accounted for"
        : "plain conversion",
      selectedBlocks:
        source.selection.kind === "blocks"
          ? [source.selection.start, source.selection.end]
          : undefined,
    });
  }
  let expected = expectedParts.join("");
  for (const correction of corrections) {
    const from = normalize(correction.from);
    assert.ok(
      expected.includes(from),
      `Correction cannot be traced to source text: ${c.slug}`,
    );
    expected = applyCorrections(
      expected,
      [{ from, to: normalize(correction.to) }],
      c.slug,
    );
  }
  same(actual, expected, `Text fidelity: ${c.slug}`);
  assert.equal(
    page("article table").length,
    expectedTables,
    `Table lost: ${c.slug}`,
  );
  assert.ok(
    page("article h1,article h2,article h3,article h4,article h5,article h6")
      .length >= headings,
    `Heading lost: ${c.slug}`,
  );
  for (const id of c.gaps)
    assert.ok(
      gaps.some((g) => g.id === id && g.reason),
      `Unexplained gap: ${c.slug} ${id}`,
    );
  const sourceImageGaps = gaps.filter(
    (g) => g.image && c.sources.some((s) => s.url === g.source),
  );
  assert.ok(
    page("article img").length + explainedImageOccurrences >= keptImages,
    `Unexplained image loss: ${c.slug}`,
  );
  assert.deepEqual(
    page("article img")
      .toArray()
      .map((el) => page(el).attr("src")),
    expectedImagePaths,
    `Image identity/order: ${c.slug}`,
  );
  if (item)
    for (const author of item.authors) {
      const name = map.authors.find((a) => a.id === author)?.name;
      assert.ok(
        name && fullPage.includes(normalize(name)),
        `Attribution absent from rendered page: ${c.slug} ${name}`,
      );
    }
  const pdf = c.sources.some((s) =>
    map.documents.find((d) => d.id === s.documentId)?.mediaType.includes("pdf"),
  );
  return {
    slug: c.slug,
    editorialId: c.editorialId,
    randomValidation: c.randomValidation,
    path: c.path,
    parts,
    text: "identical after whitespace normalization and explicitly checked removals/corrections",
    characters: originalParts.join("").length,
    tables: expectedTables,
    headings,
    anchors,
    images: {
      sourceKept: keptImages,
      viewable: page("article img").length,
      explainedGaps: sourceImageGaps.length,
      explainedOccurrences: explainedImageOccurrences,
    },
    declaredRemovals: removals,
    corrections,
    pdfTextLayer: pdf
      ? "independent unpdf text extraction matches reconstruction; all extracted illustrations present"
      : undefined,
    visualCheck:
      "Browser audit is recorded separately in reports/s2-browser.json; this script verifies source fidelity.",
  };
}
await writeJson("reports/sample-comparison.json", reports);
await writeJson("reports/s2-validation.json", {
  seed: validation.seed,
  method: validation.method,
  groups: validation.groups,
  randomCount: reports.filter((r) => r.randomValidation).length,
  totalCount: reports.length,
  allPassed: true,
  items: reports
    .filter((r) => r.randomValidation)
    .map((r) => ({
      id: r.editorialId,
      slug: r.slug,
      path: r.path,
      characters: r.characters,
      tables: r.tables,
      headings: r.headings,
      anchors: r.anchors,
      images: r.images,
    })),
});
await cache.prune();
console.log(
  `${reports.length} complete texts compared, including all 30 fixed random items; no unexplained text, anchor, table or image losses.`,
);
console.log(cache.summary());
