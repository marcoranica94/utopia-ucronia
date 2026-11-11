import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  leggiManifest,
  percorsoSicuro,
  verificaDocumento,
} from "./recupero/core.ts";

const { values } = parseArgs({
  options: { destinazione: { type: "string" }, r2: { type: "boolean" } },
});
const manifest = await leggiManifest();
const documenti = manifest.documenti.filter((d) =>
  d.esito.startsWith("recuperato"),
);
if (!documenti.length)
  throw new Error(
    "Nessun file recuperato: il backup vuoto non dimostra la conservazione",
  );
for (const d of documenti)
  if (!(await verificaDocumento(d)))
    throw new Error(`Originale non integro: ${d.url}`);
if (values.r2) {
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)
    throw new Error("Credenziali Cloudflare mancanti");
  for (const d of documenti) {
    const r = spawnSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "r2",
        "object",
        "put",
        `utopia-ucronia-archivio/originale/${d.percorso}`,
        "--file",
        percorsoSicuro("archivio/originale", d.percorso ?? ""),
        "--remote",
      ],
      { stdio: "inherit" },
    );
    if (r.status !== 0) throw new Error(`Backup R2 fallito: ${d.percorso}`);
  }
  // Manifest pubblicato per ultimo: non dichiara file non ancora caricati.
  const r = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "r2",
      "object",
      "put",
      "utopia-ucronia-archivio/manifest.json",
      "--file",
      "archivio/manifest.json",
      "--remote",
    ],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("Backup manifest R2 fallito");
} else {
  const base =
    values.destinazione ?? process.env.BACKUP_DESTINAZIONE ?? "backup";
  const dest = path.resolve(
    base,
    `utopia-ucronia-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`,
  );
  if (dest.startsWith(`${path.resolve("archivio")}${path.sep}`))
    throw new Error("Il backup deve stare fuori dall’archivio");
  await mkdir(dest, { recursive: true });
  for (const d of documenti) {
    const target = percorsoSicuro(
      path.join(dest, "originale"),
      d.percorso ?? "",
    );
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(
      percorsoSicuro("archivio/originale", d.percorso ?? ""),
      target,
      constants.COPYFILE_EXCL,
    );
    if (!(await verificaDocumento(d, dest)))
      throw new Error(`Copia non integra: ${d.percorso}`);
  }
  await copyFile(
    "archivio/manifest.json",
    path.join(dest, "manifest.json"),
    constants.COPYFILE_EXCL,
  );
  console.log(
    `Backup verificato (${documenti.length} file): ${dest}\nCopia questa cartella sul tuo drive. Finché rimane qui non è una copia indipendente.`,
  );
}
