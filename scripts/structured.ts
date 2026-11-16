import type {
  Anatomy,
  Block,
  ContributionKind,
  Entry,
  Segment,
} from "./anatomy.ts";
import { stripLeadingText } from "./anatomy.ts";

export type OutlineItem = {
  id: string;
  label: string;
  kind: "section" | "pod" | "entry" | "contribution" | "piece";
  depth: number;
  start?: number;
  end?: number;
  author?: string;
  contribution?: ContributionKind;
  replyTo?: string;
  /** Length of the text in characters: lets views size each voice. */
  size?: number;
};

const emailRe = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const escapeHtml = (s: string) =>
  s
    .replace(emailRe, "[email removed]")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const summary = (blocks: Block[], words = 9) => {
  const text = blocks
    .map((b) => b.text)
    .join(" ")
    .replace(emailRe, "")
    .trim();
  const cut = text.split(" ").slice(0, words).join(" ");
  return cut.length < text.length ? `${cut}…` : cut;
};
// Interface words are placeholders filled by the page in the reader's
// language (src/i18n.ts); outline labels starting with "@" are keys too.
const ui = (key: string, n?: number) =>
  `<span data-t="${key}"${n !== undefined ? ` data-n="${n}"` : ""}></span>`;
// Two letters that stand for an author in the interface (not text).
const initials = (name: string) => {
  const words = name
    .normalize("NFD")
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    (
      (words[0]?.[0] ?? "") +
      (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "")
    ).toUpperCase() || "?"
  );
};
const textLength = (s: Segment) =>
  [...s.lead, ...(s.pod?.blocks ?? []), ...s.entries.flatMap((e) => e.blocks)]
    .map((b) => b.text)
    .join(" ").length;

/**
 * Turns an anatomy into a Markdown body made of HTML section wrappers with
 * Markdown inside (CommonMark keeps them apart when separated by blank
 * lines), plus the outline that drives the reading page's timeline.
 */
export function renderStructured(
  a: Anatomy,
  toMarkdown: (html: string) => string,
): { body: string; outline: OutlineItem[]; contributors: string[] } {
  const outline: OutlineItem[] = [];
  const out: string[] = [];
  const byId = new Map(a.segments.map((s) => [s.id, s]));
  const md = (blocks: Block[]) =>
    blocks.length ? toMarkdown(blocks.map((b) => b.html).join("\n")) : "";
  const entry = (e: Entry, depth: number, cls = "entry") => {
    const [first, ...rest] = e.blocks;
    const label = e.date?.label ?? "";
    const stripped = e.date
      ? stripLeadingText(first.html, label)
      : { html: first.html, separator: "" };
    const firstHtml = stripped.html;
    const html = [firstHtml, ...rest.map((b) => b.html)].join("\n");
    if (e.date)
      outline.push({
        id: e.id,
        label: `${label}|${summary([{ ...first, text: first.text.slice(label.length).replace(/^\s*[:\-–),.]\s*/, "") }, ...rest])}`,
        kind: "entry",
        depth,
        start: e.date.start,
        ...(e.date.end !== undefined ? { end: e.date.end } : {}),
      });
    out.push(
      `<div class="${cls}" id="${e.id}"${e.date ? ` data-start="${e.date.start}"` : ""}>`,
      e.date
        ? `<p class="entry-date"><time>${escapeHtml(label)}</time>${stripped.separator ? `<span class="entry-sep">${escapeHtml(stripped.separator)}</span>` : ""}</p>`
        : "",
      "",
      toMarkdown(html),
      "",
      "</div>",
      "",
    );
  };
  const segmentBody = (s: Segment, depth: number) => {
    if (s.byline && s.role !== "piece")
      out.push(`<p class="byline">${escapeHtml(s.byline)}</p>`, "");
    if (s.lead.length) out.push(md(s.lead), "");
    let heading = false;
    for (const e of s.entries) {
      if (e === s.pod) {
        outline.push({
          id: e.id,
          label: "@pod",
          kind: "pod",
          depth: depth + (heading ? 1 : 0),
        });
        out.push(
          `<div class="pod" id="${e.id}">`,
          "",
          md(e.blocks),
          "",
          "</div>",
          "",
        );
        continue;
      }
      if (s.role === "main" && !heading) {
        heading = true;
        outline.push({
          id: `${s.id}-chronology`,
          label: "@chronology",
          kind: "section",
          depth,
        });
        out.push(
          `<h2 class="part-heading" id="${s.id}-chronology" data-ui>${ui("outline.chronology")}</h2>`,
          "",
        );
      }
      entry(e, depth + (s.role === "main" ? 1 : 0));
    }
  };
  const contribution = (s: Segment, depth: number) => {
    const kind = s.kind ?? "comment";
    const target = s.replyTo ? byId.get(s.replyTo) : undefined;
    // Short comments without dates stay folded so they do not break reading.
    const folded =
      (kind === "comment" || kind === "reply") &&
      !s.entries.length &&
      textLength(s) < 600;
    outline.push({
      id: s.id,
      label: s.author ?? "@anonymous",
      kind: "contribution",
      depth,
      contribution: kind,
      size: textLength(s),
      ...(s.author ? { author: s.author } : {}),
      ...(s.replyTo ? { replyTo: s.replyTo } : {}),
    });
    // The header is built by the interface; the original opening line stays
    // in the body as text.
    const head = [
      `<span class="monogram" aria-hidden="true">${escapeHtml(initials(s.author ?? "?"))}</span>`,
      `<span class="contribution-author">${s.author ? escapeHtml(s.author) : ui("outline.anonymous")}</span>`,
      `<span class="contribution-kind">${ui(`kind.${kind}`)}</span>`,
      target
        ? `<a class="contribution-target" href="#${target.id}">${ui("replyTo")} ${target.author ? escapeHtml(target.author) : ui("earlier")}</a>`
        : "",
    ].join("");
    const classes = `contribution kind-${kind}${target ? " is-reply" : ""}`;
    out.push(
      folded
        ? `<details class="${classes}" id="${s.id}"><summary><span class="contribution-head" data-ui>${head}</span><span class="contribution-preview" data-ui>${escapeHtml(summary(s.lead, 14))}</span></summary>`
        : `<section class="${classes}" id="${s.id}"><header class="contribution-head" data-ui>${head}</header>`,
      `<div class="contribution-body">`,
      s.intro ? `<p class="contribution-intro">${escapeHtml(s.intro)}</p>` : "",
      "",
    );
    segmentBody(s, depth + 1);
    out.push("</div>", folded ? "</details>" : "</section>", "");
  };
  const owners = a.segments.filter((s) => s.role !== "contribution");
  for (const owner of owners) {
    const isPiece = owner.role === "piece";
    const replies = a.segments.filter(
      (s) => s.role === "contribution" && s.id.startsWith(`${owner.id}-`),
    );
    if (isPiece) {
      outline.push({
        id: owner.id,
        label: owner.title ?? "@untitled",
        kind: "piece",
        depth: 0,
        size: textLength(owner),
        ...(owner.author ? { author: owner.author } : {}),
      });
      out.push(
        `<section class="piece" id="${owner.id}">`,
        owner.anchor ? `<span id="${escapeHtml(owner.anchor)}"></span>` : "",
        `<header class="piece-head"><h2 class="piece-title">${escapeHtml(owner.title ?? "")}</h2>${owner.byline ? `<p class="piece-byline">${escapeHtml(owner.byline)}</p>` : ""}</header>`,
        `<div class="piece-body">`,
        "",
      );
      segmentBody(owner, 1);
      out.push("</div>", "");
      for (const r of replies) contribution(r, 1);
      out.push("</section>", "");
      continue;
    }
    outline.push({
      id: "start",
      label: "@start",
      kind: "section",
      depth: 0,
      size: textLength(owner),
      ...(owner.author ? { author: owner.author } : {}),
    });
    out.push(
      `<section class="part part-main" id="start">`,
      `<header class="part-head" data-ui><span class="part-label">${ui(`part.main.${a.shape}`)}</span>${owner.author ? `<span class="part-author">${escapeHtml(owner.author)}</span>` : ""}</header>`,
      `<div class="part-body">`,
      "",
    );
    segmentBody(owner, 0);
    out.push("</div>", "</section>", "");
    if (replies.length) {
      outline.push({
        id: "discussion",
        label: "@discussion",
        kind: "section",
        depth: 0,
      });
      out.push(
        `<section class="part part-discussion" id="discussion">`,
        `<header class="part-head" data-ui><span class="part-label">${ui("outline.discussion")}</span><span class="part-note">${ui("discussion.note", replies.length)}</span></header>`,
        "",
      );
      for (const r of replies) contribution(r, 1);
      out.push("</section>", "");
    }
  }
  const contributors = [
    ...new Set(
      a.segments
        .filter((s) => s.role !== "main" && s.author)
        .map((s) => s.author as string),
    ),
  ].filter((n) => !a.authors.includes(n));
  return { body: out.join("\n"), outline, contributors };
}
