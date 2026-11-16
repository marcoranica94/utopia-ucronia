import assert from "node:assert/strict";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { load } from "cheerio";
import * as pagefind from "pagefind";
import { safePath, writeJson } from "./recovery/core.ts";

const items = JSON.parse(await readFile("reports/conversion.json", "utf8")) as {
  path: string;
  title: string;
  slug: string;
}[];
const reports = [];
for (const lang of ["it", "en"] as const) {
  const { index, errors } = await pagefind.createIndex({ forceLanguage: lang });
  assert.ok(index);
  assert.ok(!errors?.length, JSON.stringify(errors));
  const entries = [];
  for (const item of items) {
    const href = `${lang === "en" ? "/en" : ""}${item.path}`;
    const $ = load(
      await readFile(safePath("dist", `${href.slice(1)}index.html`), "utf8"),
    );
    const article = $("article.reading-copy");
    assert.equal(article.length, 1, `Search body: ${href}`);
    const content = article.text().replace(/\s+/g, " ").trim();
    assert.ok(content.length > 0);
    const originalLanguage = article.attr("lang") || "unknown";
    const result = await index.addCustomRecord({
      url: href,
      content: `${item.title}\n${content}`,
      language: lang,
      meta: {
        title: item.title,
        language: originalLanguage,
        source: $("a[data-reading-source]").first().attr("href") ?? "",
      },
      filters: { language: [originalLanguage] },
    });
    assert.ok(!result.errors?.length, JSON.stringify(result.errors));
    entries.push({
      url: href,
      title: item.title,
      language: originalLanguage,
      characters: content.length,
      probe: content
        .split(/\s+/)
        .slice(
          Math.min(40, Math.floor(content.split(/\s+/).length / 3)),
          Math.min(40, Math.floor(content.split(/\s+/).length / 3)) + 8,
        )
        .join(" "),
    });
  }
  const output = `dist/pagefind/${lang}`;
  await rm(output, { recursive: true, force: true });
  const result = await index.writeFiles({ outputPath: output });
  assert.ok(!result.errors?.length, JSON.stringify(result.errors));
  await mkdir("public/pagefind", { recursive: true });
  await rm(`public/pagefind/${lang}`, { recursive: true, force: true });
  await cp(output, `public/pagefind/${lang}`, { recursive: true });
  await index.deleteIndex();
  reports.push({ lang, count: entries.length, entries });
}
await pagefind.close();
await writeJson("reports/search-index.json", {
  passed: true,
  indexed:
    "Published reading text only; source copies, period tables, compatibility previews and review data excluded",
  indexes: reports,
});
console.log(
  `Pagefind indexed ${items.length} reading texts per interface language.`,
);
