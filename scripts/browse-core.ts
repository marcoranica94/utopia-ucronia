import { load } from "cheerio";
import { redact } from "./editorial-core.ts";
import { sha256, urlKey } from "./recovery/core.ts";

export const resourceKey = (href: string, source?: string) => {
  const url = new URL(href, source);
  const fragment = url.hash ? `#${decodeURIComponent(url.hash.slice(1))}` : "";
  try {
    return urlKey(url.href.split("#")[0]) + fragment;
  } catch {
    return url.href;
  }
};
export const recordId = (url: string) =>
  `record-${sha256(Buffer.from(resourceKey(url))).slice(0, 12)}`;
export const isIndex = (url: string) =>
  /\/(?:lista_ucronie|lavori|index|chisiamo|introduzione|ultimi)(?:[_.]|$)/i.test(
    new URL(url).pathname,
  );

/** Each leaf cell in the source grid is a work, not each table row. */
export function catalogCells(html: string, source: string) {
  const $ = load(html);
  $("script,style,iframe,object,embed,noscript").remove();
  return $("td")
    .toArray()
    .flatMap((cell, index) => {
      const c = $(cell);
      if (c.find("table").length) return [];
      const first = c
        .find("a[href]")
        .toArray()
        .find((a) => {
          const href = $(a).attr("href") ?? "";
          try {
            const url = new URL(href, source);
            return (
              /^https?:$/.test(url.protocol) && Boolean(redact($(a).text()))
            );
          } catch {
            return false;
          }
        });
      if (!first) return [];
      const paragraph = $(first).closest("p");
      const links = (paragraph.length ? paragraph.find("a[href]") : $(first))
        .toArray()
        .flatMap((a) => {
          try {
            const url = new URL($(a).attr("href") ?? "", source);
            const title = redact($(a).text());
            if (!/^https?:$/.test(url.protocol) || !title) return [];
            return [{ url: url.href, title }];
          } catch {
            return [];
          }
        });
      if (!links.length) return [];
      // FrontPage sometimes links only a quote or part of a word. Read the
      // entire title paragraph, stopping at its author line, not at the link.
      const scope = paragraph.length ? paragraph : c;
      const nodes = scope.contents().toArray();
      type SourceNode = (typeof nodes)[number];
      let prefix = "";
      let stopped = false;
      const visit = (node: SourceNode) => {
        if (stopped) return;
        if (node.type === "text") {
          prefix += node.data.replace(/\r?\n/g, " ");
          return;
        }
        if (
          node.type === "tag" &&
          node.name === "a" &&
          /^mailto:/i.test(node.attribs.href ?? "")
        ) {
          stopped = true;
          return;
        }
        if (node.type === "tag" && node.name === "br")
          prefix += $(node).closest("a[href]").length ? " " : "\n";
        if ("children" in node) for (const child of node.children) visit(child);
      };
      for (const node of nodes) visit(node);
      const lines = prefix.split(/\n/);
      const bylineStart = lines.findIndex(
        (line, index) =>
          index > 0 &&
          /^(?:di|del|dello|della|by|par|por|de)\s/iu.test(line.trim()),
      );
      let title = redact(
        (bylineStart > 0 ? lines.slice(0, bylineStart) : lines).join(" "),
      );
      if (stopped && bylineStart < 0)
        title = title.replace(/\s+(?:di|del|dello|della|by|par|por|de)$/iu, "");
      title ||= links[0].title;
      if (!title.includes(links[0].title))
        throw new Error(
          `Catalog title omits linked source text: ${source} cell ${index}`,
        );
      const resources = new Set(links.map((link) => resourceKey(link.url)));
      for (const link of links)
        if (
          resources.size === 1 ||
          link.title.length < 5 ||
          (title.startsWith(link.title) &&
            title.length - link.title.length <= 3)
        )
          link.title = title;
      const text = redact(c.text());
      const compactTitle = title.replace(/\s/g, "");
      let offset = 0;
      let matched = 0;
      while (offset < text.length && matched < compactTitle.length) {
        if (/\s/.test(text[offset])) {
          offset++;
          continue;
        }
        if (text[offset] !== compactTitle[matched])
          throw new Error(
            `Catalog title is not a source prefix: ${source} cell ${index}`,
          );
        offset++;
        matched++;
      }
      if (matched !== compactTitle.length)
        throw new Error(
          `Incomplete catalog source title: ${source} cell ${index}`,
        );
      const caption = text.slice(offset).trim();

      return [
        {
          id: `catalog-${sha256(Buffer.from(`${resourceKey(source)}:${index}`)).slice(0, 12)}`,
          cell: index,
          title,
          caption,
          authors: [
            ...new Set(
              c
                .find('a[href^="mailto:" i]')
                .toArray()
                .map((a) => redact($(a).text()))
                .filter(Boolean),
            ),
          ],
          links,
        },
      ];
    });
}

/** A source reference is not sufficient evidence of a developed text. */
export function isDocumentedDevelopment(
  label: string,
  context: string,
  inCatalog: boolean,
  target: { status: string; fragmentMissing?: boolean; source: string },
) {
  if (!["ready", "recovered"].includes(target.status) || target.fragmentMissing)
    return false;
  if (
    /\/utopiaucronia\/(?:index|ultimi|lista_ucronie|lavori)(?:[_.]|$)/i.test(
      target.source,
    )
  )
    return false;
  if (/discuss|comment|appunti|schema|trailer/i.test(label)) return false;
  if (
    /\b(?:discussione|commento|appunti|schema|trailer)\b[^.!?;:]{0,35}$/i.test(
      context,
    )
  )
    return false;
  return (
    inCatalog ||
    /svilupp|svolgiment|realizzat|scritt|versione|racconto|trattazion|cronologia/i.test(
      `${label} ${context}`,
    )
  );
}
