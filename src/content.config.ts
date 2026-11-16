import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { workContentSchema } from "./editorial/content";

const works = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/works" }),
  schema: workContentSchema,
});
export const collections = { works };
