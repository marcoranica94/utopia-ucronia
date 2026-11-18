import { type Cheerio, type CheerioAPI, load } from "cheerio";

// Node types come from cheerio's own signatures, as in anatomy.ts
// (domhandler is not a direct dependency).
type Root = ReturnType<CheerioAPI["root"]>;
type AnyNode =
  ReturnType<Root["contents"]> extends Cheerio<infer T> ? T : never;
type Element =
  ReturnType<Root["children"]> extends Cheerio<infer T> ? T : never;
type Text = AnyNode & { data: string };

/**
 * Red text in the original (owner request of 18/11/2026). The 2004 site set
 * the editors' own words in red: the line that presents a proposal ("Ecco una
 * domanda postaci da…:", "POD:"), the remarks between contributions, and
 * sometimes dates or place names. Conversion used to drop every colour, so
 * the reader could no longer tell the editors' frame from the work.
 *
 * Every text node whose nearest coloured ancestor is red is wrapped in
 * `<span class="src-red">`; a leaf block whose visible text is all red gets a
 * single `<span class="src-red src-red-whole">` around its contents, which
 * the reader shows as a separate panel. Only markup is added: the text, its
 * order and every other element stay exactly as in the source.
 */

const RED = /^(?:#?ff0000|#?f00|red|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\))$/i;
const LEAF_BLOCKS = "p,li,dd,dt,h1,h2,h3,h4,h5,h6,blockquote,div,td,th,caption";
const BLOCKS = `${LEAF_BLOCKS},table,ul,ol,dl,tr,tbody,thead,tfoot,section,center,form,pre,hr`;

/** The colour an element sets for its text, if any. */
function ownColor(element: Element): string | undefined {
  const style = element.attribs.style ?? "";
  const fromStyle = /(?:^|;)\s*color\s*:\s*([^;!]+)/i.exec(style)?.[1];
  if (fromStyle) return fromStyle.trim();
  if (element.name === "font" && element.attribs.color)
    return element.attribs.color.trim();
  return undefined;
}

function isRed(node: AnyNode): boolean {
  for (let el = node.parent; el && el.type === "tag"; el = el.parent) {
    const color = ownColor(el as Element);
    if (color !== undefined) return RED.test(color.replace(/["']/g, ""));
  }
  return false;
}

export function markSourceRed(html: string): string {
  if (!/color/i.test(html)) return html;
  const $ = load(html);
  const texts: Text[] = [];
  const collect = (nodes: Cheerio<AnyNode>) =>
    nodes.each((_i, node) => {
      if (node.type === "text") texts.push(node as Text);
      else if (
        node.type === "tag" &&
        !["script", "style", "title", "head"].includes((node as Element).name)
      )
        collect($(node).contents());
    });
  collect($("body").contents());
  let marked = 0;
  for (const node of texts) {
    if (!node.data.trim() || !isRed(node)) continue;
    const [, before, core, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(
      node.data,
    ) as RegExpExecArray;
    const span = $("<span>").addClass("src-red").text(core);
    $(node).replaceWith(
      [before, $.html(span), after]
        .filter(Boolean)
        .map((part) =>
          part.startsWith("<span")
            ? part
            : part.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
        )
        .join(""),
    );
    marked++;
  }
  if (!marked) return html;
  // A leaf block written entirely in red becomes one panel.
  $(LEAF_BLOCKS).each((_i, el) => {
    const block = $(el);
    if (block.find(BLOCKS).length) return;
    let red = 0;
    let other = false;
    block
      .find("*")
      .addBack()
      .contents()
      .each((_j, node) => {
        if (node.type !== "text" || !(node as Text).data.trim()) return;
        if ($(node).parent().is(".src-red")) red++;
        else other = true;
      });
    if (!red || other) return;
    block.find(".src-red").each((_j, span) => {
      $(span).replaceWith($(span).contents());
    });
    block.wrapInner('<span class="src-red src-red-whole"></span>');
  });
  return $.html();
}
