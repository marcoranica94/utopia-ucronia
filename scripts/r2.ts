import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  leggiManifest,
  percorsoSicuro,
  verificaDocumento,
} from "./recupero/core.ts";

export type LeggiOggetto = (chiave: string, file: string) => Promise<void>;
const leggiRemoto: LeggiOggetto = async (chiave, file) => {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error(
      "Credenziali Cloudflare mancanti: nessun download R2 eseguito",
    );
  const r = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "r2",
      "object",
      "get",
      `utopia-ucronia-archivio/${chiave}`,
      "--file",
      file,
      "--remote",
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error(`Download R2 non riuscito: ${chiave}`);
};

export async function scaricaArchivioR2(
  destinazione: string,
  leggi: LeggiOggetto = leggiRemoto,
): Promise<void> {
  // La destinazione deve essere nuova: mai sovrascrivere un archivio o una copia precedente.
  await mkdir(destinazione, { recursive: false });
  await leggi("manifest.json", path.join(destinazione, "manifest.json"));
  const manifest = await leggiManifest(destinazione);
  const documenti = manifest.documenti.filter((d) =>
    d.esito.startsWith("recuperato"),
  );
  if (!documenti.length)
    throw new Error("Il manifest R2 non contiene file recuperati");
  for (const d of documenti) {
    if (!d.percorso || !d.sha256 || d.dimensione === undefined)
      throw new Error("Metadati R2 incompleti");
    const target = percorsoSicuro(
      path.join(destinazione, "originale"),
      d.percorso,
    );
    await mkdir(path.dirname(target), { recursive: true });
    await leggi(`originale/${d.percorso}`, target);
    if (!(await verificaDocumento(d, destinazione)))
      throw new Error(`Oggetto R2 non integro: ${d.percorso}`);
  }
}
