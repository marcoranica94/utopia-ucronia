import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import {
  type World,
  type WorldsFile,
  worldsFileSchema,
} from "../src/editorial/worlds.ts";
import { decode } from "./conversion.ts";
import { readMap } from "./editorial-core.ts";
import { safePath, sha256, writeJson } from "./recovery/core.ts";
import {
  contentsChapters,
  linkTarget,
  navigationList,
  navigationMembers,
  normalText,
  numberedParts,
  reciprocalClusters,
  sectionLinks,
} from "./worlds-core.ts";

/**
 * Worlds and cycles.
 *
 *   pnpm worlds propose   derive each agent entry's chapters from its source
 *   pnpm worlds check     derive them again and fail on any disagreement
 *
 * Both write reports/worlds.json, which also lists the clusters of mutually
 * linked pages that no world covers and no rejection explains. Entries the
 * owner reviewed are never rewritten. Reads reports/conversion.json, so run
 * after `pnpm convert`.
 */

const command = process.argv[2];
if (command !== "propose" && command !== "check") {
  console.error("Usage: pnpm worlds propose|check");
  process.exit(2);
}

const FILE = "data/worlds.json";
const file: WorldsFile = worldsFileSchema.parse(
  JSON.parse(await readFile(FILE, "utf8")),
);
const map = await readMap();
const conversions = JSON.parse(
  await readFile("reports/conversion.json", "utf8"),
) as {
  title: string;
  sources: { documentId: string; entry?: string }[];
}[];
const sourceKey = (s: { documentId: string; entry?: string }) =>
  `${s.documentId}::${s.entry ?? ""}`;
const published = new Set(
  conversions.flatMap((item) => item.sources.map(sourceKey)),
);
const documentById = new Map(map.documents.map((d) => [d.id, d]));
const ORDINALS = [
  "prima",
  "seconda",
  "terza",
  "quarta",
  "quinta",
  "sesta",
  "settima",
  "ottava",
  "nona",
  "decima",
];
/** "Parte Quarta (1807 - 1905)" → 4; "parte 2" → 2. */
const partNumber = (rest: string) => {
  const word = /^\W*parte\s+(\w+)/i.exec(rest)?.[1]?.toLowerCase() ?? "";
  return /^\d+$/.test(word) ? Number(word) : ORDINALS.indexOf(word) + 1;
};
type Chapter = World["chapters"][number];
const pages = map.documents.filter((d) => /\.html?$/.test(d.path));
const byPath = new Map(pages.map((d) => [d.path.toLowerCase(), d]));

const html = new Map<string, string>();
for (const d of pages) {
  const raw = await readFile(safePath("archive/original", d.path));
  if (sha256(raw) !== d.sha256) throw Error(`Original changed: ${d.path}`);
  html.set(d.path.toLowerCase(), decode(raw));
}
const text = (path: string) => {
  const source = html.get(path.toLowerCase());
  if (source === undefined) throw Error(`Not an archived page: ${path}`);
  // Title included: some worlds are named only in a page's <title>.
  return normalText(load(source).text());
};

const errors: string[] = [];
const fail = (world: World, message: string) =>
  errors.push(`${world.id}: ${message}`);

/** Chapters from the archive or the edition, in order. */
function derive(world: World): Chapter[] {
  const source = world.source;
  if (source.kind === "zip") {
    const zip = map.documents.find((d) => d.path === source.document);
    if (!zip) {
      fail(world, `zip not archived: ${source.document}`);
      return [];
    }
    return conversions
      .flatMap((item) => item.sources)
      .filter((s) => s.documentId === zip.id && s.entry)
      .map((s) => s.entry as string)
      .sort((a, b) => a.localeCompare(b, "it", { numeric: true }))
      .map((entry) => ({ documentId: zip.id, path: zip.path, entry }));
  }
  if (source.kind === "section") {
    const page = html.get(source.document);
    const links = page
      ? sectionLinks(page, source.document, source.heading)
      : undefined;
    if (!links) {
      fail(world, `no section "${source.heading}" in ${source.document}`);
      return [];
    }
    // Each linked file that is read in the edition, a zip as its files;
    // files not (yet) read, such as scans pending OCR, are left out.
    const byLowerPath = new Map(
      map.documents.map((d) => [d.path.toLowerCase(), d]),
    );
    return links.flatMap((path) => {
      const document = byLowerPath.get(path);
      if (!document) return [];
      return conversions
        .flatMap((item) => item.sources)
        .filter((s) => s.documentId === document.id)
        .map((s) => s.entry)
        .filter((entry, i, all) => all.indexOf(entry) === i)
        .sort((a, b) =>
          (a ?? "").localeCompare(b ?? "", "it", { numeric: true }),
        )
        .map((entry) => ({
          documentId: document.id,
          path: document.path,
          ...(entry ? { entry } : {}),
        }));
    });
  }
  if (source.kind === "series") {
    const parts = conversions
      .filter((item) => item.title.startsWith(source.prefix))
      .map((item) => ({
        n: partNumber(item.title.slice(source.prefix.length)),
        source: item.sources[0],
      }));
    for (const part of parts)
      if (!part.n) fail(world, `no part number after "${source.prefix}"`);
    return parts
      .sort((a, b) => a.n - b.n)
      .map(({ source: s }) => ({
        documentId: s.documentId,
        path: documentById.get(s.documentId)?.path ?? "",
        ...(s.entry ? { entry: s.entry } : {}),
      }));
  }
  return derivePaths(world).map((path) => ({
    documentId: byPath.get(path)?.id as string,
    path,
  }));
}
/** Chapter paths of the page-based sources. */
function derivePaths(world: World): string[] {
  const source = world.source;
  if (
    source.kind === "zip" ||
    source.kind === "series" ||
    source.kind === "section"
  )
    return [];
  if (source.kind === "contents") {
    const page = html.get(source.document);
    if (page === undefined) {
      fail(world, `contents page not archived: ${source.document}`);
      return [];
    }
    const listed = contentsChapters(page, source.document);
    for (const x of source.exclude)
      if (!listed.includes(x)) fail(world, `excluded page not listed: ${x}`);
    return listed.filter((p) => byPath.has(p) && !source.exclude.includes(p));
  }
  const lists = new Map<string, string[]>();
  for (const [path, page] of html) {
    const longest = source.heading
      .split(" ")
      .reduce((a, b) => (b.length > a.length ? b : a));
    if (!page.includes(longest)) continue;
    const list = navigationList(page, path, source.heading);
    if (list)
      lists.set(
        path,
        list.filter((p) => byPath.has(p)),
      );
  }
  if (!lists.size) fail(world, `no page carries "${source.heading}"`);
  return navigationMembers(lists);
}

const owner = new Map<string, string>();
const worlds: World[] = [];
for (const world of file.worlds) {
  const chapters = derive(world);
  const quoted = text(world.evidence.document);
  if (!quoted.includes(normalText(world.evidence.quote)))
    fail(world, `evidence quote not in ${world.evidence.document}`);
  if (chapters.length < 2) fail(world, "fewer than two chapters");
  for (const c of chapters) {
    if (!published.has(sourceKey(c)))
      fail(world, `chapter not in the reading edition: ${c.path}`);
    const other = owner.get(sourceKey(c));
    if (other) fail(world, `${c.path} already belongs to ${other}`);
    owner.set(sourceKey(c), world.id);
  }
  const reviewed = world.review.by === "owner";
  if (command === "propose" && !reviewed) worlds.push({ ...world, chapters });
  else {
    if (JSON.stringify(chapters) !== JSON.stringify(world.chapters))
      fail(
        world,
        command === "check"
          ? "chapters differ from the source: run `pnpm worlds propose`"
          : "owner-reviewed chapters differ from the source",
      );
    worlds.push(world);
  }
}
if (new Set(file.worlds.map((w) => w.id)).size !== file.worlds.length)
  errors.push("duplicate world id");

// Candidates: mutually linked pages, minus covered and explained ones.
const links = new Map<string, string[]>();
for (const [path, page] of html) {
  const $ = load(page);
  const out = new Set<string>();
  $("a[href]").each((_, a) => {
    const t = linkTarget($(a).attr("href") ?? "", path);
    if (t && t !== path && html.has(t)) out.add(t);
  });
  links.set(path, [...out]);
}
const covered = new Set(
  worlds.flatMap((w) => [
    ...w.chapters.map((c) => c.path),
    ...(w.source.kind === "contents"
      ? [w.source.document, ...w.source.exclude]
      : []),
  ]),
);
const explained = new Set(file.rejected.flatMap((r) => r.documents));
const unreviewed = reciprocalClusters(links)
  .filter((c) => c.length >= 3)
  .filter((c) => !c.every((p) => covered.has(p) || explained.has(p)))
  .map((documents) => ({
    documents,
    numberedParts: numberedParts(documents),
  }));

if (command === "propose") {
  const next: WorldsFile = { ...file, worlds };
  await writeFile(FILE, `${JSON.stringify(next, null, 2)}\n`);
}
await writeJson("reports/worlds.json", {
  worlds: worlds.map((w) => ({
    id: w.id,
    form: w.form,
    state: w.review.state,
    chapters: w.chapters.length,
  })),
  rejected: file.rejected.length,
  unreviewed,
  errors,
});
for (const w of worlds)
  console.log(`${w.id}: ${w.form}, ${w.chapters.length} chapters`);
if (unreviewed.length)
  console.log(
    `${unreviewed.length} linked cluster(s) not yet reviewed (reports/worlds.json)`,
  );
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
