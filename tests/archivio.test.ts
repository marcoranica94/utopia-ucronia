import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { convertiHtml, decodifica } from "../scripts/conversione.ts";
import {
  attesaRetry,
  chiave,
  percorsoOriginale,
  percorsoSicuro,
  preparaDati,
  sha256,
  verificaDocumento,
} from "../scripts/recupero/core.ts";

const url = "https://www.fmboschetto.it/Utopiaucronia/prova.htm";
test("conserva il testo inglobato in un form FrontPage non chiuso", () => {
  const r = convertiHtml(
    '<html><body><form><input value="vecchio controllo"><h1>Titolo</h1><p>Una storia da conservare.</p></body></html>',
    () => "/lacune/",
  );
  assert.match(r.markdown, /Una storia da conservare/);
  assert.doesNotMatch(r.markdown, /<form|<input/);
});
test("gzip non dichiarato: conserva e calcola hash sui byte decompressi", () => {
  const dati = Buffer.from("<html><body>Una storia</body></html>");
  const r = preparaDati(gzipSync(dati), url, "text/html");
  assert.equal(r.compresso, true);
  assert.deepEqual(r.dati, dati);
  assert.equal(sha256(r.dati), sha256(dati));
});
test("rifiuta pagine di errore 200, HTML e PDF troncati e immagini false", () => {
  for (const html of [
    "<html><body>Bot blocked</body></html>",
    "<html><body>HTTP Error 404</body></html>",
    "<html><body>testo",
  ])
    assert.throws(() => preparaDati(Buffer.from(html), url, "text/html"));
  assert.throws(() =>
    preparaDati(
      Buffer.from("<html>errore</html>"),
      url.replace(".htm", ".pdf"),
      "application/pdf",
    ),
  );
  assert.throws(() =>
    preparaDati(
      Buffer.from("%PDF-1.4 troncato"),
      url.replace(".htm", ".pdf"),
      "application/pdf",
    ),
  );
  assert.throws(() =>
    preparaDati(
      Buffer.from("non una immagine"),
      url.replace(".htm", ".png"),
      "image/png",
    ),
  );
});
test("unifica le maiuscole senza consentire uscite dall’archivio", () => {
  assert.equal(
    chiave(url),
    chiave(url.replace("Utopiaucronia", "utopiaucronia")),
  );
  assert.equal(percorsoOriginale(url), "utopiaucronia/prova.htm");
  assert.throws(() =>
    percorsoOriginale("https://altro.example/Utopiaucronia/a.htm"),
  );
  assert.throws(() =>
    percorsoOriginale(
      "https://www.fmboschetto.it/Utopiaucronia/%2e%2e%2fsegreto",
    ),
  );
  assert.throws(() => percorsoSicuro("/archivio", "../segreto"));
});
test("Retry-After numerico e data HTTP, backoff limitato a dieci minuti", () => {
  assert.equal(attesaRetry("30", 0), 30000);
  assert.equal(
    attesaRetry(
      "Wed, 11 Nov 2026 12:00:30 GMT",
      0,
      Date.parse("2026-11-11T12:00:00Z"),
    ),
    30000,
  );
  assert.equal(attesaRetry(null, 2), 8000);
  assert.equal(attesaRetry("3600", 0), 600000);
});
test("rileva un originale alterato anziché trattarlo come file già valido", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ucronia-test-"));
  try {
    await mkdir(path.join(root, "originale"));
    const dati = Buffer.from("originale");
    await writeFile(path.join(root, "originale/a.htm"), dati);
    const d = {
      url,
      varianti: [url],
      esito: "recuperato" as const,
      percorso: "a.htm",
      sha256: sha256(dati),
      dimensione: dati.length,
    };
    assert.equal(await verificaDocumento(d, root), true);
    await writeFile(path.join(root, "originale/a.htm"), "alterato");
    assert.equal(await verificaDocumento(d, root), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("decodifica Windows-1252 e preserva accenti francesi", () => {
  assert.equal(decodifica(Buffer.from([0xe9, 0x20, 0x80])), "é €");
});
test("conversione: rimuove codice attivo ed email, preserva testo, tabelle e ancore", () => {
  const html =
    '<html lang="fr"><head><title>Une histoire</title></head><body onload="evil()"><script>evil()</script><p>Été à Paris <a href="mailto:autore@example.org">Autore</a></p><a name="nota">Nota</a><table><tr><td>1848</td><td>République</td></tr></table><iframe src="https://evil.invalid"></iframe><img src="https://evil.invalid/a.png" onerror="evil()"><p>autore@example.org</p><a href="javascript:evil()">leggi</a></body></html>';
  const r = convertiHtml(html, (_href, img) => (img ? "" : "/lacune/"));
  assert.equal(r.lingua, "fr");
  assert.match(r.markdown, /Été à Paris/);
  assert.match(r.markdown, /<table>/);
  assert.match(r.markdown, /id="nota"/);
  assert.doesNotMatch(
    r.markdown,
    /evil|mailto:|autore@example|<script|<iframe|onload|onerror/,
  );
});
