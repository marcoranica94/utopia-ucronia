import { mkdir, readFile } from "node:fs/promises";
import { load } from "cheerio";
import {
  type BrowseData,
  type BrowseTarget,
  browseSchema,
} from "../src/browse/model.ts";
import type { EditorialSource } from "../src/editorial/model.ts";
import { blocks } from "./anatomy.ts";
import { catalogCells, isIndex, recordId, resourceKey } from "./browse-core.ts";
import { decode, documentTitle } from "./conversion.ts";
import { readMap, redact } from "./editorial-core.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  sha256,
  urlKey,
  writeJson,
} from "./recovery/core.ts";

const map = await readMap();
const manifest = await readManifest();
const documents = new Map(manifest.documents.map((d) => [urlKey(d.url), d]));
const definitions = JSON.parse(
  await readFile("data/browse-groups.json", "utf8"),
) as {
  prompts: [string, string, string, string][];
  works: [string, string, string, string][];
  historicalPrompts: [string, string, string, string][];
};
const base = "https://www.fmboschetto.it/Utopiaucronia/";
const htmlCache = new Map<string, string>();
const blockCache = new Map<string, ReturnType<typeof blocks>>();
const verified = new Set<string>();
async function html(url: string) {
  const key = urlKey(url);
  const old = htmlCache.get(key);
  if (old !== undefined) return old;
  const doc = documents.get(key);
  if (!doc?.path || !isRecovered(doc))
    throw new Error(`Index source unavailable: ${url}`);
  const bytes = await readFile(safePath("archive/original", doc.path));
  if (sha256(bytes) !== doc.sha256)
    throw new Error(`Index source changed: ${url}`);
  verified.add(key);
  const text = decode(bytes);
  htmlCache.set(key, text);
  return text;
}
async function sourceBlocks(url: string) {
  const key = urlKey(url);
  let value = blockCache.get(key);
  if (!value) {
    value = blocks(await html(url));
    blockCache.set(key, value);
  }
  return value;
}
for (const [kind, menu] of [
  ["prompts", "lista_ucronie_left.htm"],
  ["works", "lavori_home.htm"],
] as const) {
  const $ = load(await html(new URL(menu, base).href));
  const expected = new Set(
    definitions[kind].map((row) => urlKey(new URL(row[1], base).href)),
  );
  const found = new Set(
    $("a[href]")
      .toArray()
      .flatMap((a) => {
        try {
          const key = urlKey(new URL($(a).attr("href") ?? "", base).href);
          return expected.has(key) ? [key] : [];
        } catch {
          return [];
        }
      }),
  );
  if (found.size !== expected.size)
    throw new Error(`Source menu differs from ${kind} groups`);
}
const data: BrowseData = {
  version: 1,
  promptGroups: [],
  workGroups: [],
  prompts: [],
  entries: [],
  targets: [],
};
for (const [kind, output] of [
  ["prompts", data.promptGroups],
  ["works", data.workGroups],
] as const)
  for (const [id, file, it, en] of definitions[kind])
    output.push({
      id,
      source: new URL(file, base).href,
      title: { it, en },
      count: 0,
    });

for (const [id, file, it, en] of definitions.historicalPrompts) {
  const source = new URL(file, base).href;
  const timestamp = documents.get(urlKey(source))?.timestamp;
  data.promptGroups.push({
    id,
    source,
    title: { it, en },
    count: 0,
    historical: true,
    ...(timestamp ? { timestamp } : {}),
  });
}

const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as {
  slug: string;
  path: string;
  editorialId?: string;
  legacyPreview?: boolean;
  sources: EditorialSource[];
}[];
const readyRoots = new Map<string, string>();
const readyAnchors = new Map<string, string>();
const readyItems = new Map<string, string>();
for (const page of conversions.filter((c) => !c.legacyPreview)) {
  if (page.editorialId) readyItems.set(page.editorialId, page.path);
  const markdown = await readFile(
    safePath("src/content/works", `${page.slug}.md`),
    "utf8",
  );
  const ids = new Set(
    [...markdown.matchAll(/\bid="([^"]+)"/g)].map((match) =>
      load(`<span id="${match[1]}"></span>`)("span").attr("id"),
    ),
  );
  for (const [index, source] of page.sources.entries()) {
    const key = urlKey(source.url);
    const prefix = page.sources.length > 1 ? `chapter-${index + 1}-` : "";
    if (source.selection.kind === "whole")
      readyRoots.set(key, page.path + (prefix ? `#chapter-${index + 1}` : ""));
    const doc = documents.get(key);
    if (!/html/i.test(doc?.type ?? "")) continue;
    const selected =
      source.selection.kind === "blocks"
        ? (await sourceBlocks(source.url))
            .slice(source.selection.start, source.selection.end)
            .map((b) => b.html)
            .join("\n")
        : await html(source.url);
    const $ = load(selected);
    for (const element of $("[id],a[name]").toArray()) {
      const anchor = $(element).attr("id") ?? $(element).attr("name");
      if (anchor && ids.has(prefix + anchor))
        readyAnchors.set(
          `${key}#${anchor}`,
          `${page.path}#${encodeURIComponent(prefix + anchor)}`,
        );
    }
  }
}
const targets = new Map<string, BrowseTarget>();
async function target(url: string, title: string) {
  const key = resourceKey(url);
  const existing = targets.get(key);
  if (existing) return existing;
  let internal = true;
  let root = "";
  try {
    root = urlKey(url.split("#")[0]);
  } catch {
    internal = false;
  }
  const doc = internal ? documents.get(root) : undefined;
  const fragment = new URL(url).hash;
  const readingHref = fragment
    ? (readyAnchors.get(key) ?? readyRoots.get(root))
    : readyRoots.get(root);
  const status = readingHref
    ? "ready"
    : !internal
      ? "external"
      : doc && isRecovered(doc)
        ? "recovered"
        : "missing";
  let fragmentMissing = false;
  if (fragment && doc && isRecovered(doc) && /html/i.test(doc.type ?? "")) {
    const $ = load(await html(doc.url));
    const anchor = decodeURIComponent(fragment.slice(1));
    fragmentMissing = !$("[id],a[name]")
      .toArray()
      .some((e) => ($(e).attr("id") ?? $(e).attr("name")) === anchor);
  }
  const id = recordId(url);
  const record: BrowseTarget = {
    id,
    title: redact(title) || url.split("/").at(-1) || "Documento",
    source: redact(url),
    status,
    href: readingHref ?? `/archive-records/${id}/`,
    ...(readingHref ? { readingHref } : {}),
    ...(doc?.timestamp ? { timestamp: doc.timestamp } : {}),
    ...(doc?.type ? { mediaType: doc.type } : {}),
    ...(fragmentMissing ? { fragmentMissing } : {}),
  };
  targets.set(key, record);
  return record;
}
for (const group of data.workGroups) {
  const sourceHtml = await html(group.source);
  const cells = catalogCells(sourceHtml, group.source);
  const grid = load(sourceHtml);
  const indexed = new Set(cells.map((cell) => cell.cell));
  grid("td").each((index, cell) => {
    if (
      !grid(cell).find("table").length &&
      redact(grid(cell).text()) &&
      !indexed.has(index)
    )
      throw new Error(`Unindexed catalog cell: ${group.source} cell ${index}`);
  });
  for (const entry of cells) {
    const links: string[] = [];
    for (const link of entry.links)
      links.push((await target(link.url, link.title)).id);
    data.entries.push({
      id: entry.id,
      title: entry.title,
      caption: entry.caption,
      group: group.id,
      source: group.source,
      cell: entry.cell,
      targets: [...new Set(links)],
    });
    group.count++;
  }
}
const workReferences = new Set(
  map.items
    .filter((i) => i.level === "work")
    .flatMap((i) => i.sources.map((s) => urlKey(s.url))),
);
const catalogTitles = new Map(
  [...targets.entries()].map(([key, t]) => [key, t.title]),
);
const groupBySource = new Map(
  data.promptGroups.map((g) => [urlKey(g.source), g]),
);
for (const item of map.items
  .filter((i) => i.level === "divergence")
  .sort((a, b) =>
    a.sources[0].selection.kind === "blocks" &&
    b.sources[0].selection.kind === "blocks"
      ? a.sources[0].selection.start - b.sources[0].selection.start
      : 0,
  )) {
  const source = item.sources[0];
  const group = groupBySource.get(urlKey(source.url));
  if (!group || source.selection.kind !== "blocks")
    throw new Error(`Unmapped divergence group: ${item.id}`);
  const selected = (await sourceBlocks(source.url)).slice(
    source.selection.start,
    source.selection.end,
  );
  const selectedHtml = selected.map((b) => b.html).join("\n");
  if (sha256(Buffer.from(selectedHtml)) !== source.selection.digest)
    throw new Error(`Changed divergence range: ${item.id}`);
  const $ = load(selectedHtml);
  const links: string[] = [];
  const references: string[] = [];
  for (const a of $("a[href]").toArray()) {
    let url: URL;
    try {
      url = new URL($(a).attr("href") ?? "", source.url);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    const key = resourceKey(url.href);
    const catalogTitle =
      catalogTitles.get(key) ??
      catalogTitles.get(resourceKey(url.href.split("#")[0]));
    if (isIndex(url.href) && !catalogTitle) continue;
    let work = Boolean(catalogTitle);
    try {
      const path = urlKey(url.href.split("#")[0]);
      work ||=
        workReferences.has(path) ||
        (/^\/(?:utopiaucronia|racconti)\//.test(path) &&
          /\.(?:html?|pdf|docx?|rtf|txt|zip)$/i.test(path));
    } catch {}
    if (!work) {
      references.push(
        (await target(url.href, redact($(a).text()) || item.title)).id,
      );
      continue;
    }
    let title = catalogTitle;
    if (!title) {
      const d = documents.get(urlKey(url.href.split("#")[0]));
      title =
        d && isRecovered(d) && /html/i.test(d.type ?? "")
          ? redact(documentTitle(await html(d.url)))
          : item.title;
    }
    links.push((await target(url.href, title ?? item.title)).id);
  }
  data.prompts.push({
    id: item.id,
    title: item.title,
    body: redact(selected.map((b) => b.text).join(" ")),
    authors: item.authors.flatMap((id) => {
      const name = map.authors.find((a) => a.id === id)?.name;
      return name ? [name] : [];
    }),
    group: group.id,
    source: source.url,
    block: source.selection.start,
    ...(readyItems.has(item.id)
      ? { readingHref: readyItems.get(item.id) }
      : {}),
    targets: [...new Set(links)],
    references: [...new Set(references)].filter((id) => !links.includes(id)),
  });
  group.count++;
}
data.targets = [...targets.values()].sort((a, b) => a.id.localeCompare(b.id));
browseSchema.parse(data);
await mkdir("src/generated", { recursive: true });
await writeJson("src/generated/browse.json", data);
await writeJson("reports/browse.json", {
  prompts: data.prompts.length,
  workEntries: data.entries.length,
  uniqueTargets: data.targets.length,
  promptGroups: data.promptGroups,
  workGroups: data.workGroups,
  linkedPrompts: data.prompts.filter((p) => p.targets.length).length,
  statuses: Object.fromEntries(
    ["ready", "recovered", "missing", "external"].map((status) => [
      status,
      data.targets.filter((t) => t.status === status).length,
    ]),
  ),
  verifiedSources: [...verified].sort().map((key) => ({
    url: documents.get(key)?.url,
    sha256: documents.get(key)?.sha256,
  })),
  notes: [
    "Groups follow the recovered menus, not inferred era classification.",
    "Source links indicate related developments/discussions; absence of a link is not proof that a prompt was never developed.",
    "Original text is retained without email addresses; missing and unpublished works have distinct local records.",
  ],
});
console.log(
  `Historical indexes: ${data.prompts.length} prompts across ${data.promptGroups.length} sections; ${data.entries.length} catalog entries across ${data.workGroups.length} categories; ${data.targets.length} distinct references.`,
);
