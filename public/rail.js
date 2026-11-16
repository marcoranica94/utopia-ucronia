// Reading position: highlights the current stop in every rail (drawn rail on
// wide screens, contents drawer on phones) and keeps it in view.
(() => {
  const shell = document.querySelector("[data-rail]");
  const wide = window.matchMedia("(min-width: 1000px)");
  const links = new Map();
  for (const a of document.querySelectorAll("[data-rail-link]")) {
    const id = a.getAttribute("data-rail-link") ?? "";
    links.set(id, [...(links.get(id) ?? []), a]);
  }
  const current = document.querySelector("[data-rail-current]");
  const scroller = document.querySelector(".rail-desktop");
  const targets = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  let active = "";
  const update = () => {
    // The active stop is the last one whose top has passed the upper third.
    let best;
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.33) best = el;
      else break;
    }
    const id = best?.id ?? "";
    if (id === active) return;
    for (const a of links.get(active) ?? []) {
      a.classList.remove("is-active");
      a.removeAttribute("aria-current");
    }
    active = id;
    const now = links.get(id) ?? [];
    for (const a of now) {
      a.classList.add("is-active");
      a.setAttribute("aria-current", "location");
    }
    const listLink = now.find((a) => a.closest(".rail"));
    if (current && listLink)
      current.textContent =
        listLink.querySelector(".rail-year")?.textContent ||
        listLink.textContent ||
        "";
    const drawn = now.find((a) => a.closest(".rail-desktop"));
    if (scroller && drawn && wide.matches) {
      const box = drawn.getBoundingClientRect();
      const frame = scroller.getBoundingClientRect();
      if (box.top < frame.top + 40 || box.bottom > frame.bottom - 40)
        scroller.scrollTop += box.top - frame.top - frame.height / 2;
    }
  };
  window.addEventListener("scroll", () => requestAnimationFrame(update), {
    passive: true,
  });
  update();
  // On phones, choosing an item closes the contents drawer.
  shell?.addEventListener("click", (event) => {
    if (event.target.closest("a") && !wide.matches) shell.open = false;
  });
})();
