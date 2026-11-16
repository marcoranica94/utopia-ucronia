import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  type EditorialMap,
  identifier,
  publicText,
} from "../src/editorial/model.ts";
import { sha256 } from "./recovery/core.ts";

export const reviewDecisionSchema = z.object({
  proposalId: identifier,
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["approved", "deferred"]),
  reason: publicText.min(3).max(2000),
  updatedAt: z.iso.datetime(),
});
export const decisionFileSchema = z
  .object({ version: z.literal(1), decisions: z.array(reviewDecisionSchema) })
  .superRefine((data, ctx) => {
    if (
      new Set(data.decisions.map((d) => d.proposalId)).size !==
      data.decisions.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate owner decisions" });
  });
export type DecisionFile = z.infer<typeof decisionFileSchema>;
export function proposalFingerprint(map: EditorialMap, id: string) {
  const proposal = map.proposals.find((p) => p.id === id);
  if (!proposal) throw new Error("Unknown proposal");
  return sha256(
    Buffer.from(
      JSON.stringify({
        action: proposal.action,
        level: proposal.level,
        targets: proposal.targets,
        documents: proposal.documents.map((id) => ({
          id,
          sha256: map.documents.find((d) => d.id === id)?.sha256,
        })),
        items: proposal.targets.map((id) => {
          const item = map.items.find((i) => i.id === id);
          return item
            ? {
                id,
                title: item.title,
                level: item.level,
                authors: item.authors,
                sources: item.sources,
                composition: item.composition,
              }
            : null;
        }),
      }),
    ),
  );
}
export async function readDecisions(
  file = "data/review-decisions.json",
): Promise<DecisionFile> {
  try {
    return decisionFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, decisions: [] };
    throw error;
  }
}
export function applyDecisions(map: EditorialMap, ledger: DecisionFile) {
  for (const decision of ledger.decisions) {
    if (proposalFingerprint(map, decision.proposalId) !== decision.fingerprint)
      throw new Error(`Reviewed proposal changed: ${decision.proposalId}`);
    const proposal = map.proposals.find((p) => p.id === decision.proposalId);
    if (!proposal) throw new Error("Missing reviewed proposal");
    // A structural proposal decision never approves its items or classifications.
    proposal.review = {
      by: "owner",
      state: decision.state,
      reason: decision.reason,
      quote: proposal.review.quote,
    };
  }
  return map;
}
