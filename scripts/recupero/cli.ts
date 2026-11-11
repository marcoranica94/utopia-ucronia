import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as pausa } from "node:timers/promises";
import { parseArgs } from "node:util";
import type { Documento } from "./core.ts";
import {
  chiave,
  copie,
  leggiManifest,
  percorsoOriginale,
  percorsoSicuro,
  preparaDati,
  richiesta,
  scriviJson,
  sha256,
  verificaDocumento,
} from "./core.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    solo: { type: "string" },
    lotto: { type: "string", default: "10" },
    pausa: { type: "string", default: "30" },
    attesa: { type: "string", default: "2" },
    "max-lotti": { type: "string" },
  },
});
const manifest = await leggiManifest();
if (positionals[0] === "verifica") {
  const recuperati = manifest.documenti.filter((d) =>
    d.esito.startsWith("recuperato"),
  );
  for (const d of recuperati)
    if (!(await verificaDocumento(d)))
      throw new Error(`Hash o dimensioni errati: ${d.url}`);
  console.log(
    `${recuperati.length} file verificati; ${manifest.documenti.length - recuperati.length} URL non recuperati`,
  );
} else if (positionals[0] === "scarica") {
  if (!values.solo)
    throw new Error("S0 richiede --solo contenuti/campione.json");
  const selezione = JSON.parse(await readFile(values.solo, "utf8")) as {
    documenti: { url: string }[];
  };
  const lotto = Number(values.lotto),
    attesa = Number(values.attesa),
    pausaLotti = Number(values.pausa);
  const maxLotti = values["max-lotti"] ? Number(values["max-lotti"]) : Infinity;
  if (
    ![lotto, attesa, pausaLotti].every(Number.isFinite) ||
    !Number.isInteger(lotto) ||
    lotto < 1 ||
    lotto > 10 ||
    attesa < 2 ||
    pausaLotti < 30 ||
    maxLotti < 1
  )
    throw new Error("Limiti: lotto 1–10, attesa ≥ 2 s, pausa ≥ 30 s");
  let stop = false,
    eseguiti = 0;
  process.on("SIGINT", () => {
    stop = true;
    console.log("Completo il salvataggio corrente prima di fermarmi.");
  });
  const visti = new Set<string>();
  for (const { url } of selezione.documenti) {
    if (stop || eseguiti >= lotto * maxLotti) break;
    const key = chiave(url);
    if (visti.has(key)) continue;
    visti.add(key);
    const index = manifest.documenti.findIndex((d) => chiave(d.url) === key);
    const presente = manifest.documenti[index];
    if (presente && (await verificaDocumento(presente))) {
      console.log(`Già valido: ${url}`);
      continue;
    }
    if (presente?.sha256 && presente.esito.startsWith("recuperato"))
      throw new Error(
        `Originale alterato o assente: ${url}. Ripristinarlo dal backup, senza sovrascriverlo.`,
      );
    const documento: Documento = {
      url,
      varianti: [...new Set([...(presente?.varianti ?? []), url])],
      esito: "tentativo fallito",
    };
    try {
      const disponibili = await copie(url);
      await pausa(attesa * 1000);
      let transitorio = false;
      for (let i = 0; i < disponibili.length && !stop; i++) {
        const c = disponibili[i];
        documento.varianti = [...new Set([...documento.varianti, c.original])];
        try {
          const r = await richiesta(
            `https://web.archive.org/web/${c.timestamp}id_/${c.original}`,
          );
          if (r.status === 404 || r.status === 410) continue;
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const tipo = r.headers.get("content-type") ?? c.mimetype;
          const { dati, compresso } = preparaDati(
            new Uint8Array(await r.arrayBuffer()),
            c.original,
            tipo,
          );
          const relativo = percorsoOriginale(url),
            dest = percorsoSicuro("archivio/originale", relativo);
          await mkdir(path.dirname(dest), { recursive: true });
          try {
            await writeFile(dest, dati, { flag: "wx" });
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "EEXIST" ||
              sha256(await readFile(dest)) !== sha256(dati)
            )
              throw error;
          }
          Object.assign(documento, {
            esito: i ? "recuperato da copia precedente" : "recuperato",
            percorso: relativo,
            timestamp: c.timestamp,
            statoHttp: 200,
            tipo,
            dimensione: dati.length,
            sha256: sha256(dati),
            compresso,
          });
          delete documento.errore;
          break;
        } catch (error) {
          documento.errore = String(error);
          if (/HTTP|fetch|timeout|network|Redirect/i.test(String(error)))
            transitorio = true;
        } finally {
          await pausa(attesa * 1000);
        }
      }
      if (!documento.sha256)
        documento.esito =
          transitorio || stop ? "tentativo fallito" : "mancante";
    } catch (error) {
      documento.errore = String(error);
    }
    if (index < 0) manifest.documenti.push(documento);
    else manifest.documenti[index] = documento;
    await scriviJson("archivio/manifest.json", manifest);
    const riga = `${new Date().toISOString()} ${documento.esito}: ${url}`;
    await appendFile("archivio/registro.log", `${riga}\n`);
    console.log(riga);
    eseguiti++;
    if (eseguiti % lotto === 0 && !stop && eseguiti < lotto * maxLotti)
      await pausa(pausaLotti * 1000);
  }
} else
  throw new Error(
    "Comandi S0: scarica --solo contenuti/campione.json | verifica. scopri/copertura previsti in S1.",
  );
