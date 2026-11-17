import { load } from "cheerio";
import type { EditorialMap } from "../../src/editorial/model.ts";
import { type Lang, useTranslations } from "../../src/i18n.ts";
import { redact, sourceHtml } from "../editorial-core.ts";
import { plainSourceBlocks } from "../source-text.ts";

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
export async function reviewSourcePage(
  map: EditorialMap,
  id: string,
  lang: Lang,
  archiveRoot?: string,
) {
  const document = map.documents.find((d) => d.id === id);
  if (
    !document ||
    !/^(?:text\/html|application\/pdf)(?:;|$)/i.test(document.mediaType)
  )
    throw Error("Unknown or unsupported review source");
  const html = await sourceHtml(
    { documentId: id, url: document.url, selection: { kind: "whole" } },
    map,
    archiveRoot,
  );
  const text = plainSourceBlocks(html);
  const $ = load(html);
  const references = [
    ...new Set(
      $("a[href]")
        .toArray()
        .flatMap((element) => {
          try {
            const url = new URL($(element).attr("href") ?? "", document.url);
            return /^https?:$/.test(url.protocol) ? [redact(url.href)] : [];
          } catch {
            return [];
          }
        }),
    ),
  ];
  const t = useTranslations(lang);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(t("review.fullSource"))} · UtopiaUcronia</title><style>:root{color-scheme:light dark;font:18px/1.65 Georgia,serif;color:light-dark(#202e3d,#f2f2ef);background:light-dark(#fff,#141b27)}body{max-width:78ch;margin:auto;padding:2rem 1rem;overflow-wrap:anywhere}header{font-family:system-ui,sans-serif}a{color:light-dark(#315f83,#a9cce7)}:focus-visible{outline:3px solid #739fca;outline-offset:3px}dt{margin-top:1rem}dd{margin-left:0}</style></head><body><header><a href="${lang === "en" ? "/en" : ""}/review/">${escapeHtml(t("review.title"))}</a><h1>${escapeHtml(t("review.fullSource"))}</h1><p>${escapeHtml(t("review.sourceNote"))}</p><dl><dt>${escapeHtml(t("source.original"))}</dt><dd>${escapeHtml(redact(document.url))}</dd><dt>SHA-256</dt><dd>${document.sha256}</dd></dl></header><main>${text.map((block) => `<p>${escapeHtml(block)}</p>`).join("\n")}</main>${references.length ? `<section><h2>${escapeHtml(t("review.sourceReferences"))}</h2><ul>${references.map((url) => `<li>${escapeHtml(url)}</li>`).join("\n")}</ul></section>` : ""}</body></html>`;
}
