import { readFile, writeFile } from "node:fs/promises";
import { isRecovered, readManifest } from "./recovery/core.ts";

const plan = await readFile("docs/development-plan.md", "utf8");
const sprints = [
  ...plan.matchAll(/^### (S\d) · (.+)\n([\s\S]*?)(?=^### |$(?![\s\S]))/gm),
].map((m) => ({
  id: m[1],
  title: m[2].trim(),
  demo: /^Demo: (.+)$/m.exec(m[3])?.[1] ?? "",
  tasks: [...m[3].matchAll(/^- \[([ x])\] (.+)$/gm)].map((a) => ({
    done: a[1] === "x",
    text: a[2],
  })),
}));
if (sprints.length !== 7) throw new Error("Seven sprints expected in the plan");
const meta = JSON.parse(await readFile("data/board.json", "utf8")) as {
  rules: {
    sprint: string;
    contains: string;
    status: string;
    assignee: string;
    note: string;
    nonBlocking?: boolean;
  }[];
};
const active =
  sprints.find((s) =>
    s.tasks.some(
      (a) =>
        !a.done &&
        !meta.rules.some(
          (r) =>
            r.sprint === s.id && r.nonBlocking && a.text.includes(r.contains),
        ),
    ),
  )?.id ?? "S6";
const statuses = ["backlog", "todo", "doing", "waiting", "done"];
for (const r of meta.rules)
  if (!statuses.includes(r.status))
    throw new Error(`Invalid board status: ${r.status}`);
const cards = sprints.flatMap((s) =>
  s.tasks.map((a, i) => {
    const r = meta.rules.find(
      (r) => r.sprint === s.id && a.text.includes(r.contains),
    );
    return {
      id: `UU-${s.id}-${String(i + 1).padStart(2, "0")}`,
      sprint: s.id,
      title: a.text.replace(/`/g, ""),
      status: a.done
        ? "done"
        : (r?.status ?? (s.id === active ? "todo" : "backlog")),
      assignee: r?.assignee ?? "Development",
      note: r?.note ?? "",
      nonBlocking: r?.nonBlocking ?? false,
      kind: /test|verif|check|comparison|Playwright|Lighthouse/i.test(a.text)
        ? "Check"
        : "Task",
    };
  }),
);
for (const r of meta.rules)
  if (
    !sprints.some(
      (s) =>
        s.id === r.sprint && s.tasks.some((a) => a.text.includes(r.contains)),
    )
  )
    throw new Error(`Board rule without a matching task: ${r.contains}`);
const manifest = await readManifest();
const data = {
  active,
  updated: new Date().toLocaleString("en-GB", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }),
  sprints: sprints.map(({ tasks: _, ...s }) => s),
  cards,
  evidence: {
    recovered: manifest.documents.filter(isRecovered).length,
  },
};
const template = await readFile("templates/board.html", "utf8");
const json = JSON.stringify(data).replaceAll("<", "\\u003c");
await writeFile("board.html", template.replace('"__BOARD_DATA__"', json));
console.log(
  `Kanban board updated: ${cards.length} cards, active sprint ${active}.`,
);
