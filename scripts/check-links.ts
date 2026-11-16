import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { allowsSameOriginScripts, contentPolicies } from "./header-policies.ts";
import { safePath } from "./recovery/core.ts";

async function pages(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await pages(file)));
    else if (item.name.endsWith(".html")) result.push(file);
  }
  return result;
}
const errors: string[] = [];
const responseHeaders = await readFile("dist/_headers", "utf8");
let total = 0;
const checked = new Map<string, Set<string> | null>();
for (const file of await pages("dist")) {
  const html = await readFile(file, "utf8");
  const $ = load(html);
  const pathname = `/${path.relative("dist", file).replace(/index\.html$/, "")}`;
  if (
    $("script[src]").length &&
    !allowsSameOriginScripts(contentPolicies(responseHeaders, pathname))
  )
    errors.push(`${file}: response CSP blocks the interface scripts`);
  const isCatalog = [
    path.join("dist", "index.html"),
    path.join("dist", "en", "index.html"),
  ].includes(file);
  const unexpectedScripts = $("script")
    .toArray()
    .filter(
      (script) =>
        ![
          "/theme.js",
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
    errors.push(`${file}: active code or email`);
  for (const el of $("a[href],img[src],link[href],script[src]").toArray()) {
    const href = $(el).attr("href") ?? $(el).attr("src") ?? "";
    if (/^https?:/.test(href)) continue;
    const u = new URL(
      href,
      `https://archive.invalid/${path.relative("dist", file)}`,
    );
    const relative = decodeURIComponent(u.pathname).slice(1);
    let target = safePath("dist", relative || "index.html");
    if (relative && u.pathname.endsWith("/"))
      target = path.join(target, "index.html");
    try {
      if (!checked.has(target)) {
        await access(target);
        if (target.endsWith(".html")) {
          const dest = load(await readFile(target, "utf8"));
          checked.set(
            target,
            new Set(
              dest("[id]")
                .toArray()
                .map((e) => dest(e).attr("id") ?? ""),
            ),
          );
        } else checked.set(target, null);
      }
      if (
        u.hash &&
        target.endsWith(".html") &&
        !checked.get(target)?.has(decodeURIComponent(u.hash.slice(1)))
      )
        throw new Error(`Missing anchor: ${u.hash}`);
    } catch {
      errors.push(`${file}: ${href}`);
    }
    total++;
  }
}
if (errors.length)
  throw new Error(`Invalid links or content:\n${errors.join("\n")}`);
console.log(
  `${total} links and resources checked; no email or active content in the HTML pages`,
);
