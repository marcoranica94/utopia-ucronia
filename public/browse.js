import { filterEntries, paginateEntries } from "./browse-filter.js";

const root = document.querySelector(".browse-period-page");
if (root) {
  const labels = JSON.parse(root.dataset.browseLabels);
  const filters = root.querySelector("[data-browse-filters]");
  const status = root.querySelector("[data-browse-status]");
  const dialog = root.querySelector("dialog");
  let opener, payload, pending, timer;
  const state = {
    q: "",
    author: "",
    availability: "",
    development: "",
    page: Number(root.dataset.browsePage),
    size: Number(root.dataset.browseSize),
  };
  const text = (key, values = {}) =>
    Object.entries(values).reduce(
      (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
      labels[key],
    );
  const pageFrom = (target) =>
    Number(
      target.searchParams.get("page") ??
        target.pathname
          .replace(/\/size\/\d+\//, "/")
          .match(/\/(\d+)\/$/)?.[1] ??
        1,
    );
  const active = () =>
    Boolean(state.q || state.author || state.availability || state.development);
  const path = (page = 1, size = state.size) =>
    `${root.dataset.browseBase}${size === 40 ? "" : `size/${size}/`}${page === 1 ? "" : `${page}/`}`;
  const url = (page = state.page, size = state.size) => {
    const result = new URL(path(active() ? 1 : page, size), location.origin);
    for (const key of ["q", "author", "availability", "development"])
      if (state[key]) result.searchParams.set(key, state[key]);
    if (active() && page > 1) result.searchParams.set("page", page);
    return result.pathname + result.search;
  };
  const syncLanguage = () => {
    for (const a of document.querySelectorAll(".lang-switch a"))
      a.href = `${a.lang === "en" ? "/en" : ""}${location.pathname.replace(/^\/en(?=\/)/, "")}${location.search}`;
  };
  async function load() {
    if (payload) return payload;
    if (!pending)
      pending = fetch(root.dataset.browsePayload)
        .then((response) => {
          if (!response.ok) throw Error("Payload unavailable");
          return response.json();
        })
        .then((data) => {
          if (
            data.version !== 1 ||
            !Array.isArray(data.entries) ||
            data.total !== data.entries.length
          )
            throw Error("Invalid payload");
          payload = data;
          const select = filters.querySelector('[name="author"]');
          for (const author of [
            ...new Set(data.entries.flatMap((entry) => entry.authors)),
          ].sort((a, b) => a.localeCompare(b)))
            select.add(new Option(author, author));
          select.value = state.author;
          return data;
        })
        .catch((error) => {
          pending = undefined;
          throw error;
        });
    return pending;
  }
  let observer;
  function observeTitles() {
    observer?.disconnect();
    const links = [...root.querySelectorAll("[data-browse-title]")];
    const mark = (id) => {
      for (const link of links)
        if (link.dataset.browseTitle === id)
          link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
    };
    const rows = [...root.querySelectorAll(".browse-entry")];
    if (rows[0]) mark(rows[0].id);
    if (!("IntersectionObserver" in window)) return;
    const visible = new Set();
    observer = new IntersectionObserver(
      (changes) => {
        for (const change of changes)
          if (change.isIntersecting) visible.add(change.target);
          else visible.delete(change.target);
        const first = [...visible].sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        )[0];
        if (first) mark(first.id);
      },
      { rootMargin: "-8% 0px -65% 0px" },
    );
    for (const row of rows) observer.observe(row);
  }
  function proposals() {
    for (const copy of root.querySelectorAll(".browse-prompt-copy")) {
      const details = copy.querySelector("details"),
        excerpt = copy.querySelector(".browse-excerpt"),
        full = details.querySelector("p");
      const probe = full.cloneNode(true);
      probe.className = "browse-excerpt";
      probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${excerpt.getBoundingClientRect().width}px;max-width:none;display:block;margin:0;white-space:pre-line;-webkit-line-clamp:unset`;
      copy.append(probe);
      const long =
        probe.getBoundingClientRect().height >
        parseFloat(getComputedStyle(probe).lineHeight) * 6 + 1;
      probe.remove();
      details.hidden = !long;
      if (!long) excerpt.textContent = full.textContent;
      details.querySelector("summary").setAttribute("aria-haspopup", "dialog");
      details.querySelector(".prompt-open-label").textContent = labels.popup;
    }
  }
  root.addEventListener("click", (event) => {
    const summary = event.target.closest(".browse-prompt-text summary");
    if (summary) {
      event.preventDefault();
      opener = summary;
      dialog.querySelector("h2").textContent = summary
        .closest("tr")
        .querySelector("h2").textContent;
      dialog.querySelector(".browse-dialog-body").textContent =
        summary.parentElement.querySelector("p").textContent;
      dialog.showModal();
    }
    if (event.target.closest("[data-dialog-close]")) dialog.close();
    if (event.target.closest("[data-browse-title]"))
      root.querySelector(".browse-mobile-titles").open = false;
  });
  // The reading dialog contains one interactive control. Keep keyboard focus there.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      dialog.querySelector("[data-dialog-close]").focus();
    }
  });
  dialog.addEventListener("close", () => opener?.focus());
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  function pager(result) {
    for (const box of root.querySelectorAll("[data-pagination]")) {
      box.querySelector("strong").textContent = text("pageOf", result);
      box.querySelector(".browse-page-summary span").textContent = text(
        "range",
        result,
      );
      const nav = box.querySelector("nav");
      nav.replaceChildren();
      const link = (n, label, current = false) => {
        const a = document.createElement("a");
        a.href = url(n);
        a.dataset.browsePage = String(n);
        a.textContent = label;
        if (current) a.setAttribute("aria-current", "page");
        return a;
      };
      if (result.page > 1) nav.append(link(result.page - 1, labels.previous));
      const list = document.createElement("ol");
      let previous = 0;
      for (let n = 1; n <= result.pages; n++)
        if (n === 1 || n === result.pages || Math.abs(n - result.page) <= 1) {
          if (previous && n > previous + 1) {
            const gap = document.createElement("li");
            gap.textContent = "…";
            list.append(gap);
          }
          const li = document.createElement("li");
          li.append(link(n, String(n), n === result.page));
          list.append(li);
          previous = n;
        }
      nav.append(list);
      if (result.page < result.pages)
        nav.append(link(result.page + 1, labels.next));
    }
    const pageSelect = root.querySelector("#browse-bottom-page");
    pageSelect.replaceChildren();
    for (let n = 1; n <= result.pages; n++)
      pageSelect.add(
        new Option(
          text("pageOf", { page: n, pages: result.pages }),
          url(n),
          false,
          n === result.page,
        ),
      );
    for (const option of root.querySelectorAll("#browse-bottom-size option")) {
      const size = Number(option.textContent);
      option.value = url(
        Math.floor(((result.page - 1) * state.size) / size) + 1,
        size,
      );
      option.selected = size === state.size;
    }
  }
  let revision = 0;
  async function render(historyMode = "push") {
    const current = ++revision;
    status.textContent = labels.loading;
    root.querySelector(".browse-results").setAttribute("aria-busy", "true");
    try {
      const data = await load();
      if (current !== revision) return;
      const result = paginateEntries(
        filterEntries(data.entries, state),
        state.page,
        state.size,
      );
      state.page = result.page;
      const temporary = document.createElement("tbody");
      temporary.innerHTML = result.entries.map((entry) => entry.html).join("");
      root.querySelector("tbody").replaceChildren(...temporary.children);
      root.querySelectorAll(".browse-row-number").forEach((el, index) => {
        el.textContent = result.start + index;
      });
      for (const nav of root.querySelectorAll(".browse-title-links")) {
        const ol = document.createElement("ol");
        ol.start = result.start;
        result.entries.forEach((entry, index) => {
          const li = document.createElement("li"),
            a = document.createElement("a"),
            number = document.createElement("span"),
            title = document.createElement("span");
          a.href = `#${entry.id}`;
          a.dataset.browseTitle = entry.id;
          number.className = "browse-title-number";
          number.textContent = result.start + index;
          title.textContent = entry.title;
          a.append(number, title);
          li.append(a);
          ol.append(li);
        });
        nav.replaceChildren(ol);
      }
      root.querySelector(".browse-index-heading span").textContent =
        result.entries.length;
      root.querySelector(".browse-mobile-titles summary").textContent =
        `${labels.onThisPage} · ${result.entries.length}`;
      root.querySelector("[data-browse-empty]").hidden = result.total > 0;
      root.querySelector("table").hidden = !result.total;
      observeTitles();
      pager(result);
      proposals();
      root.querySelector("table caption").textContent = text("range", result);
      status.textContent = text("range", result);
      if (historyMode !== "none")
        history[historyMode === "replace" ? "replaceState" : "pushState"](
          null,
          "",
          url(),
        );
      syncLanguage();
    } catch {
      if (current === revision) status.textContent = labels.filterError;
    } finally {
      if (current === revision)
        root.querySelector(".browse-results").removeAttribute("aria-busy");
    }
  }
  filters.hidden = false;
  for (const controls of root.querySelectorAll("[data-browse-controls]"))
    controls.hidden = false;
  filters.addEventListener(
    "focusin",
    () => {
      load().catch(() => {
        status.textContent = labels.filterError;
      });
    },
    { once: true },
  );
  filters.addEventListener("input", (event) => {
    if (!event.target.name) return;
    state[event.target.name] = event.target.value;
    state.page = 1;
    clearTimeout(timer);
    timer = setTimeout(() => render(), event.target.name === "q" ? 220 : 0);
  });
  root.querySelector("[data-browse-reset]").addEventListener("click", () => {
    for (const input of filters.querySelectorAll("input,select"))
      input.value = "";
    Object.assign(state, {
      q: "",
      author: "",
      availability: "",
      development: "",
      page: 1,
    });
    render();
  });
  root.addEventListener("click", (event) => {
    const a = event.target.closest("a[data-browse-page]");
    if (a && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      state.page = Number(a.dataset.browsePage);
      render();
      filters.scrollIntoView({ block: "start" });
    }
    const button = event.target.closest("[data-browse-go]");
    if (!button) return;
    const select = button.parentElement.querySelector("select");
    if (!payload && !active()) {
      location.assign(select.value);
      return;
    }
    const target = new URL(select.value, location.href);
    const size = Number(target.pathname.match(/\/size\/(\d+)\//)?.[1] ?? 40);
    const oldPage = state.page;
    state.page = select.id.endsWith("size")
      ? Math.floor(((oldPage - 1) * state.size) / size) + 1
      : pageFrom(target);
    state.size = size;
    render();
  });
  function restore() {
    const params = new URLSearchParams(location.search);
    for (const key of ["q", "author", "availability", "development"]) {
      state[key] = params.get(key) ?? "";
      const input = filters.querySelector(`[name="${key}"]`);
      if (input) input.value = state[key];
    }
    state.size = Number(location.pathname.match(/\/size\/(\d+)\//)?.[1] ?? 40);
    state.page = pageFrom(new URL(location.href));
    render("none");
  }
  window.addEventListener("popstate", restore);
  if (location.search) restore();
  syncLanguage();
  observeTitles();
  proposals();
  document.fonts.ready.then(proposals);
  let resizing;
  window.addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(proposals, 120);
  });
}
