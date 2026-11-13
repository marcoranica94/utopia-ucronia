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
    gaps: z.number().int().nonnegative(),
  }),
});
export const collections = { works };
