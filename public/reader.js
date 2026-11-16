// The text remains readable and the contents usable without JavaScript.
(() => {
  const drawer = document.querySelector("[data-reader-contents]");
  const position = document.querySelector("[data-reader-position]");
  const targets = [
    ...document.querySelectorAll(
      ".structured .part-head, .structured .piece-title, .structured .contribution-head",
    ),
  ];
  const reveal = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    for (let node = target; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  };
  drawer?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-reader-link]");
    if (!link) return;
    event.preventDefault();
    const id = decodeURIComponent(link.hash.slice(1));
    drawer.open = false;
    history.pushState(null, "", link.hash);
    requestAnimationFrame(() => reveal(id));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer?.open) {
      drawer.open = false;
      drawer.querySelector("summary")?.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (drawer?.open && !event.target.closest(".reader-navigation"))
      drawer.open = false;
  });
  const revealHash = () => {
    if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)));
  };
  window.addEventListener("hashchange", revealHash);
  if (location.hash) revealHash();
  let scheduled = false;
  const update = () => {
    let current;
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= 140) current = target;
      else break;
    }
    if (position)
      position.textContent =
        current?.querySelector(".contribution-author, .part-label")
          ?.textContent ??
        current?.textContent ??
        "";
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
