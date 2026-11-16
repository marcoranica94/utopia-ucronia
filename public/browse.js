// Static pagination remains linkable; these controls navigate only on Apply/Go.
(() => {
  const root = document.querySelector(".browse-period-page");
  if (!root) return;
  for (const button of root.querySelectorAll("[data-browse-go]")) {
    button.addEventListener("click", () => {
      const select = button
        .closest(".browse-select-control")
        ?.querySelector("select");
      if (!select) return;
      const url = new URL(select.value, location.href);
      if (url.origin === location.origin) location.assign(url.href);
    });
  }
  for (const controls of root.querySelectorAll("[data-browse-controls]"))
    controls.hidden = false;
  const links = [...root.querySelectorAll("[data-browse-title]")];
  for (const link of links)
    link.addEventListener("click", () =>
      root.querySelector(".browse-mobile-titles")?.removeAttribute("open"),
    );
  const rows = [...root.querySelectorAll(".browse-entry")];
  const mark = (id) => {
    for (const link of links) {
      if (link.dataset.browseTitle === id)
        link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  };
  if (rows[0]) mark(rows[0].id);
  if ("IntersectionObserver" in window) {
    const visible = new Set();
    const observer = new IntersectionObserver(
      (changes) => {
        for (const change of changes) {
          if (change.isIntersecting) visible.add(change.target);
          else visible.delete(change.target);
        }
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
})();
