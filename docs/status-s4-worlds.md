# S4 worlds and cycles — 17 November 2026

The map had no `world` proposals: every chapter of the long cycles was already published as a separate work. This increment adds worlds as a grouping layer over those works. No published URL changes and no item is republished.

## What is a world here

- **World** (`form: "world"`): one alternative history told across many pages, with its own contents page listing the chapters in order (the frame's contents bar).
- **Cycle** (`form: "cycle"`): separate works that the original site linked to one another under a shared heading printed on every member.

The image folders under `Utopiaucronia/` (Magellania, Grande Messico, Due Imperi, Canale, Dante33…) are not cycles: each is shared by tens or hundreds of unrelated pages. Numbered parts of one work (`grande_muraglia_romana_2.htm`…) are a `merge` question, not a world.

## Proposals

`data/worlds.json`, all `by: agent, state: proposed`, each with a reason and a quotation verified in the original:

| World | Form | Source | Chapters |
| --- | --- | --- | --- |
| Capvt Mvndi, sive Iperimperivm Romanorvm | world | `racconti/iperimpero/intestazione.htm` | 17 |
| Roma... di là dall'oceano! | world | `racconti/roma_in_america/intestazione.htm` | 26 |
| Fanta-Alessandro Magno | world | `racconti/alessandro/sommario.htm` | 9 |
| Come si fa a creare una superpotenza | cycle | heading on 15 pages | 15 |
| I capolavori della letteratura universale trasformati in libri biblici | cycle | heading on 7 pages | 7 |
| Novelle di Sandro Degiani | cycle | heading on 15 pages | 15 |

Ten mutually linked clusters were looked at and rejected, each with its reason in `rejected`: numbered parts of one work (six clusters), the Asimov pages (three works by different authors that cite each other), the Francia/Italia swaps (cross-references in prose), FantaOdissea (an essay citing the Bible cycle) and the Lista period pages (a site index).

The introductions of Capvt Mvndi and Roma di là dall'oceano (`introduzione.htm`) are `index` in the map and so not in the reading edition. They are listed in `exclude` and await an owner decision: publishing them is not covered by the blanket approval of `work`/`split`/`merge` proposals.

## How it is kept honest

- `pnpm worlds propose` derives each agent entry's chapters from its source: the contents page's links in order, or the merged order of every member's printed list (a page that carries the heading without being listed, such as `impero_eterno_2.htm`, follows its first part). Owner-reviewed entries are never rewritten.
- `pnpm worlds check`, the second step of `pnpm build`, derives them again from the hash-verified originals and fails if `data/worlds.json` disagrees, if a quotation is not in its document, if a chapter is not in the reading edition or if a chapter belongs to two worlds. `reports/worlds.json` lists any mutually linked cluster of three or more pages that is neither covered nor rejected (none at present).
- Astro resolves chapters to canonical reading items by document id; a missing one stops the build.

## Pages

- `/worlds/` and `/en/worlds/`: worlds and cycles in two groups, with chapter counts and names.
- `/worlds/<id>/` and `/en/worlds/<id>/`: proposal state, reason and quotation, then the chapters as an ordered list in the source's order.
- Reader: each chapter shows "Chapter n of N in the world" with a link to the world and previous/next links, above and below the text (two distinctly named navigation landmarks, 44 px targets).
- Links from `/library/`, the home index links and the era/place/theme indexes.

Twelve new pages in all (six worlds, two indexes, both languages), well inside the static file budget.

## Not done

Owner review of the six proposals; publication of the two introductions; maps and flags of a world as a gallery (they stay inside their chapters).
