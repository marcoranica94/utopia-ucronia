# Era, place and theme vocabulary — agent proposal, 17 November 2026

**Status: proposed, not approved.** Nothing here is written to `data/map.yaml` until the owner approves it. The registries `eras`, `places` and `themes` in the map are still empty and every item classification is still `unknown`.

## Eras

Starting point (analysis.md): the 17 historical sections of the old Lista, redefined as year ranges, plus "Outside time". The ranges below are measured, not guessed: for each Lista section, the first year cited in each prompt (6,797 prompts, BC years not counted) gives the observed spread; the boundaries follow where the editors of the old site actually filed prompts.

| id | Italian | English | Range | Observed (p10–p90 of first year cited) |
| --- | --- | --- | --- | --- |
| `prehistory` | Preistoria | Prehistory | … – 3001 BC | mostly BC, not measurable by this method |
| `ancient` | Antichità | Ancient history | 3000 BC – AD 476 | mostly BC |
| `roman` | Roma antica | Ancient Rome | 753 BC – AD 476 | AD 125–357 |
| `early-medieval` | Alto Medioevo | Early Middle Ages | 477 – 999 | 450–980 |
| `1000-1299` | Dall'anno Mille al Duecento | 1000–1299 | 1000 – 1299 | 1000–1285 |
| `1300-1499` | Trecento e Quattrocento | 1300–1499 | 1300 – 1499 | 1305–1478 |
| `1500s` | Cinquecento | 1500s | 1500 – 1599 | 1494–1595 |
| `1600s` | Seicento | 1600s | 1600 – 1699 | 1605–1691 |
| `1700s` | Settecento e Napoleone | 1700s and Napoleon | 1700 – 1814 | 1715–1810 |
| `1800s` | Ottocento | 1800s | 1815 – 1870 | 1813–1866 |
| `belle-epoque` | Belle Époque | Belle Époque | 1871 – 1913 | 1848–1912 |
| `first-world-war` | Prima guerra mondiale e anni Venti | First World War and the 1920s | 1914 – 1932 | 1914–1931 |
| `second-world-war` | Seconda guerra mondiale | Second World War | 1933 – 1945 | 1926–1944 |
| `postwar` | Dopoguerra | Postwar years | 1946 – 1969 | 1940–1970 |
| `1970s-1990s` | Anni Settanta, Ottanta e Novanta | 1970s–1990s | 1970 – 1999 | 1972–1998 |
| `2000s` | Anni Duemila | 2000s | 2000 – 2009 | 2000–2009 |
| `present-future` | Presente e futuro | Present and future | 2010 – | 2010–2018 |
| `outside-time` | Fuori dal tempo | Outside time | — | fantasy and literary worlds |

Points for the owner:

1. **Ancient history and Ancient Rome overlap.** The old site separated them by subject, not by date. Proposal: keep both as eras (a Roman divergence gets both), so the year still decides the era and the Roman subset stays one click away. Alternative: one era `ancient` plus the theme `rome`.
2. Three section names are widened to the dates they actually contain (Napoleon in the 1700s, the 1920s in the First World War, 1933–1938 in the Second World War).
3. Works use the same eras. The nine categories of "Tutti i nostri lavori" (e.g. "1860–1940") are coarser and only serve as evidence.

How eras would be proposed per item, once the vocabulary is approved: for a divergence prompt, from its Lista section (source evidence, quoted); for a work, from the year of divergence quoted in its text, else from its "lavori" category; otherwise `unknown`. All as `agent`/`proposed` with a quotation, reviewed in blocks of 20.

## Places

Areas, not states: a closed list of 12.

`italy` Italia · `western-europe` Europa occidentale · `central-europe` Europa centrale · `eastern-europe-russia` Europa orientale e Russia · `mediterranean-middle-east` Mediterraneo e Medio Oriente · `africa` Africa · `south-asia` Asia meridionale · `east-asia` Asia orientale · `north-america` America del Nord · `latin-america` America latina · `oceania-poles` Oceania e poli · `world` Mondo intero · `imaginary` Luoghi immaginari

## Themes

Closed list of 16, from the subjects that recur in the prompts (rough keyword frequency in brackets, an indicator only).

| id | Italian | English |
| --- | --- | --- |
| `rome` | Roma e il suo impero | Rome and its empire (≈16%) |
| `religions` | Religioni e Chiese | Religions and churches (≈18%) |
| `empires-dynasties` | Imperi, dinastie e successioni | Empires, dynasties and successions |
| `exploration-colonies` | Esplorazioni e colonie | Exploration and colonies (≈20%) |
| `islamic-world` | Mondo islamico e ottomano | Islamic and Ottoman world (≈12%) |
| `asia` | Cina, Giappone, India, Mongoli | China, Japan, India, Mongols (≈17%) |
| `napoleon` | Napoleone | Napoleon (≈5%) |
| `risorgimento` | Risorgimento e Unità d'Italia | Risorgimento and Italian unification (≈5%) |
| `revolutions` | Rivoluzioni | Revolutions (≈7%) |
| `world-wars` | Guerre mondiali e fascismi | World wars and fascisms (≈12%) |
| `cold-war` | Guerra fredda | Cold War |
| `united-states` | Stati Uniti | United States (≈9%) |
| `science-technology` | Scienza e tecnica | Science and technology (≈9%) |
| `society-utopia` | Società, utopie e ideologie | Society, utopias and ideologies (≈6%) |
| `culture-sport` | Cultura, letteratura e sport | Culture, literature and sport |
| `disasters` | Epidemie e catastrofi | Epidemics and disasters (≈2%) |

Themes would be proposed per item only with a quoted sentence as evidence, never from keywords alone; an item with no clear theme stays `unknown`.

## After approval

1. Write the three registries into the map as `owner`/`approved`.
2. Generate era proposals (section evidence first: it is the strongest), then places and themes, as `agent`/`proposed`.
3. Era, place and theme pages (`/eras/<slug>`, `/places/<slug>`, `/themes/<slug>`) show approved assignments; proposed ones are listed separately and labeled as such, so the pages are useful before the review is complete.
