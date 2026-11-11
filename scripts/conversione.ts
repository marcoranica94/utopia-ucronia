import { load } from "cheerio";
import iconv from "iconv-lite";
import sanitize from "sanitize-html";
import Turndown from "turndown";

export function decodifica(dati: Buffer): string {
  const inizio = dati.subarray(0, 2048).toString("ascii");
  const charset =
    /charset\s*=\s*["']?\s*([\w-]+)/i.exec(inizio)?.[1] ?? "windows-1252";
  return iconv.decode(
    dati,
    iconv.encodingExists(charset) ? charset : "windows-1252",
  );
}
export function slugTitolo(titolo: string): string {
  return (
    titolo
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "documento"
  );
}
export function titoloDocumento(html: string): string {
  const $ = load(html);
  return (
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Documento senza titolo"
  ).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email rimossa]");
}
export function convertiHtml(
  html: string,
  risolvi: (url: string, immagine: boolean) => string,
): { markdown: string; titolo: string; lingua: string; testo: string } {
  const $ = load(html);
  const titolo = titoloDocumento(html);
  const lingua = $("html").attr("lang")?.split("-")[0] ?? "it";
  $(
    "script,style,iframe,input,button,select,textarea,object,embed,applet,bgsound,noscript",
  ).remove();
  // FrontPage lascia form non chiusi che inglobano l’intera home: conserva il testo.
  $("form").each((_i, el) => {
    $(el).replaceWith($(el).contents());
  });
  $('a[href^="mailto:"]').each((_i, el) => {
    $(el).replaceWith($("<span>").text($(el).text()));
  });
  $("a[name]").each((_i, el) => {
    $(el).attr("id", $(el).attr("name") ?? "");
  });
  const ids = new Set<string>();
  $("[id]").each((_i, el) => {
    const id = $(el).attr("id") ?? "";
    if (ids.has(id)) $(el).removeAttr("id");
    else ids.add(id);
  });
  const pulito = sanitize(
    ($("body").html() ?? html)
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email rimossa]")
      .replace(/mailto:/gi, ""),
    {
      allowedTags: [
        "p",
        "br",
        "hr",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "pre",
        "code",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "s",
        "sub",
        "sup",
        "ul",
        "ol",
        "li",
        "a",
        "img",
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "caption",
        "div",
        "span",
        "dl",
        "dt",
        "dd",
      ],
      allowedAttributes: {
        "*": ["id"],
        a: ["href", "title"],
        img: ["src", "alt", "title", "width", "height"],
        th: ["colspan", "rowspan", "scope"],
        td: ["colspan", "rowspan"],
        ol: ["start"],
      },
      allowedSchemes: [],
      allowProtocolRelative: false,
      transformTags: {
        a: (_tag, attrs) => ({
          tagName: "a",
          attribs: {
            ...attrs,
            ...(attrs.href ? { href: risolvi(attrs.href, false) } : {}),
          },
        }),
        img: (_tag, attrs) => ({
          tagName: "img",
          attribs: {
            ...attrs,
            src: risolvi(attrs.src ?? "", true),
            alt: attrs.alt ?? "Immagine del documento originale",
          },
        }),
      },
      exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    },
  );
  const td = new Turndown({ headingStyle: "atx", bulletListMarker: "-" });
  td.keep(["table", "sup", "sub", "u", "span", "em", "i", "strong", "b"]);
  // FrontPage usa numerazioni scritte a mano: non trasformarle in liste nuove.
  const escapeMarkdown = td.escape.bind(td);
  td.escape = (text) =>
    escapeMarkdown(text).replace(/^(\s*\d+)\)(?=\s)/gm, "$1\\)");
  td.addRule("enfasiFrontPage", {
    filter: ["em", "i", "strong", "b"],
    replacement: (_content, node) => (node as HTMLElement).outerHTML,
  });
  td.addRule("ancore", {
    filter: (node) =>
      node.nodeType === 1 &&
      node.nodeName === "A" &&
      Boolean((node as HTMLElement).getAttribute("id")),
    replacement: (content, node) => {
      const id = sanitize((node as HTMLElement).getAttribute("id") ?? "", {
        allowedTags: [],
        allowedAttributes: {},
      }).replace(/["<>]/g, "");
      return `<span id="${id}"></span>\n\n${content}\n\n`;
    },
  });
  const markdown = td
    .turndown(pulito)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email rimossa]");
  return {
    markdown,
    titolo,
    lingua: ["it", "fr", "es"].includes(lingua) ? lingua : "it",
    testo: load(pulito).text(),
  };
}
