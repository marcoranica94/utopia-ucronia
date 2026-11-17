import worldsData from "../data/worlds.json";
import { contentPath } from "./content-path.ts";
import { type World, worldsFileSchema } from "./editorial/worlds.ts";

export const worlds: World[] = worldsFileSchema.parse(worldsData).worlds;
export const worldPath = (id: string) => `/worlds/${id}/`;

export interface WorldItem {
  id: string;
  data: {
    title: string;
    level: "work" | "divergence" | "world";
    editorialId?: string;
    authors: string[];
    language: string;
    sources: { documentId?: string }[];
  };
}
export interface WorldChapterEntry {
  id: string;
  title: string;
  path: string;
  authors: string[];
  language: string;
}
export interface WorldEntry {
  world: World;
  chapters: WorldChapterEntry[];
  authors: string[];
}

/**
 * Every world with its chapters resolved to published reading items, in the
 * source's order. `pnpm worlds check` guarantees each chapter is published;
 * a chapter missing here is a build error, not a silent gap.
 */
let memo: { items: WorldItem[]; entries: WorldEntry[] } | undefined;
export function buildWorlds(items: WorldItem[]): WorldEntry[] {
  if (memo?.items === items) return memo.entries;
  memo = { items, entries: resolve(items) };
  return memo.entries;
}
function resolve(items: WorldItem[]): WorldEntry[] {
  const byDocument = new Map<string, WorldItem[]>();
  for (const item of items) {
    // Canonical items only: legacy previews have no editorial id.
    if (!item.data.editorialId) continue;
    for (const source of item.data.sources)
      if (source.documentId) {
        const list = byDocument.get(source.documentId) ?? [];
        if (!list.includes(item)) list.push(item);
        byDocument.set(source.documentId, list);
      }
  }
  return worlds.map((world) => {
    const chapters: WorldChapterEntry[] = [];
    for (const chapter of world.chapters) {
      const found = byDocument.get(chapter.documentId);
      if (!found?.length)
        throw new Error(`World ${world.id}: unpublished ${chapter.path}`);
      for (const item of found)
        if (!chapters.some((c) => c.id === item.id))
          chapters.push({
            id: item.id,
            title: item.data.title,
            path: contentPath(item),
            authors: item.data.authors,
            language: item.data.language,
          });
    }
    const authors = [...new Set(chapters.flatMap((c) => c.authors))];
    return { world, chapters, authors };
  });
}

/** The world a reading item belongs to, with its neighbours. */
export function worldOf(entries: WorldEntry[], itemId: string) {
  for (const entry of entries) {
    const index = entry.chapters.findIndex((c) => c.id === itemId);
    if (index >= 0)
      return {
        entry,
        index,
        previous: entry.chapters[index - 1],
        next: entry.chapters[index + 1],
      };
  }
  return undefined;
}
