// The native details drawer and anchor links remain usable without JavaScript.
(() => {
  const navigation = document.querySelector(".reader-navigation");
  const drawer = document.querySelector("[data-reader-contents]");
  const panel = document.querySelector("#reader-drawer");
  const toggle = drawer?.querySelector("summary");
  const closeButton = document.querySelector("[data-reader-close]");
  const position = document.querySelector("[data-reader-position]");
  const shortPosition = document.querySelector("[data-reader-short]");
  const rail = document.querySelector(".reader-minimap");
  const stops = [...document.querySelectorAll("[data-reader-stop]")]
    .map((link) => ({
      link,
      target: document.getElementById(link.hash.slice(1)),
    }))
    .filter((stop) => stop.target)
    .sort((a, b) =>
      a.target.compareDocumentPosition(b.target) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    );
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const close = (restoreFocus = true) => {
    if (!drawer) return;
    drawer.open = false;
    document.body.classList.remove("reader-drawer-open");
    toggle?.setAttribute("aria-expanded", "false");
    if (restoreFocus) toggle?.focus({ preventScroll: true });
  };
  const reveal = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    for (let node = target; node; node = node.parentElement)
      if (node instanceof HTMLDetailsElement) node.open = true;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  };
  if (closeButton) {
    closeButton.hidden = false;
    closeButton.addEventListener("click", () => close());
  }
  if (panel) panel.setAttribute("role", "dialog");
  drawer?.addEventListener("toggle", () => {
    document.body.classList.toggle("reader-drawer-open", drawer.open);
    toggle?.setAttribute("aria-expanded", String(drawer.open));
    if (drawer.open) {
      panel?.setAttribute("aria-modal", "true");
      closeButton?.focus({ preventScroll: true });
    } else panel?.removeAttribute("aria-modal");
  });
  navigation?.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-reader-scrim]")) {
      close();
      return;
    }
    const link = event.target.closest("[data-reader-link]");
    if (!link) return;
    event.preventDefault();
    close(false);
    history.pushState(null, "", link.hash);
    requestAnimationFrame(() => reveal(decode(link.hash.slice(1))));
  });
  document.addEventListener("keydown", (event) => {
    if (!drawer?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab" && panel) {
      const focusable = [
        ...panel.querySelectorAll("a[href], button:not([disabled]), summary"),
      ].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  const revealHash = () => {
    if (location.hash) {
      close(false);
      reveal(decode(location.hash.slice(1)));
    }
  };
  window.addEventListener("hashchange", revealHash);
  if (location.hash) revealHash();
  let scheduled = false;
  let active;
  const update = () => {
    // Stops are in document order, so a binary search avoids scanning every
    // year of a long chronology on each animation frame.
    let low = 0;
    let high = stops.length - 1;
    let current;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (stops[middle].target.getBoundingClientRect().top <= 140) {
        current = stops[middle];
        low = middle + 1;
      } else high = middle - 1;
    }
    if (active !== current) {
      active?.link.removeAttribute("aria-current");
      active = current;
      active?.link.setAttribute("aria-current", "location");
      if (position)
        position.textContent = active?.link.getAttribute("aria-label") ?? "";
      if (shortPosition) {
        const year = active?.link.querySelector(".rail-stop-year")?.textContent;
        const era = active?.link.querySelector("small")?.textContent ?? "";
        shortPosition.textContent = year
          ? `${year} ${era}`.trim()
          : (active?.link.querySelector(".rail-stop-name")?.textContent ?? "");
      }
      if (rail && active && !rail.matches(":hover")) {
        const linkBox = active.link.getBoundingClientRect();
        const railBox = rail.getBoundingClientRect();
        if (linkBox.top < railBox.top || linkBox.bottom > railBox.bottom)
          rail.scrollTop += linkBox.top - railBox.top - railBox.height / 2;
      }
    }
    document
      .querySelector("[data-back-top]")
      ?.classList.toggle("is-visible", scrollY > 500);
    scheduled = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
})();
