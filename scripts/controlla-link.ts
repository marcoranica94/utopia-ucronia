import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { percorsoSicuro } from "./recupero/core.ts";

async function pagine(dir: string): Promise<string[]> {
  const result: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...(await pagine(file)));
    else if (item.name.endsWith(".html")) result.push(file);
  }
  return result;
}
const errori: string[] = [];
let totale = 0;
for (const file of await pagine("dist")) {
  const html = await readFile(file, "utf8");
  const $ = load(html);
  if (
    $("script,iframe,form,object,embed").length ||
    /mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test($("body").text())
  )
    errori.push(`${file}: codice attivo o email`);
  for (const el of $("a[href],img[src],link[href]").toArray()) {
    const href = $(el).attr("href") ?? $(el).attr("src") ?? "";
    if (/^https?:/.test(href)) continue;
    const u = new URL(
      href,
      `https://archivio.invalid/${path.relative("dist", file)}`,
    );
    const relativo = decodeURIComponent(u.pathname).slice(1);
    let target = percorsoSicuro("dist", relativo || "index.html");
    if (relativo && u.pathname.endsWith("/"))
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
          throw new Error(`Ancora assente: ${id}`);
      }
    } catch {
      errori.push(`${file}: ${href}`);
    }
    totale++;
  }
}
if (errori.length)
  throw new Error(`Collegamenti o contenuti non validi:\n${errori.join("\n")}`);
console.log(
  `${totale} collegamenti e risorse verificati; nessuna email o contenuto attivo nelle pagine HTML`,
);
