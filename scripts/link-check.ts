import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import type { BuildCache } from "./build-cache.ts";
import { allowsSameOriginScripts, contentPolicies } from "./header-policies.ts";
import { safePath } from "./recovery/core.ts";

/** What a single page says about itself: verdicts that depend only on its own
 * HTML, path and the response headers, its outgoing references and its ids.
 * Cached per page; resolving references against other pages is not. */
export type PageFacts = {
  problems: string[];
  refs: { href: string; target: string; hash: string }[];
  ids: string[];
};

async function pages(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await pages(file)));
    else if (item.name.endsWith(".html")) result.push(file);
  }
  return result;
}

export function pageFacts(
  dist: string,
  file: string,
  html: string,
  responseHeaders: string,
): PageFacts {
  const problems: string[] = [];
  const $ = load(html);
  const pathname = `/${path.relative(dist, file).replace(/index\.html$/, "")}`;
  if (
    $("script[src]").length &&
    !allowsSameOriginScripts(contentPolicies(responseHeaders, pathname))
  )
    problems.push("response CSP blocks the interface scripts");
  const isCatalog = [
    path.join(dist, "index.html"),
    path.join(dist, "en", "index.html"),
    path.join(dist, "library", "index.html"),
    path.join(dist, "en", "library", "index.html"),
  ].includes(file);
  const unexpectedScripts = $("script")
    .toArray()
    .filter(
      (script) =>
        ![
          "/theme.js",
          "/search-shortcut.js",
          ...(/^\/(?:en\/)?search\//.test(pathname) ? ["/search.js"] : []),
          "/rail.js",
          "/reader.js",
          ...(isCatalog ? ["/catalog.js"] : []),
          ...(/^\/(?:en\/)?(?:divergences|works)\/period\//.test(pathname)
            ? ["/browse.js"]
            : []),
        ].includes($(script).attr("src") ?? ""),
    );
  if (
    unexpectedScripts.length ||
    $("iframe,object,embed").length ||
    (!isCatalog && $("form").length) ||
    /mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test($("body").text())
  )
    problems.push("active code or email");
  const refs: PageFacts["refs"] = [];
  for (const el of $("a[href],img[src],link[href],script[src]").toArray()) {
    const href = $(el).attr("href") ?? $(el).attr("src") ?? "";
    if (/^https?:/.test(href)) continue;
    const u = new URL(
      href,
      `https://archive.invalid/${path.relative(dist, file)}`,
    );
    const relative = decodeURIComponent(u.pathname).slice(1);
    let target = safePath(dist, relative || "index.html");
    if (relative && u.pathname.endsWith("/"))
      target = path.join(target, "index.html");
    refs.push({ href, target: path.relative(dist, target), hash: u.hash });
  }
  return {
    problems,
    refs,
    ids: $("[id]")
      .toArray()
      .map((e) => $(e).attr("id") ?? ""),
  };
}

/** Checks every HTML page of `dist`. Page facts come from the cache when the
 * page bytes, its path, the response headers and the toolchain are unchanged;
 * whether each reference resolves (target exists, anchor present in the
 * target's current ids) is recomputed on every run. */
export async function checkLinks(
  dist: string,
  cache?: BuildCache<PageFacts>,
): Promise<{ errors: string[]; total: number }> {
  const errors: string[] = [];
  const responseHeaders = await readFile(path.join(dist, "_headers"), "utf8");
  const files = await pages(dist);
  const facts = new Map<string, PageFacts>();
  for (const file of files) {
    const bytes = await readFile(file);
    const key = cache?.key(path.relative(dist, file), bytes, responseHeaders);
    let result = key ? await cache?.get(key) : undefined;
    if (!result) {
      result = pageFacts(dist, file, bytes.toString("utf8"), responseHeaders);
      if (key) await cache?.set(key, result);
    }
    facts.set(file, result);
  }
  let total = 0;
  const checked = new Map<string, Set<string> | null>();
  for (const file of files) {
    const page = facts.get(file) as PageFacts;
    for (const problem of page.problems) errors.push(`${file}: ${problem}`);
    for (const ref of page.refs) {
      const target = path.join(dist, ref.target);
      try {
        if (!checked.has(target)) {
          await access(target);
          if (target.endsWith(".html")) {
            const known = facts.get(target);
            if (known) checked.set(target, new Set(known.ids));
            else {
              const dest = load(await readFile(target, "utf8"));
              checked.set(
                target,
                new Set(
                  dest("[id]")
                    .toArray()
                    .map((e) => dest(e).attr("id") ?? ""),
                ),
              );
            }
          } else checked.set(target, null);
        }
        if (
          ref.hash &&
          target.endsWith(".html") &&
          !checked.get(target)?.has(decodeURIComponent(ref.hash.slice(1)))
        )
          throw new Error(`Missing anchor: ${ref.hash}`);
      } catch {
        errors.push(`${file}: ${ref.href}`);
      }
      total++;
    }
  }
  return { errors, total };
}
