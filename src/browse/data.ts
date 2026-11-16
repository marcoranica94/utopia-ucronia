import raw from "../generated/browse.json";
import { type BrowseEntry, type BrowsePrompt, browseSchema } from "./model";

export const browse = browseSchema.parse(raw);
export const targets = new Map(
  browse.targets.map((target) => [target.id, target]),
);
export type BrowseKind = "prompts" | "works";
export const browseRoot = (kind: BrowseKind) =>
  kind === "prompts" ? "/divergences/" : "/works/";
export const periodPath = (kind: BrowseKind, group: string, page = 1) =>
  `${browseRoot(kind)}period/${group}/${page > 1 ? `${page}/` : ""}`;
export const groupsFor = (kind: BrowseKind) =>
  kind === "prompts" ? browse.promptGroups : browse.workGroups;
export const entriesFor = (kind: BrowseKind) =>
  kind === "prompts" ? browse.prompts : browse.entries;
export const pageSize = 40;
export function periodPages(kind: BrowseKind) {
  return groupsFor(kind).flatMap((group) => {
    const entries: (BrowsePrompt | BrowseEntry)[] = entriesFor(kind).filter(
      (entry) => entry.group === group.id,
    );
    const pages = Math.max(1, Math.ceil(entries.length / pageSize));
    return Array.from({ length: pages }, (_, index) => ({
      params: { period: group.id, page: index ? String(index + 1) : undefined },
      props: {
        kind,
        group,
        entries: entries.slice(index * pageSize, (index + 1) * pageSize),
        page: index + 1,
        pages,
      },
    }));
  });
}
export const promptLocations = new Map(
  browse.promptGroups.flatMap((group) =>
    browse.prompts
      .filter((p) => p.group === group.id)
      .map(
        (prompt, index) =>
          [
            prompt.id,
            `${periodPath("prompts", group.id, Math.floor(index / pageSize) + 1)}#${prompt.id}`,
          ] as const,
      ),
  ),
);
