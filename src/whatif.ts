/**
 * "What if…?" (S5): a random published work. The page shows one work chosen
 * at build time, so it works without JavaScript; `public/whatif.js` then
 * draws another from `/whatif.json` on request.
 */

export interface WhatIfEntry {
  /** Reading path without locale prefix, e.g. /works/<id>/. */
  p: string;
  /** Title. */
  t: string;
  /** Authors, joined. */
  a: string;
  /** Text language, if known. */
  l?: string;
  /** Opening of the text, plain. */
  o: string;
}

const entities: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Plain opening of a converted work: interface markup, images, tables
 * headers and Markdown signs removed, the repeated title skipped, cut at a
 * word boundary. */
export function opening(body: string, title: string, max = 320): string {
  let text = body
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<span data-t="[^"]*"><\/span>/g, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, (e) => entities[e.toLowerCase()] ?? " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/[#>|\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();
  const head = fold(title);
  if (head) {
    const words = text.split(" ");
    for (let n = Math.min(words.length, 30); n > 0; n--)
      if (fold(words.slice(0, n).join(" ")) === head) {
        text = words.slice(n).join(" ");
        break;
      }
  }
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

/** Deterministic pick for the build-time fallback. */
export function pick<T>(items: T[], seed: string): T {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return items[(h >>> 0) % items.length];
}
