import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
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
let total = 0;
for (const file of await pages("dist")) {
  const html = await readFile(file, "utf8");
  const $ = load(html);
  if (
    $("script,iframe,form,object,embed").length ||
    /mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test($("body").text())
  )
    errors.push(`${file}: active code or email`);
  for (const el of $("a[href],img[src],link[href]").toArray()) {
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
      await access(target);
      if (u.hash && target.endsWith(".html")) {
        const dest = load(await readFile(target, "utf8"));
        const id = decodeURIComponent(u.hash.slice(1));
        if (
          !dest("[id]")
            .toArray()
            .some((e) => dest(e).attr("id") === id)
        )
          throw new Error(`Missing anchor: ${id}`);
      }
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
