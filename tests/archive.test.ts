import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { convertHtml, decode, firstIdsOnly } from "../scripts/conversion.ts";
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
test("literal asterisks inside kept emphasis are not read as Markdown", () => {
  const r = convertHtml(
    "<html><body><p>da <i><b>*ŋroːg</b></i> con <i><b>*ŋroːg</b></i> e <b>a_b_c</b></p></body></html>",
    () => "/gaps/",
  );
  assert.match(r.markdown, /<b>&#42;ŋroːg<\/b>.*<b>&#42;ŋroːg<\/b>/);
  assert.match(r.markdown, /<b>a&#95;b&#95;c<\/b>/);
  assert.doesNotMatch(r.markdown, /[*_]/);
});
test("an id repeated across separately converted blocks keeps the first", () => {
  const seen = new Set<string>();
  const first = firstIdsOnly(
    'Anche <span id="Lorenzo"></span><span>Lorenzo</span>',
    seen,
  );
  const later = firstIdsOnly(
    'di <span id="Lorenzo"></span><span>Lorenzo</span> <b id="Lorenzo">x</b>',
    seen,
  );
  assert.match(first, /id="Lorenzo"/);
  assert.equal(later, "di <span>Lorenzo</span> <b>x</b>");
});
test("a paragraph number alone on its line stays text, not an empty list", () => {
  const r = convertHtml(
    "<html><body><p>fine.</p><p>88.</p><p>3)</p><p>12. In 1801</p></body></html>",
    () => "/gaps/",
  );
  assert.match(r.markdown, /^88\\\.$/m);
  assert.match(r.markdown, /^3\\\)$/m);
  assert.match(r.markdown, /^12\\\. In 1801$/m);
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
test("lenient mode keeps incomplete originals and lists their defects", () => {
  const gif = Buffer.concat([
    Buffer.from("GIF89a"),
    Buffer.alloc(20),
    Buffer.from([0x3b]),
  ]);
  const jpgUrl = url.replace(".htm", ".jpg");
  assert.throws(() => prepareData(gif, jpgUrl, "image/jpeg"));
  assert.deepEqual(
    prepareData(gif, jpgUrl, "image/jpeg", { lenient: true }).defects,
    ["GIF data with .jpg extension"],
  );
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9, 0, 0]);
  assert.throws(() => prepareData(jpeg, jpgUrl, "image/jpeg"));
  assert.match(
    prepareData(jpeg, jpgUrl, "image/jpeg", { lenient: true }).defects[0],
    /2 bytes after the end marker/,
  );
  const page = Buffer.from(
    "<html><head><title>Nades</title></head><body>Torna indietro",
  );
  assert.match(
    prepareData(page, url, "text/html", { lenient: true }).defects.join(),
    /HTML without closing/,
  );
  assert.deepEqual(
    prepareData(Buffer.from("<html><body>ok</body></html>"), url, "text/html")
      .defects,
    [],
  );
});
test("lenient mode still rejects error pages and files of the wrong kind", () => {
  const jpgUrl = url.replace(".htm", ".jpg");
  for (const [data, u] of [
    ["<html><body>Bot blocked</body></html>", url],
    ["<html><body>not found</body></html>", jpgUrl],
    ["plain text, no markup", url],
    ["<html>error</html>", url.replace(".htm", ".pdf")],
  ])
    assert.throws(() =>
      prepareData(Buffer.from(data), u, "text/html", { lenient: true }),
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
