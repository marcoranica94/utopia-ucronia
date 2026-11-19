import { getCollection } from "astro:content";
import catalogNotes from "../data/catalog.json";
import { contentPath } from "./content-path";
import { type Lang, localePath, useTranslations } from "./i18n";

const notes = catalogNotes as Record<
  string,
  { cover?: string; motif: string; it: string; en: string }
>;

/** The works shown first when scripts are off, and in the original order. */
export const featuredIds = [
  "ucronia-spot-the-pod-49f6bc7d",
  "ucronie-presidenziali-americane-7418c6de",
  "akhenaton-superstar-633d74ed",
  "fantacomneni-2cf7f0fc",
  "avanti-sardegna-come-la-sardegna-ha-riunito-l-italia-1249f6c1",
  "come-il-mago-pietro-bailardo-si-salvo-l-anima-con-l-aiuto-del-diavolo-1b190b4f",
];

export const catalogFormats = [
  "all",
  "divergence",
  "chronology",
  "narrative",
  "discussion",
  "collection",
  "archive",
] as const;

/** Letters or sign drawn on a typographic cover. */
export function coverWord(motif: string, title: string) {
  const signs: Record<string, string> = {
    "1943": "1943",
    cosmos: "∞",
    magic: "✧",
    winter: "❋",
    island: "Sardegna",
    egypt: "☉",
    archive: "UU",
  };
  return (
    signs[motif] ??
    title
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
  );
}

/**
 * One home-catalog card. Field names are short because the whole list is
 * fetched by the home page: href, title, summary (s) and its language (sl),
 * work language (l), format (f), byline (b), cover image (c), motif (m),
 * cover word (w) and card label for reading (r). The filter searches title,
 * byline and summary; the View Transition name derives from the href.
 */
export interface CatalogCard {
  href: string;
  title: string;
  s: string;
  sl: string;
  l: string;
  f: string;
  b: string;
  c?: string;
  m: string;
  w: string;
  r: string;
}

const clean = (s: string) => s.replace(/^\[ucronia\]\s*/i, "");

export async function catalogCards(lang: Lang): Promise<CatalogCard[]> {
  const t = useTranslations(lang);
  const works = (await getCollection("works")).sort((a, b) => {
    const rank = (id: string) => {
      const i = featuredIds.indexOf(id);
      return i < 0 ? 100 : i;
    };
    const archive = (id: string) => (notes[id]?.motif === "archive" ? 1000 : 0);
    return (
      rank(a.id) + archive(a.id) - (rank(b.id) + archive(b.id)) ||
      a.data.title.localeCompare(b.data.title, lang)
    );
  });
  return works.map((work) => {
    const note = notes[work.id];
    const title = clean(work.data.title);
    const summary = note?.[lang] ?? work.data.summary ?? "";
    const authors = work.data.authors;
    const variants =
      work.data.outline?.filter((i) => i.contribution === "variant").length ??
      0;
    const format =
      work.data.level === "divergence"
        ? "divergence"
        : note?.motif === "archive"
          ? "archive"
          : (work.data.shape ?? "work");
    const motif = note?.motif ?? "story";
    const language = work.data.language === "unknown" ? "" : work.data.language;
    const cover = note?.cover ?? work.data.cover;
    return {
      href: localePath(lang, contentPath(work)),
      title,
      s: summary,
      sl: note ? lang : language,
      l: work.data.language,
      f: format,
      b: authors.length
        ? authors.join(", ")
        : work.data.contributors?.length
          ? t("atlas.collective")
          : t("atlas.fromArchive"),
      ...(cover ? { c: cover } : {}),
      m: motif,
      w: coverWord(motif, title),
      r: variants > 0 ? t("atlas.variants", { n: variants }) : t("atlas.read"),
    };
  });
}
