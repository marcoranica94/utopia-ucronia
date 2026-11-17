import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { buildAuthorIndex } from "../src/author-index.ts";
import { workContentSchema } from "../src/editorial/content.ts";
import { fileFacts, openCache } from "./build-cache.ts";
import { writeJson } from "./recovery/core.ts";

/** Everything this check reads from a rendered page. Extracted once per page
 * content (cached by its bytes); every assertion below runs on each build. */
type Facts = {
  workCards: (string | null)[];
  authorIndex: (string | null)[];
  h1: string;
  authorTexts: number;
  authorLinks: (string | null)[];
  langSwitch: number;
  readingIds: (string | null)[];
  credits: (string | null)[];
};
const cache = await openCache<Facts>("discovery");
const hrefs = ($: ReturnType<typeof load>, selector: string) =>
  $(selector)
    .toArray()
    .map((el) => $(el).attr("href") ?? null);
// Pages do not change during the run: read and extract each one once.
const seen = new Map<string, Promise<Facts>>();
const page = (file: string) => {
  const known = seen.get(file);
  if (known) return known;
  const facts = fileFacts(cache, file, (bytes): Facts => {
    const $ = load(bytes.toString("utf8"));
    return {
      workCards: hrefs($, "[data-work] .work-card"),
      authorIndex: hrefs($, ".author-index a"),
      h1: $("h1").text(),
      authorTexts: $(".author-texts li").length,
      authorLinks: hrefs($, ".author-texts a"),
      langSwitch: $(".lang-switch a").length,
      readingIds: $("article.reading-copy [id]")
        .toArray()
        .map((el) => $(el).attr("id") ?? null),
      credits: hrefs($, ".author-credits a"),
    };
  });
  seen.set(file, facts);
  return facts;
};

const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as {
  slug: string;
  path: string;
  editorialId?: string;
}[];
const items = await Promise.all(
  conversions.map(async (entry) => {
    const raw = await readFile(`src/content/works/${entry.slug}.md`, "utf8");
    const data = Object.fromEntries(
      raw
        .split("---\n")[1]
        .trim()
        .split("\n")
        .map((line) => {
          const colon = line.indexOf(":");
          return [line.slice(0, colon), JSON.parse(line.slice(colon + 1))];
        }),
    );
    return { id: entry.slug, data: workContentSchema.parse(data) };
  }),
);
const authors = buildAuthorIndex(items);
const works = conversions.filter(
  (entry) => entry.editorialId && entry.path.startsWith("/works/"),
);
let checkedAnchors = 0;
for (const prefix of ["", "/en"]) {
  const library = await page(`dist${prefix}/library/index.html`);
  assert.deepEqual(
    [...library.workCards].sort(),
    works.map((work) => prefix + work.path).sort(),
  );
  const index = await page(`dist${prefix}/authors/index.html`);
  assert.deepEqual(
    [...index.authorIndex].sort(),
    authors.map((author) => prefix + author.path).sort(),
  );
  for (const author of authors) {
    const $ = await page(`dist${prefix}${author.path}index.html`);
    assert.equal($.h1, author.name);
    assert.equal($.authorTexts, author.entries.length);
    const links = $.authorLinks;
    for (const entry of author.entries) {
      assert.ok(links.includes(prefix + entry.path));
      const reader = await page(`dist${prefix}${entry.path}index.html`);
      for (const anchor of entry.anchors) {
        assert.ok(
          links.includes(
            `${prefix}${entry.path}#${encodeURIComponent(anchor)}`,
          ),
        );
        assert.ok(reader.readingIds.some((id) => id === anchor));
        checkedAnchors++;
      }
    }
    assert.equal($.langSwitch, 2);
  }
  for (const item of conversions) {
    const $ = await page(`dist${prefix}${item.path}index.html`);
    for (const href of $.credits) {
      assert.ok(authors.some((author) => prefix + author.path === href));
    }
  }
}
await cache.prune();
await writeJson("reports/discovery-validation.json", {
  passed: true,
  works: works.length,
  authors: authors.length,
  interfaces: 2,
  signedContributionLinks: checkedAnchors,
  scope:
    "Existing canonical reading items only; exact source spellings, no inferred alias merges or editorial approvals",
});
console.log(
  `Discovery verified: ${works.length} reading works, ${authors.length} signatures, ${checkedAnchors} signed links across both interfaces.`,
);
console.log(cache.summary());
