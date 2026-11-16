/** Public paths follow editorial level, independent of the content collection's legacy name. */
export const contentPath = (work: {
  id: string;
  data: { level: "work" | "divergence" | "world" };
}) =>
  `/${work.data.level === "divergence" ? "divergences" : work.data.level === "world" ? "worlds" : "works"}/${work.id}/`;
