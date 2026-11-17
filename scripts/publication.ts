import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { itemPath, readMap } from "./editorial-core.ts";
import {
  baselineIds,
  publicationCandidate,
  publicationItems,
  publicationTargets,
  readPublication,
  selectPublication,
  updatePublication,
} from "./publication-core.ts";
import { writeJson } from "./recovery/core.ts";
import { readDecisions } from "./review-decisions.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean" },
    whole: { type: "boolean" },
    action: { type: "string", default: "work" },
    limit: { type: "string", default: "20" },
  },
});
const [command = "status", proposalId = ""] = positionals;
if (
  !["status", "next", "select", "remove", "select-approved"].includes(
    command,
  ) ||
  positionals.length > 2
)
  throw Error(
    "Use: pnpm publication status | next [--action work|split|merge] [--limit 20] | select <proposal-id> [--whole] [--dry-run] | select-approved [--dry-run] | remove <proposal-id> [--dry-run]",
  );
if ((command === "select" || command === "remove") !== Boolean(proposalId))
  throw Error(
    "select/remove require exactly one proposal ID; status/next do not take an ID",
  );

const map = await readMap(),
  ledger = await readDecisions(),
  baseline = await baselineIds();
const publication = await readPublication();
const edition = values.whole ? ("whole" as const) : undefined;
const change = (current: typeof publication) => {
  if (command === "select")
    return selectPublication(
      map,
      ledger,
      current,
      baseline,
      proposalId,
      edition,
    );
  if (!current.selections.some((s) => s.proposalId === proposalId))
    throw Error(`Proposal is not selected: ${proposalId}`);
  const next = {
    ...current,
    selections: current.selections.filter((s) => s.proposalId !== proposalId),
  };
  publicationItems(map, ledger, next, baseline);
  return next;
};
if (command === "select-approved") {
  // Select every approved, not yet selected proposal in one process, with the
  // same checks as `select`: one map read instead of one per proposal.
  // A split needs an explicit edition choice (`select <id> [--whole]`), so
  // bulk selection leaves split proposals alone.
  const pendingIds = (
    current: typeof publication,
    currentLedger: typeof ledger,
    currentMap: typeof map,
  ) =>
    currentLedger.decisions
      .filter(
        (d) =>
          d.state === "approved" &&
          currentMap.proposals.find((p) => p.id === d.proposalId)?.action !==
            "split" &&
          !current.selections.some((s) => s.proposalId === d.proposalId),
      )
      .map((d) => d.proposalId);
  const selectAll = (
    currentMap: typeof map,
    currentLedger: typeof ledger,
    current: typeof publication,
  ) =>
    pendingIds(current, currentLedger, currentMap).reduce(
      (next, id) =>
        selectPublication(currentMap, currentLedger, next, baseline, id),
      current,
    );
  const before = publication.selections.length;
  const next = values["dry-run"]
    ? selectAll(map, ledger, publication)
    : await updatePublication("data/publication.json", async (current) => {
        const currentMap = await readMap(),
          currentLedger = await readDecisions();
        const latest = selectAll(currentMap, currentLedger, current);
        publicationItems(currentMap, currentLedger, latest, baseline);
        return latest;
      });
  console.log(
    JSON.stringify(
      {
        dryRun: Boolean(values["dry-run"]),
        command,
        selected: next.selections.length - before,
        canonicalItems: publicationItems(map, ledger, next, baseline).items
          .length,
        next: "Run pnpm build to convert and verify every selected text before deployment.",
      },
      null,
      2,
    ),
  );
} else if (command === "select" || command === "remove") {
  // Re-read both decisions and selection while holding the publication lock.
  const next = values["dry-run"]
    ? change(publication)
    : await updatePublication("data/publication.json", async (current) => {
        const currentMap = await readMap(),
          currentLedger = await readDecisions();
        const latest =
          command === "select"
            ? selectPublication(
                currentMap,
                currentLedger,
                current,
                baseline,
                proposalId,
                edition,
              )
            : change(current);
        publicationItems(currentMap, currentLedger, latest, baseline);
        return latest;
      });
  console.log(
    JSON.stringify(
      {
        dryRun: Boolean(values["dry-run"]),
        command,
        proposalId,
        canonicalItems: publicationItems(map, ledger, next, baseline).items
          .length,
        next: "Run pnpm build to convert and verify every selected text before deployment.",
      },
      null,
      2,
    ),
  );
} else {
  const current = publicationItems(map, ledger, publication, baseline);
  const selected = new Set(current.items.map((i) => i.id));
  if (command === "status") {
    console.log(
      JSON.stringify(
        {
          baselineItems: baseline.length,
          additionalItems: current.extraIds.length,
          canonicalItems: selected.size,
          approvedProposals: ledger.decisions.filter(
            (d) => d.state === "approved",
          ).length,
          readyToSelect: ledger.decisions
            .filter(
              (d) =>
                d.state === "approved" &&
                !publication.selections.some(
                  (s) => s.proposalId === d.proposalId,
                ),
            )
            .flatMap((decision) => {
              try {
                const additions = publicationCandidate(
                  map,
                  decision.proposalId,
                  current.items,
                );
                return additions.length
                  ? [
                      {
                        proposalId: decision.proposalId,
                        titles: additions.map((item) => item.title),
                      },
                    ]
                  : [];
              } catch {
                return [];
              }
            }),
          selections: publication.selections.map((s) => ({
            proposalId: s.proposalId,
            titles: publicationTargets(map, s.proposalId, s.edition).map(
              (i) => i.title,
            ),
          })),
          note: "Approval alone never selects a text for publication. Selection alone never deploys it.",
        },
        null,
        2,
      ),
    );
  } else {
    const limit = Number(values.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw Error("Choose a review batch of 1–20 proposals");
    if (!["work", "split", "merge"].includes(values.action))
      throw Error("Review action must be work, split or merge");
    const pending = map.proposals
      .filter((p) => p.action === values.action && p.review.by !== "owner")
      .sort((a, b) => a.id.localeCompare(b.id));
    const skipped: { proposalId: string; reason: string }[] = [];
    const entries = pending
      .flatMap((proposal, index) => {
        try {
          const targets = publicationTargets(map, proposal.id);
          if (targets.every((item) => selected.has(item.id))) return [];
          publicationCandidate(map, proposal.id, current.items);
          return [
            {
              proposalId: proposal.id,
              action: proposal.action,
              reviewPath: `/review/?state=pending&action=${proposal.action}&page=${Math.floor(index / 20) + 1}#${proposal.id}`,
              reason: proposal.review.reason,
              quote: proposal.review.quote,
              items: targets.map((item) => ({
                id: item.id,
                title: item.title,
                path: itemPath(item),
                composition: item.composition,
                alreadyPublished: selected.has(item.id),
                sources: item.sources.map((source) => ({
                  ...source,
                  sha256: map.documents.find((d) => d.id === source.documentId)
                    ?.sha256,
                  localReviewPath: `/review/source/${source.documentId}/`,
                })),
              })),
            },
          ];
        } catch (error) {
          skipped.push({
            proposalId: proposal.id,
            reason:
              error instanceof Error
                ? error.message
                : "Unsupported publication candidate",
          });
          return [];
        }
      })
      .slice(0, limit);
    const report = {
      action: values.action,
      proposals: entries.length,
      skipped,
      note: "Read-only review packet. No owner approval, publication selection or live ledger was changed.",
      entries,
    };
    await writeJson("reports/publication-next.json", report);
    const markdownText = (text: string) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/[\\`*_[\]]/g, "\\$&");
    await writeFile(
      "reports/publication-next.md",
      [
        "# Next publication review batch",
        "",
        "Read-only proposals for owner review. No approval or publication selection has been recorded. Review links open on the local development server after `pnpm dev`; they are absent from the deployed site.",
        "",
        ...entries.flatMap((entry, index) => [
          `## ${index + 1}. ${entry.items.map((item) => markdownText(item.title)).join(" / ")}`,
          "",
          `Proposal: \`${entry.proposalId}\` · action: \`${entry.action}\``,
          "",
          `[Review this proposal](${entry.reviewPath})`,
          "",
          `> ${markdownText(entry.quote)}`,
          "",
          markdownText(entry.reason),
          "",
          ...entry.items.flatMap((item) => [
            `Target: \`${item.path}\` · composition: \`${item.composition}\``,
            "",
            ...item.sources.flatMap((source) => [
              `[Full source for local review](${source.localReviewPath})`,
              "",
              `Source: ${markdownText(source.url)}`,
              "",
              `SHA-256: \`${source.sha256}\``,
              "",
              `Selection: \`${JSON.stringify(source.selection)}\``,
              "",
            ]),
          ]),
        ]),
      ].join("\n"),
    );
    console.log(JSON.stringify(report, null, 2));
  }
}
