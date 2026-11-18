// Theme: automatic (system), light or dark. The choice persists when storage
// is available; otherwise it applies to the current page only.
(() => {
  const key = "utopia-ucronia-theme";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const read = () => {
    try {
      const saved = localStorage.getItem(key);
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  };
  const apply = (choice) => {
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
  };
  let selected = read();
  apply(selected);
  // Mark scripting now, in <head>: the switch takes its place in the header
  // from the first paint instead of pushing the page down on DOMContentLoaded.
  root.dataset.scripted = "";
  const update = () => {
    const group = document.querySelector("[data-theme-switch]");
    if (!group) return;
    group.hidden = false;
    const choice = selected;
    for (const button of group.querySelectorAll("[data-theme-set]"))
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-theme-set") === choice),
      );
  };
  document.addEventListener("DOMContentLoaded", () => {
    for (const button of document.querySelectorAll("[data-theme-set]"))
      button.addEventListener("click", () => {
        const choice = button.getAttribute("data-theme-set") ?? "system";
        try {
          if (choice === "system") localStorage.removeItem(key);
          else localStorage.setItem(key, choice);
        } catch {
          /* The choice still applies to this page. */
        }
        selected = choice;
        apply(choice);
        update();
      });
    system.addEventListener("change", update);
    update();
  });
})();
