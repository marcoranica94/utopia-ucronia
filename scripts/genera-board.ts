import { readFile, writeFile } from "node:fs/promises";
import { leggiManifest } from "./recupero/core.ts";

const piano = await readFile("docs/piano-di-sviluppo.md", "utf8");
const sprint = [
  ...piano.matchAll(/^### (S\d) · (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm),
].map((m) => ({
  id: m[1],
  titolo: m[2].trim(),
  demo: /^Demo: (.+)$/m.exec(m[3])?.[1] ?? "",
  attivita: [...m[3].matchAll(/^- \[([ x])\] (.+)$/gm)].map((a) => ({
    fatta: a[1] === "x",
    testo: a[2],
  })),
}));
if (sprint.length !== 7) throw new Error("Sette sprint attesi nel piano");
const attivo = sprint.find((s) => s.attivita.some((a) => !a.fatta))?.id ?? "S6";
const meta = JSON.parse(await readFile("contenuti/board.json", "utf8")) as {
  regole: {
    sprint: string;
    contiene: string;
    stato: string;
    assegnatario: string;
    nota: string;
    nonBloccante?: boolean;
  }[];
};
const stati = ["backlog", "todo", "doing", "waiting", "done"];
for (const r of meta.regole)
  if (!stati.includes(r.stato))
    throw new Error(`Stato board non valido: ${r.stato}`);
const cards = sprint.flatMap((s) =>
  s.attivita.map((a, i) => {
    const r = meta.regole.find(
      (r) => r.sprint === s.id && a.testo.includes(r.contiene),
    );
    return {
      id: `UU-${s.id}-${String(i + 1).padStart(2, "0")}`,
      sprint: s.id,
      titolo: a.testo.replace(/`/g, ""),
      stato: a.fatta
        ? "done"
        : (r?.stato ?? (s.id === attivo ? "todo" : "backlog")),
      assegnatario: r?.assegnatario ?? "Sviluppo",
      nota: r?.nota ?? "",
      nonBloccante: r?.nonBloccante ?? false,
      tipo: /test|verifica|confronto|Playwright|Lighthouse/i.test(a.testo)
        ? "Verifica"
        : "Attività",
    };
  }),
);
for (const r of meta.regole)
  if (
    !sprint.some(
      (s) =>
        s.id === r.sprint &&
        s.attivita.some((a) => a.testo.includes(r.contiene)),
    )
  )
    throw new Error(
      `Regola board senza attività corrispondente: ${r.contiene}`,
    );
const manifest = await leggiManifest();
const dati = {
  attivo,
  aggiornato: new Date().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }),
  sprint: sprint.map(({ attivita: _, ...s }) => s),
  cards,
  evidenze: {
    recuperati: manifest.documenti.filter((d) =>
      d.esito.startsWith("recuperato"),
    ).length,
  },
};
const template = await readFile("templates/board.html", "utf8");
const json = JSON.stringify(dati).replaceAll("<", "\\u003c");
await writeFile("board.html", template.replace('"__BOARD_DATA__"', json));
console.log(
  `Board Kanban aggiornata: ${cards.length} schede, sprint attivo ${attivo}.`,
);
