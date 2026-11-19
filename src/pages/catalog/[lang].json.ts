import { catalogCards } from "../../catalog-entries";
import { type Lang, languages } from "../../i18n";

/** Every card of the home catalog, fetched by /catalog.js. */
export function getStaticPaths() {
  return languages.map((lang) => ({ params: { lang } }));
}

export async function GET({ params }: { params: { lang: Lang } }) {
  return new Response(JSON.stringify(await catalogCards(params.lang)), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
