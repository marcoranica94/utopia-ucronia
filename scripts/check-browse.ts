import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { browseSchema } from "../src/browse/model.ts";
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
      const seen = new Set<string>();
      for (let offset = 0; offset < expected.length; offset += 40) {
        const n = offset / 40 + 1;
        const path = `${lang === "en" ? "en/" : ""}${kind}/period/${group.id}/${n > 1 ? `${n}/` : ""}index.html`;
        const page = load(await readFile(safePath("dist", path), "utf8"));
        visited.add(path);
        assert.equal(
          page(".browse-entry").length,
          Math.min(40, expected.length - offset),
          `Page size: ${path}`,
        );
        for (const entry of expected.slice(offset, offset + 40)) {
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
                normalize(article.find(".browse-attribution").text()).includes(
                  normalize(author),
                ),
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
      checks.push({ lang, kind, group: group.id, count: seen.size });
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
  contentDigest: sha256(Buffer.from(JSON.stringify(data))),
  checks,
});
console.log(
  `Historical index fidelity: all ${data.prompts.length} prompts, ${data.entries.length} catalog entries and ${data.targets.length} source records verified in both languages.`,
);
