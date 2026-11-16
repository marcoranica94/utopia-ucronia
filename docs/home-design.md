# Discovery home and collection, 16 November 2026

The owner rejected the minimal homepage and plain list and requested a complete redesign. The new direction is an atlas of alternate histories: the original Spot the POD map forms the opening image, with a prominent title and a direct entrance into the collection.

## Design decisions

- Deep blue `#173b4d`, pale mint `#d8eecc`, map blue `#aacbdc` and lilac `#e3ddf0`, alongside the shared white/slate palette. Cover art keeps its own controlled palette in both light and dark modes.
- Local Titillium Web carries the discovery headings and interface. Georgia remains the reading typeface. The opening uses a two-column map-and-title composition on desktop and a stacked layout on phones.
- Original maps, reliefs, photographs and the presidential seal become covers. Works without an illustration use typographic covers with a branching motif. Source files remain untouched; cover treatments use CSS only.
- The collection has three columns on desktop, two on tablets, one on phones, and a compact list alternative. Each work has a title, a short editorial introduction, language, known format and available attribution. Technical archive pages are identified separately by their format and appear after the works, without being removed.
- Introductions live in `data/catalog.json`, separate from converted source text. They are interface copy in Italian and English. Removing the legacy `[ucronia]` prefix is a display-only title treatment; source titles and URLs stay unchanged.
- Filters combine title, author, contributor and introductory text with language and format. Query, language, format and view persist in the URL. Empty results offer a reset. Without JavaScript all 15 texts remain available and inactive controls stay hidden.
- The existing reader, story branches and explicit light/dark/system modes are retained. The homepage now has its own floating back-to-top link.

The repository's frontend-design skill guided the direction. The recognizable element is the archive's own map, rather than unrelated stock imagery. The catalogue uses the material's actual variety while keeping reading quiet.

## Validation

- Checked the built assets through Wrangler's local runtime, including the production CSP.
- Italian and English, 320/390/768/1440/1920 px, light/dark, cover/list view: 40 combinations without horizontal overflow or console errors.
- Combined Story + Spanish filters return El Rey Escorpión. Reload restores the filters and list view; a nonexistent query shows the empty state; reset restores all 15 texts.
- JavaScript-disabled browser: all 15 works visible, inactive filter controls hidden. Text at 200% on a 1440 px viewport fits the page.
- Desktop and phone screenshots inspected. Type checks, 35 script tests, lint with no warnings, link/CSP checks and full comparison of the 14 HTML texts pass. The PDF is outside that automated fidelity comparison.

Owner visual review remains pending. This completes the implementation of this revision, not the remaining editorial work in S2–S6.
