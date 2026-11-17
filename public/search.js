const root = document.querySelector("[data-search-page]");
if (root) {
  const labels = JSON.parse(root.dataset.searchLabels),
    lang = root.dataset.searchLang;
  const input = root.querySelector("[data-fulltext-input]"),
    language = root.querySelector("[data-search-language]"),
    kind = root.querySelector("[data-search-kind]"),
    status = root.querySelector("[data-search-status]"),
    list = root.querySelector("[data-search-results]"),
    more = root.querySelector("[data-search-more]"),
    retry = root.querySelector("[data-search-retry]");
  let engine,
    results = [],
    shown = 0,
    revision = 0,
    timer;
  const load = async () => {
    if (!engine)
      engine = import(`/pagefind/${lang}/pagefind.js`).catch((error) => {
        engine = undefined;
        throw error;
      });
    return engine;
  };
  function preserveQuery() {
    const url = new URL(location.href);
    url.search = "";
    if (input.value.trim()) url.searchParams.set("q", input.value.trim());
    if (language.value) url.searchParams.set("language", language.value);
    if (kind.value) url.searchParams.set("kind", kind.value);
    history.replaceState(null, "", url);
    for (const link of document.querySelectorAll(".lang-switch a")) {
      const target = new URL(link.href);
      target.search = url.search;
      link.href = target.href;
    }
  }
  function excerpt(html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = document.createDocumentFragment();
    function copy(node, parent) {
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE)
          parent.append(document.createTextNode(child.textContent));
        else if (child.nodeType === Node.ELEMENT_NODE) {
          if (child.tagName === "MARK") {
            const mark = document.createElement("mark");
            mark.textContent = child.textContent;
            parent.append(mark);
          } else copy(child, parent);
        }
      }
    }
    copy(template.content, fragment);
    return fragment;
  }
  async function append(current) {
    const batch = results.slice(shown, shown + 10);
    const data = await Promise.all(batch.map((result) => result.data()));
    if (current !== revision) return;
    for (const result of data) {
      // A period-table page yields one hit per matching prompt (its row).
      const prompt = result.meta.kind === "prompt";
      const hits = prompt
        ? (result.sub_results ?? []).map((sub) => ({
            url: sub.url,
            title: sub.title,
            excerpt: sub.excerpt,
          }))
        : [
            {
              url: result.url,
              title: result.meta.title,
              excerpt: result.excerpt,
            },
          ];
      for (const hit of hits) {
        const target = new URL(hit.url, location.origin);
        if (
          target.origin !== location.origin ||
          !(prompt
            ? /^\/(?:en\/)?divergences\/period\/[a-z0-9-]+\/(?:\d+\/)?$/.test(
                target.pathname,
              ) && /^#item-[a-f0-9]+$/.test(target.hash)
            : /^\/(?:en\/)?(?:works|divergences)\/[a-z0-9-]+\/$/.test(
                target.pathname,
              ))
        )
          continue;
        const li = document.createElement("li"),
          heading = document.createElement("h2"),
          link = document.createElement("a"),
          p = document.createElement("p");
        link.href = target.pathname + (prompt ? target.hash : "");
        link.textContent = hit.title;
        heading.append(link);
        li.append(heading);
        if (prompt) {
          const where = document.createElement("p");
          where.className = "search-result-meta";
          where.textContent = labels.promptIn.replace(
            "{period}",
            result.meta.period ?? "",
          );
          li.append(where);
        }
        p.lang = prompt ? "" : result.meta.language || "";
        p.append(excerpt(hit.excerpt));
        li.append(p);
        if (!prompt && result.meta.source) {
          const source = new URL(result.meta.source, location.origin);
          if (
            source.origin === location.origin &&
            /^\/(?:en\/)?sources\/doc-[a-f0-9]+\/$/.test(source.pathname)
          ) {
            const a = document.createElement("a");
            a.href = source.pathname;
            a.textContent = root.dataset.searchSourceLabel;
            li.append(a);
          }
        }
        list.append(li);
      }
    }
    shown += batch.length;
    more.hidden = shown >= results.length;
  }
  async function search() {
    const current = ++revision;
    list.replaceChildren();
    more.hidden = true;
    retry.hidden = true;
    results = [];
    shown = 0;
    preserveQuery();
    const query = input.value.trim();
    if (!query) {
      status.textContent = labels.hint;
      return;
    }
    status.textContent = labels.loading;
    list.setAttribute("aria-busy", "true");
    try {
      const api = await load();
      // Works and prompt pages are counted apart: a prompt result is a
      // period-table page holding one or more matching prompts.
      const kinds = kind.value ? [kind.value] : ["work", "prompt"];
      const responses = await Promise.all(
        kinds.map((k) =>
          api.search(query, {
            filters: {
              kind: k,
              ...(language.value ? { language: language.value } : {}),
            },
          }),
        ),
      );
      if (current !== revision) return;
      results = responses.flatMap((response) => response.results);
      const counts = Object.fromEntries(
        kinds.map((k, i) => [k, responses[i].results.length]),
      );
      const parts = [];
      if (counts.work)
        parts.push(
          counts.work === 1
            ? labels.one
            : labels.count.replace("{count}", counts.work),
        );
      if (counts.prompt)
        parts.push(labels.promptPages.replace("{count}", counts.prompt));
      status.textContent = parts.length ? parts.join(" · ") : labels.empty;
      await append(current);
    } catch {
      if (current === revision) {
        status.textContent = labels.error;
        retry.hidden = false;
      }
    } finally {
      if (current === revision) list.removeAttribute("aria-busy");
    }
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(search, 180);
  });
  language.addEventListener("change", search);
  kind.addEventListener("change", search);
  retry.addEventListener("click", () => location.reload());
  more.addEventListener("click", async () => {
    more.disabled = true;
    try {
      await append(revision);
    } catch {
      status.textContent = labels.error;
      retry.hidden = false;
    } finally {
      more.disabled = false;
    }
  });
  input.addEventListener(
    "focus",
    () => {
      load().catch(() => {});
    },
    { once: true },
  );
  function restore() {
    const params = new URLSearchParams(location.search);
    input.value = params.get("q") ?? "";
    language.value = params.get("language") ?? "";
    kind.value = ["work", "prompt"].includes(params.get("kind"))
      ? params.get("kind")
      : "";
    search();
  }
  window.addEventListener("popstate", restore);
  restore();
  if (location.hash === "#search-input") input.focus();
}
