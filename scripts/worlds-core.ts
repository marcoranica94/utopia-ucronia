import { type CheerioAPI, load } from "cheerio";

/** Whitespace-collapsed text, as the quotations in data/worlds.json are written. */
export const normalText = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Archive path (lowercase, as in the manifest) that a link in `documentPath`
 * points to, or undefined for anchors on the same page, mail, scripts and
 * other sites. IIS was case-insensitive, so the path is lowercased.
 */
export function linkTarget(
  href: string,
  documentPath: string,
): string | undefined {
  const raw = href.trim();
  if (!raw || raw.startsWith("#")) return undefined;
  let url: URL;
  try {
    url = new URL(raw, `http://archive.invalid/${documentPath}`);
  } catch {
    return undefined;
  }
  if (!["http:", "https:"].includes(url.protocol)) return undefined;
  let path: string;
  if (url.hostname === "archive.invalid") path = url.pathname.slice(1);
  else if (/(^|\.)fmboschetto\.it$/i.test(url.hostname)) {
    path = url.pathname.slice(1);
    // Absolute links to the main folder: "Utopiaucronia/x.htm".
  } else return undefined;
  try {
    path = decodeURIComponent(path);
  } catch {}
  return path.toLowerCase();
}

const isPage = (path: string) => /\.html?$/.test(path);

/** Pages linked from `$root`, in document order, each once, `self` included. */
function pagesIn($: CheerioAPI, root: Parameters<CheerioAPI>[0], self: string) {
  const out: string[] = [];
  $(root)
    .find("a[href], frame[src]")
    .each((_, el) => {
      const href = $(el).attr("href") ?? $(el).attr("src") ?? "";
      const target = href.trim().startsWith("#")
        ? self
        : linkTarget(href, self);
      if (target && isPage(target) && !out.includes(target)) out.push(target);
    });
  return out;
}

/**
 * The links listed under `heading` on one page (S8): from the block that
 * reads exactly `heading` to the next block set in the same font size that
 * holds no link, in order, each once, as archive paths of any file type.
 */
export function sectionLinks(
  html: string,
  documentPath: string,
  heading: string,
): string[] | undefined {
  const $ = load(html);
  const start = $("p,h1,h2,h3,h4,div")
    .filter((_, el) => normalText($(el).text()) === heading)
    .first();
  if (!start.length) return undefined;
  const size = start.find("font[size]").attr("size");
  const out: string[] = [];
  for (let el = start.next(); el.length; el = el.next()) {
    if (
      size &&
      el.find(`font[size="${size}"]`).length &&
      !el.find("a[href]").length
    )
      break;
    el.find("a[href]").each((_, a) => {
      const target = linkTarget($(a).attr("href") ?? "", documentPath);
      if (target && !out.includes(target)) out.push(target);
    });
  }
  return out;
}

/** Chapters listed by a contents page: its page links in order, without itself. */
export function contentsChapters(html: string, documentPath: string) {
  const $ = load(html);
  return pagesIn($, "body", documentPath).filter((p) => p !== documentPath);
}

/**
 * The member list printed under `heading` on one page: the links of the
 * smallest element that contains the heading and at least two page links.
 * A link to an anchor on the same page stands for the page itself.
 * Undefined when the page does not carry the heading.
 */
export function navigationList(
  html: string,
  documentPath: string,
  heading: string,
): string[] | undefined {
  const $ = load(html);
  let deepest: Parameters<CheerioAPI>[0] | undefined;
  $("body *").each((_, el) => {
    if (normalText($(el).text()).includes(heading)) deepest = el;
  });
  if (!deepest) return undefined;
  let box = $(deepest);
  while (box.length) {
    const pages = pagesIn($, box, documentPath);
    if (pages.length >= 2) return pages;
    box = box.parent();
  }
  return undefined;
}

/**
 * One order agreeing with every list (each list may lack some members, for
 * example the page it is printed on). Ties, and contradictions between lists,
 * go to the member seen first.
 */
export function mergeOrders(lists: string[][]): string[] {
  const first = new Map<string, number>();
  let n = 0;
  for (const list of lists)
    for (const item of list) if (!first.has(item)) first.set(item, n++);
  const after = new Map<string, Set<string>>();
  const before = new Map<string, number>();
  for (const item of first.keys()) {
    after.set(item, new Set());
    before.set(item, 0);
  }
  for (const list of lists)
    for (let i = 1; i < list.length; i++) {
      const [a, b] = [list[i - 1], list[i]];
      if (a === b || after.get(a)?.has(b)) continue;
      after.get(a)?.add(b);
      before.set(b, (before.get(b) ?? 0) + 1);
    }
  const order: string[] = [];
  const left = new Set(first.keys());
  const byFirst = (a: string, b: string) =>
    (first.get(a) ?? 0) - (first.get(b) ?? 0);
  while (left.size) {
    const ready = [...left].filter((i) => before.get(i) === 0).sort(byFirst);
    // A contradiction leaves no free member: break it at the earliest one.
    const next = ready[0] ?? [...left].sort(byFirst)[0];
    order.push(next);
    left.delete(next);
    for (const b of after.get(next) ?? [])
      before.set(b, (before.get(b) ?? 1) - 1);
  }
  return order;
}

/**
 * Members of a navigation cycle: the merged order of every printed list,
 * plus pages that carry the heading without being listed anywhere (a second
 * part, "x_2.htm", goes right after "x.htm"; anything else at the end).
 */
export function navigationMembers(lists: Map<string, string[]>): string[] {
  const order = mergeOrders([...lists.values()]);
  const carriers = [...lists.keys()].sort();
  for (const page of carriers) {
    if (order.includes(page)) continue;
    const base = page.replace(/_\d+(\.html?)$/, "$1");
    const at = order.indexOf(base);
    if (at >= 0 && base !== page) {
      let end = at + 1;
      while (
        end < order.length &&
        order[end].replace(/_\d+(\.html?)$/, "$1") === base
      )
        end++;
      order.splice(end, 0, page);
    } else order.push(page);
  }
  return order;
}

/**
 * Groups of pages that link to each other both ways, ignoring pages with
 * `hubLimit` or more page links (site menus and catalogs). These are the
 * candidates a reviewer looks at; most are multi-part works, not worlds.
 */
export function reciprocalClusters(
  links: Map<string, string[]>,
  hubLimit = 20,
): string[][] {
  const hubs = new Set(
    [...links].filter(([, l]) => l.length >= hubLimit).map(([p]) => p),
  );
  const near = new Map<string, Set<string>>();
  const join = (a: string, b: string) => {
    if (!near.has(a)) near.set(a, new Set());
    near.get(a)?.add(b);
  };
  for (const [page, targets] of links) {
    if (hubs.has(page)) continue;
    for (const t of targets)
      if (t !== page && !hubs.has(t) && links.get(t)?.includes(page)) {
        join(page, t);
        join(t, page);
      }
  }
  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const start of [...near.keys()].sort()) {
    if (seen.has(start)) continue;
    const cluster: string[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const page = stack.pop() as string;
      cluster.push(page);
      for (const next of near.get(page) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
    }
    clusters.push(cluster.sort());
  }
  return clusters.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
}

/** True when every page is a numbered part of one file: "x.htm", "x_2.htm"… */
export function numberedParts(pages: string[]) {
  const stems = new Set(
    pages.map((p) => p.replace(/(?:_\d+)?\.html?$/, "").replace(/\d+$/, "")),
  );
  return stems.size === 1;
}
