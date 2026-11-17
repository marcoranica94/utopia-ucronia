import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  BuildCache,
  cacheEnabled,
  digest,
  fileFacts,
  toolchainHash,
} from "../scripts/build-cache.ts";
import { checkLinks, type PageFacts } from "../scripts/link-check.ts";
import { compareItemKey, convertPageKey } from "../scripts/unit-keys.ts";

async function fixture() {
  return mkdtemp(path.join(tmpdir(), "build-cache-"));
}
async function write(root: string, file: string, content: string) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), content);
}
const page = (body: string) =>
  `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

async function site(root: string) {
  const dist = path.join(root, "dist");
  await write(
    dist,
    "_headers",
    "/*\n  Content-Security-Policy: script-src 'self'\n",
  );
  await write(dist, "index.html", page('<a href="/works/a/#chapter">A</a>'));
  await write(dist, "works/a/index.html", page('<h2 id="chapter">One</h2>'));
  return dist;
}
const linksCache = (root: string, toolchain = "tools-1") =>
  new BuildCache<PageFacts>("links", toolchain, {
    root: path.join(root, "cache"),
    enabled: true,
  });

test("BUILD_CACHE=off disables the cache", async () => {
  assert.equal(cacheEnabled({ BUILD_CACHE: "off" }), false);
  assert.equal(cacheEnabled({}), true);
  const root = await fixture();
  const cache = new BuildCache<number>("unit", "t", { root, enabled: false });
  const key = cache.key("a");
  await cache.set(key, 1);
  assert.equal(await cache.get(key), undefined);
  assert.deepEqual(await readdir(root), []);
  await rm(root, { recursive: true });
});

test("digest separates its parts unambiguously", () => {
  assert.notEqual(digest("ab", "c"), digest("a", "bc"));
  assert.equal(digest("a", Buffer.from("b")), digest("a", "b"));
});

test("a toolchain change, but not a generated file, changes the digest", async () => {
  const root = await fixture();
  await write(root, "package.json", "{}");
  await write(root, "scripts/convert.ts", "export {};");
  await write(root, "src/generated/sources.json", "[]");
  await write(root, "data/corrections/x.json", "[]");
  const first = await toolchainHash(root);
  await write(root, "src/generated/sources.json", "[1]");
  await write(root, "src/content/works/x.md", "generated");
  assert.equal(await toolchainHash(root), first);
  await write(root, "scripts/convert.ts", "export const changed = 1;");
  const second = await toolchainHash(root);
  assert.notEqual(second, first);
  await write(root, "data/corrections/x.json", '[{"from":"a","to":"b"}]');
  assert.notEqual(await toolchainHash(root), second);
  await rm(root, { recursive: true });
});

test("a changed toolchain recomputes every unit", async () => {
  const root = await fixture();
  const dist = await site(root);
  const first = linksCache(root, "tools-1");
  await checkLinks(dist, first);
  assert.equal(first.stats.misses, 2);
  const same = linksCache(root, "tools-1");
  await checkLinks(dist, same);
  assert.deepEqual([same.stats.hits, same.stats.misses], [2, 0]);
  const changed = linksCache(root, "tools-2");
  await checkLinks(dist, changed);
  assert.deepEqual([changed.stats.hits, changed.stats.misses], [0, 2]);
  await rm(root, { recursive: true });
});

test("a changed page is recomputed and a broken page fails despite a good cache", async () => {
  const root = await fixture();
  const dist = await site(root);
  assert.deepEqual((await checkLinks(dist, linksCache(root))).errors, []);
  await write(
    dist,
    "index.html",
    page(
      '<a href="/works/missing/">B</a><a href="mailto:x@example.org">x@example.org</a>',
    ),
  );
  const cache = linksCache(root);
  const result = await checkLinks(dist, cache);
  assert.deepEqual([cache.stats.hits, cache.stats.misses], [1, 1]);
  assert.deepEqual(result.errors, [
    `${path.join(dist, "index.html")}: active code or email`,
    `${path.join(dist, "index.html")}: /works/missing/`,
    `${path.join(dist, "index.html")}: mailto:x@example.org`,
  ]);
  // Identical verdict without the cache.
  assert.deepEqual((await checkLinks(dist)).errors, result.errors);
  await rm(root, { recursive: true });
});

test("a removed anchor in a target page fails the unchanged, cached linking page", async () => {
  const root = await fixture();
  const dist = await site(root);
  assert.deepEqual((await checkLinks(dist, linksCache(root))).errors, []);
  await write(dist, "works/a/index.html", page('<h2 id="renamed">One</h2>'));
  const cache = linksCache(root);
  const { errors } = await checkLinks(dist, cache);
  assert.deepEqual([cache.stats.hits, cache.stats.misses], [1, 1]);
  assert.deepEqual(errors, [
    `${path.join(dist, "index.html")}: /works/a/#chapter`,
  ]);
  await rm(root, { recursive: true });
});

test("a corrupted entry is ignored and recomputed; prune drops unused entries", async () => {
  const root = await fixture();
  const dist = await site(root);
  await checkLinks(dist, linksCache(root));
  const dir = path.join(root, "cache", "links");
  const files = (await readdir(dir)).sort();
  assert.equal(files.length, 2);
  for (const file of files) await writeFile(path.join(dir, file), "{not json");
  const cache = linksCache(root);
  assert.deepEqual((await checkLinks(dist, cache)).errors, []);
  assert.deepEqual([cache.stats.hits, cache.stats.misses], [0, 2]);
  const again = linksCache(root);
  await checkLinks(dist, again);
  assert.equal(again.stats.hits, 2);
  await writeFile(path.join(dir, `${"0".repeat(64)}.json`), "stale");
  assert.equal(await again.prune(), 1);
  assert.deepEqual((await readdir(dir)).sort(), files);
  await rm(root, { recursive: true });
});

test("file facts are keyed by bytes and identical fresh or cached", async () => {
  const root = await fixture();
  await write(root, "a.html", page("<a>no href</a>"));
  const cache = new BuildCache<(string | null)[]>("facts", "t", {
    root: path.join(root, "cache"),
    enabled: true,
  });
  const extract = (bytes: Buffer) =>
    /href=/.test(bytes.toString()) ? ["x"] : [undefined as unknown as string];
  const fresh = await fileFacts(cache, path.join(root, "a.html"), extract);
  const cached = await fileFacts(cache, path.join(root, "a.html"), extract);
  assert.deepEqual(fresh, [null]);
  assert.deepEqual(cached, fresh);
  await write(root, "a.html", page('<a href="x">x</a>'));
  assert.deepEqual(await fileFacts(cache, path.join(root, "a.html"), extract), [
    "x",
  ]);
  assert.deepEqual([cache.stats.hits, cache.stats.misses], [1, 2]);
  await rm(root, { recursive: true });
});

test("a changed source byte or correction changes the conversion key", () => {
  const cache = new BuildCache<unknown>("convert", "t", { enabled: true });
  const descriptor = { slug: "a", parts: [{ prefix: "" }] };
  const document = { id: "doc-1", sha256: "x" };
  const key = (bytes: string, corrections: unknown[], tools = cache) =>
    convertPageKey(tools, descriptor, corrections, [
      { document, bytes: Buffer.from(bytes) },
    ]);
  const base = key("<p>Testo</p>", []);
  assert.equal(key("<p>Testo</p>", []), base);
  assert.notEqual(key("<p>Testa</p>", []), base);
  assert.notEqual(key("<p>Testo</p>", [{ from: "Testo", to: "Text" }]), base);
  assert.notEqual(
    key("<p>Testo</p>", [], new BuildCache<unknown>("convert", "t2")),
    base,
  );
  assert.notEqual(
    convertPageKey(
      cache,
      { ...descriptor, title: "b" },
      [],
      [{ document, bytes: Buffer.from("<p>Testo</p>") }],
    ),
    base,
  );
});

test("every fidelity input changes the comparison key", () => {
  const cache = new BuildCache<unknown>("compare", "t", { enabled: true });
  const inputs = {
    page: Buffer.from(page('<article id="a">Testo</article>')),
    conversion: { slug: "a" },
    item: { id: "item-1" },
    authors: [{ id: "author-1", name: "Nome" }],
    documentsDigest: "d",
    sourceDigests: [digest("source")],
    gaps: [],
    corrections: [],
  };
  const base = compareItemKey(cache, inputs);
  assert.equal(compareItemKey(cache, { ...inputs }), base);
  const variants = {
    page: Buffer.from(page('<article id="b">Testo</article>')),
    conversion: { slug: "b" },
    item: { id: "item-2" },
    authors: [{ id: "author-1", name: "Altro" }],
    documentsDigest: "e",
    sourceDigests: [digest("source changed")],
    gaps: [{ id: "gap-1" }],
    corrections: [{ from: "Testo", to: "Text" }],
  };
  for (const [field, value] of Object.entries(variants))
    assert.notEqual(
      compareItemKey(cache, { ...inputs, [field]: value }),
      base,
      field,
    );
});
