import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { load } from "cheerio";
import { decode } from "../conversion.ts";
import {
  isRecovered,
  originalPath,
  readManifest,
  request,
  safePath,
  urlKey,
  writeJson,
} from "./core.ts";

type Capture = { timestamp: string; url: string; type: string; digest: string };
type Entry = {
  url: string;
  variants: string[];
  captures: Capture[];
  foundIn: string[];
};
type Queue = {
  version: 1;
  source: string;
  complete: boolean;
  resumeKey: string | null;
  pages: number;
  documents: Entry[];
};
const source = "www.fmboschetto.it/Utopiaucronia/*";

export async function discover(
  maxPages: number,
  delay: number,
  fetchPage = request,
): Promise<void> {
  if (
    (!Number.isInteger(maxPages) && maxPages !== Infinity) ||
    maxPages < 1 ||
    !Number.isFinite(delay) ||
    delay < 2
  )
    throw new Error("Use a positive --max-pages and a --delay of at least 2 s");
  let queue: Queue;
  try {
    queue = JSON.parse(await readFile("archive/queue.json", "utf8")) as Queue;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    queue = {
      version: 1,
      source,
      complete: false,
      resumeKey: null,
      pages: 0,
      documents: [],
    };
  }
  if (
    queue.version !== 1 ||
    queue.source !== source ||
    !Array.isArray(queue.documents)
  )
    throw new Error(
      "Incompatible queue: keep the file and check it before continuing",
    );
  const entries = new Map(queue.documents.map((d) => [urlKey(d.url), d]));
  const add = (url: string, foundIn?: string): Entry | null => {
    try {
      originalPath(url);
      const key = urlKey(url);
      let entry = entries.get(key);
      if (!entry) {
        entry = { url, variants: [url], captures: [], foundIn: [] };
        entries.set(key, entry);
      }
      if (!entry.variants.includes(url)) entry.variants.push(url);
      if (foundIn && !entry.foundIn.includes(foundIn))
        entry.foundIn.push(foundIn);
      return entry;
    } catch {
      return null;
    }
  };
  const manifest = await readManifest();
  for (const d of manifest.documents) {
    add(d.url);
    if (!d.path || !isRecovered(d)) continue;
    const addLink = (href: string | undefined) => {
      if (!href || href.startsWith("#")) return;
      try {
        const u = new URL(href, d.url);
        u.hash = "";
        add(u.href, d.url);
      } catch {
        /* Malformed URL in the source. */
      }
    };
    const addCss = (css: string) => {
      for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi))
        addLink(match[1]);
      for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi))
        addLink(match[1]);
    };
    if (/\.css$/i.test(new URL(d.url).pathname)) {
      addCss(decode(await readFile(safePath("archive/original", d.path))));
      continue;
    }
    if (!/text\/html/i.test(d.type ?? "")) continue;
    const $ = load(
      decode(await readFile(safePath("archive/original", d.path))),
    );
    $("a[href],area[href],link[href]").each((_i, el) =>
      addLink($(el).attr("href")),
    );
    $(
      "img[src],frame[src],iframe[src],source[src],input[src],video[poster],object[data],embed[src],bgsound[src]",
    ).each((_i, el) => {
      addLink($(el).attr("src") ?? $(el).attr("poster") ?? $(el).attr("data"));
    });
    $("[background]").each((_i, el) => addLink($(el).attr("background")));
    $("[srcset]").each((_i, el) => {
      for (const candidate of ($(el).attr("srcset") ?? "").split(","))
        addLink(candidate.trim().split(/\s+/)[0]);
    });
    $("[style],style").each((_i, el) => {
      const css = $(el).attr("style") ?? $(el).text();
      addCss(css);
    });
  }
  // Persist links even if the first CDX request fails.
  queue.documents = [...entries.values()];
  await writeJson("archive/queue.json", queue);
  let count = 0;
  while (!queue.complete && count < maxPages) {
    const query = new URLSearchParams({
      url: source,
      output: "json",
      fl: "original,timestamp,mimetype,statuscode,digest",
      filter: "statuscode:200",
      limit: "1000",
      showResumeKey: "true",
    });
    if (queue.resumeKey) query.set("resumeKey", queue.resumeKey);
    const response = await fetchPage(
      `https://web.archive.org/cdx/search/cdx?${query}`,
    );
    if (!response.ok) throw new Error(`CDX HTTP ${response.status}`);
    const rows = (await response.json()) as string[][];
    if (
      !Array.isArray(rows) ||
      !Array.isArray(rows[0]) ||
      rows[0][0] !== "original"
    )
      throw new Error("Unexpected CDX format: previous queue kept");
    let next: string | null = null;
    for (const row of rows.slice(1)) {
      if (row.length === 1) {
        next = row[0];
        continue;
      }
      if (row.length < 5) continue;
      const [url, timestamp, type, , digest] = row;
      if (!/^\d{14}$/.test(timestamp)) continue;
      const entry = add(url);
      if (
        entry &&
        !entry.captures.some((c) => c.timestamp === timestamp && c.url === url)
      )
        entry.captures.push({ timestamp, url, type, digest });
    }
    if (next && next === queue.resumeKey)
      throw new Error("The CDX cursor is not advancing: previous queue kept");
    queue.resumeKey = next;
    queue.complete = !next;
    queue.pages++;
    count++;
    queue.documents = [...entries.values()];
    await writeJson("archive/queue.json", queue);
    console.log(
      `CDX page ${queue.pages}: ${queue.documents.length} URLs found; ${queue.complete ? "index exhausted" : "resume available"}`,
    );
    if (!queue.complete && count < maxPages) await sleep(delay * 1000);
  }
  queue.documents = [...entries.values()];
  await writeJson("archive/queue.json", queue);
  if (!queue.complete)
    console.log(
      "Partial inventory: run the command again to continue from the saved cursor.",
    );
}
