import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { workContentSchema } from "../src/editorial/content.ts";
import type { EditorialItem, EditorialSource } from "../src/editorial/model.ts";
import { type Anatomy, anatomy } from "./anatomy.ts";
import { convertHtml, decode, documentTitle, titleSlug } from "./conversion.ts";
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
type Part = {
  source: EditorialSource;
  html: string;
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
};
const pages: Page[] = [];
for (const item of selected) {
  const sources =
    item.composition === "equivalent" ? item.sources.slice(0, 1) : item.sources;
  const parts: Part[] = [];
  for (const [index, source] of sources.entries()) {
    const html = await sourceHtml(source, map);
    const parsed = anatomy(html, item.title);
    parts.push({
      source,
      html,
      parsed,
      prefix: item.composition === "chapters" ? `chapter-${index + 1}-` : "",
    });
  }
  pages.push({
    slug: item.slug,
    title: item.title,
    item,
    parts,
    language: item.language.value,
  });
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
  pages.push({
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
  });
}
const pathFor = (p: Page) => (p.item ? itemPath(p.item) : `/works/${p.slug}/`);
const roots = new Map<string, string>();
const anchorRoutes = new Map<string, string>();
const rawAnchors = (html: string) => {
  const $ = load(html);
  return $("[id],a[name]")
    .toArray()
    .map((e) => $(e).attr("id") ?? $(e).attr("name") ?? "")
    .filter(Boolean);
};
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
    for (const anchor of rawAnchors(part.html))
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
  for (const part of page.parts) {
    const $ = load(
      part.parsed
        ? part.parsed.blocks
            .filter((b) => !part.parsed?.removed.has(b))
            .map((b) => b.html)
            .join("\n")
        : part.html,
    );
    for (const e of $("img[src]").toArray())
      try {
        needed.add(
          urlKey(
            new URL($(e).attr("src") ?? "", part.source.url).href.split("#")[0],
          ),
        );
      } catch {}
  }
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
    const edition = await pdfEdition(
      await readFile(safePath("archive/original", document.path)),
    );
    for (const image of edition?.images ?? []) {
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
  for (const part of page.parts) {
    if (
      part.source.selection.kind !== "blocks" ||
      fullSourceAnchors.has(part.source.documentId)
    )
      continue;
    const document = map.documents.find((d) => d.id === part.source.documentId);
    if (!document) throw new Error("Missing fragment source");
    fullSourceAnchors.set(
      document.id,
      new Set(
        rawAnchors(
          decode(await readFile(safePath("archive/original", document.path))),
        ),
      ),
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
for (const page of pages) {
  const out: string[] = [];
  const outline: OutlineItem[] = [];
  const contributors = new Set<string>();
  const gaps = new Set<string>();
  const removed: Result["removed"] = [];
  for (const [index, part] of page.parts.entries()) {
    const resolve = (href: string, image: boolean) => {
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
      gapRegistry.set(gap.id, gap);
      gaps.add(gap.id);
      return image ? "" : `/gaps/#${gap.id}`;
    };
    const clean = part.parsed ? undefined : convertHtml(part.html, resolve);
    const structured = part.parsed
      ? renderStructured(
          part.parsed,
          (html) =>
            convertHtml(`<html><body>${html}</body></html>`, resolve).markdown,
        )
      : undefined;
    if (part.prefix) {
      out.push(
        `<section class="source-chapter"><header data-ui><h2 id="chapter-${index + 1}">${escapeHtml(documentTitle(part.html))}</h2></header>`,
      );
      outline.push({
        id: `chapter-${index + 1}`,
        label: documentTitle(part.html),
        kind: "section",
        depth: 0,
      });
    }
    out.push(namespace(structured?.body ?? clean?.markdown ?? "", part.prefix));
    if (part.prefix) out.push("</section>");
    for (const entry of structured?.outline ?? [])
      outline.push({
        ...entry,
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
  results.push({
    page,
    markdown,
    outline,
    contributors: [...contributors],
    gaps,
    removed,
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
      /\]\(([^\s)]+)([^)]*)\)/g,
      (_m, href, tail) => `](${fix(href)}${tail})`,
    );
}
await rm("src/content/works", { recursive: true, force: true });
await mkdir("src/content/works", { recursive: true });
const report = [];
for (const result of results) {
  const { page } = result;
  const item = page.item;
  const summaryBlock = page.parts.flatMap(
    (p) =>
      p.parsed?.blocks.filter(
        (b) => !p.parsed?.removed.has(b) && b.text.length > 100,
      ) ?? [],
  )[0];
  const summary = summaryBlock
    ? `${redact(summaryBlock.text)
        .slice(0, 240)
        .replace(/\s+\S*$/, "")}…`
    : undefined;
  const firstImage =
    /!\[[^\]]*\]\((\/sample\/[^\s)]+)|<img[^>]+src="(\/sample\/[^"]+)"/.exec(
      result.markdown,
    );
  const cover = firstImage?.[1] ?? firstImage?.[2];
  const meta = workContentSchema.parse({
    title: page.title,
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
          classification: item.classification,
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
    ...(page.parts[0].parsed
      ? {
          shape:
            item?.composition === "chapters"
              ? "collection"
              : page.parts[0].parsed.shape,
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
    title: page.title,
    structured: Boolean(page.parts[0].parsed),
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
console.log(
  `${pages.length} content items converted from the editorial map, including the fixed 30-item validation sample; every gap has an explicit reason.`,
);
