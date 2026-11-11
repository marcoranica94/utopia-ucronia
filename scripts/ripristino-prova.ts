import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { scaricaArchivioR2 } from "./r2.ts";
import {
  leggiManifest,
  percorsoSicuro,
  scriviJson,
  verificaDocumento,
} from "./recupero/core.ts";

const { values } = parseArgs({
  options: {
    da: { type: "string" },
    r2: { type: "boolean" },
    offline: { type: "boolean" },
  },
});
if (Boolean(values.da) === Boolean(values.r2))
  throw new Error(
    "Indica una sola sorgente: --da /percorso/del/backup oppure --r2",
  );
const temp = await mkdtemp(
  path.join(os.tmpdir(), "utopia-ucronia-ripristino-"),
);
const checkout = path.join(temp, "progetto");
function esegui(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, GIT_LFS_SKIP_SMUDGE: "1" },
  });
  if (r.status !== 0)
    throw new Error(`Comando fallito: ${cmd} ${args.join(" ")}`);
}
try {
  const sorgente = values.r2
    ? path.join(temp, "backup-r2")
    : path.resolve(values.da ?? "");
  if (values.r2) await scaricaArchivioR2(sorgente);
  const manifest = await leggiManifest(sorgente);
  const documenti = manifest.documenti.filter((d) =>
    d.esito.startsWith("recuperato"),
  );
  if (!documenti.length)
    throw new Error("Un archivio vuoto non dimostra un ripristino");
  esegui(
    "git",
    ["clone", "--no-hardlinks", path.resolve("."), checkout],
    path.resolve("."),
  );
  // Ricostruisce l’archivio soltanto dalla copia selezionata.
  await rm(path.join(checkout, "archivio"), { recursive: true, force: true });
  for (const d of documenti) {
    if (!(await verificaDocumento(d, sorgente)))
      throw new Error(`Backup non integro: ${d.url}`);
    const dest = percorsoSicuro(
      path.join(checkout, "archivio/originale"),
      d.percorso ?? "",
    );
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(
      percorsoSicuro(path.join(sorgente, "originale"), d.percorso ?? ""),
      dest,
    );
  }
  await copyFile(
    path.join(sorgente, "manifest.json"),
    path.join(checkout, "archivio/manifest.json"),
  );
  esegui(
    "pnpm",
    ["install", "--frozen-lockfile", ...(values.offline ? ["--offline"] : [])],
    checkout,
  );
  esegui("pnpm", ["recupero", "verifica"], checkout);
  esegui("pnpm", ["build"], checkout);
  await scriviJson(`rapporti/ripristino-${Date.now()}.json`, {
    data: new Date().toISOString(),
    sorgente: values.r2 ? "R2:utopia-ucronia-archivio" : sorgente,
    file: documenti.length,
    clonePulito: true,
    hash: "ok",
    build: "ok",
  });
  console.log(
    `Ripristino riuscito: ${documenti.length} file, clone pulito, dipendenze reinstallate e build verificata.`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
