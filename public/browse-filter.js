// Shared by the browser and fixture tests. Filters always precede pagination.
export const normalizeSearch = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export function filterEntries(entries, state) {
  const words = normalizeSearch(state.q ?? "")
    .split(" ")
    .filter(Boolean);
  return entries.filter(
    (entry) =>
      words.every((word) => entry.search.includes(word)) &&
      (!state.author || entry.authors.includes(state.author)) &&
      (!state.availability || entry.statuses.includes(state.availability)) &&
      (!state.development ||
        (state.development === "documented"
          ? entry.development
          : state.development === "related"
            ? entry.related && !entry.development
            : !entry.related)),
  );
}
export function paginateEntries(entries, requestedPage, size) {
  const total = entries.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.max(
    1,
    Math.min(pages, Number.isInteger(requestedPage) ? requestedPage : 1),
  );
  const start = total ? (page - 1) * size + 1 : 0;
  return {
    entries: entries.slice((page - 1) * size, page * size),
    total,
    pages,
    page,
    start,
    end: Math.min(page * size, total),
  };
}
