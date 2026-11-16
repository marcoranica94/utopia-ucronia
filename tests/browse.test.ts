import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogCells, recordId, resourceKey } from "../scripts/browse-core.ts";
import { browseSchema, targetSchema } from "../src/browse/model.ts";

const base = "https://www.fmboschetto.it/Utopiaucronia/lavori_1.htm";
test("catalog grids yield one entry per leaf cell, including cycle indexes", () => {
  const html =
    '<table><tr><td><p><a href="one.htm">First work</a></p><p>di <a href="mailto:a@example.org">Ada</a></p></td><td><a href="../racconti/cycle/Index.htm">A complete cycle</a><br>di Bea</td></tr></table>';
  const entries = catalogCells(html, base);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, "First work");
  assert.equal(entries[0].caption, "di Ada");
  assert.equal(entries[0].links.length, 1);
  assert.equal(
    entries[1].links[0].url,
    "https://www.fmboschetto.it/racconti/cycle/Index.htm",
  );
  assert.ok(!JSON.stringify(entries).includes("example.org"));
});
test("nested layout containers do not duplicate works or turn author links into works", () => {
  const html =
    '<table><tr><td><table><tr><td><p><a href="first.htm">First</a> / <a href="second.htm">Second version</a></p><p>di <a href="https://author.example/">Author</a></p></td></tr></table></td></tr></table>';
  const entries = catalogCells(html, base);
  assert.equal(entries.length, 1);
  assert.deepEqual(
    entries[0].links.map((link) => link.title),
    ["First", "Second version"],
  );
});
test("active source elements and unsafe links never become catalog actions", () => {
  const entries = catalogCells(
    '<table><td><p><a href="javascript:alert(1)">Bad</a><a href="work.htm">Good</a></p><script>alert(1)</script></td></table>',
    base,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "BadGood");
  assert.equal(
    entries[0].links[0].url,
    "https://www.fmboschetto.it/Utopiaucronia/work.htm",
  );
  assert.ok(!JSON.stringify(entries).includes("alert(1)"));
});
test("source references fold IIS path case while preserving meaningful fragments", () => {
  assert.equal(
    resourceKey("http://www.fmboschetto.it:80/Utopiaucronia/WORK.htm#First"),
    resourceKey("https://fmboschetto.it/utopiaucronia/work.htm#First"),
  );
  assert.notEqual(recordId(`${base}#A`), recordId(`${base}#a`));
  assert.notEqual(
    recordId("https://external.example/?q=one"),
    recordId("https://external.example/?q=two"),
  );
});
test("catalog schema rejects unexplained target references and incorrect group totals", () => {
  const data = {
    version: 1,
    promptGroups: [],
    workGroups: [
      {
        id: "ancient",
        source: base,
        title: { it: "Antichità", en: "Ancient" },
        count: 1,
      },
    ],
    prompts: [],
    entries: [
      {
        id: "catalog-a",
        title: "A",
        caption: "di Ada",
        group: "ancient",
        source: base,
        cell: 0,
        targets: ["missing-record"],
      },
    ],
    targets: [],
  };
  assert.equal(browseSchema.safeParse(data).success, false);
  assert.equal(browseSchema.safeParse({ ...data, entries: [] }).success, false);
  assert.equal(
    targetSchema.safeParse({
      id: "record-0123456789ab",
      title: "A",
      source: base,
      status: "ready",
      href: "javascript:alert(1)",
    }).success,
    false,
  );
});

test("a recovered work is not labeled readable until a published page exists", () => {
  const record = {
    id: "record-0123456789ab",
    title: "An existing work",
    source: base,
    status: "recovered",
    href: "/archive-records/record-0123456789ab/",
  };
  assert.equal(targetSchema.safeParse(record).success, true);
  assert.equal(
    targetSchema.safeParse({ ...record, status: "ready" }).success,
    false,
  );
  assert.equal(
    targetSchema.safeParse({
      ...record,
      status: "ready",
      href: "/works/a/",
      readingHref: "/works/a/",
    }).success,
    true,
  );
  assert.equal(
    targetSchema.safeParse({ ...record, readingHref: "/works/a/" }).success,
    false,
  );
});

test("FrontPage links around a quote or part of a word do not truncate titles", () => {
  const entries = catalogCells(
    '<table><td><p><a href="first.htm">«</a>Divided We Stand »</p><p>di Ada</p></td><td><p><a href="second.htm">Morir</a>e per Kiev?<br>di <a href="mailto:b@example.org">Bea</a></p></td><td><p><a href="third.htm">Italia Unit</a><a href="broken.htm">a</a> di <a href="mailto:c@example.org">Camus</a></p></td></table>',
    base,
  );
  assert.deepEqual(
    entries.map((entry) => entry.title),
    ["«Divided We Stand »", "Morire per Kiev?", "Italia Unita"],
  );
  assert.deepEqual(
    entries.map((entry) => entry.caption),
    ["di Ada", "di Bea", "di Camus"],
  );
  assert.equal(entries[2].links[1].title, "Italia Unita");
});

test("source indentation inside a linked title is not mistaken for an author line", () => {
  const [entry] = catalogCells(
    '<table><td><p><a href="book.pdf">Albe\n di Cieli Lontani</a></p><p>[saggio] di Ada</p></td></table>',
    base,
  );
  assert.equal(entry.title, "Albe di Cieli Lontani");
  assert.equal(entry.caption, "[saggio] di Ada");
});

test("page-size routes preserve existing links and locate the current first entry", async () => {
  const { periodPath, pageForSize, pageSizes } = await import(
    "../src/browse/pagination.ts"
  );
  assert.equal(
    periodPath("prompts", "ancient"),
    "/divergences/period/ancient/",
  );
  assert.equal(periodPath("works", "roman", 2), "/works/period/roman/2/");
  assert.equal(
    periodPath("prompts", "ancient", 3, 20),
    "/divergences/period/ancient/size/20/3/",
  );
  assert.equal(pageForSize(2, 40, 20, 426), 3);
  assert.equal(pageForSize(11, 40, 100, 426), 5);
  for (const size of pageSizes)
    for (const next of pageSizes)
      for (let page = 1; page <= Math.ceil(426 / size); page++) {
        const first = (page - 1) * size;
        const nextPage = pageForSize(page, size, next, 426);
        assert.ok(first >= (nextPage - 1) * next && first < nextPage * next);
      }
  assert.throws(() => periodPath("works", "roman", 0));
  assert.throws(() => periodPath("works", "roman", 1, 30));
});
