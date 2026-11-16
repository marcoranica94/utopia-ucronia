import { z } from "zod";
import {
  classificationSchema,
  contributionSchema,
  identifier,
  languageSchema,
  publicText,
  reviewSchema,
} from "./model.ts";

export const outlineSchema = z.object({
  id: z.string(),
  label: publicText,
  kind: z.enum(["section", "pod", "entry", "contribution", "piece"]),
  depth: z.number().int().min(0).max(8),
  start: z.number().int().optional(),
  end: z.number().int().optional(),
  author: publicText.optional(),
  contribution: z.enum(["comment", "addition", "variant", "reply"]).optional(),
  replyTo: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});
export const workContentSchema = z.object({
  title: publicText.min(1),
  authors: z.array(publicText),
  authorIds: z.array(identifier).optional(),
  language: languageSchema,
  level: z.enum(["work", "divergence", "world"]),
  editorialId: identifier.optional(),
  review: reviewSchema.optional(),
  classification: classificationSchema.optional(),
  divergences: z.array(z.number().int()),
  sources: z
    .array(
      z.object({
        url: z.url(),
        documentId: identifier.optional(),
        timestamp: z
          .string()
          .regex(/^\d{14}$/)
          .optional(),
      }),
    )
    .min(1),
  unverified: z.array(z.string()),
  shape: z
    .enum(["chronology", "discussion", "narrative", "collection"])
    .optional(),
  contributors: z.array(publicText).optional(),
  contributions: z.array(contributionSchema).optional(),
  outline: z.array(outlineSchema).optional(),
  summary: publicText.optional(),
  cover: z
    .string()
    .regex(/^\/(?:sample|design)\/[a-zA-Z0-9._/-]+$/)
    .optional(),
  gaps: z.number().int().nonnegative(),
});
