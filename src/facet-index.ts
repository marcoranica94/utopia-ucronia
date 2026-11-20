import vocabularyData from "../data/vocabulary.json";
import { contentPath } from "./content-path.ts";
import {
  type Facet,
  type Vocabulary,
  vocabularySchema,
} from "./editorial/vocabulary.ts";

export const vocabulary: Vocabulary = vocabularySchema.parse(vocabularyData);
export const facetRoots: Record<Facet, string> = {
  eras: "/eras/",
  places: "/places/",
  themes: "/themes/",
};
export const facetPath = (facet: Facet, id: string) =>
  `${facetRoots[facet]}${id}/`;

type Review = {
  by: "agent" | "owner";
  state: "proposed" | "approved" | "deferred";
  reason: string;
  quote: string;
};
export interface ClassifiedItem {
  id: string;
  data: {
    title: string;
    level: "work" | "divergence" | "world";
    editorialId?: string;
    authors: string[];
    language: string;
    classification?: Partial<
      Record<Facet, { value: string[] | "unknown"; review: Review }>
    >;
  };
}
export interface FacetEntry {
  id: string;
  /** What the item is, shown as a tag next to its title. */
  type: "work" | "divergence";
  title: string;
  path: string;
  authors: string[];
  language: string;
  reason: string;
}
export interface FacetValue {
  id: string;
  label: { it: string; en: string };
  start?: number;
  end?: number;
  outsideTime?: boolean;
  approved: FacetEntry[];
  proposed: FacetEntry[];
}

/** Every vocabulary value with the published items assigned to it, approved
 * assignments apart from agent proposals (deferred ones are left out). */
export function buildFacetIndex(
  items: ClassifiedItem[],
  facet: Facet,
): FacetValue[] {
  const values: FacetValue[] = vocabulary[facet].map((v) => ({
    ...v,
    approved: [],
    proposed: [],
  }));
  const byId = new Map(values.map((v) => [v.id, v]));
  for (const item of items) {
    const assignment = item.data.classification?.[facet];
    if (!item.data.editorialId || !assignment) continue;
    if (
      assignment.value === "unknown" ||
      assignment.review.state === "deferred"
    )
      continue;
    const entry: FacetEntry = {
      id: item.id,
      type: item.data.level === "divergence" ? "divergence" : "work",
      title: item.data.title,
      path: contentPath(item),
      authors: item.data.authors,
      language: item.data.language,
      reason: assignment.review.reason,
    };
    for (const id of assignment.value) {
      const value = byId.get(id);
      if (!value) throw new Error(`Unknown ${facet} value: ${id}`);
      (assignment.review.state === "approved"
        ? value.approved
        : value.proposed
      ).push(entry);
    }
  }
  const order = (a: FacetEntry, b: FacetEntry) =>
    a.title.localeCompare(b.title, "it");
  for (const value of values) {
    value.approved.sort(order);
    value.proposed.sort(order);
  }
  return values;
}

/** Year range as text: "753 a.C.–476" / "753 BC–476". */
export function rangeLabel(value: FacetValue, lang: "it" | "en") {
  if (value.outsideTime || value.start === undefined) return "";
  const year = (n: number) =>
    n < 0 ? `${-n} ${lang === "it" ? "a.C." : "BC"}` : String(n);
  if (value.start <= -100000) return `→ ${year(value.end ?? 0)}`;
  if ((value.end ?? 0) >= 9999) return `${year(value.start)} →`;
  return `${year(value.start)}–${year(value.end ?? value.start)}`;
}

/** One line of a facet page: an item, or a world or cycle with the items
 * of it assigned to this entry, in the world's order. */
export type FacetRow =
  | { kind: "item"; entry: FacetEntry }
  | {
      kind: "world";
      world: {
        id: string;
        title: string;
        form: "world" | "cycle";
        language: string;
        state: string;
      };
      total: number;
      /** `n`: the item's place in the world, counted from 1. */
      chapters: (FacetEntry & { n: number })[];
    };

export function facetRows(
  entries: FacetEntry[],
  worlds: {
    world: {
      id: string;
      title: string;
      form: "world" | "cycle";
      language: string;
      review: { state: string };
    };
    chapters: { id: string }[];
  }[],
): FacetRow[] {
  const worldOf = new Map<string, (typeof worlds)[number]>();
  for (const w of worlds) for (const c of w.chapters) worldOf.set(c.id, w);
  const rows: FacetRow[] = [];
  const grouped = new Map<string, Extract<FacetRow, { kind: "world" }>>();
  for (const entry of entries) {
    const w = worldOf.get(entry.id);
    if (!w) {
      rows.push({ kind: "item", entry });
      continue;
    }
    let row = grouped.get(w.world.id);
    if (!row) {
      row = {
        kind: "world",
        world: {
          id: w.world.id,
          title: w.world.title,
          form: w.world.form,
          language: w.world.language,
          state: w.world.review.state,
        },
        total: w.chapters.length,
        chapters: [],
      };
      grouped.set(w.world.id, row);
      rows.push(row);
    }
    row.chapters.push({
      ...entry,
      n: w.chapters.findIndex((c) => c.id === entry.id) + 1,
    });
  }
  for (const row of grouped.values()) row.chapters.sort((a, b) => a.n - b.n);
  const title = (r: FacetRow) =>
    r.kind === "item" ? r.entry.title : r.world.title;
  return rows.sort((a, b) => title(a).localeCompare(title(b), "it"));
}
