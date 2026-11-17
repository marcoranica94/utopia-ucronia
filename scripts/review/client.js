const entries = document.querySelector("#entries"),
  reviewStatus = document.querySelector("#status"),
  state = document.querySelector("#state"),
  action = document.querySelector("#action");
let page = 1,
  version = 0,
  labels;
const node = (tag, text) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
async function load() {
  const current = ++version;
  entries.setAttribute("aria-busy", "true");
  try {
    const response = await fetch(
      `${location.pathname.replace(/\/$/, "")}/api?page=${page}&state=${state.value}&action=${action.value}`,
    );
    if (!response.ok) throw Error("Review unavailable");
    const data = await response.json();
    if (current !== version) return;
    labels = data.labels;
    page = data.page;
    const query = new URL(location.href);
    query.search = new URLSearchParams({
      page,
      state: state.value,
      action: action.value,
    });
    history.replaceState(null, "", query);
    reviewStatus.textContent = labels.batch
      .replace("{start}", data.start)
      .replace("{end}", data.end)
      .replace("{total}", data.total);
    document.querySelector("#previous").disabled = page <= 1;
    document.querySelector("#next").disabled = page >= data.pages;
    entries.replaceChildren();
    if (!data.entries.length) entries.append(node("p", labels.empty));
    for (const proposal of data.entries) {
      const article = node("article");
      article.id = proposal.id;
      article.dataset.proposal = proposal.id;
      article.append(
        node("h2", `${proposal.action} · ${proposal.id}`),
        node("p", `${proposal.review.by} · ${proposal.review.state}`),
      );
      const columns = node("div");
      columns.className = "review-columns";
      const source = node("section"),
        proposed = node("section");
      source.append(node("h3", labels.source));
      const quote = node("p", proposal.review.quote);
      quote.className = "quote";
      source.append(quote);
      for (const document of proposal.documents) {
        source.append(
          node(
            "p",
            `${document.url}\n${document.mediaType}\nSHA-256: ${document.sha256}`,
          ),
        );
        if (document.reviewPath) {
          const link = node("a", labels.fullSource);
          link.href = document.reviewPath;
          link.target = "_blank";
          link.rel = "noopener";
          source.append(link);
        }
      }
      proposed.append(
        node("h3", labels.proposal),
        node("p", proposal.review.reason),
        node("p", `${proposal.level} · ${proposal.items.length} items`),
      );
      const details = node("details");
      details.append(
        node("summary", labels.metadata),
        node("pre", JSON.stringify(proposal.items, null, 2)),
      );
      proposed.append(details);
      columns.append(source, proposed);
      article.append(columns);
      const label = node("label", labels.reason),
        reason = node("textarea");
      reason.minLength = 3;
      reason.maxLength = 2000;
      reason.value =
        proposal.review.by === "owner" ? proposal.review.reason : "";
      label.append(reason);
      article.append(label);
      const buttons = node("div");
      buttons.className = "actions";
      const message = node("p");
      message.setAttribute("role", "status");
      for (const [decision, title] of [
        ["approved", labels.approve],
        ["deferred", labels.defer],
      ]) {
        const button = node("button", title);
        button.type = "button";
        button.addEventListener("click", async () => {
          if (reason.value.trim().length < 3) {
            reason.setCustomValidity(labels.reason);
            reason.reportValidity();
            reason.focus();
            return;
          }
          reason.setCustomValidity("");
          for (const control of entries.querySelectorAll("button"))
            control.disabled = true;
          try {
            const response = await fetch(
              `${location.pathname.replace(/\/$/, "")}/api`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Review-Token": data.token,
                },
                body: JSON.stringify({
                  proposalId: proposal.id,
                  fingerprint: proposal.fingerprint,
                  state: decision,
                  reason: reason.value.trim(),
                  revision: data.revision,
                }),
              },
            );
            if (response.status === 409) {
              message.textContent = labels.conflict;
              return;
            }
            if (!response.ok) {
              message.textContent = labels.error;
              return;
            }
            await load();
            const saved = entries.querySelector(
              `[data-proposal="${proposal.id}"]`,
            );
            if (saved) {
              saved.querySelector("textarea").focus();
              saved.querySelector('[role="status"]').textContent = labels.saved;
            }
          } catch {
            message.textContent = labels.error;
          } finally {
            for (const control of entries.querySelectorAll("button"))
              control.disabled = false;
          }
        });
        buttons.append(button);
      }
      reason.addEventListener("input", () => reason.setCustomValidity(""));
      article.append(buttons, message);
      entries.append(article);
    }
    if (/^#[a-z0-9-]+$/.test(location.hash)) {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
    }
  } catch {
    reviewStatus.textContent =
      labels?.error ?? "Revisione non disponibile / Review unavailable";
  } finally {
    if (current === version) entries.removeAttribute("aria-busy");
  }
}
for (const control of [state, action])
  control.addEventListener("change", () => {
    page = 1;
    load();
  });
document.querySelector("#previous").onclick = () => {
  page--;
  load();
};
document.querySelector("#next").onclick = () => {
  page++;
  load();
};
document.querySelector("#reload").onclick = load;
const params = new URLSearchParams(location.search);
page = Number(params.get("page") ?? 1);
state.value = params.get("state") ?? "all";
action.value = params.get("action") ?? "";
load();
