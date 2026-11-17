import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { buildAuthorIndex } from "../src/author-index.ts";
import { workContentSchema } from "../src/editorial/content.ts";
import { writeJson } from "./recovery/core.ts";

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
  const library = load(
    await readFile(`dist${prefix}/library/index.html`, "utf8"),
  );
  assert.deepEqual(
    library("[data-work] .work-card")
      .toArray()
      .map((el) => library(el).attr("href"))
      .sort(),
    works.map((work) => prefix + work.path).sort(),
  );
  const index = load(
    await readFile(`dist${prefix}/authors/index.html`, "utf8"),
  );
  assert.deepEqual(
    index(".author-index a")
      .toArray()
      .map((el) => index(el).attr("href"))
      .sort(),
    authors.map((author) => prefix + author.path).sort(),
  );
  for (const author of authors) {
    const $ = load(
      await readFile(`dist${prefix}${author.path}index.html`, "utf8"),
    );
    assert.equal($("h1").text(), author.name);
    assert.equal($(".author-texts li").length, author.entries.length);
    const links = $(".author-texts a")
      .toArray()
      .map((el) => $(el).attr("href"));
    for (const entry of author.entries) {
      assert.ok(links.includes(prefix + entry.path));
      const reader = load(
        await readFile(`dist${prefix}${entry.path}index.html`, "utf8"),
      );
      for (const anchor of entry.anchors) {
        assert.ok(
          links.includes(
            `${prefix}${entry.path}#${encodeURIComponent(anchor)}`,
          ),
        );
        assert.ok(
          reader("article.reading-copy [id]")
            .toArray()
            .some((el) => reader(el).attr("id") === anchor),
        );
        checkedAnchors++;
      }
    }
    assert.equal($(".lang-switch a").length, 2);
  }
  for (const item of conversions) {
    const $ = load(
      await readFile(`dist${prefix}${item.path}index.html`, "utf8"),
    );
    for (const el of $(".author-credits a").toArray()) {
      assert.ok(
        authors.some((author) => prefix + author.path === $(el).attr("href")),
      );
    }
  }
}
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
