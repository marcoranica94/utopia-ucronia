import { getCollection } from "astro:content";
import { contentPath } from "./content-path";
import { opening, type WhatIfEntry } from "./whatif";

/** Every readable work, in collection order, for "What if…?". */
export async function whatIfEntries(): Promise<WhatIfEntry[]> {
  return (await getCollection("works"))
    .filter((work) => work.data.level === "work")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((work) => ({
      p: contentPath(work),
      t: work.data.title,
      a: work.data.authors.join(", "),
      ...(work.data.language !== "unknown" ? { l: work.data.language } : {}),
      o: opening(work.body ?? "", work.data.title),
    }));
}
