import { z } from "zod";
import {
  identifier,
  interpretation,
  publicText,
  reviewSchema,
} from "./model.ts";

/**
 * Owner-approved vocabularies (data/vocabulary.json) and the per-item
 * classification overlay (data/classification.json). The overlay replaces
 * the map's `unknown` eras/places/themes without regenerating the 33 MB map;
 * every assignment records who gave it, its state and a quotation.
 */
const label = z.object({ it: publicText.min(1), en: publicText.min(1) });
export const vocabularySchema = z
  .object({
    version: z.literal(1),
    approved: reviewSchema,
    eras: z.array(
      z
        .object({
          id: identifier,
          label,
          start: z.number().int().optional(),
          end: z.number().int().optional(),
          outsideTime: z.boolean().optional(),
        })
        .refine(
          (era) =>
            era.outsideTime ||
            (era.start !== undefined &&
              era.end !== undefined &&
              era.start <= era.end),
          "An era needs an ordered range or outsideTime",
        ),
    ),
    places: z.array(z.object({ id: identifier, label })),
    themes: z.array(z.object({ id: identifier, label })),
  })
  .superRefine((v, ctx) => {
    for (const key of ["eras", "places", "themes"] as const) {
      const ids = v[key].map((entry) => entry.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: `Duplicate ${key} id` });
    }
  });
export type Vocabulary = z.infer<typeof vocabularySchema>;
export type Facet = "eras" | "places" | "themes";
export const facets: Facet[] = ["eras", "places", "themes"];

const assignment = interpretation(z.array(identifier).min(1));
export const classificationFileSchema = z.object({
  version: z.literal(1),
  items: z.record(
    identifier,
    z.object({
      eras: assignment.optional(),
      places: assignment.optional(),
      themes: assignment.optional(),
    }),
  ),
});
export type ClassificationFile = z.infer<typeof classificationFileSchema>;

/** Rejects an assignment to a value the approved vocabulary does not have. */
export function checkClassification(
  vocabulary: Vocabulary,
  file: ClassificationFile,
) {
  for (const [item, entry] of Object.entries(file.items))
    for (const facet of facets) {
      const value = entry[facet]?.value;
      if (!value || value === "unknown") continue;
      const known = new Set(vocabulary[facet].map((v) => v.id));
      for (const id of value)
        if (!known.has(id))
          throw new Error(`Unknown ${facet} value for ${item}: ${id}`);
    }
  return file;
}
