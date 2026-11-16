import raw from "../generated/browse.json";
import { type BrowseEntry, type BrowsePrompt, browseSchema } from "./model";
import { type BrowseKind, pageSize, pageSizes, periodPath } from "./pagination";

export const browse = browseSchema.parse(raw);
export const targets = new Map(
  browse.targets.map((target) => [target.id, target]),
);

export {
  type BrowseKind,
  browseRoot,
  pageSize,
  pageSizes,
  periodPath,
} from "./pagination";
export const groupsFor = (kind: BrowseKind) =>
  kind === "prompts" ? browse.promptGroups : browse.workGroups;
export const entriesFor = (kind: BrowseKind) =>
  kind === "prompts" ? browse.prompts : browse.entries;
export function periodPages(kind: BrowseKind) {
  return groupsFor(kind).flatMap((group) => {
    const entries: (BrowsePrompt | BrowseEntry)[] = entriesFor(kind).filter(
      (entry) => entry.group === group.id,
    );
    return pageSizes.flatMap((size) => {
      const pages = Math.max(1, Math.ceil(entries.length / size));
      return Array.from({ length: pages }, (_, index) => ({
        params: {
          period: group.id,
          page:
            size === pageSize
              ? index
                ? String(index + 1)
                : undefined
              : `size/${size}${index ? `/${index + 1}` : ""}`,
        },
        props: {
          kind,
          group,
          entries: entries.slice(index * size, (index + 1) * size),
          page: index + 1,
          pages,
          size,
        },
      }));
    });
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
