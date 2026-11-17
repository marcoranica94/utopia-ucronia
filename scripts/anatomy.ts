import { type Cheerio, type CheerioAPI, load } from "cheerio";

// Node types come from cheerio's own signatures (domhandler is not a direct dependency).
type Root = ReturnType<CheerioAPI["root"]>;
type AnyNode =
  ReturnType<Root["contents"]> extends Cheerio<infer T> ? T : never;
type Element =
  ReturnType<Root["children"]> extends Cheerio<infer T> ? T : never;

/**
 * Reads the visual structure of an old UtopiaUcronia page and turns it into
 * explicit sections. The site never used real headings: a page is a header
 * ("di AUTHOR"), a main text (story, chronology or numbered proposals) and a
 * discussion where each contribution opens with a line such as "Questo è il
 * commento di X:" whose name links to the author's address.
 */

export type Block = {
  html: string;
  text: string;
  names: string[];
  anchor?: string;
  anchors?: string[];
  bold: boolean;
  image: boolean;
  hr: boolean;
  marquee: boolean;
};
export type ContributionKind = "comment" | "addition" | "variant" | "reply";
export type DateLabel = { start: number; end?: number; label: string };
export type Entry = {
  id: string;
  date?: DateLabel;
  blocks: Block[];
};
export type Segment = {
  id: string;
  role: "main" | "contribution" | "piece";
  author?: string;
  /** The original line that introduced the contribution, kept verbatim. */
  intro?: string;
  introBlock?: Block;
  title?: string;
  /** Original anchor name, kept so that the page's own links still work. */
  anchor?: string;
  anchors?: string[];
  kind?: ContributionKind;
  replyTo?: string;
  pod?: Entry;
  /** Text before the first dated entry, or the whole text when undated. */
  lead: Block[];
  entries: Entry[];
  signed?: string;
  /** The original "di AUTHOR" line, when it sits in the body. */
  byline?: string;
};
export type Anatomy = {
  title: string;
  headerText: string[];
  authors: string[];
  shape: "chronology" | "discussion" | "narrative" | "collection";
  segments: Segment[];
  dropped: string[];
  /** Every block of the page, and those deliberately left out of the text. */
  blocks: Block[];
  removed: Set<Block>;
  headerAnchors?: string[];
  footerAnchors?: string[];
};

const blockTags = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "table",
  "ul",
  "ol",
  "dl",
  "pre",
  "hr",
  "div",
  "center",
  "marquee",
]);
const atomicTags = new Set(["table", "ul", "ol", "dl", "pre", "blockquote"]);
const clean = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const norm = (s: string) =>
  clean(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Flattens the body into paragraph-level blocks, whatever the nesting. */
export function blocks(html: string, preserveWrapperAnchors = false): Block[] {
  const $ = load(html);
  $(
    "script,style,noscript,iframe,input,button,select,textarea,object,embed,applet,bgsound",
  ).remove();
  const out: Block[] = [];
  let run: AnyNode[] = [];
  let pendingAnchors: string[] = [];
  const preserve = (node: Element) => {
    if (!preserveWrapperAnchors) return;
    const id = $(node).attr("id") ?? $(node).attr("name");
    if (id) pendingAnchors.push(id);
  };
  const make = (nodes: AnyNode[], tag?: string) => {
    const $w = load("<div></div>");
    const wrap = $w("div");
    for (const n of nodes) wrap.append($(n).clone());
    const parts = splitDatedLines(wrap.html() ?? "");
    if (parts.length > 1) {
      for (const part of parts) push(part, tag);
      return;
    }
    push(wrap.html() ?? "", tag);
  };
  const push = (html: string, tag?: string) => {
    const $w = load(`<div>${html}</div>`, null, false);
    const wrap = $w("div").first();
    const text = clean(wrap.text());
    const image = wrap.find("img").length > 0 || tag === "img";
    const hr = tag === "hr" || wrap.find("hr").length > 0;
    if (!text && !image && !hr) {
      if (preserveWrapperAnchors)
        pendingAnchors.push(
          ...wrap
            .find("[id],a[name]")
            .toArray()
            .map((el) => $w(el).attr("id") ?? $w(el).attr("name") ?? "")
            .filter(Boolean),
        );
      return;
    }
    if (pendingAnchors.length) {
      for (const id of [...new Set(pendingAnchors)].reverse())
        wrap.prepend($w("<a></a>").attr("name", id));
      pendingAnchors = [];
    }
    const names = wrap
      .find('a[href^="mailto:" i]')
      .toArray()
      // Read through the wrapper's own API: load(a) would detach the node.
      .map((a) => clean($w(a).text()))
      .filter(Boolean);
    const anchor = wrap.find("a[name]").first().attr("name") ?? undefined;
    const boldText = clean(wrap.find("b,strong").text());
    out.push({
      html: wrap.html() ?? "",
      text,
      names,
      anchor,
      anchors: [
        ...new Set(
          wrap
            .find("[id],a[name]")
            .toArray()
            .map((el) => $w(el).attr("id") ?? $w(el).attr("name") ?? "")
            .filter(Boolean),
        ),
      ],
      bold: text.length > 0 && boldText.length >= text.length * 0.8,
      image,
      hr,
      marquee: tag === "marquee" || wrap.find("marquee").length > 0,
    });
  };
  const flush = () => {
    if (run.length) make(run);
    run = [];
  };
  const hasBlockChild = (el: Cheerio<Element>) =>
    el.find([...blockTags].join(",")).length > 0;
  const walk = (nodes: Cheerio<AnyNode>) => {
    nodes.each((_i, node) => {
      if (node.type !== "tag") {
        run.push(node);
        return;
      }
      const tag = node.name.toLowerCase();
      if (tag === "form" || tag === "font" || tag === "span" || tag === "a") {
        // Inline wrappers that FrontPage stretches around whole paragraphs.
        if (hasBlockChild($(node))) {
          preserve(node);
          walk($(node).contents());
          return;
        }
        run.push(node);
        return;
      }
      if (!blockTags.has(tag)) {
        if (tag === "br" && run.length) {
          // Two line breaks in a row separate paragraphs in FrontPage text.
          const prev = run.at(-1);
          if (prev?.type === "tag" && (prev as Element).name === "br") {
            run.pop();
            flush();
            return;
          }
        }
        run.push(node);
        return;
      }
      flush();
      if (atomicTags.has(tag) || tag === "hr" || !hasBlockChild($(node)))
        make([node], tag);
      else {
        preserve(node);
        walk($(node).contents());
      }
    });
    flush();
  };
  walk($("body").length ? $("body").contents() : $.root().contents());
  if (pendingAnchors.length)
    out.push({
      html: pendingAnchors
        .map((id) => `<span id="${id.replace(/["<>&]/g, "")}"></span>`)
        .join(""),
      text: "",
      names: [],
      anchors: pendingAnchors,
      bold: false,
      image: false,
      hr: false,
      marquee: false,
    });
  return out;
}

const months =
  "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|d[ée]cembre|enero|febrero|abril|mayo|junio|julio|septiembre|octubre|diciembre";
const bc = String.raw`a\.?\s?C\.?|av\.?\s?J\.?[-\s]?C\.?|BC|B\.C\.`;
const ad = String.raw`d\.?\s?C\.?|ap\.?\s?J\.?[-\s]?C\.?|AD|A\.D\.`;
const dateRe = new RegExp(
  String.raw`^(?:(?:anno|année|an|año|year)\s+)?(?:(\d{1,2})(?:°|º|er)?\s+(?:${months})\s+)?(?:(?:${months})\s+)?(\d{1,4})(?:\s*[-–/]\s*(\d{1,4}))?\s*(${bc}|${ad})?\s*(?:[:\-–)]|,|\.(?!\d))`,
  "iu",
);

const splitMark = "\u0000BR\u0000";
const voidTags = new Set([
  "br",
  "img",
  "hr",
  "input",
  "meta",
  "link",
  "area",
  "base",
  "col",
  "wbr",
]);
/**
 * Some chronologies separate their entries with a single line break inside
 * one paragraph. Split there, but only before a line that opens with a date,
 * and reopen the formatting tags that were open at the break.
 */
export function splitDatedLines(html: string): string[] {
  if (!/<br\b/i.test(html)) return [html];
  const marked = html.replace(/<br\b[^>]*>/gi, (br) => `${splitMark}${br}`);
  const pieces = marked.split(splitMark);
  const lineText = (h: string) =>
    clean(load(`<div>${h}</div>`, null, false).root().text());
  const out: string[] = [];
  let current = pieces[0];
  for (const piece of pieces.slice(1)) {
    const next = piece.replace(/^<br\b[^>]*>/i, "");
    if (leadingDate(lineText(next)) && lineText(current)) {
      // Tags still open at the break are closed by the parser in the first
      // part and reopened at the start of the second.
      const open: string[] = [];
      for (const m of current.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
        const name = m[2].toLowerCase();
        if (voidTags.has(name)) continue;
        if (m[1]) {
          const i = open
            .map((t) => /^<([a-z0-9]+)/i.exec(t)?.[1]?.toLowerCase())
            .lastIndexOf(name);
          if (i >= 0) open.splice(i, 1);
        } else open.push(m[0]);
      }
      out.push(
        load(`<div>${current}</div>`, null, false)("div").first().html() ??
          current,
      );
      current = open.join("") + next;
    } else current += piece;
  }
  out.push(
    load(`<div>${current}</div>`, null, false)("div").first().html() ?? current,
  );
  return out;
}

/** Reads a date at the start of a paragraph: "1155:", "1147-1149:", "753 a.C.:". */
export function leadingDate(text: string): DateLabel | undefined {
  const m = dateRe.exec(text);
  if (!m) return;
  const [whole, day, year, until, era] = m;
  const hasMonth = new RegExp(months, "iu").test(whole);
  if (year.length < 3 && !era && !hasMonth && !day) return;
  const sign = era && new RegExp(`^(?:${bc})$`, "iu").test(era) ? -1 : 1;
  const start = sign * Number(year);
  let end = until ? sign * Number(until) : undefined;
  // "1147-49" means 1147-1149.
  if (end !== undefined && until.length < year.length && sign > 0)
    end = Number(year.slice(0, year.length - until.length) + until);
  if (Math.abs(start) > 9999) return;
  return {
    start,
    ...(end !== undefined && end !== start ? { end } : {}),
    label: clean(whole.replace(/[:\-–),.]\s*$/u, "")),
  };
}

const podRe =
  /^(?:P\.?\s?O\.?\s?D\.?|punto di divergenza|point de divergence|punto de divergencia)(?=[\s:.,;-]|$)/i;
const inviteRe =
  /scrivete(?:ci|mi)|scrivi(?:ci|mi)|écrivez|escribid|escríbanos|a quest[oa] indirizzo|per contribuire|per suggerimenti|se volete (?:farmi|fornirmi|farci|dirmi|commentare)/i;
const navRe =
  /^(?:torna(?:re)? (?:indietro|alla|all')|indietro|avanti|retour|volver|home)\b/i;

/** Classifies a contribution from the verbs of its opening line. */
export function contributionKind(intro: string): ContributionKind {
  const t = intro.toLowerCase();
  if (
    /rispond|rispost|replica|ribatte|obietta|fa notare|fa osservare|precisa|controbatte|répond|responde/.test(
      t,
    )
  )
    return "reply";
  if (
    /variaz|variant|alternativ|propost|propon|versione|ucroni|uchroni|scenario|ipotesi|idea|idee|lavoro|racconto|cronologia|sviluppa/.test(
      t,
    )
  )
    return "variant";
  if (/aggiung|integra|complet|ajoute|añade|prosegu|continua/.test(t))
    return "addition";
  return "comment";
}

const isIntro = (b: Block) =>
  b.names.length > 0 &&
  b.text.length <= 260 &&
  !inviteRe.test(b.text) &&
  (/:\s*$/.test(b.text) ||
    (b.text.length <= 140 && (/!\s*$/.test(b.text) || /:\s/.test(b.text))));

const isSignature = (b: Block, author?: string) =>
  b.text.length > 0 &&
  b.text.length <= 60 &&
  !/[:;?]$/.test(b.text) &&
  ((b.names.length > 0 && norm(b.names.join(" ")) === norm(b.text)) ||
    (author !== undefined && b.bold && norm(b.text) === norm(author)));

const authorLine = (text: string) =>
  /^(?:di|de|by|par|por)\s+(.+)$/iu.exec(text)?.[1]?.replace(/\s*\(.*\)$/, "");

/** Splits a segment's blocks into lead text, POD and dated entries. */
function structure(segment: Segment, body: Block[], idPrefix: string): void {
  const dated = body.filter((b) => leadingDate(b.text)).length;
  const chronology = dated >= 3;
  let current: Entry | undefined;
  let lastStart: number | undefined;
  let n = 0;
  for (const b of body) {
    if (!segment.pod && podRe.test(b.text)) {
      segment.pod = { id: `${idPrefix}-pod`, blocks: [b] };
      // Kept in reading order: some pages state the POD mid-chronology.
      segment.entries.push(segment.pod);
      current = segment.pod;
      continue;
    }
    let date = chronology ? leadingDate(b.text) : undefined;
    // In a BC chronology later entries often drop the era: 1379 av. J-C.,
    // then "1352-1312 :". Keep the era while years keep falling.
    if (
      date &&
      date.start > 0 &&
      lastStart !== undefined &&
      lastStart < 0 &&
      date.start <= -lastStart + 50 &&
      !/d\.?\s?C|ap\.?\s?J|AD/i.test(date.label)
    )
      date = {
        ...date,
        start: -date.start,
        ...(date.end ? { end: -date.end } : {}),
      };
    if (date) {
      lastStart = date.start;
      current = { id: `${idPrefix}-e${++n}`, date, blocks: [b] };
      segment.entries.push(current);
    } else if (current) current.blocks.push(b);
    else segment.lead.push(b);
  }
}

function isNavigationGraphic(block: Block): boolean {
  if (!block.image || block.text) return false;
  const $ = load(block.html);
  return (
    $("a[href]")
      .toArray()
      .some((a) =>
        /^(?:mailto:)|(?:^|\/)(?:index|lista_ucronie|lavori)\.html?(?:#.*)?$/i.test(
          $(a).attr("href") ?? "",
        ),
      ) ||
    $("img")
      .toArray()
      .some((img) =>
        /(?:logo|e-?mail|torna indietro)/i.test(
          [$(img).attr("alt"), $(img).attr("title")].join(" "),
        ),
      )
  );
}

export function anatomy(html: string, documentTitle: string): Anatomy {
  const all = blocks(html, true);
  const dropped: string[] = [];
  const removed = new Set<Block>();
  // Header: everything up to the first rule, if the rule comes early.
  const firstHr = all.findIndex((b) => b.hr && !b.text);
  const candidate = firstHr >= 0 && firstHr <= 8 ? all.slice(0, firstHr) : [];
  const sourceTitle = norm(documentTitle.replace(/^\[[^\]]*\]\s*/, ""));
  const metadataOnly = candidate.every((b) =>
    !b.text
      ? !b.image || isNavigationGraphic(b)
      : b.marquee ||
        Boolean(authorLine(b.text)) ||
        norm(b.text) === sourceTitle,
  );
  // An early horizontal rule is not proof that preceding prose is a header.
  const headerEnd = candidate.length > 0 && metadataOnly ? firstHr + 1 : 0;
  const header = all.slice(0, headerEnd);
  // The header's title and author line are shown in the page header instead.
  for (const b of header) removed.add(b);
  let rest = all.slice(headerEnd);
  const marquee = header.find((b) => b.marquee)?.text;
  const title =
    marquee ||
    clean(documentTitle.replace(/^\[[^\]]*\]\s*/, "")) ||
    header.find((b) => b.bold)?.text ||
    "Senza titolo";
  const authors: string[] = [];
  for (const b of header) {
    const a = authorLine(b.text);
    if (a) authors.push(clean(a));
  }
  // Footer: navigation, logo and contact lines after the last rule.
  while (rest.length) {
    const b = rest.at(-1) as Block;
    if (
      (b.hr && !b.text) ||
      (navRe.test(b.text) && load(b.html)("a[href]").length > 0) ||
      isNavigationGraphic(b) ||
      (inviteRe.test(b.text) && b.text.length < 200) ||
      b.text === "."
    ) {
      if (b.text && b.text !== ".") dropped.push(b.text);
      removed.add(b);
      rest = rest.slice(0, -1);
    } else break;
  }
  const pieceTitles = rest.filter((b) => b.anchor && b.bold).length;
  const collection = pieceTitles >= 3;
  const segments: Segment[] = [];
  const main: Segment = {
    id: "main",
    role: "main",
    author: authors[0],
    lead: [],
    entries: [],
  };
  segments.push(main);
  const bodies = new Map<Segment, Block[]>([[main, []]]);
  let current = main;
  let pieceOwner: Segment = main;
  let contributions = 0;
  let pieces = 0;
  for (const b of rest) {
    const body = bodies.get(current) as Block[];
    if ((b.hr && !b.text) || b.text === "." || b.text === "*") {
      if (b.anchors?.length) {
        body.push(b);
        continue;
      }
      removed.add(b);
      continue;
    }
    if (inviteRe.test(b.text) && b.text.length < 200) {
      dropped.push(b.text);
      removed.add(b);
      continue;
    }
    if (collection && b.anchor && b.bold) {
      // A picture placed inside the title line ("<img …><a name=Cesare>")
      // opens the piece's body instead of being lost with the markup.
      const $title = load(b.html);
      const pictures = b.image
        ? $title("img")
            .toArray()
            .map((img) => $title.html(img))
            .join("")
        : "";
      current = {
        id: `p${++pieces}`,
        role: "piece",
        title: b.text,
        anchors: b.anchors,
        ...(b.anchor ? { anchor: b.anchor } : {}),
        lead: pictures
          ? [
              {
                ...b,
                html: `<p>${pictures}</p>`,
                text: "",
                names: [],
                anchor: undefined,
                anchors: [],
                bold: false,
              },
            ]
          : [],
        entries: [],
      };
      pieceOwner = current;
      segments.push(current);
      bodies.set(current, []);
      continue;
    }
    const by = authorLine(b.text);
    if (by && b.text.length < 80 && !body.length && !current.author) {
      current.author = clean(by);
      current.byline = b.text;
      current.anchors = [...(current.anchors ?? []), ...(b.anchors ?? [])];
      continue;
    }
    if (isSignature(b, current.author)) {
      current.signed = b.text;
      if (!current.author) current.author = b.names[0] ?? b.text;
      // The signature stays where it was: text may follow it.
      body.push(b);
      continue;
    }
    // An opening line directly after another one is that contribution's text.
    if (isIntro(b) && !(current.role === "contribution" && !body.length)) {
      const speaker =
        b.names.find((n) => !/^(questo|quest'|qui)$/i.test(n)) ?? b.names[0];
      // "Ecco le idee di MAS:" right after the header opens the main text.
      if (
        current === main &&
        !body.length &&
        (!main.author || norm(main.author) === norm(speaker))
      ) {
        main.author ??= speaker;
        body.push(b);
        continue;
      }
      const kind = contributionKind(b.text);
      const previous = segments.filter(
        (s) => s.role === "contribution" && s.id.startsWith(pieceOwner.id),
      );
      // A reply answers the last contribution by someone else, or the author.
      const target = [pieceOwner, ...previous]
        .reverse()
        .find((s) => s.author && norm(s.author) !== norm(speaker));
      current = {
        id: `${pieceOwner.id}-c${++contributions}`,
        role: "contribution",
        author: speaker,
        intro: b.text,
        introBlock: b,
        kind,
        ...(kind === "reply" && target ? { replyTo: target.id } : {}),
        lead: [],
        entries: [],
      };
      segments.push(current);
      bodies.set(current, []);
      continue;
    }
    body.push(b);
  }
  for (const s of segments) structure(s, bodies.get(s) ?? [], s.id);
  const shape = collection
    ? "collection"
    : main.entries.filter((e) => e.date).length >= 3
      ? "chronology"
      : segments.length > 2
        ? "discussion"
        : "narrative";
  return {
    title,
    headerText: header.map((block) => block.text).filter(Boolean),
    authors: [
      ...new Set(
        [...authors, main.author].filter((a): a is string => Boolean(a)),
      ),
    ],
    shape,
    segments,
    dropped,
    blocks: all,
    removed,
    headerAnchors: header.flatMap((b) => b.anchors ?? []),
    footerAnchors: [...removed]
      .filter((b) => !header.includes(b))
      .flatMap((b) => b.anchors ?? []),
  };
}

/** Removes the leading date text from a block so it can hang in the margin. */
export function stripLeadingText(
  html: string,
  label: string,
): { html: string; separator: string } {
  const $: CheerioAPI = load(`<div id="root">${html}</div>`);
  let remaining = label.replace(/\s/g, "").length;
  let separator = true;
  let removedSeparator = "";
  const visit = (node: AnyNode): boolean => {
    if (node.type === "text") {
      let data = node.data;
      let i = 0;
      while (i < data.length && remaining > 0) {
        if (!/\s/.test(data[i])) remaining--;
        i++;
      }
      data = data.slice(i);
      if (remaining === 0 && separator) {
        const m = /^\s*[:\-–),.]?\s*/u.exec(data);
        if (data.length) {
          removedSeparator = (m?.[0] ?? "").trim();
          data = data.slice(m?.[0].length ?? 0);
          separator = false;
        }
      }
      node.data = data;
      return remaining === 0 && !separator;
    }
    if (node.type === "tag")
      for (const child of [...(node as Element).children])
        if (visit(child)) return true;
    return false;
  };
  visit($("#root")[0]);
  return { html: $("#root").html() ?? html, separator: removedSeparator };
}
