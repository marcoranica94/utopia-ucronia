import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    language: z.enum(["it", "fr", "es"]),
    level: z.literal("work"),
    divergences: z.array(z.number().int()),
    sources: z.array(
      z.object({
        url: z.url(),
        timestamp: z
          .string()
          .regex(/^\d{14}$/)
          .optional(),
      }),
    ),
    unverified: z.array(z.string()),
    // Structure read by scripts/anatomy.ts; absent on unstructured pages.
    shape: z
      .enum(["chronology", "discussion", "narrative", "collection"])
      .optional(),
    contributors: z.array(z.string()).optional(),
    outline: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          kind: z.enum(["section", "pod", "entry", "contribution", "piece"]),
          depth: z.number().int().min(0).max(4),
          start: z.number().int().optional(),
          end: z.number().int().optional(),
          author: z.string().optional(),
          contribution: z
            .enum(["comment", "addition", "variant", "reply"])
            .optional(),
          replyTo: z.string().optional(),
          size: z.number().int().nonnegative().optional(),
        }),
      )
      .optional(),
    gaps: z.number().int().nonnegative(),
  }),
});
export const collections = { works };
