import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { load } from "cheerio";
import { decodifica } from "./conversione.ts";
import { leggiManifest, percorsoSicuro, scriviJson } from "./recupero/core.ts";

// Il testo deve coincidere dopo le sole rimozioni dichiarate e normalizzando gli spazi.
function normalizza(testo: string): string {
  return testo
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email rimossa]")
    .replace(/mailto:/gi, "")
    .replace(/\s/g, "")
    .normalize("NFC");
}
const manifest = await leggiManifest();
const conversioni = JSON.parse(
  await readFile("rapporti/conversione.json", "utf8"),
) as { slug: string; origine: string }[];
assert.ok(
  conversioni.length > 0,
  "Il confronto non può riuscire su un campione vuoto",
);
const rapporti = [];
for (const c of conversioni) {
  const documento = manifest.documenti.find((d) => d.url === c.origine);
  assert.ok(documento?.percorso);
  const fonte = load(
    decodifica(
      await readFile(percorsoSicuro("archivio/originale", documento.percorso)),
    ),
  );
  fonte(
    "script,style,iframe,input,button,select,textarea,object,embed,applet,bgsound,noscript",
  ).remove();
  const pagina = load(
    await readFile(
      percorsoSicuro("dist/opere", `${c.slug}/index.html`),
      "utf8",
    ),
  );
  const originale = normalizza(fonte("body").text());
  const convertito = normalizza(pagina("article").text());
  assert.ok(originale.length > 0, `Fonte vuota: ${c.slug}`);
  assert.equal(
    convertito,
    originale,
    `Il testo convertito non coincide: ${c.slug}`,
  );
  const ancore = [
    ...new Set(
      fonte("a[name]")
        .toArray()
        .map((e) => fonte(e).attr("name")),
    ),
  ];
  const ids = pagina("article [id]")
    .toArray()
    .map((e) => pagina(e).attr("id"));
  assert.equal(new Set(ids).size, ids.length, `ID duplicati: ${c.slug}`);
  for (const ancora of ancore)
    assert.ok(ids.includes(ancora), `Ancora persa in ${c.slug}`);
  assert.equal(
    pagina("article table").length,
    fonte("table").length,
    `Tabella persa: ${c.slug}`,
  );
  const imgFonte = fonte("img").length;
  const imgConvertite = pagina("article img").length;
  rapporti.push({
    slug: c.slug,
    caratteri: originale.length,
    testo: "identico dopo normalizzazione degli spazi e rimozioni dichiarate",
    ancore: ancore.length,
    tabelle: fonte("table").length,
    immagini: {
      origine: imgFonte,
      consultabili: imgConvertite,
      escluseDalCampione: imgFonte - imgConvertite,
    },
    verificaVisiva: "da eseguire nel browser",
    attribuzioniEditoriali: "da verificare",
  });
}
await scriviJson("rapporti/confronto-campione.json", rapporti);
console.log(
  `${rapporti.length} testi confrontati integralmente: testo, accenti, ancore e tabelle conservati. Verifica visiva ancora necessaria.`,
);
