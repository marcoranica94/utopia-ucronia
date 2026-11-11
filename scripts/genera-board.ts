import { readdir, readFile, writeFile } from "node:fs/promises";
import { leggiManifest } from "./recupero/core.ts";

const piano = await readFile("docs/piano-di-sviluppo.md", "utf8");
const sprint = [
  ...piano.matchAll(/^### (S\d) · (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm),
].map((match) => ({
  id: match[1],
  titolo: match[2].trim(),
  attivita: [...match[3].matchAll(/^- \[([ x])\] (.+)$/gm)].map((m) => ({
    fatta: m[1] === "x",
    testo: m[2],
  })),
  demo: /^Demo: (.+)$/m.exec(match[3])?.[1] ?? "",
}));
if (sprint.length !== 7 || sprint.some((s) => !s.attivita.length))
  throw new Error(
    "Il piano non contiene sette sprint con attività: board non aggiornata",
  );
const manifest = await leggiManifest();
const confronti = JSON.parse(
  await readFile("rapporti/confronto-campione.json", "utf8"),
) as { caratteri: number }[];
const fileRapporti = (await readdir("rapporti"))
  .filter((f) => /^ripristino-\d+\.json$/.test(f))
  .sort();
const ultimoRipristino = fileRapporti.at(-1);
const ripristino = ultimoRipristino
  ? (JSON.parse(await readFile(`rapporti/${ultimoRipristino}`, "utf8")) as {
      build: string;
      file: number;
    })
  : null;
const recuperati = manifest.documenti.filter((d) =>
  d.esito.startsWith("recuperato"),
).length;
const attivo = sprint.find((s) => s.attivita.some((a) => !a.fatta));
const completate = sprint
  .flatMap((s) => s.attivita)
  .filter((a) => a.fatta).length;
const tutte = sprint.reduce((sum, s) => sum + s.attivita.length, 0);
const finiti = sprint.filter((s) => s.attivita.every((a) => a.fatta)).length;
const aggiornato = new Date().toLocaleString("it-IT", {
  timeZone: "Europe/Rome",
  dateStyle: "long",
  timeStyle: "short",
});
const h = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const testoAttivita = (text: string) =>
  h(text).replace(/`([^`]+)`/g, "<code>$1</code>");
const stato = (s: (typeof sprint)[number]) =>
  s.attivita.every((a) => a.fatta)
    ? "concluso"
    : s.id === attivo?.id
      ? "in corso"
      : "da iniziare";
const doneAttivo = attivo?.attivita.filter((a) => a.fatta).length ?? 0;
const totaleAttivo = attivo?.attivita.length ?? 0;
const percento = totaleAttivo
  ? Math.round((doneAttivo / totaleAttivo) * 100)
  : 100;
const icona =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const aperte = attivo?.attivita.filter((a) => !a.fatta) ?? [];
const azioniHtml = aperte
  .map((a) => {
    const testo = a.testo;
    const categoria = /drive/i.test(testo)
      ? { titolo: "Copiare il backup sul tuo drive", chi: "A cura tua" }
      : /Access|segreti GitHub/i.test(testo)
        ? {
            titolo: "Proteggere e pubblicare il sito",
            chi: "Configurazione dell’account",
          }
        : /R2/i.test(testo)
          ? { titolo: "Attivare il backup R2", chi: "Account + sviluppo" }
          : /visivo|telefono/i.test(testo)
            ? { titolo: "Leggere e confrontare da telefono", chi: "Revisione" }
            : { titolo: testo.replace(/`/g, ""), chi: "Sviluppo e verifica" };
    return `<li><h3>${h(categoria.titolo)}</h3><p>${testoAttivita(testo)}</p><span class="who">${h(categoria.chi)}</span></li>`;
  })
  .join("");

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>UtopiaUcronia · Board di sviluppo</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#193049;background:#f0f4f8;line-height:1.55;font-synthesis:none;--blu:#2458b8;--verde:#08796d;--bordo:#d8e1eb;--muted:#50657b}
*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button,a{-webkit-tap-highlight-color:transparent}a{color:var(--blu);text-underline-offset:4px}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #2769d2;outline-offset:4px}button:disabled{cursor:default}svg{width:1.3rem;height:1.3rem;flex-shrink:0}[hidden]{display:none!important}
.shell{width:min(1280px,100% - 64px);margin-inline:auto}.top{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-block:25px;border-bottom:1px solid var(--bordo)}.brand{display:flex;align-items:center;gap:12px;font-weight:750;letter-spacing:-.025em;font-size:1.25rem}.brand svg{width:36px;height:36px;color:var(--blu)}.top nav{display:flex;gap:22px;flex-wrap:wrap;font-size:.9rem}.top nav a{color:var(--muted)}.intro{display:flex;align-items:end;justify-content:space-between;gap:32px;margin:44px 0 28px}.intro h1{font-size:clamp(2rem,4vw,3.4rem);line-height:1.05;letter-spacing:-.05em;margin:0 0 14px}.intro p{color:var(--muted);margin:0;max-width:66ch}.data{font-size:.82rem;flex-shrink:0;color:var(--muted)}
.overview{display:grid;grid-template-columns:1.8fr 1fr;gap:22px}.current{background:#153754;color:#fff;padding:30px 34px;border-radius:18px;display:flex;gap:24px;align-items:center;justify-content:space-between}.current h2{font-size:1.6rem;line-height:1.2;letter-spacing:-.025em;margin:12px 0}.current p{color:#d7e5f0;margin:0;max-width:54ch}.pill{display:inline-flex;align-items:center;gap:7px;font-size:.78rem;font-weight:650;border-radius:30px;padding:5px 11px;background:#eaf1fb;color:#244b80;white-space:nowrap}.current .pill{background:#284f6d;color:#e8f4ff}.dot{width:7px;height:7px;background:currentColor;border-radius:100%}.ring{width:118px;height:118px;flex-shrink:0;position:relative;display:grid;place-items:center}.ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}.ring .track{stroke:#365b76}.ring .fill{stroke:#7de4ca;stroke-linecap:round;stroke-dasharray:${percento} 100}.ring strong{font-size:2rem;letter-spacing:-.05em}.ring span{display:block;text-align:center;font-size:.7rem;color:#d7e5f0;letter-spacing:0;font-weight:500}.summarybox{background:#fff;border:1px solid var(--bordo);border-radius:18px;padding:26px}.summarybox h2{font-size:1rem;margin:0 0 17px}.numbers{display:grid;grid-template-columns:1fr 1fr;gap:22px}.numbers strong{display:block;font-size:2.2rem;line-height:1.1;letter-spacing:-.05em}.numbers span{font-size:.85rem;color:var(--muted)}.smallnote{font-size:.76rem;color:var(--muted);margin:18px 0 0}.section-title{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin:34px 0 16px}.section-title h2{font-size:1.3rem;letter-spacing:-.025em;margin:0}.section-title p{font-size:.85rem;color:var(--muted);margin:0}
.milestones{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}.milestone{background:#e6edf5;border-radius:10px;padding:15px 13px;color:#40566b;text-decoration:none;border:1px solid transparent;min-width:0}.milestone.active{background:#fff;border-color:#2458b8;box-shadow:inset 0 3px #2458b8;color:#193049}.milestone.done{background:#e5f4ee}.milestone strong{font-size:.9rem}.milestone .name{font-size:.8rem;display:block;line-height:1.3;min-height:2.6em;margin:8px 0 12px;overflow-wrap:anywhere}.milestone small{font-size:.72rem;display:block;color:var(--muted)}.bar{height:4px;border-radius:10px;background:#ccd8e5;margin-top:10px;overflow:hidden}.bar span{display:block;background:var(--blu);height:100%;width:var(--progress)}
.work{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(270px,1fr);gap:22px;align-items:start;margin-top:32px}.board,.asidebox{background:#fff;border:1px solid var(--bordo);border-radius:16px}.toolbar{padding:24px;border-bottom:1px solid var(--bordo)}.toolbar h2{font-size:1.2rem;margin:0 0 16px;letter-spacing:-.025em}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.filters{display:flex;background:#edf2f7;border-radius:8px;padding:3px;gap:2px}.filters button{border:0;background:transparent;padding:6px 10px;color:#42586e;border-radius:6px;font-size:.8rem}.filters button[aria-pressed="true"]{background:#fff;box-shadow:0 1px 4px #1b35551c;color:#163650;font-weight:700}.search{flex:1;min-width:160px}.search input{width:100%;border:1px solid var(--bordo);border-radius:8px;padding:8px 11px;font-size:.85rem;background:#fff;color:#193049}.visually-hidden{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.filterresult{font-size:.77rem;color:var(--muted);margin:12px 0 0}details{border-bottom:1px solid var(--bordo)}details:last-child{border:0}summary{list-style:none;cursor:pointer;padding:22px 24px;display:flex;gap:14px;align-items:center}summary::-webkit-details-marker{display:none}summary:after{content:'+';font-size:1.4rem;color:var(--muted);margin-inline-start:auto;font-weight:400}details[open]>summary:after{content:'−'}.sid{font-size:.83rem;font-weight:750;color:var(--blu);min-width:26px}.stitle{font-size:.95rem;font-weight:650;line-height:1.35}.stitle small{display:block;font-size:.75rem;font-weight:400;color:var(--muted);margin-top:4px}.tasks{padding:0 24px 5px;margin:0;list-style:none}.task{display:flex;gap:12px;padding:13px 0;border-top:1px solid #edf1f5;font-size:.87rem;line-height:1.55}.task .check{margin-top:2px;width:20px;height:20px;flex-shrink:0;border:1.5px solid #879aae;border-radius:5px}.task.done .check{display:grid;place-items:center;background:#e5f5ee;border-color:#a1d6c1;color:var(--verde)}.task.done .check svg{width:16px;height:16px}.task.done .tasktext{color:#4c6173}.tasktext{min-width:0;overflow-wrap:anywhere}.task code{font:inherit;font-size:.92em;background:#edf2f7;padding:1px 4px;border-radius:4px;color:#294b6d}.demo{margin:0 24px 22px;padding:14px 16px;background:#f1f5fa;border-radius:8px;font-size:.81rem;color:#3e556d}.demo strong{display:block;color:#193049;margin-bottom:4px}.empty{padding:28px 24px;color:var(--muted)}.sidebar{display:grid;gap:18px}.asidebox{padding:23px}.asidebox h2{font-size:1.08rem;margin:0 0 8px;letter-spacing:-.025em}.asidebox>p{color:var(--muted);font-size:.83rem;margin:0 0 18px}.next{list-style:none;padding:0;margin:0}.next li{padding:16px 0;border-top:1px solid #e8eef4}.next h3{font-size:.88rem;margin:0 0 5px}.next p{font-size:.81rem;color:var(--muted);margin:0}.who{display:inline-block;font-size:.7rem;font-weight:650;color:#71500a;background:#fff2d2;border-radius:5px;padding:2px 7px;margin-top:9px}.checks{padding:0;list-style:none;margin:0}.checks li{display:flex;gap:10px;padding-block:10px;font-size:.83rem;border-bottom:1px solid #edf1f5}.checks li:last-child{border:0}.checks svg{color:var(--verde)}.checks small{color:var(--muted);display:block;margin-top:2px}.private{background:#e8f0fa;border-color:#c9d9ef}.private p{margin:0}.private h2{color:#234d7d}.footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding-block:28px 36px;margin-top:16px;font-size:.77rem;color:var(--muted)}.footer p{margin:0;max-width:75ch}
@media(min-width:1000px){.sidebar{position:sticky;top:18px}}@media(max-width:950px){.overview{grid-template-columns:1fr}.work{grid-template-columns:1fr}.sidebar{grid-template-columns:1fr 1fr}.private{grid-column:1/-1}.milestones{grid-template-columns:repeat(4,minmax(0,1fr))}.intro{align-items:start;flex-direction:column;gap:16px}.milestone .name{min-height:0}}@media(max-width:580px){.shell{width:calc(100% - 28px)}.top{align-items:start;flex-direction:column;gap:12px;padding-block:18px}.top nav{gap:18px}.intro{margin-top:30px}.current{padding:23px;gap:14px;align-items:start;flex-direction:column}.current h2{font-size:1.45rem}.current .ring{align-self:flex-end;width:96px;height:96px;margin-top:-8px}.ring strong{font-size:1.75rem}.summarybox{padding:23px}.milestones{grid-template-columns:repeat(2,minmax(0,1fr))}.milestone:last-child{grid-column:1/-1}.milestone .name{margin-block:5px}.section-title{flex-direction:column;gap:5px}.sidebar{grid-template-columns:1fr}.toolbar,summary{padding:19px}.tasks{padding-inline:19px}.demo{margin-inline:19px}.controls{align-items:stretch;flex-direction:column}.filters{align-self:flex-start}.work{margin-top:24px}.stitle{font-size:.9rem}.numbers strong{font-size:2rem}.footer{padding-bottom:24px}}@media(prefers-reduced-motion:no-preference){a,button{transition:background .15s,color .15s}}@media print{body{background:white}.shell{width:100%}.top nav,.controls,.filterresult{display:none}.work,.overview{display:block}.sidebar{position:static;display:block}.current{print-color-adjust:exact}.board,.asidebox{margin-block:16px;break-inside:avoid}.milestones{grid-template-columns:repeat(7,1fr)}details{break-inside:avoid}.footer{margin:0}}
</style>
</head>
<body>
<div class="shell">
<header class="top"><div class="brand"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M9 32V23c0-6 9-6 9-13V5M9 23c0-6 21-3 21-13V5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="18" cy="5" r="3" fill="currentColor"/><circle cx="30" cy="5" r="3" fill="currentColor"/><circle cx="9" cy="32" r="3" fill="currentColor"/></svg>UtopiaUcronia</div><nav aria-label="Documenti del progetto"><a href="https://github.com/marcoranica94/utopia-ucronia" target="_blank" rel="noopener noreferrer">Repository</a><a href="docs/piano-di-sviluppo.md">Piano completo</a><a href="docs/stato-s0.md">Report S0</a></nav></header>
<main>
<div class="intro"><div><h1>A che punto siamo.</h1><p>Dal recupero del vecchio sito a un archivio personale da leggere. Qui trovi i risultati, il lavoro aperto e il prossimo passo.</p></div><div class="data">Aggiornata il ${h(aggiornato)}</div></div>
<section class="overview" aria-label="Stato del progetto">
<div class="current"><div><span class="pill"><span class="dot"></span>${h(attivo ? `${attivo.id} in corso` : "Progetto completato")}</span><h2>${h(attivo?.titolo ?? "Progetto completato")}</h2><p>${attivo?.id === "S0" ? "La prova locale funziona. " : ""}${attivo ? `Restano ${aperte.length} attività per chiudere ${h(attivo.id)}. Trovi i prossimi passi qui sotto.` : "Tutte le attività del piano risultano completate."}</p></div><div class="ring" role="img" aria-label="${doneAttivo} attività su ${totaleAttivo} completate nello sprint attivo"><svg viewBox="0 0 40 40" aria-hidden="true"><circle class="track" cx="20" cy="20" r="15.915" fill="none" stroke-width="2.5"/><circle class="fill" cx="20" cy="20" r="15.915" fill="none" stroke-width="2.5" pathLength="100"/></svg><strong>${percento}%<span>${doneAttivo} di ${totaleAttivo} attività</span></strong></div></div>
<div class="summarybox"><h2>Il campione è al sicuro in locale</h2><div class="numbers"><div><strong>${recuperati}</strong><span>file recuperati e verificati</span></div><div><strong>${confronti.length}</strong><span>testi convertiti e confrontati</span></div></div><p class="smallnote">${finiti} di ${sprint.length} sprint conclusi. ${completate} attività spuntate su ${tutte}: le attività hanno pesi diversi, non è una stima dei tempi.</p></div>
</section>
<div class="section-title"><h2>Il percorso</h2><p>Ogni sprint si chiude con una demo riuscita.</p></div>
<nav class="milestones" aria-label="Roadmap degli sprint">${sprint
  .map((s) => {
    const n = s.attivita.filter((a) => a.fatta).length;
    return `<a class="milestone ${s.id === attivo?.id ? "active" : n === s.attivita.length ? "done" : ""}" href="#${s.id}"><strong>${s.id}</strong><span class="name">${h(s.titolo)}</span><small>${n}/${s.attivita.length} attività · ${stato(s)}</small><div class="bar" style="--progress:${Math.round((n / s.attivita.length) * 100)}%" aria-hidden="true"><span></span></div></a>`;
  })
  .join("")}</nav>
<div class="work"><section class="board" aria-labelledby="lavoro-title"><div class="toolbar"><h2 id="lavoro-title">La board di lavoro</h2><div class="controls"><div class="filters" role="group" aria-label="Filtra attività"><button type="button" data-filter="all" aria-pressed="true">Tutte</button><button type="button" data-filter="todo" aria-pressed="false">Da fare</button><button type="button" data-filter="done" aria-pressed="false">Completate</button></div><label class="search"><span class="visually-hidden">Cerca un’attività</span><input id="cerca" type="search" placeholder="Cerca un’attività…" autocomplete="off"></label></div><p class="filterresult" id="esito-filtri" aria-live="polite">${tutte} attività nel piano</p></div>
${sprint.map((s) => `<details id="${s.id}" ${s.id === attivo?.id ? "open" : ""}><summary><span class="sid">${s.id}</span><span class="stitle">${h(s.titolo)}<small>${s.attivita.filter((a) => a.fatta).length} di ${s.attivita.length} attività completate · ${stato(s)}</small></span></summary><ul class="tasks">${s.attivita.map((a) => `<li class="task ${a.fatta ? "done" : "todo"}" data-state="${a.fatta ? "done" : "todo"}"><span class="check" aria-label="${a.fatta ? "Completata" : "Da fare"}">${a.fatta ? icona : ""}</span><div class="tasktext">${testoAttivita(a.testo)}</div></li>`).join("")}</ul><p class="demo"><strong>Demo per chiudere ${s.id}</strong>${h(s.demo)}</p></details>`).join("")}
<p class="empty" id="vuoto" hidden>Nessuna attività corrisponde alla ricerca. Cambia il testo o scegli “Tutte”.</p></section>
<aside class="sidebar" aria-label="Prossime azioni e verifiche"><section class="asidebox"><h2>Cosa serve adesso</h2><p>${attivo ? `Per chiudere ${h(attivo.id)}: ${aperte.length} attività aperte.` : "Il piano è completato."}</p><ol class="next">${azioniHtml}</ol></section>
<section class="asidebox"><h2>Le prove già riuscite</h2><ul class="checks"><li>${icona}<div>Archivio integro<small>${recuperati} file con hash verificato. Il rilancio non scarica nulla.</small></div></li><li>${icona}<div>Testi fedeli alle fonti<small>${confronti.length} testi, ${new Intl.NumberFormat("it-IT").format(confronti.reduce((sum, c) => sum + c.caratteri, 0))} caratteri confrontati. Ancore, accenti e tabelle conservati.</small></div></li><li>${icona}<div>Build e controlli locali<small>8 test, TypeScript, Biome e 147 collegamenti verificati nel report S0.</small></div></li><li>${icona}<div>${ripristino?.build === "ok" ? "Ripristino da clone pulito" : "Backup esportabile"}<small>${ripristino?.build === "ok" ? `${ripristino.file} file ricostruiti dal backup, dipendenze reinstallate e build riuscita.` : "Verifica il rapporto di ripristino per confermare la prova completa."}</small></div></li><li>${icona}<div>Deploy simulato<small>Configurazione accettata da Wrangler. Il sito non è stato pubblicato.</small></div></li></ul></section>
<section class="asidebox private"><h2>Resta un archivio privato</h2><p>Gli originali non vengono serviti. Le pagine convertite escludono email e codice attivo. Il PDF resta nell’archivio in attesa di verifica.</p></section></aside></div>
</main><footer class="footer"><p>Le spunte riflettono il piano di sviluppo. La board è una fotografia del lavoro: filtri e ricerca non modificano le attività.</p><a href="README.md">Come avviare e verificare il progetto</a></footer>
</div>
<script>
(() => {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const search = document.querySelector('#cerca');
  const sections = [...document.querySelectorAll('details')];
  const tasks = [...document.querySelectorAll('.task')];
  let filter = 'all';
  function update() {
    const query = search.value.trim().toLocaleLowerCase('it');
    let visible = 0;
    for (const task of tasks) {
      task.hidden = (filter !== 'all' && task.dataset.state !== filter) || !task.textContent.toLocaleLowerCase('it').includes(query);
      if (!task.hidden) visible++;
    }
    for (const section of sections) {
      section.hidden = ![...section.querySelectorAll('.task')].some(task => !task.hidden);
      if (query || filter !== 'all') section.open = !section.hidden;
    }
    document.querySelector('#esito-filtri').textContent = visible + ' attività su ' + tasks.length;
    document.querySelector('#vuoto').hidden = visible > 0;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }
  for (const button of buttons) button.addEventListener('click', () => { filter = button.dataset.filter; update(); });
  search.addEventListener('input', update);
  for (const link of document.querySelectorAll('.milestone')) link.addEventListener('click', () => {
    filter = 'all'; search.value = ''; update();
    const target = document.querySelector(link.getAttribute('href'));
    target.open = true;
  });
})();
</script>
</body></html>`;
await writeFile("board.html", html);
console.log(
  `board.html aggiornata: ${sprint.length} sprint, ${completate}/${tutte} attività completate; ${attivo?.id ?? "nessuno sprint attivo"}.`,
);
