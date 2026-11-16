// Catalog filters are external so the production CSP can keep inline scripts disabled.
const search = document.querySelector("#catalog-search");
const language = document.querySelector("#catalog-language");
const count = document.querySelector("#catalog-count");
const empty = document.querySelector("#catalog-empty");
const items = [...document.querySelectorAll("[data-work]")];
if (search && language && count) {
  const url = new URL(location.href);
  search.value = url.searchParams.get("q") ?? "";
  language.value = url.searchParams.get("lang") ?? "";
  const fold = (value) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  const update = (saveUrl) => {
    const query = fold(search.value.trim());
    let shown = 0;
    for (const item of items) {
      const match =
        fold(item.dataset.title ?? "").includes(query) &&
        (!language.value || item.dataset.language === language.value);
      item.hidden = !match;
      if (match) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? count.dataset.one : count.dataset.many}`;
    if (empty) empty.hidden = shown > 0;
    if (saveUrl) {
      if (search.value.trim()) url.searchParams.set("q", search.value.trim());
      else url.searchParams.delete("q");
      if (language.value) url.searchParams.set("lang", language.value);
      else url.searchParams.delete("lang");
      history.replaceState(null, "", url);
    }
  };
  search.addEventListener("input", () => update(true));
  language.addEventListener("change", () => update(true));
  document
    .querySelector(".catalog-filters")
    ?.addEventListener("submit", (event) => event.preventDefault());
  update(false);
}
