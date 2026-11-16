# Historical indexes — owner request of 16 November 2026

The owner requested counterparts of `lista_ucronie.htm` and `lavori.htm`: every prompt by historical period, with links to its developments where supplied by the source, and the original complete-works catalog by period/category. These two S4 entrances have been brought forward without marking the rest of S3 or S4 complete.

## Pages and coverage

- `/divergences/` and `/en/divergences/`: the recovered menu's 18 sections, containing 6,797 prompt entries. A separate historical section preserves 296 entries from `lista_ucronie_4_1.htm`, captured in 2013. This earlier early-modern list may overlap the newer sections; the combined 7,093 entries are not presented as 7,093 distinct current ideas.
- `/works/` and `/en/works/`: all 825 nonempty catalog cells across the nine recovered categories. Utopias and stories and imaginary histories retain their own sections rather than receiving invented historical dates. Counts describe catalog entries, not necessarily distinct works.
- Period/category lists offer 20, 40 (default), 80 or 100 entries per static page, preserve source order, and retain native navigation without JavaScript. Existing 40-entry URLs and source backlinks remain stable. Prompts have their complete original text and credited names, with longer texts available through native disclosures. Opening a prompt hides its preview, so the complete text appears once; collapsing restores the preview. Published canonical prompt pages remain linked where available.
- `/archive-records/<id>/` and its English counterpart preserve each cited resource. A ready reading page is linked directly; recovered files awaiting publication, missing files and external references receive distinct records and explanations. A missing source anchor is explicitly flagged; if the complete work is published, it remains readable at its root.

Source links to works/discussions and additional references are shown separately. An absent development link is described as "not linked by the source", never as "not written". Catalog inclusion and a recovered file are evidence of a source reference, not an editorial certification that a work is finished. External citations are retained without automated requests to their sites. Original-site links are explicitly named and open only after the user's action.

The new header exposes Spunti / Opere / Albero; the atlas home also links to both indexes. Existing reader URLs, the wide text layout, left timeline drawer, themes and back-to-top behavior are retained. This does not publish every complete work: the prepared reading edition remains 46 items, while the indexes expose the full recovered lists and their availability.

## Sources and conversion

`data/browse-groups.json` identifies the recovered menu sections and supplies IT/EN navigation labels. `scripts/generate-browse.ts` verifies the source hashes and menu membership, applies the editorial map's exact block selections/digests, and writes `src/generated/browse.json` as build input. It does not alter originals, approve map proposals or assign new era classifications.

Catalog extraction treats each leaf table cell as an entry, including valid works whose URLs end in `Index.htm` or `Ultimi.htm`. Every nonempty leaf cell must be accounted for. FrontPage links can cover just a quote or part of a word: titles come from the complete title paragraph, with source indentation distinguished from author lines. Title plus caption must account for the cell's text. Email addresses and active source elements are removed; source names, titles, text and references remain.

Availability is derived from the manifest and the actual conversion report. Source paths resolve case-insensitively, fragments retain case, and a canonical reading link is used only when published. Related-prompt backlinks lead to the correct paginated list and entry anchor. Records preserve source URLs, available capture dates, formats and original catalog categories. Source menu grouping is independent of S4's still-pending reviewed era/theme vocabularies.

## Design and checks

The approved white/slate/blue palette is reused (`#ffffff`, `#202e3d`, `#586b7c`, `#315f83`, `#f7f9fc`, dark paper `#141b27`). Georgia carries titles and prompt prose; local Titillium Web carries navigation and status. Periods form an ordered index rather than a grid of story covers. Lists use the available page width with a three-column table for prompts and a two-column table for works, striped rows, stronger separators and a sticky index of the current page’s titles. Periods are chosen in a native disclosure. On phones, table rows stack and the title index becomes a sticky disclosure that closes after a jump. Page position, total pages and entry ranges appear above and below; the bottom controls select page size or jump directly to a page after Apply/Go. An external same-origin script enhances these controls and the current-title indication under the production CSP. Availability uses explicit words and never relies on color alone.

`pnpm build` runs generation and `pnpm browse:check` in addition to the existing link/privacy/CSP checks and complete reading comparisons. The browse audit checks every prompt's full text and attribution, every catalog title/caption, every source and auxiliary link, each period's page/count coverage, and every resource record in both languages. Evidence is in `reports/browse.json`, `reports/browse-validation.json` and `reports/browse-browser.json`. CI also retains the first two in its conversion artifact.

Unit tests cover leaf-cell and nested-grid extraction, cycle-index URLs, unsafe source links, source URL identity, incorrect totals/references, availability distinctions, partial-word/quote title links and source indentation within titles. Browser checks cover the 18 current period sections plus the historical section, all nine work categories, native disclosure/pagination, ready and unavailable source records, theme persistence, locale switches, keyboard use and responsive layouts including enlarged text. Full accessibility certification remains S6.


## Owner refinement: table view and navigation

Implemented the owner's follow-up request for wider tables, distinct rows, current-page title shortcuts and adjustable pagination. Page-size changes keep the previously first entry inside the new page's range; language and period navigation retain the chosen size. All four sizes are prerendered and checked in both languages, with no query-driven server behavior. Original content and archive records are unchanged.

Validation extends the existing full-text audit to every size and checks table columns, page selectors and the exact set of title shortcuts on each page. Unit tests cover stable default URLs and page-size transitions, including the last partial page. Browser evidence for the refinement is in `reports/browse-table-browser.json`; it also verifies that expanding a prompt never displays both the excerpt and full text.
