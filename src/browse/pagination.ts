export type BrowseKind = "prompts" | "works";
export const pageSize = 40;
export const pageSizes = [20, 40, 80, 100] as const;
export const browseRoot = (kind: BrowseKind) =>
  kind === "prompts" ? "/divergences/" : "/works/";
export function periodPath(
  kind: BrowseKind,
  group: string,
  page = 1,
  size = pageSize,
) {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !pageSizes.some((value) => value === size)
  )
    throw new Error("Invalid browse pagination");
  return `${browseRoot(kind)}period/${group}/${size !== pageSize ? `size/${size}/` : ""}${page > 1 ? `${page}/` : ""}`;
}
/** Keep the current first entry in view when changing the number of rows. */
export function pageForSize(
  page: number,
  size: number,
  nextSize: number,
  total: number,
) {
  return Math.min(
    Math.floor(((page - 1) * size) / nextSize) + 1,
    Math.max(1, Math.ceil(total / nextSize)),
  );
}
