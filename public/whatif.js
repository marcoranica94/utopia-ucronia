// "What if…?": draw another random work from /whatif.json. Without this
// script the page still shows the work chosen at build time.
(() => {
  const root = document.querySelector("[data-whatif]");
  if (!root) return;
  const prefix = root.dataset.prefix || "";
  const $ = (name) => root.querySelector(`[data-whatif-${name}]`);
  const link = $("link");
  const read = $("read");
  const authors = $("authors");
  const opening = $("opening");
  const again = $("again");
  let entries = null;
  let current = link.getAttribute("href");
  const show = (entry) => {
    const href = prefix + entry.p;
    current = href;
    link.textContent = entry.t;
    link.href = href;
    read.href = href;
    for (const el of [link, opening]) {
      if (entry.l) el.lang = entry.l;
      else el.removeAttribute("lang");
    }
    authors.textContent = entry.a;
    authors.hidden = !entry.a;
    opening.textContent = entry.o;
  };
  const draw = () => {
    if (!entries || entries.length < 2) return;
    let entry;
    do entry = entries[Math.floor(Math.random() * entries.length)];
    while (prefix + entry.p === current);
    show(entry);
  };
  fetch("/whatif.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!Array.isArray(data) || data.length < 2) return;
      entries = data;
      draw();
      again.hidden = false;
      again.addEventListener("click", draw);
    })
    .catch(() => {});
})();
