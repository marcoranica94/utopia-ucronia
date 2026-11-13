import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { discover } from "../scripts/recovery/discover.ts";

test("discovery saves linked URLs on failure and resumes without duplicates", async () => {
  const cwd = process.cwd();
  const root = await mkdtemp(path.join(os.tmpdir(), "discovery-"));
  const url = "https://www.fmboschetto.it/Utopiaucronia/a.htm";
  try {
    process.chdir(root);
    await mkdir("archive/original", { recursive: true });
    await writeFile(
      "archive/original/a.htm",
      '<html><body background="bg.gif" style="background:url(cover.jpg)"><a href="b.htm">B</a><img srcset="one.png 1x, two.png 2x"><style>p{background:url(texture.gif)}</style></body></html>',
    );
    await writeFile(
      "archive/manifest.json",
      JSON.stringify({
        version: 1,
        documents: [
          {
            url,
            variants: [url],
            outcome: "recovered",
            path: "a.htm",
            type: "text/html",
          },
        ],
      }),
    );
    await assert.rejects(
      discover(1, 2, async () => {
        throw new Error("offline");
      }),
      /offline/,
    );
    const queue = async () =>
      JSON.parse(await readFile("archive/queue.json", "utf8"));
    assert.equal((await queue()).documents.length, 7);
    const header = [
      "original",
      "timestamp",
      "mimetype",
      "statuscode",
      "digest",
    ];
    const row = [url, "20200101000000", "text/html", "200", "abc"];
    await discover(1, 2, async () => Response.json([header, row, ["next"]]));
    assert.equal((await queue()).resumeKey, "next");
    await discover(1, 2, async (requestUrl) => {
      assert.equal(new URL(requestUrl).searchParams.get("resumeKey"), "next");
      return Response.json([header, row]);
    });
    const result = await queue();
    assert.equal(result.complete, true);
    assert.equal(result.pages, 2);
    for (const name of [
      "bg.gif",
      "cover.jpg",
      "one.png",
      "two.png",
      "texture.gif",
    ])
      assert.ok(
        result.documents.some((d: { url: string }) =>
          d.url.endsWith(`/${name}`),
        ),
      );
    assert.equal(
      result.documents.find((d: { url: string }) => d.url === url).captures
        .length,
      1,
    );
    assert.deepEqual(
      result.documents.find((d: { url: string }) => d.url.endsWith("/b.htm"))
        .foundIn,
      [url],
    );
  } finally {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  }
});

test("bulk download requires a complete discovery queue", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bulk-queue-"));
  const cli = path.resolve("scripts/recovery/cli.ts");
  try {
    await mkdir(path.join(root, "archive"));
    await writeFile(
      path.join(root, "archive/manifest.json"),
      JSON.stringify({ version: 1, documents: [] }),
    );
    const queue = path.join(root, "archive/queue.json");
    await writeFile(queue, JSON.stringify({ complete: false, documents: [] }));
    const incomplete = spawnSync(process.execPath, [cli, "download"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /Discovery is incomplete/);
    await writeFile(queue, JSON.stringify({ complete: true, documents: [] }));
    const complete = spawnSync(process.execPath, [cli, "download"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(complete.status, 0, complete.stderr);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("coverage keeps image gaps linked to their referring page", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "coverage-"));
  const cli = path.resolve("scripts/recovery/cli.ts");
  try {
    await mkdir(path.join(root, "archive"));
    const page = "https://www.fmboschetto.it/Utopiaucronia/page.htm";
    const image = "https://www.fmboschetto.it/Utopiaucronia/map.gif";
    await writeFile(
      path.join(root, "archive/manifest.json"),
      JSON.stringify({
        version: 1,
        documents: [{ url: image, variants: [image], outcome: "missing" }],
      }),
    );
    await writeFile(
      path.join(root, "archive/queue.json"),
      JSON.stringify({
        complete: true,
        documents: [{ url: image, foundIn: [page] }],
      }),
    );
    const result = spawnSync(process.execPath, [cli, "coverage"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const report = await readFile(
      path.join(root, "archive/coverage.md"),
      "utf8",
    );
    assert.match(report, /\| Images \| 0 \| 1 \| 0 \| 0 \| 1 \| 0\.0% \|/);
    assert.ok(report.includes(image) && report.includes(page));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ten overlapping downloads preserve all manifest entries", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bulk-concurrency-"));
  const cli = path.resolve("scripts/recovery/cli.ts");
  try {
    await mkdir(path.join(root, "archive"));
    await writeFile(
      path.join(root, "archive/manifest.json"),
      JSON.stringify({ version: 1, documents: [] }),
    );
    const urls = [
      "https://www.fmboschetto.it/Utopiaucronia/a.htm",
      "https://www.fmboschetto.it/Utopiaucronia/b.htm",
      "https://www.fmboschetto.it/Utopiaucronia/c.htm",
      "https://www.fmboschetto.it/Utopiaucronia/d.htm",
      "https://www.fmboschetto.it/Utopiaucronia/e.htm",
      "https://www.fmboschetto.it/Utopiaucronia/f.htm",
      "https://www.fmboschetto.it/Utopiaucronia/g.htm",
      "https://www.fmboschetto.it/Utopiaucronia/h.htm",
      "https://www.fmboschetto.it/Utopiaucronia/i.htm",
      "https://www.fmboschetto.it/Utopiaucronia/j.htm",
    ];
    await writeFile(
      path.join(root, "archive/queue.json"),
      JSON.stringify({
        complete: true,
        documents: urls.map((url, i) => ({
          url,
          captures:
            i === 0
              ? [
                  {
                    url: url.replace("/a.htm", "/A.htm"),
                    timestamp: "20200101000000",
                    type: "text/html",
                  },
                ]
              : [],
        })),
      }),
    );
    const preload = path.join(root, "mock.mjs");
    await writeFile(
      preload,
      `globalThis.fetch = async (input) => {
      const u = new URL(input);
      if (u.pathname.includes('/cdx/')) { const original = u.searchParams.get('url'); return Response.json(original.endsWith('/a.htm') ? [] : [['timestamp','original','mimetype'], ['20200101000000', original, 'text/html']]); }
      return new Response('<html><body>valid</body></html>', {headers:{'content-type':'text/html'}});
    };`,
    );
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        preload,
        cli,
        "download",
        "--batch",
        "10",
        "--max-batches",
        "1",
        "--concurrency",
        "10",
      ],
      { cwd: root, encoding: "utf8", timeout: 35000 },
    );
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(
      await readFile(path.join(root, "archive/manifest.json"), "utf8"),
    );
    assert.equal(manifest.documents.length, 10);
    assert.deepEqual(
      new Set(manifest.documents.map((d: { url: string }) => d.url)),
      new Set(urls),
    );
    assert.ok(
      manifest.documents.every(
        (d: { outcome: string }) => d.outcome === "recovered",
      ),
    );
    assert.ok(
      manifest.documents
        .find((d: { url: string }) => d.url === urls[0])
        .variants.some((v: string) => v.endsWith("/A.htm")),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
