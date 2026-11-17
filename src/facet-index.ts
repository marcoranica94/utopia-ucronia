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
