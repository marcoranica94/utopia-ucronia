import { readFile } from "node:fs/promises";
import { setTimeout as pausa } from "node:timers/promises";
import { load } from "cheerio";
import { decodifica } from "../conversione.ts";
import {
  chiave,
  leggiManifest,
  percorsoOriginale,
  percorsoSicuro,
  richiesta,
  scriviJson,
} from "./core.ts";

type Copia = { timestamp: string; url: string; tipo: string; digest: string };
type Voce = {
  url: string;
  varianti: string[];
  copie: Copia[];
  trovata_in: string[];
};
type Coda = {
  versione: 1;
  sorgente: string;
  completa: boolean;
  resumeKey: string | null;
  pagine: number;
  documenti: Voce[];
};
const sorgente = "www.fmboschetto.it/Utopiaucronia/*";

export async function scopri(maxPagine: number, attesa: number): Promise<void> {
  if (
    (!Number.isInteger(maxPagine) && maxPagine !== Infinity) ||
    maxPagine < 1 ||
    !Number.isFinite(attesa) ||
    attesa < 2
  )
    throw new Error(
      "Usare --max-pagine positivo e --attesa di almeno 2 secondi",
    );
  let coda: Coda;
  try {
    coda = JSON.parse(await readFile("archivio/coda.json", "utf8")) as Coda;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    coda = {
      versione: 1,
      sorgente,
      completa: false,
      resumeKey: null,
      pagine: 0,
      documenti: [],
    };
  }
  if (
    coda.versione !== 1 ||
    coda.sorgente !== sorgente ||
    !Array.isArray(coda.documenti)
  )
    throw new Error(
      "Coda incompatibile: conservare il file e verificare prima di proseguire",
    );
  const voci = new Map(coda.documenti.map((d) => [chiave(d.url), d]));
  const aggiungi = (url: string, fonte?: string): Voce | null => {
    try {
      percorsoOriginale(url);
      const key = chiave(url);
      let voce = voci.get(key);
      if (!voce) {
        voce = { url, varianti: [url], copie: [], trovata_in: [] };
        voci.set(key, voce);
      }
      if (!voce.varianti.includes(url)) voce.varianti.push(url);
      if (fonte && !voce.trovata_in.includes(fonte))
        voce.trovata_in.push(fonte);
      return voce;
    } catch {
      return null;
    }
  };
  const manifest = await leggiManifest();
  for (const d of manifest.documenti) {
    aggiungi(d.url);
    if (
      !d.percorso ||
      !/text\/html/i.test(d.tipo ?? "") ||
      !d.esito.startsWith("recuperato")
    )
      continue;
    const $ = load(
      decodifica(
        await readFile(percorsoSicuro("archivio/originale", d.percorso)),
      ),
    );
    $("a[href],img[src],frame[src],link[href]").each((_i, el) => {
      const href = $(el).attr("href") ?? $(el).attr("src");
      if (!href || href.startsWith("#")) return;
      try {
        const u = new URL(href, d.url);
        u.hash = "";
        aggiungi(u.href, d.url);
      } catch {
        /* URL malformato nella fonte. */
      }
    });
  }
  let count = 0;
  while (!coda.completa && count < maxPagine) {
    const query = new URLSearchParams({
      url: sorgente,
      output: "json",
      fl: "original,timestamp,mimetype,statuscode,digest",
      filter: "statuscode:200",
      limit: "1000",
      showResumeKey: "true",
    });
    if (coda.resumeKey) query.set("resumeKey", coda.resumeKey);
    const response = await richiesta(
      `https://web.archive.org/cdx/search/cdx?${query}`,
    );
    if (!response.ok) throw new Error(`CDX HTTP ${response.status}`);
    const rows = (await response.json()) as string[][];
    if (
      !Array.isArray(rows) ||
      !Array.isArray(rows[0]) ||
      rows[0][0] !== "original"
    )
      throw new Error("Formato CDX inatteso: coda precedente conservata");
    let prossimo: string | null = null;
    for (const row of rows.slice(1)) {
      if (row.length === 1) {
        prossimo = row[0];
        continue;
      }
      if (row.length < 5) continue;
      const [url, timestamp, tipo, , digest] = row;
      if (!/^\d{14}$/.test(timestamp)) continue;
      const voce = aggiungi(url);
      if (
        voce &&
        !voce.copie.some((c) => c.timestamp === timestamp && c.url === url)
      )
        voce.copie.push({ timestamp, url, tipo, digest });
    }
    if (prossimo && prossimo === coda.resumeKey)
      throw new Error("Il cursore CDX non avanza: coda precedente conservata");
    coda.resumeKey = prossimo;
    coda.completa = !prossimo;
    coda.pagine++;
    count++;
    coda.documenti = [...voci.values()];
    await scriviJson("archivio/coda.json", coda);
    console.log(
      `Pagina CDX ${coda.pagine}: ${coda.documenti.length} URL individuati; ${coda.completa ? "indice esaurito" : "ripresa disponibile"}`,
    );
    if (!coda.completa && count < maxPagine) await pausa(attesa * 1000);
  }
  coda.documenti = [...voci.values()];
  await scriviJson("archivio/coda.json", coda);
  if (!coda.completa)
    console.log(
      "Inventario parziale: ripetere il comando per proseguire dal cursore salvato.",
    );
}
