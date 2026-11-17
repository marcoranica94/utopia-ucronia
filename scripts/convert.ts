import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { workContentSchema } from "../src/editorial/content.ts";
import type { EditorialItem, EditorialSource } from "../src/editorial/model.ts";
import {
  checkClassification,
  classificationFileSchema,
  vocabularySchema,
} from "../src/editorial/vocabulary.ts";
import { type Anatomy, anatomy } from "./anatomy.ts";
import { openCache } from "./build-cache.ts";
import {
  convertHtml,
  decode,
  documentTitle,
  firstIdsOnly,
  titleSlug,
} from "./conversion.ts";
import {
  applyCorrections,
  correctionsFor,
  itemPath,
  readMap,
  redact,
  sourceHtml,
} from "./editorial-core.ts";
import { explainedGap, type Gap, type GapReason } from "./link-resolution.ts";
import { pdfEdition } from "./pdf.ts";
import {
  baselineIds,
  publicationItems,
  readPublication,
} from "./publication-core.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  sha256,
  urlKey,
  verifyDocument,
  writeJson,
} from "./recovery/core.ts";
import { readDecisions } from "./review-decisions.ts";
import { type OutlineItem, renderStructured } from "./structured.ts";
import { convertPageKey } from "./unit-keys.ts";

const manifest = await readManifest();
const map = await readMap();
if (map.manifestDigest !== sha256(Buffer.from(JSON.stringify(manifest))))
  throw new Error(
    "Editorial map does not match the manifest; regenerate and review it before conversion.",
  );
const sample = JSON.parse(await readFile("data/sample.json", "utf8")) as {
  documents: { url: string; language?: "it" | "fr" | "es" }[];
};
const validation = JSON.parse(
  await readFile("data/validation-sample.json", "utf8"),
) as { items: string[] };
const publication = publicationItems(
  map,
  await readDecisions(),
  await readPublication(),
  await baselineIds(),
);
const selectedIds = new Set(publication.items.map((item) => item.id));
const selected = map.items.filter((item) => selectedIds.has(item.id));
const recovered = manifest.documents.filter(isRecovered);
for (const document of recovered)
  if (!(await verifyDocument(document)))
    throw new Error(`Original not intact: ${document.url}`);
const documents = new Map(manifest.documents.map((d) => [urlKey(d.url), d]));
const authorNames = new Map(map.authors.map((a) => [a.id, a.name]));
/** What the edition needs to know about one source part without parsing it
 * again: derived only from the part's source bytes and its page descriptor. */
type PartFacts = {
  title: string;
  anchors: string[];
  images: string[];
  fullAnchors?: string[];
  structured: boolean;
  shape?: Anatomy["shape"];
  headerText: string[];
  dropped: string[];
  longText?: string;
};
type Lookup = { href: string; image: boolean; result: string };
type Conversion = {
  markdown: string;
  outline: OutlineItem[];
  contributors: string[];
  removed: { source: string; text: string[] }[];
  /** Every routing lookup made while converting, per part, in call order. */
  lookups: Lookup[][];
};
type CacheEntry = { parts: PartFacts[]; conversion: Conversion };
type Part = {
  source: EditorialSource;
  html?: string;
  parsed?: Anatomy;
  prefix: string;
};
type Page = {
  slug: string;
  title: string;
  item?: EditorialItem;
  parts: Part[];
  language: "it" | "fr" | "es" | "en" | "unknown";
  legacy?: boolean;
  key?: string;
  facts?: PartFacts[];
  cached?: CacheEntry;
};
const cache = await openCache<CacheEntry>("convert");
const pdfCache = await openCache<{ id: string; png: string }[]>("convert-pdf");
const pages: Page[] = [];
const sourceFile = (source: EditorialSource) => {
  const document = map.documents.find((d) => d.id === source.documentId);
  if (!document) throw new Error(`Unknown source: ${source.documentId}`);
  return document;
};
// A page's unit key: its descriptor (item, parts, title, language), the
// document record and current bytes of every source, and its corrections.
// Routing tables are not in the key: the lookups are replayed instead.
async function pageKey(page: Page, html?: string) {
  const sources = [];
  if (html === undefined)
    for (const part of page.parts) {
      const document = sourceFile(part.source);
      sources.push({
        document,
        bytes: await readFile(safePath("archive/original", document.path)),
      });
    }
  return convertPageKey(
    cache,
    {
      slug: page.slug,
      title: page.title,
      item: page.item ?? null,
      language: page.language,
      legacy: Boolean(page.legacy),
      parts: page.parts.map((p) => ({ source: p.source, prefix: p.prefix })),
    },
    await correctionsFor(page.slug),
    html === undefined ? sources : { html },
  );
}
async function prepare(page: Page) {
  if (!page.item) return;
  for (const part of page.parts) {
    if (part.html !== undefined) continue;
    part.html = await sourceHtml(part.source, map);
    part.parsed = anatomy(part.html, page.item.title);
  }
}
const rawAnchors = (html: string) => {
  const $ = load(html);
  return $("[id],a[name]")
    .toArray()
    .map((e) => $(e).attr("id") ?? $(e).attr("name") ?? "")
    .filter(Boolean);
};
async function partFacts(part: Part): Promise<PartFacts> {
  const html = part.html as string;
  const $ = load(
    part.parsed
      ? part.parsed.blocks
          .filter((b) => !part.parsed?.removed.has(b))
          .map((b) => b.html)
          .join("\n")
      : html,
  );
  let fullAnchors: string[] | undefined;
  if (part.source.selection.kind === "blocks") {
    const document = map.documents.find((d) => d.id === part.source.documentId);
    if (!document) throw new Error("Missing fragment source");
    fullAnchors = rawAnchors(
      decode(await readFile(safePath("archive/original", document.path))),
    );
  }
  return {
    title: documentTitle(html),
    anchors: rawAnchors(html),
    images: $("img[src]")
      .toArray()
      .map((e) => $(e).attr("src") ?? ""),
    ...(fullAnchors ? { fullAnchors } : {}),
    structured: Boolean(part.parsed),
    ...(part.parsed ? { shape: part.parsed.shape } : {}),
    headerText: part.parsed?.headerText ?? [],
    dropped: part.parsed?.dropped ?? [],
    ...(part.parsed
      ? {
          longText: part.parsed.blocks.find(
            (b) => !part.parsed?.removed.has(b) && b.text.length > 100,
          )?.text,
        }
      : {}),
  };
}
async function factsFor(page: Page) {
  page.cached = page.key ? await cache.get(page.key) : undefined;
  if (page.cached?.parts.length === page.parts.length)
    page.facts = page.cached.parts;
  else {
    page.cached = undefined;
    await prepare(page);
    page.facts = [];
    for (const part of page.parts) page.facts.push(await partFacts(part));
  }
}
for (const item of selected) {
  const sources =
    item.composition === "equivalent" ? item.sources.slice(0, 1) : item.sources;
  const page: Page = {
    slug: item.slug,
    title: item.title,
    item,
    parts: sources.map((source, index) => ({
      source,
      prefix: item.composition === "chapters" ? `chapter-${index + 1}-` : "",
    })),
    language: item.language.value,
  };
  page.key = await pageKey(page);
  await factsFor(page);
  pages.push(page);
}
// Keep the already published S0 source previews reachable. Index previews are
// compatibility views, excluded from canonical editorial sampling and proposals.
for (const entry of sample.documents) {
  if (
    pages.some((p) =>
      p.parts.some(
        (part) =>
          part.source.selection.kind === "whole" &&
          urlKey(part.source.url) === urlKey(entry.url),
      ),
    )
  )
    continue;
  const document = documents.get(urlKey(entry.url));
  if (
    !document?.path ||
    !isRecovered(document) ||
    !/html/i.test(document.type ?? "")
  )
    continue;
  const html = decode(
    await readFile(safePath("archive/original", document.path)),
  );
  if (load(html)("frameset").length) continue;
  const title = documentTitle(html);
  const slug = `${titleSlug(title)}-${sha256(Buffer.from(urlKey(document.url))).slice(0, 8)}`;
  const doc = map.documents.find((d) => urlKey(d.url) === urlKey(document.url));
  if (!doc) throw new Error(`Unmapped document: ${document.url}`);
  const page: Page = {
    slug,
    title,
    language: entry.language ?? "it",
    legacy: true,
    parts: [
      {
        html,
        prefix: "",
        source: {
          documentId: doc.id,
          url: doc.url,
          ...(doc.timestamp ? { timestamp: doc.timestamp } : {}),
          selection: { kind: "whole" },
        },
      },
    ],
  };
  page.key = await pageKey(page, html);
  await factsFor(page);
  pages.push(page);
}
const factsOf = (page: Page) => page.facts as PartFacts[];
const pathFor = (p: Page) => (p.item ? itemPath(p.item) : `/works/${p.slug}/`);
const roots = new Map<string, string>();
const anchorRoutes = new Map<string, string>();
for (const page of [...pages].sort(
  (a, b) =>
    Number(a.parts[0].source.selection.kind === "blocks") -
    Number(b.parts[0].source.selection.kind === "blocks"),
)) {
  for (const [index, part] of page.parts.entries()) {
    const key = urlKey(part.source.url);
    const target = pathFor(page);
    if (part.source.selection.kind === "whole")
      roots.set(key, target + (part.prefix ? `#chapter-${index + 1}` : ""));
    for (const anchor of factsOf(page)[index].anchors)
      anchorRoutes.set(`${key}#${anchor}`, `${target}#${part.prefix}${anchor}`);
    if (new URL(part.source.url).pathname.endsWith("/")) {
      roots.set(`${key}index.htm`, target);
      roots.set(`${key}index.html`, target);
    }
  }
}
const oldList = roots.get("/utopiaucronia/lista_ucronie_1.htm");
if (oldList) roots.set("/utopiaucronia/lista_ucronie.htm", oldList);
// Publish only the non-executable images referenced by this edition, deduplicated by hash.
const needed = new Set(sample.documents.map((d) => urlKey(d.url)));
for (const page of pages)
  for (const [index, part] of page.parts.entries())
    for (const src of factsOf(page)[index].images)
      try {
        needed.add(urlKey(new URL(src, part.source.url).href.split("#")[0]));
      } catch {}
const assets = new Map<string, string>();
await rm("public/sample", { recursive: true, force: true });
await mkdir("public/sample", { recursive: true });
for (const d of recovered) {
  if (
    !d.path ||
    !needed.has(urlKey(d.url)) ||
    !/\.(?:png|jpe?g|gif)$/i.test(d.path)
  )
    continue;
  const filename = `${d.sha256}${path.extname(d.path).toLowerCase()}`;
  await copyFile(
    safePath("archive/original", d.path),
    `public/sample/${filename}`,
  );
  assets.set(urlKey(d.url), `/sample/${filename}`);
}
// Extract PDF illustrations into safe static PNGs, keeping page provenance.
for (const page of pages)
  for (const part of page.parts) {
    const document = map.documents.find((d) => d.id === part.source.documentId);
    if (!document)
      throw new Error(`Missing source document: ${part.source.documentId}`);
    if (!document.mediaType.includes("pdf")) continue;
    const bytes = await readFile(safePath("archive/original", document.path));
    // Illustrations depend only on the PDF bytes (and the toolchain).
    const key = pdfCache.key(bytes);
    let images = await pdfCache.get(key);
    if (!images) {
      images = ((await pdfEdition(bytes))?.images ?? []).map((image) => ({
        id: image.id,
        png: image.bytes.toString("base64"),
      }));
      await pdfCache.set(key, images);
    }
    for (const image of images.map((i) => ({
      id: i.id,
      bytes: Buffer.from(i.png, "base64"),
    }))) {
      const filename = `${sha256(image.bytes)}.png`;
      await writeFile(`public/sample/${filename}`, image.bytes);
      assets.set(
        `${urlKey(part.source.url)}#${image.id}`,
        `/sample/${filename}`,
      );
    }
  }
const fullSourceAnchors = new Map<string, Set<string>>();
for (const page of pages)
  for (const [index, part] of page.parts.entries()) {
    if (
      part.source.selection.kind !== "blocks" ||
      fullSourceAnchors.has(part.source.documentId)
    )
      continue;
    fullSourceAnchors.set(
      part.source.documentId,
      new Set(factsOf(page)[index].fullAnchors),
    );
  }
const gapRegistry = new Map<string, Gap>();
type Result = {
  page: Page;
  markdown: string;
  outline: OutlineItem[];
  contributors: string[];
  gaps: Set<string>;
  removed: { source: string; text: string[] }[];
};
const results: Result[] = [];
const namespace = (body: string, prefix: string) =>
  prefix
    ? body
        .replace(/\bid="([^"]+)"/g, (_m, id) => `id="${prefix}${id}"`)
        .replace(/href="#([^"]+)"/g, (_m, id) => `href="#${prefix}${id}"`)
    : body;
const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
// The routing decision for one link of one part; registers its gap, if any.
function resolver(
  part: Part,
  registry: Map<string, Gap>,
  gaps: Set<string>,
  lookups?: Lookup[],
) {
  const route = (href: string, image: boolean) => {
    let reason: GapReason | undefined;
    try {
      const u = new URL(href, part.source.url);
      const key = urlKey(u.href.split("#")[0]);
      const decodedHash = u.hash ? decodeURIComponent(u.hash.slice(1)) : "";
      const known = image
        ? (assets.get(`${key}#${decodedHash}`) ?? assets.get(key))
        : decodedHash
          ? anchorRoutes.get(`${key}#${decodedHash}`)
          : (roots.get(key) ?? assets.get(key));
      if (known) return known;
      // Generated in-page sections are handled after all bodies are known.
      if (href.startsWith("#") && !image) {
        if (
          part.source.selection.kind === "blocks" &&
          fullSourceAnchors.get(part.source.documentId)?.has(decodedHash)
        )
          reason = "edition-pending";
        else return `#${decodedHash}`;
      }
    } catch {}
    const gap = explainedGap(href, part.source.url, image, documents, reason);
    registry.set(gap.id, gap);
    gaps.add(gap.id);
    return image ? "" : `/gaps/#${gap.id}`;
  };
  return (href: string, image: boolean) => {
    const result = route(href, image);
    lookups?.push({ href, image, result });
    return result;
  };
}
/** Replays a cached page's lookups against the current routing tables. Only
 * if every lookup still gives the recorded result is the cached conversion
 * identical to a fresh one; its gaps are then registered as a fresh run would. */
function replay(page: Page, conversion: Conversion) {
  const registry = new Map<string, Gap>();
  const gaps = new Set<string>();
  for (const [index, part] of page.parts.entries()) {
    const resolve = resolver(part, registry, gaps);
    for (const lookup of conversion.lookups[index] ?? [])
      if (resolve(lookup.href, lookup.image) !== lookup.result)
        return undefined;
  }
  for (const [id, gap] of registry) gapRegistry.set(id, gap);
  return gaps;
}
async function convertPage(page: Page): Promise<{
  conversion: Conversion;
  gaps: Set<string>;
}> {
  await prepare(page);
  const facts = factsOf(page);
  const out: string[] = [];
  const outline: OutlineItem[] = [];
  const contributors = new Set<string>();
  const gaps = new Set<string>();
  const removed: Result["removed"] = [];
  const lookups: Lookup[][] = [];
  for (const [index, part] of page.parts.entries()) {
    const partLookups: Lookup[] = [];
    lookups.push(partLookups);
    const resolve = resolver(part, gapRegistry, gaps, partLookups);
    const html = part.html as string;
    const clean = part.parsed ? undefined : convertHtml(html, resolve);
    // Blocks are converted one at a time: keep the first of any id the
    // source repeats (a browser resolves #anchor to the first one too).
    const seenIds = new Set<string>();
    const structured = part.parsed
      ? renderStructured(part.parsed, (html) =>
          firstIdsOnly(
            convertHtml(`<html><body>${html}</body></html>`, resolve).markdown,
            seenIds,
          ),
        )
      : undefined;
    if (part.prefix) {
      out.push(
        `<section class="source-chapter"><header data-ui><h2 id="chapter-${index + 1}">${escapeHtml(facts[index].title)}</h2></header>`,
      );
      outline.push({
        id: `chapter-${index + 1}`,
        label: facts[index].title,
        kind: "section",
        depth: 0,
      });
    }
    out.push(namespace(structured?.body ?? clean?.markdown ?? "", part.prefix));
    if (part.prefix) out.push("</section>");
    for (const entry of structured?.outline ?? [])
      outline.push({
        ...entry,
        // A contribution signed only with an address: the outline, like the
        // body, never carries it.
        label: redact(entry.label),
        ...(entry.author ? { author: redact(entry.author) } : {}),
        id: `${part.prefix}${entry.id}`,
        depth: entry.depth + (part.prefix ? 1 : 0),
        ...(entry.replyTo ? { replyTo: `${part.prefix}${entry.replyTo}` } : {}),
      });
    for (const name of structured?.contributors ?? [])
      contributors.add(redact(name));
    removed.push({ source: part.source.url, text: part.parsed?.dropped ?? [] });
  }
  const markdown = applyCorrections(
    out.join("\n\n"),
    await correctionsFor(page.slug),
    page.slug,
  );
  return {
    conversion: {
      markdown,
      outline,
      contributors: [...contributors],
      removed,
      lookups,
    },
    gaps,
  };
}
for (const page of pages) {
  const reused = page.cached && replay(page, page.cached.conversion);
  if (page.cached && !reused) cache.reject();
  const { conversion, gaps } =
    page.cached && reused
      ? { conversion: page.cached.conversion, gaps: reused }
      : await convertPage(page);
  if (!reused && page.key)
    await cache.set(page.key, { parts: factsOf(page), conversion });
  results.push({
    page,
    markdown: conversion.markdown,
    outline: conversion.outline,
    contributors: conversion.contributors,
    gaps,
    removed: conversion.removed,
  });
}
// Resolve fragment failures against the final output; every unresolved target
// becomes a specifically explained gap rather than an unexplained broken link.
const idsByPath = new Map(
  results.map((r) => [
    pathFor(r.page),
    new Set([...r.markdown.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
  ]),
);
for (const result of results) {
  const source = result.page.parts[0].source.url;
  const fix = (href: string) => {
    if (href.startsWith("/gaps/")) return href;
    const u = new URL(href, `https://edition.invalid${pathFor(result.page)}`);
    if (u.origin !== "https://edition.invalid" || !u.hash) return href;
    const id = decodeURIComponent(u.hash.slice(1));
    if (idsByPath.get(u.pathname)?.has(id) || id === "work-title") return href;
    const gap = explainedGap(href, source, false, documents, "anchor-missing");
    gapRegistry.set(gap.id, gap);
    result.gaps.add(gap.id);
    return `/gaps/#${gap.id}`;
  };
  result.markdown = result.markdown
    .replace(/href="([^"]+)"/g, (_m, href) => `href="${fix(href)}"`)
    .replace(
      // A destination with spaces ("#Betsy Ross Flag") is written as <…>;
      // Turndown escapes parentheses in a plain one ("#\(1\)" for "#(1)").
      /\]\((?:<([^>\n]*)>|((?:\\.|[^\s)\\])+))([^)]*)\)/g,
      (_m, bracketed: string | undefined, plain: string | undefined, tail) => {
        if (bracketed === undefined) {
          const fixed = fix((plain ?? "").replace(/\\([()])/g, "$1"));
          return `](${fixed.replace(/[()]/g, "\\$&")}${tail})`;
        }
        const fixed = fix(bracketed);
        return `](${/\s/.test(fixed) ? `<${fixed}>` : fixed}${tail})`;
      },
    );
}
// Owner-approved vocabularies and the per-item classification overlay
// (data/vocabulary.json, data/classification.json). Applied here, outside the
// per-item conversion cache, so a reclassification never needs reconversion.
const vocabulary = vocabularySchema.parse(
  JSON.parse(await readFile("data/vocabulary.json", "utf8")),
);
const overlay = checkClassification(
  vocabulary,
  classificationFileSchema.parse(
    JSON.parse(
      await readFile("data/classification.json", "utf8").catch(
        () => '{"version":1,"items":{}}',
      ),
    ),
  ),
);
await rm("src/content/works", { recursive: true, force: true });
await mkdir("src/content/works", { recursive: true });
const report = [];
for (const result of results) {
  const { page } = result;
  const item = page.item;
  const facts = factsOf(page);
  const summaryText = facts.find((f) => f.longText !== undefined)?.longText;
  const summary = summaryText
    ? `${redact(summaryText)
        .slice(0, 240)
        .replace(/\s+\S*$/, "")}…`
    : undefined;
  const firstImage =
    /!\[[^\]]*\]\((\/sample\/[^\s)]+)|<img[^>]+src="(\/sample\/[^"]+)"/.exec(
      result.markdown,
    );
  const cover = firstImage?.[1] ?? firstImage?.[2];
  // Some FrontPage titles contain literal icon-link markup. Keep source/map/route intact.
  const title = page.title
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const meta = workContentSchema.parse({
    title,
    sourceHeaders: [...new Set(facts.flatMap((f) => f.headerText).map(redact))],
    authors: item
      ? item.authors
          .map((id) => authorNames.get(id))
          .filter((name): name is string => Boolean(name))
      : [],
    ...(item
      ? {
          editorialId: item.id,
          authorIds: item.authors,
          review: item.review,
          classification: {
            ...item.classification,
            ...overlay.items[item.id],
          },
          contributions: item.contributions,
        }
      : {}),
    language: page.language,
    level: item?.level ?? "work",
    divergences:
      item && item.classification.divergences.value !== "unknown"
        ? item.classification.divergences.value
        : [],
    sources: page.parts.map((p) => ({
      url: p.source.url,
      documentId: p.source.documentId,
      timestamp: p.source.timestamp,
    })),
    unverified: ["title", "authors", "language", "structure", "classification"],
    ...(facts[0].structured
      ? {
          shape:
            item?.composition === "chapters" ? "collection" : facts[0].shape,
          outline: result.outline,
          contributors: result.contributors,
        }
      : {}),
    ...(summary ? { summary } : {}),
    ...(cover ? { cover } : {}),
    gaps: result.gaps.size,
  });
  await writeFile(
    `src/content/works/${page.slug}.md`,
    `---\n${Object.entries(meta)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n")}\n---\n\n${result.markdown}\n`,
  );
  report.push({
    slug: page.slug,
    path: pathFor(page),
    editorialId: item?.id,
    source: page.parts[0].source.url,
    sources: page.parts.map((p) => p.source),
    title,
    structured: facts[0].structured,
    randomValidation: Boolean(item && validation.items.includes(item.id)),
    publicationSelection: Boolean(
      item && publication.extraIds.includes(item.id),
    ),
    legacyPreview: Boolean(page.legacy),
    removed: result.removed,
    gaps: [...result.gaps],
    comparison: { status: "pending-build-comparison" },
  });
}
await writeJson("reports/conversion.json", report);
await writeJson(
  "reports/link-gaps.json",
  [...gapRegistry.values()].sort((a, b) => a.id.localeCompare(b.id)),
);
await cache.prune();
await pdfCache.prune();
console.log(
  `${pages.length} content items converted from the editorial map, including the fixed 30-item validation sample; every gap has an explicit reason.`,
);
console.log(`${cache.summary()}; ${pdfCache.summary()}`);
