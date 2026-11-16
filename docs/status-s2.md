# S2 closure — 16 November 2026

S2's conversion demo passes. The approved atlas/catalog and full-width reader remain in place, now with 46 readable items, including ten short divergences on their own routes. Editorial approval of the full archive is still future work.

## Delivered

The validated editorial map covers all 6,900 recovered documents, including 834 HTML pages. It proposes 8,509 items: 7,093 short divergences, 635 anchored pieces and 781 other items, including one prepared PDF. Its 472 proposed author names are not verified identities or merged aliases. All interpretations retain author, state, reason and source quotation; uncertain classifications remain `unknown`. Zero reorganization proposals are falsely marked owner-approved.

The selected edition contains 43 canonical items and three existing source previews, generating 186 IT/EN pages including compatibility previews. It retains the previous trial URLs, separates the two 25 July 1943 works and merges the five explicitly numbered parts of L'Impero Pontico into ordered chapters. The map and original hashes remain separate from generated reading content. Details and regeneration commands: [content-model.md](content-model.md).

Conversion fixes found by the expanded sample include source prose before early horizontal rules, meaningful trailing images, empty/wrapper/paragraph anchors, named anchors in contributor introductions, portraits inside email links and angle-bracket linguistic transcriptions. Source email addresses are removed without dropping their associated text or illustrations. Attribution matching avoids substring aliases and names mentioned in dedications. Persistent corrections are reapplied on every conversion; stale corrections and changed fragment digests stop the build. Owner decisions survive proposal regeneration.

The Sardinia PDF now retains all three raster illustrations, its seven pages' text and the English final letter. A separate raw text-layer extraction matches the reconstructed reading text. Illustrations are presented before the text of their original page; arbitrary PDF geometry, OCR and vector-only illustration recovery remain outside this trial.

## Validation evidence

The random sample was recorded before comparison and never replaced when failures appeared. Its seed is `e949a318daddf0643c1251da096fde1f`: 15 whole HTML works, ten divergence prompts and five anchored pieces, drawn without replacement by seeded SHA-256 ranking. Regenerating proposals retained the same 30 IDs and pool digest.

- `pnpm test`: 50 tests passed, including editorial references, owner-review preservation, source hashes/ranges, corrections, attribution boundaries, PDF ranges and conversion regressions.
- `pnpm lint`: clean; the large generated map is checked by Zod rather than Biome.
- `pnpm recovery verify`: all 6,900 recovered files intact; 95 unrecovered URLs remain documented.
- `pnpm build`: zero type errors/warnings/hints, 186 static pages, 20,321 links/resources checked, all 46 complete source comparisons passed.
- `reports/sample-comparison.json`: 2,812,584 normalized source characters, 48 tables, 57 source anchors and 417 displayed illustrations accounted for. Image identity and order are compared by source hash, not only by count. Removed source navigation/contact invitations and relocated metadata are individually classified.
- `reports/s2-validation.json`: all 30 fixed random items passed the source comparison checklist, including headings, prose, accents, notes/links, tables, images and attributions.
- `reports/link-gaps.json`: 222 explicitly explained destinations. Recovered material awaiting publication is distinguished from missing archive files and excluded/unsupported resources. The Fanta Siam link to Srivijaya is recognized as another source section awaiting publication, rather than silently dropped.
- `reports/s2-browser.json`: all 30 items opened at 1440 and 320 pixels, light/dark checks, loaded retained images, no missing alt attributes or untranslated placeholders, and no script errors. Opening screenshots were inspected; PDF, table, long-text and merged-chapter cases received additional checks. Keyboard focus stays inside the open drawer, Escape returns focus, chapter links and back-to-top work. Text enlargement exposed and corrected title/header/contributor wrapping.

This is the first accessibility pass required by S2. Comprehensive axe checks, assistive-technology review and the final S6 device matrix are still due. Proposed reply relationships and editorial boundaries also remain subject to owner review.

## Next sprint

S3 adds full-text Pagefind search, source-page navigation and the development-only review queue. Full archive publication, final vocabularies and author/world/theme pages belong to S4. The cleaned `/original/` archive and full divergence tree remain S5 work.
