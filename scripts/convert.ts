import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { anatomy } from "./anatomy.ts";
import { convertHtml, decode, documentTitle, titleSlug } from "./conversion.ts";
import { pdfToHtml } from "./pdf.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
  writeJson,
} from "./recovery/core.ts";
import { renderStructured } from "./structured.ts";

const manifest = await readManifest();
const sample = JSON.parse(await readFile("data/sample.json", "utf8")) as {
  documents: { url: string; language?: string }[];
};
const trial = JSON.parse(await readFile("data/trial.json", "utf8")) as {
  documents: { url: string; language?: string }[];
};
const trialKeys = new Set(trial.documents.map((item) => urlKey(item.url)));
const sampleKeys = new Set([
  ...sample.documents.map((item) => urlKey(item.url)),
  ...trialKeys,
]);
const documents = manifest.documents.filter(isRecovered);
for (const d of documents)
  if (!(await verifyDocument(d)))
    throw new Error(`Original not intact: ${d.url}`);
const pages = [];
for (const d of documents) {
  // The recovered archive is broader than the reviewed edition. Publish only
  // the sample until S2 resolves structure, anchors and personal data.
  if (!sampleKeys.has(urlKey(d.url)) || !d.path) continue;
  const structured = trialKeys.has(urlKey(d.url));
  const isPdf = /\.pdf$/i.test(d.path);
  if (!/text\/html/i.test(d.type ?? "") && !(structured && isPdf)) continue;
  const raw = await readFile(safePath("archive/original", d.path));
  const html = isPdf ? await pdfToHtml(raw) : decode(raw);
  // Without the optional PDF library the PDF stays an archive attachment only.
  if (html === undefined) {
    console.warn(`Skipped PDF (install unpdf to convert it): ${d.url}`);
    continue;
  }
  // A frameset is a technical container, not an empty work.
  if (load(html)("frameset").length) continue;
  const parsed = structured ? anatomy(html, documentTitle(html)) : undefined;
  const title = parsed?.title ?? documentTitle(html);
  // The suffix ties the content item to its source and avoids name clashes.
  const slug = `${titleSlug(title)}-${sha256(Buffer.from(urlKey(d.url))).slice(0, 8)}`;
  pages.push({ d, html, slug, structured, parsed });
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
// Images referenced by trial pages are published with them.
const referenced = new Set<string>();
for (const p of pages.filter((page) => page.structured))
  for (const m of p.html.matchAll(
    /\b(?:src|background)\s*=\s*["']?([^"'\s>]+)/gi,
  ))
    try {
      referenced.add(urlKey(new URL(m[1], p.d.url).href.split("#")[0]));
    } catch {
      /* External or malformed reference: stays a gap. */
    }
// Only non-executable files selected in the sample are published.
await rm("public/sample", { recursive: true, force: true });
await mkdir("public/sample", { recursive: true });
for (const d of documents) {
  // PDFs stay in the archive until they are checked for personal data and active content.
  if (
    !(sampleKeys.has(urlKey(d.url)) || referenced.has(urlKey(d.url))) ||
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
for (const { d, html, slug, parsed } of pages) {
  const gaps = new Set<string>();
  const resolve = (href: string, image: boolean) => {
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
  };
  const result = convertHtml(html, resolve);
  const shape = parsed
    ? renderStructured(
        parsed,
        (part) =>
          convertHtml(`<html><body>${part}</body></html>`, resolve).markdown,
      )
    : undefined;
  // Corrections live apart from the originals and are reapplied on every build.
  let markdown = shape?.body ?? result.markdown;
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
    [...sample.documents, ...trial.documents].find(
      (s) => urlKey(s.url) === urlKey(d.url),
    )?.language ?? result.language;
  const meta = {
    title: parsed?.title ?? result.title,
    authors: parsed?.authors ?? [],
    ...(parsed && shape
      ? {
          shape: parsed.shape,
          contributors: shape.contributors,
          outline: shape.outline,
        }
      : {}),
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
    title: parsed?.title ?? result.title,
    ...(parsed ? { structured: true, removed: parsed.dropped } : {}),
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
