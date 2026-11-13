import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { convertHtml, decode, documentTitle, titleSlug } from "./conversion.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
  writeJson,
} from "./recovery/core.ts";

const manifest = await readManifest();
const sample = JSON.parse(await readFile("data/sample.json", "utf8")) as {
  documents: { url: string; language?: string }[];
};
const sampleKeys = new Set(sample.documents.map((item) => urlKey(item.url)));
const documents = manifest.documents.filter(isRecovered);
for (const d of documents)
  if (!(await verifyDocument(d)))
    throw new Error(`Original not intact: ${d.url}`);
const pages = [];
for (const d of documents) {
  // The recovered archive is broader than the reviewed edition. Publish only
  // the sample until S2 resolves structure, anchors and personal data.
  if (
    !sampleKeys.has(urlKey(d.url)) ||
    !/text\/html/i.test(d.type ?? "") ||
    !d.path
  )
    continue;
  const html = decode(await readFile(safePath("archive/original", d.path)));
  // A frameset is a technical container, not an empty work.
  if (load(html)("frameset").length) continue;
  const title = documentTitle(html);
  // The suffix ties the content item to its source and avoids name clashes.
  const slug = `${titleSlug(title)}-${sha256(Buffer.from(urlKey(d.url))).slice(0, 8)}`;
  pages.push({ d, html, slug });
}
const urls = new Map(pages.map((p) => [urlKey(p.d.url), `/works/${p.slug}/`]));
for (const p of pages)
  if (new URL(p.d.url).pathname.endsWith("/")) {
    urls.set(`${urlKey(p.d.url)}index.htm`, `/works/${p.slug}/`);
    urls.set(`${urlKey(p.d.url)}index.html`, `/works/${p.slug}/`);
  }
const list = urls.get("/utopiaucronia/lista_ucronie_1.htm");
if (list) urls.set("/utopiaucronia/lista_ucronie.htm", list);
const assets = new Map<string, string>();
// Only non-executable files selected in the sample are published.
await rm("public/sample", { recursive: true, force: true });
await mkdir("public/sample", { recursive: true });
for (const d of documents) {
  // PDFs stay in the archive until they are checked for personal data and active content.
  if (
    !sampleKeys.has(urlKey(d.url)) ||
    !d.path ||
    !/\.(png|jpe?g|gif)$/i.test(d.path)
  )
    continue;
  const name = `${d.sha256}${path.extname(d.path).toLowerCase()}`;
  await copyFile(safePath("archive/original", d.path), `public/sample/${name}`);
  assets.set(urlKey(d.url), `/sample/${name}`);
}
await rm("src/content/works", { recursive: true, force: true });
await mkdir("src/content/works", { recursive: true });
const report = [];
for (const { d, html, slug } of pages) {
  const gaps = new Set<string>();
  const result = convertHtml(html, (href, image) => {
    if (href.startsWith("#") && !image) return href;
    try {
      const u = new URL(href, d.url);
      const key = urlKey(u.href.split("#")[0]);
      const target = image
        ? assets.get(key)
        : (urls.get(key) ?? assets.get(key));
      if (target) return `${target}${u.hash}`;
    } catch {
      /* External or disallowed resource: recorded as a gap. */
    }
    gaps.add(href);
    return image ? "" : "/gaps/";
  });
  // Corrections live apart from the originals and are reapplied on every build.
  let markdown = result.markdown;
  try {
    const corrections = JSON.parse(
      await readFile(`data/corrections/${slug}.json`, "utf8"),
    ) as { from: string; to: string }[];
    for (const c of corrections) {
      if (!c.from || !markdown.includes(c.from))
        throw new Error(`Correction does not apply: ${slug}`);
      markdown = markdown.replaceAll(c.from, c.to);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const language =
    sample.documents.find((s) => urlKey(s.url) === urlKey(d.url))?.language ??
    result.language;
  const meta = {
    title: result.title,
    authors: [],
    language,
    level: "work",
    divergences: [],
    sources: [{ url: d.url, timestamp: d.timestamp }],
    unverified: ["title", "authors", "language", "structure"],
    gaps: gaps.size,
  };
  await writeFile(
    `src/content/works/${slug}.md`,
    `---\n${Object.entries(meta)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n")}\n---\n\n${markdown}\n`,
  );
  report.push({
    slug,
    source: d.url,
    title: result.title,
    gaps: [...gaps],
    comparison: {
      headings: "to verify",
      paragraphs: "to verify",
      images: "to verify",
      notes: "to verify",
      tables: "to verify",
      accents: "to verify",
      attributions: "to verify",
    },
  });
}
await writeJson("reports/conversion.json", report);
console.log(
  `${pages.length} documents converted; editorial comparison in reports/conversion.json`,
);
