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
const published = new Set(
  (
    JSON.parse(await readFile("reports/conversion.json", "utf8")) as {
      sources: { documentId: string }[];
    }[]
  ).flatMap((item) => item.sources.map((s) => s.documentId)),
);
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

/** Chapter paths from the archive, in order. */
function derive(world: World): string[] {
  const source = world.source;
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
  const paths = derive(world);
  const chapters = paths.map((path) => ({
    documentId: byPath.get(path)?.id as string,
    path,
  }));
  const quoted = text(world.evidence.document);
  if (!quoted.includes(normalText(world.evidence.quote)))
    fail(world, `evidence quote not in ${world.evidence.document}`);
  if (chapters.length < 2) fail(world, "fewer than two chapters");
  for (const c of chapters) {
    if (!published.has(c.documentId))
      fail(world, `chapter not in the reading edition: ${c.path}`);
    const other = owner.get(c.documentId);
    if (other) fail(world, `${c.path} already belongs to ${other}`);
    owner.set(c.documentId, world.id);
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
