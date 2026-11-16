import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { browseSchema } from "../src/browse/model.ts";
import { pageSizes, periodPath } from "../src/browse/pagination.ts";
import { safePath, sha256, writeJson } from "./recovery/core.ts";

const data = browseSchema.parse(
  JSON.parse(await readFile("src/generated/browse.json", "utf8")),
);
const targetById = new Map(data.targets.map((target) => [target.id, target]));
const normalize = (text: string) =>
  text.replace(/\s+/g, " ").trim().normalize("NFC");
const visited = new Set<string>();
const checks = [];
for (const lang of ["it", "en"] as const) {
  for (const [kind, groups, entries] of [
    ["divergences", data.promptGroups, data.prompts],
    ["works", data.workGroups, data.entries],
  ] as const) {
    for (const group of groups) {
      const expected = entries.filter((entry) => entry.group === group.id);
      const payload = JSON.parse(
        await readFile(
          safePath(
            "dist",
            `browse-data/${lang}/${kind === "divergences" ? "prompts" : "works"}/${group.id}.json`,
          ),
          "utf8",
        ),
      );
      assert.equal(payload.version, 1);
      assert.equal(payload.total, expected.length);
      assert.deepEqual(
        payload.entries.map((entry: { id: string }) => entry.id),
        expected.map((entry) => entry.id),
      );
      for (const [index, entry] of expected.entries()) {
        const row = payload.entries[index];
        assert.equal(row.title, entry.title);
        assert.deepEqual(row.authors, entry.authors);
        assert.equal(
          row.development,
          "developments" in entry && entry.developments.length > 0,
        );
        assert.equal(row.related, entry.targets.length > 0);
        const html = load(`<table><tbody>${row.html}</tbody></table>`);
        assert.equal(html(".browse-entry").attr("id"), entry.id);
        if ("body" in entry)
          assert.equal(
            normalize(html(".browse-prompt-text > p").text()),
            normalize(entry.body),
          );
      }
      for (const size of pageSizes) {
        const seen = new Set<string>();
        for (let offset = 0; offset < expected.length; offset += size) {
          const n = offset / size + 1;
          const path = `${lang === "en" ? "en/" : ""}${periodPath(kind === "divergences" ? "prompts" : "works", group.id, n, size).slice(1)}index.html`;
          const page = load(await readFile(safePath("dist", path), "utf8"));
          visited.add(path);
          assert.equal(
            page(".browse-entry").length,
            Math.min(size, expected.length - offset),
            `Page size: ${path}`,
          );
          const currentEntries = expected.slice(offset, offset + size);
          assert.deepEqual(
            page(".browse-page-sidebar [data-browse-title]")
              .toArray()
              .map((el) => page(el).attr("href")),
            currentEntries.map((entry) => `#${entry.id}`),
            `Current-page title index: ${path}`,
          );
          assert.equal(
            page(".browse-table thead th").length,
            kind === "divergences" ? 3 : 2,
            `Table columns: ${path}`,
          );
          assert.equal(
            page("#browse-bottom-page option").length,
            Math.ceil(expected.length / size),
            `Page selector count: ${path}`,
          );
          assert.equal(
            page("#browse-bottom-size option[selected]").text(),
            String(size),
            `Page size selector: ${path}`,
          );
          for (const entry of currentEntries) {
            const article = page(".browse-entry").filter(
              (_i, el) => page(el).attr("id") === entry.id,
            );
            assert.equal(
              article.length,
              1,
              `Missing or duplicate entry ${entry.id} on ${path}`,
            );
            assert.ok(!seen.has(entry.id), `Repeated page entry: ${entry.id}`);
            seen.add(entry.id);
            assert.equal(
              normalize(article.find("h2").text()),
              normalize(entry.title),
            );
            if ("body" in entry) {
              const text = article.find(".browse-prompt-text > p").length
                ? article.find(".browse-prompt-text > p").text()
                : article.find(".browse-excerpt").text();
              assert.equal(
                normalize(text),
                normalize(entry.body),
                `Complete prompt text: ${entry.id}`,
              );
              for (const author of entry.authors)
                assert.ok(
                  normalize(
                    article.find(".browse-attribution").text(),
                  ).includes(normalize(author)),
                  `Attribution: ${entry.id}`,
                );
            } else
              assert.equal(
                normalize(article.find(".browse-attribution").text()),
                normalize(entry.caption),
                `Source caption: ${entry.id}`,
              );
            if ("references" in entry)
              assert.deepEqual(
                article
                  .find(".browse-additional-references li a")
                  .toArray()
                  .map((el) => page(el).attr("href")),
                entry.references.map(
                  (id) =>
                    `${lang === "en" ? "/en" : ""}${targetById.get(id)?.href}`,
                ),
                `Additional source references: ${entry.id}`,
              );
            const links = article
              .find(".browse-work-references li a")
              .toArray()
              .map((el) => page(el).attr("href"));
            assert.deepEqual(
              links,
              entry.targets.map((id) => {
                const target = targetById.get(id);
                assert.ok(target);
                return `${lang === "en" ? "/en" : ""}${target.href}`;
              }),
              `Source references: ${entry.id}`,
            );
          }
        }
        assert.equal(seen.size, group.count, `Complete period: ${group.id}`);
        checks.push({ lang, kind, group: group.id, size, count: seen.size });
      }
    }
  }
  for (const target of data.targets) {
    const path = `${lang === "en" ? "en/" : ""}archive-records/${target.id}/index.html`;
    const page = load(await readFile(safePath("dist", path), "utf8"));
    assert.equal(normalize(page("h1").text()), normalize(target.title));
    assert.equal(
      page(`.browse-status.status-${target.status}`).length,
      1,
      `Distinct availability status: ${target.id}`,
    );
    assert.ok(
      normalize(page(".record-source").text()).includes(
        normalize(target.source),
      ),
      `Source provenance: ${target.id}`,
    );
  }
}
await writeJson("reports/browse-validation.json", {
  passed: true,
  promptsPerLanguage: data.prompts.length,
  catalogEntriesPerLanguage: data.entries.length,
  recordsPerLanguage: data.targets.length,
  listPages: visited.size,
  pageSizes: [...pageSizes],
  defaultPageSize: 40,
  contentDigest: sha256(Buffer.from(JSON.stringify(data))),
  checks,
});
console.log(
  `Historical index fidelity: all ${data.prompts.length} prompts, ${data.entries.length} catalog entries and ${data.targets.length} source records verified in both languages.`,
);
