import { open, readFile, rm } from "node:fs/promises";
import { z } from "zod";
import {
  type EditorialItem,
  type EditorialMap,
  identifier,
} from "../src/editorial/model.ts";
import { sha256, writeJson } from "./recovery/core.ts";
import {
  applyDecisions,
  type DecisionFile,
  proposalFingerprint,
} from "./review-decisions.ts";

export const publicationSchema = z
  .strictObject({
    version: z.literal(1),
    selections: z.array(
      z.strictObject({
        proposalId: identifier,
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        selectedAt: z.iso.datetime(),
      }),
    ),
  })
  .refine(
    (data) =>
      new Set(data.selections.map((s) => s.proposalId)).size ===
      data.selections.length,
    "Duplicate publication selections",
  );
export type Publication = z.infer<typeof publicationSchema>;

export async function readPublication(
  file = "data/publication.json",
): Promise<Publication> {
  return publicationSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export async function updatePublication(
  file: string,
  update: (current: Publication) => Promise<Publication> | Publication,
) {
  const lock = await open(`${file}.lock`, "wx");
  try {
    const next = publicationSchema.parse(
      await update(await readPublication(file)),
    );
    await writeJson(file, next);
    return next;
  } finally {
    await lock.close();
    await rm(`${file}.lock`, { force: true });
  }
}

export async function baselineIds() {
  const baseline = z
    .strictObject({
      version: z.literal(1),
      validationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      items: z.array(identifier).min(1),
    })
    .parse(
      JSON.parse(await readFile("data/publication-baseline.json", "utf8")),
    );
  const sample = JSON.parse(
    await readFile("data/validation-sample.json", "utf8"),
  );
  if (
    sha256(Buffer.from(JSON.stringify(sample))) !==
    baseline.validationFingerprint
  )
    throw Error(
      "The fixed validation sample changed; review the baseline explicitly",
    );
  if (
    new Set(baseline.items).size !== baseline.items.length ||
    !sample.items.every((id: string) => baseline.items.includes(id))
  )
    throw Error("Invalid publication baseline");
  return baseline.items;
}

export function publicationFingerprint(map: EditorialMap, proposalId: string) {
  const proposal = map.proposals.find((p) => p.id === proposalId);
  if (!proposal) throw Error(`Unknown publication proposal: ${proposalId}`);
  return sha256(
    Buffer.from(
      JSON.stringify({
        structure: proposalFingerprint(map, proposalId),
        items: proposal.targets.map((id) => {
          const item = map.items.find((i) => i.id === id);
          if (!item) throw Error(`Missing publication target: ${id}`);
          return {
            id,
            slug: item.slug,
            language: item.language.value,
            contributions: item.contributions,
          };
        }),
      }),
    ),
  );
}

export function publicationTargets(map: EditorialMap, proposalId: string) {
  const proposal = map.proposals.find((p) => p.id === proposalId);
  if (!proposal) throw Error(`Unknown publication proposal: ${proposalId}`);
  if (
    !["work", "split", "merge"].includes(proposal.action) ||
    !proposal.targets.length
  )
    throw Error(`Proposal has no supported reading edition: ${proposalId}`);
  const targets = proposal.targets.map((id) => {
    const item = map.items.find((i) => i.id === id);
    if (!item) throw Error(`Missing publication target: ${id}`);
    if (item.level === "world")
      throw Error(`World publication is not implemented: ${id}`);
    for (const source of item.sources) {
      const document = map.documents.find((d) => d.id === source.documentId);
      if (
        !document ||
        !/^(?:text\/html|application\/pdf)(?:;|$)/i.test(document.mediaType)
      )
        throw Error(`Unsupported reading source: ${source.documentId}`);
      if (!proposal.documents.includes(source.documentId))
        throw Error(
          `Publication source is outside its reviewed proposal: ${source.documentId}`,
        );
    }
    return item;
  });
  if (new Set(targets.map((i) => i.id)).size !== targets.length)
    throw Error(`Duplicate proposal targets: ${proposalId}`);
  return targets;
}

function overlaps(a: EditorialItem, b: EditorialItem) {
  return a.sources.some((left) =>
    b.sources.some((right) => {
      if (left.documentId !== right.documentId) return false;
      if (left.selection.kind === "whole" || right.selection.kind === "whole")
        return true;
      return (
        left.selection.start < right.selection.end &&
        right.selection.start < left.selection.end
      );
    }),
  );
}

export function publicationCandidate(
  map: EditorialMap,
  proposalId: string,
  existing: EditorialItem[],
) {
  const selected = new Map(existing.map((item) => [item.id, item]));
  const additions: EditorialItem[] = [];
  for (const item of publicationTargets(map, proposalId)) {
    if (selected.has(item.id)) continue;
    for (const previous of selected.values()) {
      if (overlaps(item, previous))
        throw Error(
          `Overlapping reading editions: ${item.id} and ${previous.id}`,
        );
      if (item.slug === previous.slug)
        throw Error(`Duplicate publication route: ${item.slug}`);
    }
    selected.set(item.id, item);
    additions.push(item);
  }
  return additions;
}

export function publicationItems(
  map: EditorialMap,
  ledger: DecisionFile,
  publication: Publication,
  baseline: string[],
) {
  publicationSchema.parse(publication);
  // Read the explicit ledger, never infer owner approval from an item's metadata.
  applyDecisions(structuredClone(map), ledger);
  const selected = new Map(
    baseline.map((id) => {
      const item = map.items.find((i) => i.id === id);
      if (!item) throw Error(`Baseline item is missing: ${id}`);
      return [id, item] as const;
    }),
  );
  const extraIds = new Set<string>();
  for (const entry of publication.selections) {
    const decision = ledger.decisions.find(
      (d) => d.proposalId === entry.proposalId,
    );
    if (decision?.state !== "approved")
      throw Error(
        `Publication requires an explicit current owner approval: ${entry.proposalId}`,
      );
    if (publicationFingerprint(map, entry.proposalId) !== entry.fingerprint)
      throw Error(
        `Publication selection changed; review and select it again: ${entry.proposalId}`,
      );
    for (const item of publicationCandidate(map, entry.proposalId, [
      ...selected.values(),
    ])) {
      selected.set(item.id, item);
      extraIds.add(item.id);
    }
  }
  return { items: [...selected.values()], extraIds: [...extraIds] };
}

export function selectPublication(
  map: EditorialMap,
  ledger: DecisionFile,
  publication: Publication,
  baseline: string[],
  proposalId: string,
) {
  if (publication.selections.some((s) => s.proposalId === proposalId))
    throw Error(`Proposal already selected: ${proposalId}`);
  const current = publicationItems(map, ledger, publication, baseline);
  const targets = publicationTargets(map, proposalId);
  if (
    targets.every((item) =>
      current.items.some((selected) => selected.id === item.id),
    )
  )
    throw Error(`All proposal targets are already published: ${proposalId}`);
  const next = publicationSchema.parse({
    ...publication,
    selections: [
      ...publication.selections,
      {
        proposalId,
        fingerprint: publicationFingerprint(map, proposalId),
        selectedAt: new Date().toISOString(),
      },
    ],
  });
  publicationItems(map, ledger, next, baseline);
  return next;
}
