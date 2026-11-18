import { contentPath } from "./content-path.ts";
import type { ClassifiedItem } from "./facet-index.ts";

/**
 * The era timeline at /tree/ (S5, owner choice of 18/11/2026): a trunk of
 * the vocabulary's eras in order, each published work branching off the
 * eras it is assigned to. Works carry no verified point of divergence, so
 * inside an era they are ordered by the first year cited at the opening of
 * the text, as recorded in the era assignment's reason, and that year is
 * labelled for what it is.
 */

export interface TimelineWork {
  title: string;
  path: string;
  authors: string[];
  language: string;
  /** First year cited at the opening (negative = BC), if recorded. */
  year?: number;
  approved: boolean;
}
export interface TimelineEra {
  id: string;
  label: { it: string; en: string };
  start?: number;
  end?: number;
  works: TimelineWork[];
}
export interface EraTimeline {
  eras: TimelineEra[];
  outsideTime: TimelineEra;
  unplaced: TimelineWork[];
}

const yearPattern = /First year (?:cited )?in the opening \((\d+)( BC)?\)/;
export const openingYear = (reason: string): number | undefined => {
  const match = yearPattern.exec(reason);
  if (!match) return undefined;
  const year = Number(match[1]);
  return match[2] ? -year : year;
};

export interface VocabularyEra {
  id: string;
  label: { it: string; en: string };
  start?: number;
  end?: number;
}

export function buildEraTimeline(
  items: ClassifiedItem[],
  vocabularyEras: VocabularyEra[],
): EraTimeline {
  const byId = new Map<string, TimelineEra>(
    vocabularyEras.map((era) => [
      era.id,
      {
        id: era.id,
        label: era.label,
        start: era.start,
        end: era.end,
        works: [],
      },
    ]),
  );
  const unplaced: TimelineWork[] = [];
  for (const item of items) {
    const assignment = item.data.classification?.eras;
    if (!item.data.editorialId || item.data.level !== "work") continue;
    const work = {
      title: item.data.title,
      path: contentPath(item),
      authors: item.data.authors,
      language: item.data.language,
    };
    if (
      !assignment ||
      assignment.value === "unknown" ||
      assignment.review.state === "deferred"
    ) {
      unplaced.push({ ...work, approved: false });
      continue;
    }
    const year = openingYear(assignment.review.reason);
    for (const id of assignment.value) {
      const era = byId.get(id);
      if (!era) throw new Error(`Unknown era: ${id}`);
      era.works.push({
        ...work,
        year,
        approved: assignment.review.state === "approved",
      });
    }
  }
  const byTitle = (a: TimelineWork, b: TimelineWork) =>
    a.title.localeCompare(b.title, "it");
  const byYear = (a: TimelineWork, b: TimelineWork) =>
    a.year === undefined || b.year === undefined
      ? (a.year === undefined ? 1 : 0) - (b.year === undefined ? 1 : 0) ||
        byTitle(a, b)
      : a.year - b.year || byTitle(a, b);
  for (const era of byId.values()) era.works.sort(byYear);
  unplaced.sort(byTitle);
  const outsideTime = byId.get("outside-time");
  if (!outsideTime) throw new Error("Missing outside-time era");
  return {
    eras: [...byId.values()].filter((era) => era.id !== "outside-time"),
    outsideTime,
    unplaced,
  };
}

/** "1804" / "44 a.C." / "44 BC". */
export const yearLabel = (year: number, lang: "it" | "en") =>
  year < 0 ? `${-year} ${lang === "it" ? "a.C." : "BC"}` : String(year);
