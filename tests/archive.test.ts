import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { convertHtml, decode } from "../scripts/conversion.ts";
import {
  originalPath,
  prepareData,
  retryDelay,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
} from "../scripts/recovery/core.ts";

const url = "https://www.fmboschetto.it/Utopiaucronia/prova.htm";
test("a missing image leaves no empty link", () => {
  const r = convertHtml(
    '<html><body><a href="map.htm"><img src="map.gif"></a></body></html>',
    (_href, img) => (img ? "" : "/gaps/"),
  );
  assert.doesNotMatch(r.markdown, /gaps|<a|!\[/);
});
test("keeps the text swallowed by an unclosed FrontPage form", () => {
  const r = convertHtml(
    '<html><body><form><input value="vecchio controllo"><h1>Titolo</h1><p>Una storia da conservare.</p></body></html>',
    () => "/gaps/",
  );
  assert.match(r.markdown, /Una storia da conservare/);
  assert.doesNotMatch(r.markdown, /<form|<input/);
});
test("undeclared gzip: stores and hashes the decompressed bytes", () => {
  const data = Buffer.from("<html><body>Una storia</body></html>");
  const r = prepareData(gzipSync(data), url, "text/html");
  assert.equal(r.compressed, true);
  assert.deepEqual(r.data, data);
  assert.equal(sha256(r.data), sha256(data));
});
test("rejects 200 error pages, truncated HTML and PDF, and fake images", () => {
  for (const html of [
    "<html><body>Bot blocked</body></html>",
    "<html><body>HTTP Error 404</body></html>",
    "<html><body>testo",
  ])
    assert.throws(() => prepareData(Buffer.from(html), url, "text/html"));
  assert.throws(() =>
    prepareData(
      Buffer.from("<html>error</html>"),
      url.replace(".htm", ".pdf"),
      "application/pdf",
    ),
  );
  assert.throws(() =>
    prepareData(
      Buffer.from("%PDF-1.4 truncated"),
      url.replace(".htm", ".pdf"),
      "application/pdf",
    ),
  );
  assert.throws(() =>
    prepareData(
      Buffer.from("not an image"),
      url.replace(".htm", ".png"),
      "image/png",
    ),
  );
});
test("folds letter case without allowing escapes from the archive", () => {
  assert.equal(
    urlKey(url),
    urlKey(url.replace("Utopiaucronia", "utopiaucronia")),
  );
  assert.equal(originalPath(url), "utopiaucronia/prova.htm");
  assert.throws(() =>
    originalPath("https://other.example/Utopiaucronia/a.htm"),
  );
  assert.throws(() =>
    originalPath("https://www.fmboschetto.it/Utopiaucronia/%2e%2e%2fsecret"),
  );
  assert.throws(() => safePath("/archive", "../secret"));
});
test("numeric and HTTP-date Retry-After, backoff capped at ten minutes", () => {
  assert.equal(retryDelay("30", 0), 30000);
  assert.equal(
    retryDelay(
      "Wed, 11 Nov 2026 12:00:30 GMT",
      0,
      Date.parse("2026-11-11T12:00:00Z"),
    ),
    30000,
  );
  assert.equal(retryDelay(null, 2), 8000);
  assert.equal(retryDelay("3600", 0), 600000);
});
test("detects an altered original instead of treating it as already valid", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ucronia-test-"));
  try {
    await mkdir(path.join(root, "original"));
    const data = Buffer.from("original");
    await writeFile(path.join(root, "original/a.htm"), data);
    const d = {
      url,
      variants: [url],
      outcome: "recovered" as const,
      path: "a.htm",
      sha256: sha256(data),
      size: data.length,
    };
    assert.equal(await verifyDocument(d, root), true);
    await writeFile(path.join(root, "original/a.htm"), "altered");
    assert.equal(await verifyDocument(d, root), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("decodes Windows-1252 and keeps French accents", () => {
  assert.equal(decode(Buffer.from([0xe9, 0x20, 0x80])), "é €");
});
test("conversion: removes active code and email, keeps text, tables and anchors", () => {
  const html =
    '<html lang="fr"><head><title>Une histoire</title></head><body onload="evil()"><script>evil()</script><p>Été à Paris <a href="mailto:autore@example.org">Autore</a></p><a name="nota">Nota</a><table><tr><td>1848</td><td>République</td></tr></table><iframe src="https://evil.invalid"></iframe><img src="https://evil.invalid/a.png" onerror="evil()"><p>autore@example.org</p><a href="javascript:evil()">leggi</a></body></html>';
  const r = convertHtml(html, (_href, img) => (img ? "" : "/gaps/"));
  assert.equal(r.language, "fr");
  assert.match(r.markdown, /Été à Paris/);
  assert.match(r.markdown, /<table>/);
  assert.match(r.markdown, /id="nota"/);
  assert.doesNotMatch(
    r.markdown,
    /evil|mailto:|autore@example|<script|<iframe|onload|onerror/,
  );
});
