(() => {
  const key = "utopia-ucronia-theme";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  } catch {
    // The system preference still works when storage is unavailable.
  }
  const current = () =>
    root.dataset.theme || (system.matches ? "dark" : "light");
  const update = () => {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;
    const theme = current();
    button.hidden = false;
    button.dataset.activeTheme = theme;
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro",
    );
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.querySelector("[data-theme-label]").textContent =
      theme === "dark" ? "Scuro" : "Chiaro";
  };
  document.addEventListener("DOMContentLoaded", () => {
    document
      .querySelector("[data-theme-toggle]")
      ?.addEventListener("click", () => {
        const next = current() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        try {
          localStorage.setItem(key, next);
        } catch {
          /* The choice still applies to this page. */
        }
        update();
      });
    system.addEventListener("change", update);
    update();
  });
})();
