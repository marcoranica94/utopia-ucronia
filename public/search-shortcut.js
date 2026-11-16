document.addEventListener("keydown", (event) => {
  if (
    event.key !== "/" ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.defaultPrevented
  )
    return;
  const element = event.target;
  if (
    element instanceof Element &&
    element.closest(
      "input,textarea,select,[contenteditable]:not([contenteditable=false]),dialog[open]",
    )
  )
    return;
  event.preventDefault();
  const input = document.querySelector("[data-fulltext-input]");
  if (input) input.focus();
  else {
    const link = document.querySelector("[data-search-link]");
    if (link) location.assign(`${link.pathname}#search-input`);
  }
});
