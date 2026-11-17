/** Public paths follow editorial level, independent of the content collection's legacy name. */
export const contentPath = (work: {
  id: string;
  data: { level: "work" | "divergence" | "world" };
}) =>
  `/${work.data.level === "divergence" ? "divergences" : work.data.level === "world" ? "worlds" : "works"}/${work.id}/`;

/**
 * View Transition name shared by a catalog card title and the reading title,
 * so cross-document navigation can morph one into the other.
 */
export const transitionName = (id: string) =>
  `work-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
