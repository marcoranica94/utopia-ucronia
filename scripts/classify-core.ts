import type { Vocabulary } from "../src/editorial/vocabulary.ts";

/** Pure helpers for scripts/classify.ts: evidence for agent proposals. */

/** Plain text of a converted item: no front matter, tags or entities. */
export function plainText(markdown: string) {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\([\\`*_[\]()#+\-.!~|])/g, "$1")
    .replace(/[*_#>[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The sentence around a match, trimmed for a quotation. */
export function sentenceAt(text: string, index: number) {
  // Start after the previous sentence end (or at the text start), at most
  // 200 characters back; end at the next sentence end, at most 200 ahead.
  const previous = Math.max(
    ...[". ", "! ", "? "].map((mark) => {
      const at = text.lastIndexOf(mark, index - 1);
      return at < 0 ? 0 : at + mark.length;
    }),
  );
  const start = Math.max(previous, index - 200, 0);
  const ends = [". ", "! ", "? "]
    .map((mark) => text.indexOf(mark, index))
    .filter((at) => at >= 0);
  const end = Math.min(...ends, index + 200, text.length);
  return text.slice(start, end + 1).trim();
}

const BC = String.raw`(?:a\.\s?C\.|avanti Cristo|av\.\s?J\.-C\.|a\.\s?de\s?C\.|a\.\s?C\b|BC|B\.C\.)`;
const yearRe = new RegExp(
  String.raw`(?<![\p{L}\d.,])(?:(\d{1,4})\s*${BC}|(1\d{3}|20\d{2}|[1-9]\d{2})(?:\s*(?:d\.\s?C\.|dopo Cristo))?)(?![\p{L}\d]|\s*(?:km|chilometri|metri|uomini|soldati|navi|persone|abitanti|anni|euro|lire|dollari|pagine|%))`,
  "u",
);

/** First year cited in the opening of a text (negative for BC). */
export function firstYear(text: string) {
  const opening = text.slice(0, 1500);
  const match = yearRe.exec(opening);
  if (!match) return undefined;
  const year = match[1] ? -Number(match[1]) : Number(match[2]);
  // A bare three-digit number is too weak unless marked as a date.
  if (!match[1] && match[2].length === 3 && !/d\.\s?C\.|Cristo/.test(match[0]))
    return undefined;
  return { year, index: match.index };
}

export function erasFor(vocab: Vocabulary, year: number) {
  return vocab.eras
    .filter(
      (era) =>
        !era.outsideTime &&
        era.start !== undefined &&
        era.end !== undefined &&
        era.start <= year &&
        year <= era.end,
    )
    .map((era) => era.id);
}

// Original "Tutti i nostri lavori" sections and the eras they can contain.
export const categoryEras: Record<string, string[]> = {
  ancient: ["prehistory", "ancient", "roman"],
  roman: ["roman", "ancient"],
  medieval: ["early-medieval", "1000-1299", "1300-1499"],
  modern: ["1500s", "1600s", "1700s", "1800s"],
  "1860-1940": ["1800s", "belle-epoque", "first-world-war", "second-world-war"],
  "1940-1960": ["second-world-war", "postwar"],
  "post-1960": ["postwar", "1970s-1990s", "2000s", "present-future"],
  fantasy: ["outside-time"],
};
export const categoryOnly: Record<string, string> = {
  roman: "roman",
  fantasy: "outside-time",
};

const k = (words: string) =>
  new RegExp(String.raw`(?<!\p{L})(?:${words})(?!\p{L})`, "giu");
export const placeWords: Record<string, RegExp> = {
  italy: k(
    `italia|italian[aeio]|italic[aeio]|milano|venezia|veneziani|napoli|firenze|torino|genova|sicilia|sardegna|piemonte|toscana|lombardia|savoia|italie|italia`,
  ),
  "western-europe": k(
    `francia|frances[ei]|parigi|inghilterra|ingles[ei]|londra|spagna|spagnol[aeio]|portogallo|portoghes[ei]|gallia|galli|britannia|scozia|irlanda|olanda|olandes[ei]|belgio|france|français|paris|angleterre|españa|españoles|inglaterra|francia`,
  ),
  "central-europe": k(
    `germania|tedesc[ahio]+|austria|austriac[ahio]+|prussia|prussian[aeio]|baviera|berlino|vienna|boemia|ungheria|unghers[ei]|polonia|polacc[ahio]+|svizzera|asburgo|asburgic[aeio]|sacro romano impero|allemagne|alemania`,
  ),
  "eastern-europe-russia": k(
    `russia|russ[aeio]|sovietic[aeio]|urss|mosca|zar|zarina|ucraina|balcani|serbia|serb[aeio]|bulgaria|romania|lituania|cosacch[ei]|russie|rusia`,
  ),
  "mediterranean-middle-east": k(
    `grecia|grec[aio]|greche|atene|sparta|egitto|egizi[aeo]?|egiziani|cartagine|cartaginesi|bisanzio|bizantin[aeio]|costantinopoli|persia|persian[aeio]|turchia|ottoman[aeio]|gerusalemme|israele|palestina|mesopotamia|babilonia|siria|mediterraneo|égypte|egipto`,
  ),
  africa: k(
    `africa|african[aeio]|etiopia|abissinia|congo|sudafrica|marocco|algeria|tunisia|zulu|nubia|afrique`,
  ),
  "south-asia": k(
    `india|indù|hindu|delhi|bengala|bengalese|pakistan|afghanistan|moghul|inde`,
  ),
  "east-asia": k(
    `cina|cines[ei]|giappone|giappones[ei]|corea|mongol[aio]|mongolia|manciù|tokyo|pechino|vietnam|indocina|samurai|shogun|chine|japon|china|japón`,
  ),
  "north-america": k(
    `stati uniti|americani|usa|washington|new york|canada|confederati|lincoln|kennedy|texas|california|nordamerica|états-unis|estados unidos`,
  ),
  "latin-america": k(
    `messico|messican[aeio]|aztec[ahio]+|inca|maya|brasile|argentina|cile|perù|cuba|caraibi|sudamerica|america latina|colombia|venezuela|mexique|méxico|brasil`,
  ),
  "oceania-poles": k(
    `australia|nuova zelanda|oceania|polinesia|antartide|antartico|polo nord|polo sud|artico|australie`,
  ),
  world: k(
    `tutto il mondo|il mondo intero|intero pianeta|scala mondiale|globale|globalizzazione`,
  ),
  imaginary: k(
    String.raw`terra di mezzo|atlantide|mordor|gondor|narnia|paperopoli|topolinia|westeros|regno immaginario|pianeta [A-Z]\w+|galassia`,
  ),
};
export const themeWords: Record<string, RegExp> = {
  rome: k(
    `impero romano|romani|roma antica|cesare|augusto|senato romano|legion[ei]|legionari|repubblica romana|imperatore romano|urbe`,
  ),
  religions: k(
    `papa|papato|pontefice|chiesa|cristian[aeio]|cristianesimo|cattolic[ahio]+|protestant[ei]|islam|ebre[ioa]|ebraic[ahio]+|eresia|eretic[ahio]+|vescov[io]|lutero|monaster[io]|religion[ei]|église|iglesia`,
  ),
  "empires-dynasties": k(
    `dinastia|dinastie|successione|trono|incoronazione|incoronat[aeio]|erede al trono|imperatore|imperatrice|sovrano|sovrani|monarchia`,
  ),
  "exploration-colonies": k(
    `colonia|colonie|colonizzazione|coloni|esplorator[ei]|esplorazion[ei]|colombo|conquistador[ei]|scoperta dell'america|navigator[ei]|impero coloniale`,
  ),
  "islamic-world": k(
    `islam|islamic[ahio]+|musulman[aeio]|arabi|califf[oi]|califfato|sultano|sultanato|ottoman[aeio]|turchi|maometto|saraceni`,
  ),
  asia: k(
    `cina|cines[ei]|giappone|giappones[ei]|mongol[aio]|india|samurai|shogun|khan|gengis`,
  ),
  napoleon: k(`napoleone|napoleonic[ahio]+|bonaparte|napoléon`),
  risorgimento: k(
    `risorgimento|garibaldi|garibaldini|cavour|mazzini|unità d'italia|borbon[ei]|due sicilie|vittorio emanuele`,
  ),
  revolutions: k(
    `rivoluzione|rivoluzioni|rivoluzionari[eo]?|insurrezione|rivolta|révolution|revolución`,
  ),
  "world-wars": k(
    `guerra mondiale|hitler|nazist[aei]|nazismo|mussolini|fascismo|fascist[aei]|terzo reich|wehrmacht|stalingrado|churchill|duce|führer`,
  ),
  "cold-war": k(
    `guerra fredda|urss|sovietic[aeio]|krusciov|breznev|cortina di ferro|patto di varsavia|kgb|cia`,
  ),
  "united-states": k(
    `stati uniti|americani|washington|lincoln|presidente americano|casa bianca|confederazione|confederati|yankee`,
  ),
  "science-technology": k(
    `scienza|scienze|scienziat[aio]|invenzion[ei]|inventore|tecnologia|tecnologie|macchina a vapore|elettricità|atomic[ahio]+|computer|spaziale|razzo|robot|intelligenza artificiale`,
  ),
  "society-utopia": k(
    `utopia|utopie|utopic[aeo]|società ideale|comunismo|comunist[aei]|socialismo|socialist[aei]|anarchi[aceo]+|ideologia|democrazia`,
  ),
  "culture-sport": k(
    `romanzo|letteratura|poeta|poesia|poesie|dante|shakespeare|tolkien|cinema|film|musica|calcio|olimpiadi|disney|fumetto|fumetti|pittore`,
  ),
  disasters: k(
    `peste|epidemia|epidemie|pandemia|terremoto|eruzione|vulcano|meteorite|asteroide|diluvio|carestia`,
  ),
};
const thresholds: Partial<Record<string, number>> = {
  "empires-dynasties": 8,
  italy: 5,
  world: 3,
};

/** Keyword evidence: weighted hits (title counts triple), capped per word. */
export function keywordFacet(
  words: Record<string, RegExp>,
  title: string,
  text: string,
) {
  const scored = Object.entries(words).flatMap(([id, re]) => {
    const titleHits = [...title.matchAll(re)].length;
    const bodyMatches = [...text.matchAll(re)];
    const perWord = new Map<string, number>();
    for (const m of bodyMatches)
      perWord.set(
        m[0].toLowerCase(),
        (perWord.get(m[0].toLowerCase()) ?? 0) + 1,
      );
    const body = [...perWord.values()].reduce((n, c) => n + Math.min(c, 5), 0);
    const score = titleHits * 3 + body;
    if (score < (thresholds[id] ?? 4)) return [];
    const first = bodyMatches[0];
    const terms = [...perWord.keys()].slice(0, 4).join(", ");
    return [
      {
        id,
        score,
        terms,
        quote: first ? sentenceAt(text, first.index ?? 0) : title,
      },
    ];
  });
  const sorted = scored.sort((a, b) => b.score - a.score);
  // Secondary values must weigh at least a third of the main one.
  return sorted
    .filter((hit) => hit.score * 3 >= (sorted[0]?.score ?? 0))
    .slice(0, 3);
}
