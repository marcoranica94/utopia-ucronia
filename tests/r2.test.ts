import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { scaricaArchivioR2 } from "../scripts/r2.ts";
import { sha256 } from "../scripts/recupero/core.ts";

const dati = Buffer.from("Un originale conservato.");
const documento = {
  url: "https://www.fmboschetto.it/Utopiaucronia/prova.htm",
  varianti: [],
  esito: "recuperato",
  percorso: "utopiaucronia/prova.htm",
  sha256: sha256(dati),
  dimensione: dati.length,
};
for (const caso of ["integro", "corrotto", "percorso non sicuro"]) {
  test(`ripristino R2 simulato: ${caso}`, async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "ucronia-r2-test-"));
    const dest = path.join(temp, "backup");
    const richieste: string[] = [];
    const manifest = {
      versione: 1,
      documenti: [
        {
          ...documento,
          ...(caso === "percorso non sicuro"
            ? { percorso: "../../fuori.htm" }
            : {}),
        },
      ],
    };
    try {
      const esegui = () =>
        scaricaArchivioR2(dest, async (chiave, file) => {
          richieste.push(chiave);
          await writeFile(
            file,
            chiave === "manifest.json"
              ? JSON.stringify(manifest)
              : caso === "corrotto"
                ? Buffer.from("alterato")
                : dati,
          );
        });
      if (caso === "integro") {
        await esegui();
        assert.deepEqual(
          await readFile(path.join(dest, "originale", documento.percorso)),
          dati,
        );
        await assert.rejects(esegui(), /EEXIST/);
      } else
        await assert.rejects(
          esegui(),
          caso === "corrotto" ? /non integro/ : /Percorso non sicuro/,
        );
      assert.equal(richieste.length, caso === "percorso non sicuro" ? 1 : 2);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
}
