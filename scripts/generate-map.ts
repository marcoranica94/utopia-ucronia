import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import type { EditorialItem, EditorialMap } from "../src/editorial/model.ts";
import { mapSchema } from "../src/editorial/model.ts";
import { blocks } from "./anatomy.ts";
import { decode, documentTitle } from "./conversion.ts";
import {
  attributionNames,
  authorId,
  documentId,
  itemId,
  itemSlug,
  proposed,
  redact,
  unknownClassification,
} from "./editorial-core.ts";
import { preserveOwnerDecisions } from "./editorial-review.ts";
import {
  isRecovered,
  readManifest,
  safePath,
  sha256,
  urlKey,
  writeJson,
} from "./recovery/core.ts";
import { applyDecisions, readDecisions } from "./review-decisions.ts";

const manifest = await readManifest();
const recovered = manifest.documents.filter(
  (d) => isRecovered(d) && d.path && d.sha256,
);
const map: EditorialMap = {
  version: 1,
  manifestDigest: sha256(Buffer.from(JSON.stringify(manifest))),
  documents: [],
  authors: [],
  eras: [],
  places: [],
  themes: [],
  proposals: [],
  items: [],
};
const authorRegistry = new Map<string, EditorialMap["authors"][number]>();
const registerAuthor = (raw: string, docId: string, quote: string) => {
  const name = redact(raw);
  if (
    name === "[email removed]" ||
    !name ||
    name.length < 2 ||
    name.length > 90 ||
    /^(?:qui|qua|quest|clicca|click|indirizzo|e-mail|email|scriv|contatt|nostr|sito|home|web|per\s)/i.test(
      name,
    )
  )
    return;
  const id = authorId(name);
  const existing = authorRegistry.get(id);
  if (existing) {
    if (!existing.documents.includes(docId)) existing.documents.push(docId);
  } else
    authorRegistry.set(id, {
      id,
      name,
      documents: [docId],
      review: proposed(
        "A name/pseudonym appears in an original author line or contact label; no identity or alias equivalence is inferred.",
        quote,
      ),
    });
  return id;
};
const trial = JSON.parse(await readFile("data/trial.json", "utf8")) as {
  documents: { url: string; language?: "it" | "fr" | "es" }[];
};
const knownLanguage = new Map(
  trial.documents
    .filter((d) => d.language)
    .map((d) => [urlKey(d.url), d.language ?? ("unknown" as const)]),
);
const htmlPages: {
  document: EditorialMap["documents"][number];
  html: string;
  title: string;
  text: string;
  authors: string[];
  links: { text: string; key?: string }[];
  index: boolean;
  frames: boolean;
}[] = [];
for (const d of recovered) {
  if (!d.path || !d.sha256)
    throw new Error(`Recovered document lacks provenance: ${d.url}`);
  const document = {
    id: documentId(d.url),
    url: d.url,
    path: d.path,
    sha256: d.sha256,
    mediaType: d.type ?? "application/octet-stream",
    source: d.source ?? ("wayback" as const),
    ...(d.timestamp ? { timestamp: d.timestamp } : {}),
    ...(d.retrievedAt ? { retrievedAt: d.retrievedAt } : {}),
  };
  map.documents.push(document);
  if (!/html/i.test(document.mediaType)) {
    map.proposals.push({
      id: `proposal-${document.id}`,
      documents: [document.id],
      action: "attachment",
      level: "none",
      targets: [],
      review: proposed(
        "Retain as an immutable archive resource; publication depends on the referencing content and supported media type.",
        document.path,
      ),
    });
    continue;
  }
  const raw = await readFile(safePath("archive/original", document.path));
  if (sha256(raw) !== document.sha256)
    throw new Error(`Original changed: ${document.path}`);
  const html = decode(raw);
  const $ = load(html);
  $("script,style,noscript").remove();
  const title = redact(documentTitle(html).replace(/^\[ucronia\]\s*/i, ""));
  const text = redact($("body").text());
  const authors: string[] = [];
  const firstLines = $("p,h1,h2,h3")
    .toArray()
    .slice(0, 12)
    .map((e) => redact($(e).text()));
  for (const line of firstLines) {
    const match = /^(?:di|de|par|por|by)\s+(.+)$/i.exec(line);
    if (match && line.length < 95) {
      const id = registerAuthor(match[1], document.id, line);
      if (id && !authors.includes(id)) authors.push(id);
    }
  }
  for (const e of $('a[href^="mailto:" i]').toArray())
    registerAuthor($(e).text(), document.id, $(e).parent().text());
  const links = $("a[href]")
    .toArray()
    .map((e) => {
      const href = $(e).attr("href") ?? "";
      let key: string | undefined;
      try {
        key = urlKey(new URL(href, d.url).href.split("#")[0]);
      } catch {}
      return { text: redact($(e).text()), key };
    });
  const index =
    /\/(?:lista_ucronie|lavori|index|chisiamo|introduzione|ultimi|classifica|uchronies_en_francais|ucronias_en_espanol)(?:[_.]|$)/i.test(
      urlKey(d.url),
    ) || urlKey(d.url).endsWith("/");
  htmlPages.push({
    document,
    html,
    title,
    text,
    authors,
    links,
    index,
    frames: $("frameset").length > 0,
  });
  if (htmlPages.length % 100 === 0)
    console.log(`Map inventory: ${htmlPages.length} HTML pages read`);
}
const inferLanguage = (p: (typeof htmlPages)[number]) => {
  const explicit = knownLanguage.get(urlKey(p.document.url));
  if (explicit)
    return {
      value: explicit,
      review: proposed(
        "Language verified in the deliberately selected trial.",
        p.title,
      ),
    };
  const folder = /uchroniesenfrancais/i.test(p.document.path)
    ? "fr"
    : /ucroniasenespanol/i.test(p.document.path)
      ? "es"
      : undefined;
  if (folder)
    return {
      value: folder as "fr" | "es",
      review: proposed(
        "Proposed from the original language section; retained as unreviewed.",
        p.title,
      ),
    };
  const declared = load(p.html)("html")
    .attr("lang")
    ?.split("-")[0]
    .toLowerCase();
  if (declared && ["it", "fr", "es", "en"].includes(declared))
    return {
      value: declared as "it" | "fr" | "es" | "en",
      review: proposed(
        "Language declared by the source HTML, pending editorial review.",
        p.title,
      ),
    };
  const text = p.text.slice(0, 12000).toLowerCase();
  const words = {
    it: /\b(?:della|delle|degli|gli|che|nella|anche|sono|questo)\b/g,
    fr: /\b(?:les|des|une|dans|pour|avec|sont|cette|mais)\b/g,
    es: /\b(?:los|las|una|del|para|como|pero|esta|con)\b/g,
    en: /\b(?:the|with|from|this|which|would|their|were)\b/g,
  };
  const ranking = Object.entries(words)
    .map(([lang, re]) => ({ lang, count: [...text.matchAll(re)].length }))
    .sort((a, b) => b.count - a.count);
  const best = ranking[0];
  const value =
    best.count >= 5 && best.count > ranking[1].count * 1.3
      ? (best.lang as "it" | "fr" | "es" | "en")
      : ("unknown" as const);
  return {
    value,
    review: proposed(
      value === "unknown"
        ? "Insufficient language evidence; do not silently label the text Italian."
        : "Proposed from the source's function words; not an owner-approved attribution.",
      p.text.slice(0, 220),
    ),
  };
};
const languageCache = new Map<string, ReturnType<typeof inferLanguage>>();
const language = (p: (typeof htmlPages)[number]) => {
  let value = languageCache.get(p.document.id);
  if (!value) {
    value = inferLanguage(p);
    languageCache.set(p.document.id, value);
  }
  return structuredClone(value);
};
const baseItem = (
  p: (typeof htmlPages)[number],
  title = p.title,
  selector = "whole",
  level: "work" | "divergence" = "work",
): EditorialItem => ({
  id: itemId(p.document.url, selector),
  slug: itemSlug(title, p.document.url, selector),
  title,
  level,
  authors: [...p.authors],
  language: language(p),
  sources: [
    {
      documentId: p.document.id,
      url: p.document.url,
      ...(p.document.timestamp ? { timestamp: p.document.timestamp } : {}),
      selection: { kind: "whole" },
    },
  ],
  classification: unknownClassification(p.text.slice(0, 220)),
  contributions: [],
  developedIn: [],
  composition: "single",
  review: proposed(
    level === "divergence"
      ? "A separately titled prompt in the original list; preserve its complete source paragraph."
      : "A recovered text page; preserve the source and propose its editorial role for progressive review.",
    p.text.slice(0, 220),
  ),
});
const pageItems = new Map<string, EditorialItem>();
for (const p of htmlPages) {
  if (p.frames) {
    map.proposals.push({
      id: `proposal-${p.document.id}`,
      documents: [p.document.id],
      action: "discard",
      level: "none",
      targets: [],
      review: proposed(
        "Technical frameset, not an independent content item. Discard applies only to new-edition output, never to the original.",
        p.title,
      ),
    });
    continue;
  }
  if (p.index) {
    map.proposals.push({
      id: `proposal-${p.document.id}`,
      documents: [p.document.id],
      action: "index",
      level: "none",
      targets: [],
      review: proposed(
        "Original navigation or prompt index, used as a metadata source rather than invented as a new work.",
        p.title,
      ),
    });
    continue;
  }
  if (p.text.length < 100) {
    map.proposals.push({
      id: `proposal-${p.document.id}`,
      documents: [p.document.id],
      action: "discard",
      level: "none",
      targets: [],
      review: proposed(
        "Short technical/title page proposed for source-only retention; not deleted from the archive.",
        p.text || p.title,
      ),
    });
    continue;
  }
  const item = baseItem(p);
  map.items.push(item);
  pageItems.set(urlKey(p.document.url), item);
  map.proposals.push({
    id: `proposal-${p.document.id}`,
    documents: [p.document.id],
    action: "work",
    level: "work",
    targets: [item.id],
    review: item.review,
  });
}
// A merge needs an explicit ordinal in the title, the same stated author,
// contiguous parts and an original continuation link. Numbered filenames alone
// are never evidence: the two 25 July texts intentionally remain independent.
const ordinals = [
  "prima",
  "seconda",
  "terza",
  "quarta",
  "quinta",
  "sesta",
  "settima",
  "ottava",
  "nona",
  "decima",
];
const families = new Map<
  string,
  { page: (typeof htmlPages)[number]; order: number; base: string }[]
>();
for (const p of htmlPages.filter(
  (p) => !p.index && !p.frames && p.authors.length,
)) {
  const m =
    /^(.*?)[,:\s]+(prima|seconda|terza|quarta|quinta|sesta|settima|ottava|nona|decima) parte[.!]?$/i.exec(
      p.title,
    );
  if (!m) continue;
  const key = `${m[1].toLowerCase()}:${p.authors.join(",")}`;
  const part = {
    page: p,
    order: ordinals.indexOf(m[2].toLowerCase()) + 1,
    base: m[1],
  };
  families.set(key, [...(families.get(key) ?? []), part]);
}
let merged = 0;
for (const parts of families.values()) {
  parts.sort((a, b) => a.order - b.order);
  if (parts.length < 2 || parts.some((p, i) => p.order !== i + 1)) continue;
  const keys = new Set(parts.map((p) => urlKey(p.page.document.url)));
  if (
    !parts.some((p) =>
      p.page.links.some(
        (l) =>
          l.key &&
          keys.has(l.key) &&
          /continua|seguito|seconda parte|terza parte|quarta parte|quinta parte/i.test(
            l.text,
          ),
      ),
    )
  )
    continue;
  const item = baseItem(parts[0].page, parts[0].base);
  item.composition = "chapters";
  item.sources = parts.map(({ page: p }) => ({
    documentId: p.document.id,
    url: p.document.url,
    ...(p.document.timestamp ? { timestamp: p.document.timestamp } : {}),
    selection: { kind: "whole" as const },
  }));
  item.review = proposed(
    "Merge explicitly numbered parts with the same stated author and source continuation links, preserving their original order as chapters.",
    parts.map((p) => p.page.title).join("; "),
  );
  for (const part of parts) {
    const previous = pageItems.get(urlKey(part.page.document.url));
    if (previous) map.items = map.items.filter((i) => i.id !== previous.id);
    pageItems.set(urlKey(part.page.document.url), item);
    const proposal = map.proposals.find(
      (p) => p.documents[0] === part.page.document.id,
    );
    if (!proposal) throw new Error("Missing source proposal");
    proposal.action = "merge";
    proposal.targets = [item.id];
    proposal.review = item.review;
  }
  map.items.push(item);
  merged++;
}
let prompts = 0;
let pieces = 0;
const knownAuthors = [...authorRegistry.values()].sort(
  (a, b) => b.name.length - a.name.length,
);
for (const p of htmlPages.filter((p) => !p.frames)) {
  const promptIndex = /\/lista_ucronie_[0-8](?:_|\.)/i.test(
    urlKey(p.document.url),
  );
  const $ = load(p.html);
  const possibleCollection = !p.index && $("a[name]").length >= 3;
  if (!promptIndex && !possibleCollection) continue;
  const bs = blocks(p.html);
  const headings = bs
    .map((b, index) => ({ b, index }))
    .filter(
      ({ b }) =>
        b.anchor &&
        b.bold &&
        b.text.length > 2 &&
        b.text.length < 180 &&
        !/:$/.test(b.text),
    );
  const selected = promptIndex
    ? bs
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => {
          const w = load(b.html);
          const red = w("font[color]")
            .toArray()
            .find((e) => /^#?ff0000$|^red$/i.test(w(e).attr("color") ?? ""));
          const title = red ? redact(w(red).text()) : "";
          return (
            title.length >= 3 &&
            title.length < 180 &&
            b.text.startsWith(title) &&
            b.text.length > title.length + 30
          );
        })
    : headings.length >= 3
      ? headings
      : [];
  const targets: string[] = [];
  for (const { b, index } of selected) {
    const w = load(b.html);
    const red = w("font[color]")
      .toArray()
      .find((e) => /^#?ff0000$|^red$/i.test(w(e).attr("color") ?? ""));
    const title = redact(promptIndex && red ? w(red).text() : b.text).replace(
      /[.:]\s*$/,
      "",
    );
    const end = promptIndex
      ? index + 1
      : (headings.find((h) => h.index > index)?.index ?? bs.length);
    const selector = `blocks:${index}:${end}`;
    const item = baseItem(
      p,
      title,
      selector,
      promptIndex ? "divergence" : "work",
    );
    item.sources[0].selection = {
      kind: "blocks",
      start: index,
      end,
      digest: sha256(
        Buffer.from(
          bs
            .slice(index, end)
            .map((b) => b.html)
            .join("\n"),
        ),
      ),
      ...(b.anchor ? { anchor: b.anchor } : {}),
    };
    if (!promptIndex) item.parent = pageItems.get(urlKey(p.document.url))?.id;
    const tail = /\(([^()]*)\)\s*[.!]?\s*$/.exec(b.text)?.[1] ?? "";
    const labels = attributionNames(
      b.names,
      tail,
      knownAuthors.map((a) => a.name),
    );
    item.authors = [
      ...new Set(
        labels
          .map((name) => registerAuthor(name, p.document.id, tail || b.text))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    item.review = proposed(
      promptIndex
        ? "Split the original list at its explicitly colored title, preserving the whole prompt and its attribution."
        : "Propose a separately titled, anchored piece from a collective page; retain the parent as context pending review.",
      b.text.slice(0, 250),
    );
    if (promptIndex)
      item.classification.kind = {
        value: "uchronia",
        review: proposed(
          "The source explicitly lists this paragraph among its uchronia prompts.",
          p.title,
        ),
      };
    map.items.push(item);
    targets.push(item.id);
    if (promptIndex) prompts++;
    else pieces++;
  }
  if (targets.length) {
    const proposal = map.proposals.find(
      (x) => x.documents[0] === p.document.id,
    );
    if (!proposal) throw new Error("Missing source proposal");
    proposal.action = "split";
    proposal.level = promptIndex ? "divergence" : "work";
    proposal.targets = [...proposal.targets, ...targets];
    proposal.review = proposed(
      promptIndex
        ? "Extract individually titled divergence prompts from the list."
        : "Split candidates have explicit source anchors and headings; proposals remain unapproved.",
      p.title,
    );
  }
}
const blockCache = new Map<string, ReturnType<typeof blocks>>();
for (const item of map.items.filter((i) => i.level === "divergence")) {
  const source = item.sources[0];
  if (source.selection.kind !== "blocks") continue;
  const p = htmlPages.find((p) => p.document.id === source.documentId);
  if (!p) throw new Error(`Missing HTML source: ${source.documentId}`);
  let bs = blockCache.get(source.documentId);
  if (!bs) {
    bs = blocks(p.html);
    blockCache.set(source.documentId, bs);
  }
  const w = load(
    bs
      .slice(source.selection.start, source.selection.end)
      .map((b) => b.html)
      .join("\n"),
  );
  for (const e of w("a[href]").toArray())
    try {
      const target = pageItems.get(
        urlKey(new URL(w(e).attr("href") ?? "", source.url).href.split("#")[0]),
      );
      if (target && !item.developedIn.includes(target.id))
        item.developedIn.push(target.id);
    } catch {}
}
map.authors = [...authorRegistry.values()];
// Preserve deliberate owner decisions when regenerating the proposal map.
try {
  const rawPrevious = JSON.parse(await readFile("data/map.yaml", "utf8"));
  for (const item of rawPrevious.items)
    if (!item.composition && item.sources.length > 1)
      item.composition = "chapters";
  const previous = mapSchema.parse(rawPrevious);
  preserveOwnerDecisions(map, previous);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
applyDecisions(map, await readDecisions());
map.items.sort((a, b) => a.id.localeCompare(b.id));
map.documents.sort((a, b) => a.id.localeCompare(b.id));
map.authors.sort((a, b) => a.id.localeCompare(b.id));
map.proposals.sort((a, b) => a.id.localeCompare(b.id));
mapSchema.parse(map);
// One object per line: valid JSON-compatible YAML 1.2, with reviewable diffs and no parser dependency.
const serialized =
  "{\n" +
  Object.entries(map)
    .map(
      ([key, value]) =>
        `  ${JSON.stringify(key)}: ${Array.isArray(value) ? `[\n${value.map((v) => `    ${JSON.stringify(v)}`).join(",\n")}\n  ]` : JSON.stringify(value)}`,
    )
    .join(",\n") +
  "\n}\n";
await writeFile("data/map.yaml", serialized);
await writeJson("reports/editorial-map.json", {
  documents: map.documents.length,
  html: htmlPages.length,
  items: map.items.length,
  authors: map.authors.length,
  prompts,
  pieces,
  mergedFamilies: merged,
  actions: Object.fromEntries(
    [...new Set(map.proposals.map((p) => p.action))].map((action) => [
      action,
      map.proposals.filter((p) => p.action === action).length,
    ]),
  ),
  ownerApproved: map.proposals.filter(
    (p) => p.review.by === "owner" && p.review.state === "approved",
  ).length,
});
console.log(
  `Map ready: ${map.documents.length} documents, ${map.items.length} proposed items, ${prompts} prompts, ${pieces} anchored pieces, ${merged} explicit merges.`,
);
