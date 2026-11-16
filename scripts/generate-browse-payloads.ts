import assert from "node:assert/strict";
import { mkdir, readFile, rm } from "node:fs/promises";
import { load } from "cheerio";
import { normalizeSearch } from "../public/browse-filter.js";
import { browseSchema } from "../src/browse/model.ts";
import { periodPath } from "../src/browse/pagination.ts";
import { safePath, writeJson } from "./recovery/core.ts";

const data = browseSchema.parse(
  JSON.parse(await readFile("src/generated/browse.json", "utf8")),
);
const targets = new Map(data.targets.map((target) => [target.id, target]));
for (const root of ["public/browse-data", "dist/browse-data"]) {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
}
const reports = [];
for (const lang of ["it", "en"] as const)
  for (const [kind, groups, source] of [
    ["prompts", data.promptGroups, data.prompts],
    ["works", data.workGroups, data.entries],
  ] as const)
    for (const group of groups) {
      const entries = source.filter((entry) => entry.group === group.id);
      const rows = [];
      for (let offset = 0; offset < entries.length; offset += 40) {
        const page = offset / 40 + 1;
        const pathname = `${lang === "en" ? "en/" : ""}${periodPath(kind, group.id, page).slice(1)}index.html`;
        const $ = load(await readFile(safePath("dist", pathname), "utf8"));
        for (const entry of entries.slice(offset, offset + 40)) {
          const row = $(".browse-entry").filter(
            (_index, el) => $(el).attr("id") === entry.id,
          );
          assert.equal(row.length, 1, `Missing filter row: ${entry.id}`);
          assert.equal(row.find("script,iframe,object,embed,form").length, 0);
          for (const el of row.find("*").toArray())
            for (const [key, value] of Object.entries(el.attribs ?? {})) {
              assert.ok(!/^on/i.test(key), `Active source attribute: ${key}`);
              if (key === "href" || key === "src")
                assert.ok(!/^(?:javascript|data|vbscript):/i.test(value));
            }
          const prompt = "body" in entry ? entry : undefined;
          rows.push({
            id: entry.id,
            title: entry.title,
            authors: entry.authors,
            search: normalizeSearch(
              [
                entry.title,
                ...entry.authors,
                prompt?.body ?? ("caption" in entry ? entry.caption : ""),
              ].join(" "),
            ),
            statuses: [
              ...new Set(
                entry.targets.flatMap((id) => {
                  const t = targets.get(id);
                  return t ? [t.status] : [];
                }),
              ),
            ],
            development: Boolean(prompt?.developments.length),
            related: entry.targets.length > 0,
            html: $.html(row),
          });
        }
      }
      const payload = {
        version: 1,
        kind,
        group: group.id,
        total: rows.length,
        entries: rows,
      };
      for (const root of ["public/browse-data", "dist/browse-data"]) {
        await mkdir(`${root}/${lang}/${kind}`, { recursive: true });
        await writeJson(`${root}/${lang}/${kind}/${group.id}.json`, payload);
      }
      reports.push({
        lang,
        kind,
        group: group.id,
        entries: rows.length,
        documented: rows.filter((row) => row.development).length,
      });
    }
await writeJson("reports/browse-filter-payloads.json", {
  passed: true,
  groups: reports,
});
console.log(
  "Full-period filter payloads generated from all validated server-rendered rows in both languages.",
);
