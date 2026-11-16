# S3 — First useful version

Implemented and validated on 16 November 2026. S3 is complete for the published 46-item reading edition. The complete historical catalog remains distinct from complete archive publication, which belongs to S4.

## Delivered behavior

- `/search/` and `/en/search/` search the complete published reading texts, including original Italian, French and Spanish material and items whose language is unknown. The header link and `/` shortcut reach search without interfering with editable controls or open reading dialogs. Queries and language filters survive reloads and locale switches; excerpts, ten-result batches, empty/error states and retry are implemented. Two interface indexes each contain exactly 46 reading URLs, excluding source copies, period tables, compatibility previews and review data.
- Every reading item links to local `/sources/<document-id>/` pages. These retain full inert source text, original URL, capture/origin information, MIME type, immutable original hash, related editions and unavailable-resource links. There are 46 source documents and 100 IT/EN reading-to-source links. This is source text/provenance navigation; reconstructing the original visual layout and its browsable links remains S5.
- Source notes and internal links retain their existing anchors. The audit checks 134 in-page links. All 222 unavailable references have explicit records: 156 edition-pending, two archive-missing, 57 external-excluded, five attachment-pending, one unsupported-format and one unlisted source. Available resources are not labelled missing. The five recovered attachments remain explicitly pending reading publication; originals are never served as executable files.
- `/review/` and `/en/review/` exist only through the Astro development-server integration and require local access. The queue exposes 20 proposals per batch, source quotations/hashes, proposed metadata and filters. Each explicit approve/defer action requires a reason and a current proposal fingerprint/revision. Decisions are atomically persisted in `data/review-decisions.json`, replayed by `readMap` and map regeneration, and never approve item classifications or publish texts automatically. The real decision ledger is empty; save/conflict/persistence tests used isolated fixture files only. No review route, client, map or decision file is emitted to production.
- The owner's additional S3 request is delivered: 18 thematic archive illustrations fade behind the historical-period blocks, with aliases covering all nine work categories. SHA-256 checks precede optimized WebP derivative generation; source originals remain untouched. Static masks/gradients respect the approved palette and keep title/count text legible in both themes.

## Implementation and regeneration

`pnpm build` converts the validated edition, generates browse/source data and optimized period images, builds Astro, generates filter payloads and Pagefind bundles, then checks links/privacy, full reading fidelity, historical indexes and S3 coverage. Generated public assets are ignored by Git. Run a build before local development to make search/filter/image assets available; then use `pnpm dev` and open `/review/` locally.

Pagefind is pinned to 1.6.0. Its [Node indexing API](https://pagefind.app/docs/node-api/) builds custom records from the rendered reading articles; the [browser search API](https://pagefind.app/docs/api/) supports the local interface. Production CSP permits same-origin WebAssembly compilation (`wasm-unsafe-eval`) for Pagefind while still forbidding JavaScript eval and inline scripts. `/original/*` retains its stricter script prohibition.

The visual additions reuse the approved white/slate/blue palette, local Titillium UI and Georgia reading text. Search has one wide input and a language selector; sources are readable prose plus provenance; review shows source evidence beside proposed structure. Period imagery is decorative, not a claim that an alternate-history illustration is a historical photograph. Its per-file provenance is in `reports/period-images.json`.

## Evidence

- 66 script tests passed, including privacy/source-text fixtures and review batching, forged/stale request rejection, persistent decisions, regeneration preservation and changed-source protection.
- Types and repository lint passed with no diagnostics.
- 266,346 built links/resources passed privacy and active-content checks.
- All 46 reading texts passed full source fidelity, including the fixed 30-item validation sample.
- All 7,093 prompt entries, 825 catalog entries and 927 records passed historical-index checks in both languages and every page size.
- All 46 reading items matched text probes in both search interfaces: 92 successful browser searches under Wrangler's production headers.
- Mobile demo passed: the remembered phrase “erano troppo potenti per combattersi” finds the Petrov work; its reading page opens the local source containing the same sentence. Search language filtering, locale/reload preservation, load-more, no-results, blocked-network error/retry and `/` focus were checked. Production `/review/` returns 404.
- New views were checked at 320, 768, 1440 and 1920 px; text at 200% produced no horizontal overflow. Local review pagination and English rendering were checked without writing real decisions. Final all-view axe/assistive-technology certification remains S6.

Machine evidence: `reports/search-index.json`, `reports/s3-validation.json`, `reports/s3-browser.json` and `reports/period-images.json`.
