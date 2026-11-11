import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const opere = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/opere" }),
  schema: z.object({
    titolo: z.string(),
    autori: z.array(z.string()),
    lingua: z.enum(["it", "fr", "es"]),
    livello: z.literal("opera"),
    divergenze: z.array(z.number().int()),
    origine: z.array(
      z.object({ url: z.url(), timestamp: z.string().regex(/^\d{14}$/) }),
    ),
    da_verificare: z.array(z.string()),
    lacune: z.number().int().nonnegative(),
  }),
});
export const collections = { opere };
