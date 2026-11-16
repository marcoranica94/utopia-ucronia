/**
 * Interface strings. The site interface is bilingual: Italian at the root,
 * English under /en/. The stories themselves always stay in their original
 * language (Italian, French, Spanish) and are never translated.
 */
export const languages = ["it", "en"] as const;
export type Lang = (typeof languages)[number];

const it = {
  "site.version": "Versione",
  "site.skip": "Vai al contenuto",
  "site.home": "UtopiaUcronia, pagina iniziale",
  "site.navLabel": "Navigazione principale",
  "site.nav.works": "Ucronie",
  "site.nav.tree": "Albero",
  "site.nav.preview": "Anteprima",
  "site.footer": "Archivio in lavorazione. Testi e attribuzioni in revisione.",
  "site.languageLabel": "Lingua dell’interfaccia",
  "theme.toggle": "Tema",
  "theme.auto": "Auto",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",
  "home.title": "Le storie possibili",
  "home.kicker": "Un archivio di storie possibili",
  "home.heading": "Storie di altri mondi",
  "home.lede":
    "UtopiaUcronia raccoglie racconti, mappe e idee di storia alternativa. Questa è la prima selezione convertita dall’archivio recuperato.",
  "home.featureTitle": "Ogni storia apre un ramo",
  "home.featureText":
    "Tre punti di partenza, molte strade possibili. L’albero guida alle prime ucronie campione.",
  "home.featureLink": "Esplora l’albero delle ucronie",
  "home.catalogTitle": "Le ucronie",
  "home.count.one": "testo disponibile",
  "home.count.many": "testi disponibili",
  "home.filters": "Filtra i documenti",
  "home.search": "Titolo o autore",
  "home.searchPlaceholder": "Es. 25 luglio",
  "home.language": "Lingua",
  "home.allLanguages": "Tutte le lingue",
  "lang.it": "Italiano",
  "lang.fr": "Francese",
  "lang.es": "Spagnolo",
  "home.gaps": "Contiene collegamenti o immagini da verificare",
  "home.recovered": "Testo recuperato",
  "home.empty":
    "Nessun documento corrisponde ai filtri. Prova un altro titolo o una lingua diversa.",
  "home.none": "I primi testi appariranno qui dopo la conversione.",
  "home.note":
    "La raccolta è in revisione: titoli, attribuzioni e collegamenti saranno controllati durante la conversione editoriale.",
  "tree.title": "Albero delle possibilità",
  "tree.kicker": "Tre divergenze campione",
  "tree.heading": "L’albero delle possibilità",
  "tree.lede":
    "Ogni ramo parte da una domanda diversa. Scegli una storia per leggerla; l’elenco resta disponibile anche senza il disegno.",
  "tree.stage":
    "I punti color rame aprono le tre ucronie campione. Gli altri rami mostrano come la raccolta potrà crescere.",
  "tree.navLabel": "Scegli un ramo",
  "tree.follow": "Segui un ramo",
  "tree.open": "Apri",
  "tree.group": "Tre ucronie nell’albero delle possibilità",
  "tree.caveat":
    "Le date qui seguono i testi campione e saranno verificate durante la catalogazione. La vista completa dell’albero arriverà quando ogni opera avrà il suo punto di divergenza.",
  "tree.akhenaton": "E se il culto di Aton fosse sopravvissuto?",
  "tree.spot": "Una mappa diventa il punto di partenza di più storie.",
  "tree.farinacci":
    "Una decisione diversa al Gran Consiglio cambia il percorso della guerra.",
  "tree.bc14": "XIV secolo a.C.",
  "tree.preview": "Anteprima grafica",
  "gaps.title": "Materiale non disponibile",
  "gaps.kicker": "Archivio in lavorazione",
  "gaps.heading": "Questo materiale non è ancora disponibile",
  "gaps.text1":
    "Il collegamento può indicare una pagina non ancora convertita, una risorsa esterna esclusa o un file senza una copia valida.",
  "gaps.text2":
    "La lacuna è registrata nel rapporto di conversione; il collegamento originale resta nel file d’archivio.",
  "back.works": "← Torna alle ucronie",
  "work.kicker": "Documento recuperato",
  "work.review": "Testo in revisione editoriale.",
  "work.reviewGaps": "Alcuni collegamenti o immagini richiedono un controllo:",
  "work.reviewGapsLink": "vedi le lacune note",
  "work.provenance": "Provenienza",
  "work.captured": "Cattura del {date}",
  "work.fromOrigin": "File recuperato dal sito originale",
  "work.kept": "Il file originale resta conservato nell’archivio.",
  "work.by": "di {names}",
  "work.withOne": ", con interventi di un altro autore",
  "work.withMany": ", con interventi di altri {n} autori",
  "work.source": "Fonte: {url}",
  "work.sourceCaptured": "Fonte: {url}, cattura del {date}.",
  "work.automatic":
    "Struttura riconosciuta automaticamente dalla pagina originale: sezioni, date e tipi di intervento possono contenere errori.",
  "work.language.fr": "Testo in francese.",
  "work.language.es": "Testo in spagnolo.",
  "work.language.it": "",
  "shape.chronology": "Cronologia",
  "shape.discussion": "Proposta e discussione",
  "shape.narrative": "Racconto",
  "shape.collection": "Raccolta",
  "count.stories.one": "racconto",
  "count.stories.many": "racconti",
  "count.dates.one": "data",
  "count.dates.many": "date",
  "count.contributions.one": "intervento",
  "count.contributions.many": "interventi",
  "count.variants.one": "variante",
  "count.variants.many": "varianti",
  "reader.branches": "I rami della storia",
  "reader.branchNote":
    "Ogni ramo è un racconto o una variante. Apri gli eventi per seguirne le date, nell’ordine del testo.",
  "reader.events": "Mostra gli eventi ({n})",
  "reader.contents": "Indice",
  "reader.dates": "Date nel testo",
  "reader.dateNote":
    "Eventi nell’ordine del racconto. Ogni data apre il passaggio corrispondente; gli interventi degli altri autori sono elencati separatamente.",
  "reader.main": "Il testo",
  "reader.top": "Torna su",
  "reader.tools": "Navigazione del testo",
  "reader.open": "Indice e rami della storia",
  "rail.toggle": "Indice del testo",
  "rail.label": "Struttura del testo",
  "rail.century": "{n} secolo",
  "rail.centuryBc": "{n} secolo a.C.",
  "outline.start": "Inizio",
  "outline.pod": "Punto di divergenza",
  "outline.chronology": "Cronologia",
  "outline.discussion": "Discussione",
  "outline.anonymous": "Anonimo",
  "outline.untitled": "Senza titolo",
  "part.main.discussion": "La proposta",
  "part.main.chronology": "L’ucronia",
  "part.main.narrative": "Il racconto",
  "part.main.collection": "Presentazione",
  "rail.ourHistory": "La nostra storia",
  "rail.uchronia": "Ucronia",
  "rail.sections": "Sezioni",
  "rail.voices": "Voci della discussione",
  "kind.comment": "Commento",
  "kind.addition": "Aggiunta",
  "kind.variant": "Variante",
  "kind.reply": "Risposta",
  "rail.kind.comment": "commento",
  "rail.kind.addition": "aggiunta",
  "rail.kind.variant": "variante",
  "rail.kind.reply": "risposta",
  replyTo: "in risposta a",
  earlier: "un intervento precedente",
  "discussion.note.one":
    "{n} intervento, nell’ordine in cui è apparso sul sito.",
  "discussion.note.many":
    "{n} interventi, nell’ordine in cui sono apparsi sul sito.",
  "notFound.title": "Pagina non trovata",
  "notFound.heading": "Questa pagina non è nell’archivio",
  "notFound.text":
    "Controlla l’indirizzo oppure torna alle ucronie disponibili.",
};

const en: Record<keyof typeof it, string> = {
  "site.version": "Version",
  "site.skip": "Skip to content",
  "site.home": "UtopiaUcronia, home page",
  "site.navLabel": "Main navigation",
  "site.nav.works": "Uchronias",
  "site.nav.tree": "Tree",
  "site.nav.preview": "Preview",
  "site.footer": "Archive in progress. Texts and attributions under review.",
  "site.languageLabel": "Interface language",
  "theme.toggle": "Theme",
  "theme.auto": "Auto",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "home.title": "Possible histories",
  "home.kicker": "An archive of possible histories",
  "home.heading": "Stories from other worlds",
  "home.lede":
    "UtopiaUcronia collects stories, maps and ideas of alternate history. This is the first selection converted from the recovered archive.",
  "home.featureTitle": "Every story opens a branch",
  "home.featureText":
    "Three starting points, many possible paths. The tree leads to the first sample uchronias.",
  "home.featureLink": "Explore the uchronia tree",
  "home.catalogTitle": "The collection",
  "home.count.one": "text available",
  "home.count.many": "texts available",
  "home.filters": "Filter the documents",
  "home.search": "Title or author",
  "home.searchPlaceholder": "E.g. 25 luglio",
  "home.language": "Language",
  "home.allLanguages": "All languages",
  "lang.it": "Italian",
  "lang.fr": "French",
  "lang.es": "Spanish",
  "home.gaps": "Contains links or images to check",
  "home.recovered": "Recovered text",
  "home.empty":
    "No document matches the filters. Try another title or a different language.",
  "home.none": "The first texts will appear here after conversion.",
  "home.note":
    "The collection is under review: titles, attributions and links will be checked during editorial conversion.",
  "tree.title": "Tree of possibilities",
  "tree.kicker": "Three sample divergences",
  "tree.heading": "The tree of possibilities",
  "tree.lede":
    "Each branch starts from a different question. Choose a story to read it; the list works without the drawing too.",
  "tree.stage":
    "The copper points open the three sample uchronias. The other branches show how the collection can grow.",
  "tree.navLabel": "Choose a branch",
  "tree.follow": "Follow a branch",
  "tree.open": "Open",
  "tree.group": "Three uchronias in the tree of possibilities",
  "tree.caveat":
    "These dates follow the sample texts and will be checked during cataloguing. The full tree will come when every work has its point of divergence.",
  "tree.akhenaton": "What if the cult of Aten had survived?",
  "tree.spot": "A map becomes the starting point of several stories.",
  "tree.farinacci":
    "A different decision at the Grand Council changes the course of the war.",
  "tree.bc14": "14th century BC",
  "tree.preview": "Design preview",
  "gaps.title": "Material not available",
  "gaps.kicker": "Archive in progress",
  "gaps.heading": "This material is not available yet",
  "gaps.text1":
    "The link may point to a page not converted yet, an excluded external resource or a file without a valid copy.",
  "gaps.text2":
    "The gap is recorded in the conversion report; the original link stays in the archive file.",
  "back.works": "← Back to the uchronias",
  "work.kicker": "Recovered document",
  "work.review": "Text under editorial review.",
  "work.reviewGaps": "Some links or images need checking:",
  "work.reviewGapsLink": "see the known gaps",
  "work.provenance": "Provenance",
  "work.captured": "Captured on {date}",
  "work.fromOrigin": "File recovered from the original site",
  "work.kept": "The original file is kept in the archive.",
  "work.by": "by {names}",
  "work.withOne": ", with contributions by one other author",
  "work.withMany": ", with contributions by {n} other authors",
  "work.source": "Source: {url}",
  "work.sourceCaptured": "Source: {url}, captured on {date}.",
  "work.automatic":
    "Structure recognised automatically from the original page: sections, dates and contribution types may contain errors.",
  "work.language.fr": "Text in French.",
  "work.language.es": "Text in Spanish.",
  "work.language.it": "Text in Italian.",
  "shape.chronology": "Chronology",
  "shape.discussion": "Proposal and discussion",
  "shape.narrative": "Story",
  "shape.collection": "Collection",
  "count.stories.one": "story",
  "count.stories.many": "stories",
  "count.dates.one": "date",
  "count.dates.many": "dates",
  "count.contributions.one": "contribution",
  "count.contributions.many": "contributions",
  "count.variants.one": "variant",
  "count.variants.many": "variants",
  "reader.branches": "Branches of the story",
  "reader.branchNote":
    "Each branch is a narrative or a variant. Open its events to follow the dates in the order of the text.",
  "reader.events": "Show events ({n})",
  "reader.contents": "Contents",
  "reader.dates": "Dates in the text",
  "reader.dateNote":
    "Events in narrative order. Each date opens the matching passage; other authors’ contributions are listed separately.",
  "reader.main": "The text",
  "reader.top": "Back to top",
  "reader.tools": "Reading navigation",
  "reader.open": "Contents and story branches",
  "rail.toggle": "Contents",
  "rail.label": "Structure of the text",
  "rail.century": "{n} century",
  "rail.centuryBc": "{n} century BC",
  "outline.start": "Beginning",
  "outline.pod": "Point of divergence",
  "outline.chronology": "Chronology",
  "outline.discussion": "Discussion",
  "outline.anonymous": "Anonymous",
  "outline.untitled": "Untitled",
  "part.main.discussion": "The proposal",
  "part.main.chronology": "The uchronia",
  "part.main.narrative": "The story",
  "part.main.collection": "Introduction",
  "rail.ourHistory": "Our history",
  "rail.uchronia": "Uchronia",
  "rail.sections": "Sections",
  "rail.voices": "Voices in the discussion",
  "kind.comment": "Comment",
  "kind.addition": "Addition",
  "kind.variant": "Variant",
  "kind.reply": "Reply",
  "rail.kind.comment": "comment",
  "rail.kind.addition": "addition",
  "rail.kind.variant": "variant",
  "rail.kind.reply": "reply",
  replyTo: "in reply to",
  earlier: "an earlier contribution",
  "discussion.note.one":
    "{n} contribution, in the order it appeared on the site.",
  "discussion.note.many":
    "{n} contributions, in the order they appeared on the site.",
  "notFound.title": "Page not found",
  "notFound.heading": "This page is not in the archive",
  "notFound.text": "Check the address or go back to the available uchronias.",
};

export type Key = keyof typeof it;
const dictionaries: Record<Lang, Record<Key, string>> = { it, en };

/** Returns the translator for a language; {name} placeholders are filled. */
export function useTranslations(lang: Lang) {
  return (key: Key, values: Record<string, string | number> = {}) =>
    dictionaries[lang][key].replace(/\{(\w+)\}/g, (_m, name) =>
      String(values[name] ?? `{${name}}`),
    );
}
export function isKey(key: string): key is Key {
  return key in it;
}

/** Path of the same page in a language: Italian at the root, English under /en/. */
export function localePath(lang: Lang, path: string): string {
  const bare = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return lang === "it" ? bare : `/en${bare === "/" ? "/" : bare}`;
}
export function pageLang(pathname: string): Lang {
  return /^\/en(\/|$)/.test(pathname) ? "en" : "it";
}

const roman = (n: number) => {
  const map: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
};
const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
};
/** "XII secolo" in Italian, "12th century" in English; negative years are BC. */
export function centuryLabel(lang: Lang, year: number): string {
  const t = useTranslations(lang);
  const n = Math.ceil(Math.abs(year) / 100);
  const name = lang === "it" ? roman(n) : ordinal(n);
  return t(year > 0 ? "rail.century" : "rail.centuryBc", { n: name });
}

/**
 * Fills the interface placeholders that the converter leaves in a work's
 * HTML (<span data-t="kind.variant"></span>) and keeps internal links in
 * the reader's language.
 */
export function localizeHtml(html: string, lang: Lang): string {
  const t = useTranslations(lang);
  return html
    .replace(
      /<span data-t="([\w.]+)"(?: data-n="(\d+)")?><\/span>/g,
      (whole, key: string, n?: string) => {
        const k =
          n !== undefined ? `${key}.${n === "1" ? "one" : "many"}` : key;
        return isKey(k) ? `<span>${t(k, { n: n ?? "" })}</span>` : whole;
      },
    )
    .replace(/href="\/(works|gaps)\//g, (whole, section: string) =>
      lang === "en" ? `href="/en/${section}/` : whole,
    );
}
