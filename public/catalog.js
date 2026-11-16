// All controls enhance the complete, server-rendered collection.
(() => {
  const search = document.querySelector("#catalog-search");
  const language = document.querySelector("#catalog-language");
  const count = document.querySelector("#catalog-count");
  const empty = document.querySelector("#catalog-empty");
  const catalog = document.querySelector("[data-catalog]");
  if (!search || !language || !count || !catalog) return;
  const items = [...catalog.querySelectorAll("[data-work]")];
  const formats = [...document.querySelectorAll("button[data-format]")];
  const views = [...document.querySelectorAll("button[data-view]")];
  const fold = (value) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  let format = "all";
  let view = "covers";
  const update = (saveUrl) => {
    const query = fold(search.value.trim());
    let shown = 0;
    for (const item of items) {
      const matches =
        fold(item.dataset.title ?? "").includes(query) &&
        (!language.value || item.dataset.language === language.value) &&
        (format === "all" || item.dataset.format === format);
      item.hidden = !matches;
      if (matches) shown++;
    }
    count.textContent = `${shown} ${shown === 1 ? count.dataset.one : count.dataset.many}`;
    if (empty) empty.hidden = shown > 0;
    for (const button of formats)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.format === format),
      );
    for (const button of views)
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    catalog.dataset.view = view;
    if (saveUrl) {
      const url = new URL(location.href);
      for (const [name, value] of [
        ["q", search.value.trim()],
        ["lang", language.value],
        ["format", format === "all" ? "" : format],
        ["view", view === "covers" ? "" : view],
      ]) {
        if (value) url.searchParams.set(name, value);
        else url.searchParams.delete(name);
      }
      history.replaceState(null, "", url);
    }
  };
  const restore = () => {
    const url = new URL(location.href);
    search.value = url.searchParams.get("q") ?? "";
    const requestedLanguage = url.searchParams.get("lang") ?? "";
    language.value = [...language.options].some(
      (o) => o.value === requestedLanguage,
    )
      ? requestedLanguage
      : "";
    const requestedFormat = url.searchParams.get("format");
    format = formats.some((b) => b.dataset.format === requestedFormat)
      ? requestedFormat
      : "all";
    view = url.searchParams.get("view") === "list" ? "list" : "covers";
    update(false);
  };
  for (const controls of document.querySelectorAll("[data-catalog-tools]"))
    controls.hidden = false;
  search.addEventListener("input", () => update(true));
  language.addEventListener("change", () => update(true));
  for (const button of formats)
    button.addEventListener("click", () => {
      format = button.dataset.format;
      update(true);
    });
  for (const button of views)
    button.addEventListener("click", () => {
      view = button.dataset.view;
      update(true);
    });
  document
    .querySelector("[data-reset-filters]")
    ?.addEventListener("click", () => {
      search.value = "";
      language.value = "";
      format = "all";
      update(true);
      search.focus();
    });
  document
    .querySelector(".atlas-filters")
    ?.addEventListener("submit", (event) => event.preventDefault());
  window.addEventListener("popstate", restore);
  const topLink = document.querySelector("[data-catalog-top]");
  let pending = false;
  const position = () => {
    if (topLink) topLink.hidden = window.scrollY < 700;
    pending = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(position);
      }
    },
    { passive: true },
  );
  position();
  restore();
})();
