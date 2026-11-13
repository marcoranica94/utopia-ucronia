import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { manifestSchema, verifyDocument } from "../scripts/recovery/core.ts";

test("origin recovery saves provenance, distinguishes 404, and resumes without downloading valid files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "origin-test-"));
  try {
    await mkdir(path.join(root, "archive"));
    await writeFile(
      path.join(root, "archive/manifest.json"),
      JSON.stringify({ version: 1, documents: [] }),
    );
    const urls = [
      "https://www.fmboschetto.it/Utopiaucronia/map.gif",
      "https://www.fmboschetto.it/Utopiaucronia/missing.gif",
    ];
    await writeFile(
      path.join(root, "archive/queue.json"),
      JSON.stringify({
        version: 1,
        source: "www.fmboschetto.it/Utopiaucronia/*",
        complete: true,
        resumeKey: null,
        pages: 1,
        documents: urls.map((url) => ({
          url,
          variants: [url],
          captures: [],
          foundIn: [],
        })),
      }),
    );
    const preload = path.join(root, "mock.mjs");
    await writeFile(
      preload,
      `globalThis.fetch = async input => String(input).includes('missing.gif') ? new Response('',{status:404}) : new Response('GIF89a-test',{headers:{'content-type':'image/gif'}});`,
    );
    const cli = path.resolve("scripts/recovery/origin.ts");
    const result = spawnSync(
      process.execPath,
      ["--import", preload, cli, "--limit", "2"],
      { cwd: root, encoding: "utf8", timeout: 15000 },
    );
    assert.equal(result.status, 0, result.stderr);
    const manifest = manifestSchema.parse(
      JSON.parse(
        await readFile(path.join(root, "archive/manifest.json"), "utf8"),
      ),
    );
    assert.equal(manifest.documents.length, 2);
    const recovered = manifest.documents.find((d) => d.outcome === "recovered");
    assert.ok(recovered);
    assert.equal(recovered.source, "origin");
    assert.ok(recovered.retrievedAt);
    assert.equal(recovered.timestamp, undefined);
    assert.equal(
      await verifyDocument(recovered, path.join(root, "archive")),
      true,
    );
    assert.equal(
      manifest.documents.find((d) => d.url === urls[1])?.outcome,
      "missing",
    );
    await writeFile(
      preload,
      `globalThis.fetch = () => { throw new Error('Unexpected network request on resume'); };`,
    );
    const rerun = spawnSync(process.execPath, ["--import", preload, cli], {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout, /0 recovered this run/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
