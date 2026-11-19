// Home catalog: the page carries a few featured cards; this script fetches the
// complete list, shows a random handful, and filters it only on request.
(() => {
  const search = document.querySelector("#catalog-search");
  const language = document.querySelector("#catalog-language");
  const count = document.querySelector("#catalog-count");
  const empty = document.querySelector("#catalog-empty");
  const catalog = document.querySelector("[data-catalog]");
  if (!search || !language || !count || !catalog) return;
  const labels = JSON.parse(catalog.dataset.labels ?? "{}");
  const formats = [...document.querySelectorAll("button[data-format]")];
  const views = [...document.querySelectorAll("button[data-view]")];
  const shuffle = document.querySelector("[data-shuffle]");
  const more = document.querySelector("[data-more]");
  const RANDOM = 6;
  const STEP = 24;
  const SVG = "http://www.w3.org/2000/svg";
  const fold = (value) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase();
  let cards = [];
  let format = "all";
  let view = "covers";
  let limit = STEP;
  let pick = [];

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
      if (v !== undefined) node.setAttribute(k, v);
    node.append(...children);
    return node;
  };
  const svg = (viewBox, paths) => {
    const node = document.createElementNS(SVG, "svg");
    node.setAttribute("viewBox", viewBox);
    node.setAttribute("fill", "none");
    node.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of paths) {
      const child = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) child.setAttribute(k, v);
      node.append(child);
    }
    return node;
  };
  const cover = (card) => {
    const box = el("div", {
      class: `work-cover cover-${card.m}${card.c ? "" : " cover-type"}`,
      "aria-hidden": "true",
    });
    if (card.c)
      box.append(
        el("img", { src: card.c, alt: "", loading: "lazy", decoding: "async" }),
      );
    else {
      const lines = svg("0 0 400 200", [
        [
          "path",
          {
            d: "M-30 190H100Q160 190 160 130V-20M-30 190H100Q220 190 220 110V-20M-30 190H100Q290 190 290 70V-20M-30 190H100Q350 190 350 20V-20",
            stroke: "currentColor",
            "stroke-width": "1.5",
          },
        ],
        ["circle", { cx: "160", cy: "74", r: "5", fill: "currentColor" }],
        ["circle", { cx: "290", cy: "54", r: "5", fill: "currentColor" }],
      ]);
      lines.setAttribute("class", "cover-lines");
      box.append(lines, el("span", {}, card.w));
    }
    return box;
  };
  const render = (card) =>
    el(
      "li",
      { "data-work": "" },
      el(
        "a",
        { class: "work-card", href: card.href },
        cover(card),
        el(
          "div",
          { class: "work-info" },
          el(
            "div",
            { class: "work-card-meta" },
            el("span", {}, labels.formats?.[card.f] ?? ""),
            el("span", {}, labels.languages?.[card.l] ?? ""),
          ),
          el(
            "h3",
            {
              style: `view-transition-name:work-${(card.href.split("/").at(-2) ?? "").replace(/[^a-zA-Z0-9_-]/g, "-")};view-transition-class:work-title`,
              lang: card.l === "unknown" ? "" : card.l,
            },
            card.title,
          ),
          el("p", { class: "work-description", lang: card.sl }, card.s),
          el(
            "div",
            { class: "work-card-foot" },
            el("span", {}, card.b),
            el(
              "span",
              { class: "work-read" },
              card.r,
              svg("0 0 20 20", [
                [
                  "path",
                  {
                    d: "M4 10h12m-5-5 5 5-5 5",
                    stroke: "currentColor",
                    "stroke-width": "1.5",
                  },
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  const randomPick = () => {
    const pool = [...cards];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, RANDOM);
  };
  const filtering = () =>
    Boolean(search.value.trim() || language.value || format !== "all");
  const update = (saveUrl) => {
    for (const button of formats)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.format === format),
      );
    for (const button of views)
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    catalog.dataset.view = view;
    if (cards.length) {
      let shown;
      if (filtering()) {
        const query = fold(search.value.trim());
        const matches = cards.filter(
          (card) =>
            card.q.includes(query) &&
            (!language.value || card.l === language.value) &&
            (format === "all" || card.f === format),
        );
        shown = matches.slice(0, limit);
        count.textContent =
          matches.length === 1
            ? labels.one
            : (labels.found ?? "").replace("{n}", matches.length);
        if (more) more.hidden = matches.length <= shown.length;
        if (shuffle) shuffle.hidden = true;
        if (empty) empty.hidden = matches.length > 0;
      } else {
        shown = pick;
        count.textContent = (labels.random ?? "")
          .replace("{n}", shown.length)
          .replace("{total}", cards.length);
        if (more) more.hidden = true;
        if (shuffle) shuffle.hidden = false;
        if (empty) empty.hidden = true;
      }
      catalog.replaceChildren(...shown.map(render));
    }
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
  const changed = () => {
    limit = STEP;
    update(true);
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
    limit = STEP;
    update(false);
  };
  search.addEventListener("input", changed);
  language.addEventListener("change", changed);
  for (const button of formats)
    button.addEventListener("click", () => {
      format = button.dataset.format;
      changed();
    });
  for (const button of views)
    button.addEventListener("click", () => {
      view = button.dataset.view;
      update(true);
    });
  shuffle?.addEventListener("click", () => {
    pick = randomPick();
    update(false);
  });
  more?.addEventListener("click", () => {
    limit += STEP;
    update(false);
  });
  document
    .querySelector("[data-reset-filters]")
    ?.addEventListener("click", () => {
      search.value = "";
      language.value = "";
      format = "all";
      changed();
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
  // Without the list the featured cards stay, and the filters stay hidden.
  fetch(catalog.dataset.source)
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((list) => {
      cards = list.map((card) => ({
        ...card,
        q: fold(`${card.title} ${card.b} ${card.s}`),
      }));
      pick = randomPick();
      for (const controls of document.querySelectorAll("[data-catalog-tools]"))
        controls.hidden = false;
      restore();
    })
    .catch(() => {});
})();
