import { load } from "cheerio";
import iconv from "iconv-lite";
import sanitize from "sanitize-html";
import Turndown from "turndown";

export function decode(data: Buffer): string {
  const head = data.subarray(0, 2048).toString("ascii");
  const charset =
    /charset\s*=\s*["']?\s*([\w-]+)/i.exec(head)?.[1] ?? "windows-1252";
  return iconv.decode(
    data,
    iconv.encodingExists(charset) ? charset : "windows-1252",
  );
}
export function titleSlug(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) || "document"
  );
}
export function documentTitle(html: string): string {
  const $ = load(html);
  return (
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled document"
  ).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]");
}
export function convertHtml(
  html: string,
  resolve: (url: string, image: boolean) => string,
): { markdown: string; title: string; language: string; text: string } {
  const $ = load(html);
  const title = documentTitle(html);
  const language = $("html").attr("lang")?.split("-")[0] ?? "it";
  $(
    "script,style,iframe,input,button,select,textarea,object,embed,applet,bgsound,noscript",
  ).remove();
  // FrontPage leaves unclosed forms that swallow the whole home page: keep the text.
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
  const clean = sanitize(
    ($("body").html() ?? html)
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
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
            ...(attrs.href ? { href: resolve(attrs.href, false) } : {}),
          },
        }),
        img: (_tag, attrs) => ({
          tagName: "img",
          attribs: {
            ...attrs,
            src: resolve(attrs.src ?? "", true),
            alt: attrs.alt ?? "Image from the original document",
          },
        }),
      },
      exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    },
  );
  const ready = load(clean);
  // An excluded image must not leave an empty link reachable by keyboard.
  ready("a[href]").each((_i, el) => {
    if (!ready(el).text().trim() && !ready(el).find("img").length)
      ready(el).removeAttr("href");
  });
  const td = new Turndown({ headingStyle: "atx", bulletListMarker: "-" });
  td.keep(["table", "sup", "sub", "u", "span", "em", "i", "strong", "b"]);
  // FrontPage uses hand-typed numbering: do not turn it into new lists.
  const escapeMarkdown = td.escape.bind(td);
  td.escape = (text) =>
    escapeMarkdown(text).replace(/^(\s*\d+)\)(?=\s)/gm, "$1\\)");
  td.addRule("frontPageEmphasis", {
    filter: ["em", "i", "strong", "b"],
    replacement: (_content, node) => (node as HTMLElement).outerHTML,
  });
  td.addRule("anchors", {
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
    .turndown(ready("body").html() ?? "")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]");
  return {
    markdown,
    title,
    language: ["it", "fr", "es"].includes(language) ? language : "it",
    text: load(clean).text(),
  };
}
