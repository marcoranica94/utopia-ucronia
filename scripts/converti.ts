import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import {
  convertiHtml,
  decodifica,
  slugTitolo,
  titoloDocumento,
} from "./conversione.ts";
import {
  chiave,
  leggiManifest,
  percorsoSicuro,
  scriviJson,
  sha256,
  verificaDocumento,
} from "./recupero/core.ts";

const manifest = await leggiManifest();
const campione = JSON.parse(
  await readFile("contenuti/campione.json", "utf8"),
) as { documenti: { url: string; lingua?: string }[] };
const documenti = manifest.documenti.filter((d) =>
  d.esito.startsWith("recuperato"),
);
for (const d of documenti)
  if (!(await verificaDocumento(d)))
    throw new Error(`Originale non integro: ${d.url}`);
const pagine = [];
for (const d of documenti) {
  if (!/text\/html/i.test(d.tipo ?? "") || !d.percorso) continue;
  const html = decodifica(
    await readFile(percorsoSicuro("archivio/originale", d.percorso)),
  );
  // Il frameset è un contenitore tecnico, non un’opera vuota.
  if (load(html)("frameset").length) continue;
  const titolo = titoloDocumento(html);
  // Il suffisso lega stabilmente il contenuto alla fonte ed evita omonimie.
  const slug = `${slugTitolo(titolo)}-${sha256(Buffer.from(chiave(d.url))).slice(0, 8)}`;
  pagine.push({ d, html, slug });
}
const urls = new Map(pagine.map((p) => [chiave(p.d.url), `/opere/${p.slug}/`]));
for (const p of pagine)
  if (new URL(p.d.url).pathname.endsWith("/")) {
    urls.set(`${chiave(p.d.url)}index.htm`, `/opere/${p.slug}/`);
    urls.set(`${chiave(p.d.url)}index.html`, `/opere/${p.slug}/`);
  }
const lista = urls.get("/utopiaucronia/lista_ucronie_1.htm");
if (lista) urls.set("/utopiaucronia/lista_ucronie.htm", lista);
const asset = new Map<string, string>();
// Vengono pubblicati soltanto file non eseguibili selezionati nel campione.
await rm("public/campione", { recursive: true, force: true });
await mkdir("public/campione", { recursive: true });
for (const d of documenti) {
  // I PDF restano nell’archivio finché non è verificata la presenza di dati personali e contenuti attivi.
  if (!d.percorso || !/\.(png|jpe?g|gif)$/i.test(d.percorso)) continue;
  const nome = `${d.sha256}${path.extname(d.percorso).toLowerCase()}`;
  await copyFile(
    percorsoSicuro("archivio/originale", d.percorso),
    `public/campione/${nome}`,
  );
  asset.set(chiave(d.url), `/campione/${nome}`);
}
await rm("src/content/opere", { recursive: true, force: true });
await mkdir("src/content/opere", { recursive: true });
const rapporto = [];
for (const { d, html, slug } of pagine) {
  const lacune = new Set<string>();
  const risultato = convertiHtml(html, (href, immagine) => {
    if (href.startsWith("#") && !immagine) return href;
    try {
      const u = new URL(href, d.url);
      const key = chiave(u.href.split("#")[0]);
      const target = immagine
        ? asset.get(key)
        : (urls.get(key) ?? asset.get(key));
      if (target) return `${target}${u.hash}`;
    } catch {
      /* Risorsa esterna o non ammessa: viene documentata come lacuna. */
    }
    lacune.add(href);
    return immagine ? "" : "/lacune/";
  });
  // Correzioni separate dagli originali e riapplicate a ogni build.
  let markdown = risultato.markdown;
  try {
    const correzioni = JSON.parse(
      await readFile(`contenuti/correzioni/${slug}.json`, "utf8"),
    ) as { da: string; a: string }[];
    for (const c of correzioni) {
      if (!c.da || !markdown.includes(c.da))
        throw new Error(`Correzione non applicabile: ${slug}`);
      markdown = markdown.replaceAll(c.da, c.a);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const lingua =
    campione.documenti.find((s) => chiave(s.url) === chiave(d.url))?.lingua ??
    risultato.lingua;
  const meta = {
    titolo: risultato.titolo,
    autori: [],
    lingua,
    livello: "opera",
    divergenze: [],
    origine: [{ url: d.url, timestamp: d.timestamp }],
    da_verificare: ["titolo", "autori", "lingua", "struttura"],
    lacune: lacune.size,
  };
  await writeFile(
    `src/content/opere/${slug}.md`,
    `---\n${Object.entries(meta)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join("\n")}\n---\n\n${markdown}\n`,
  );
  rapporto.push({
    slug,
    origine: d.url,
    titolo: risultato.titolo,
    lacune: [...lacune],
    confronto: {
      titoli: "da verificare",
      paragrafi: "da verificare",
      immagini: "da verificare",
      note: "da verificare",
      tabelle: "da verificare",
      accenti: "da verificare",
      attribuzioni: "da verificare",
    },
  });
}
await scriviJson("rapporti/conversione.json", rapporto);
console.log(
  `${pagine.length} documenti convertiti; confronto editoriale in rapporti/conversione.json`,
);
