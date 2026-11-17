# S4 second owner-approved batch — 17 November 2026

The owner approved the prepared 20-proposal packet in conversation (“Sì, approvo tutte e 20”). The exact packet, source hashes, intended routes and authorization are preserved in `reports/publication-batch-02.json`. The approval covers those 20 proposals only, all `work` actions with whole-document selections; no classifications and no later packets are approved.

## Delivery

- Twenty more explicit approved decisions in `data/review-decisions.json` (40 in total) and twenty more selections in `data/publication.json` (40 in total). The map, archive and 43-item S2 baseline are unchanged.
- The edition now has 86 reading items: 83 canonical plus three legacy previews. `/library/` has 73 canonical works; author navigation has 123 exact source signatures and 1,364 signed-intervention links across both interfaces.
- `reports/publication-next.md` and `.json` hold the next unapproved packet (batch 03).

## Conversion fixes revealed by the batch

The strict source comparison stopped the build twice. Both times the converter was at fault, and the checks stayed as they were.

1. **Literal asterisks in kept HTML.** *I cari estinti* writes Old Chinese reconstructions in bold italics (`*ŋroːg`). Emphasis tags are kept as raw HTML inside Markdown, but Markdown still parses the text between tags, so two asterisks in separate tags became an `<em>` and disappeared. Text inside kept HTML now encodes `* _ \` [ ] ~ \\` as character references (`inertHtml` in `scripts/conversion.ts`). All four reconstructions are visible again. The same encoding now applies to texts that were already published; the comparison still passes for all 86, so their visible text did not change.
2. **Repeated source anchors.** *Il Gran Regno di Gallia* has the same `name="Lorenzo"` anchor three times (a repeated mail link). Structured works convert blocks one at a time, so the per-document de-duplication did not apply across blocks. Now only the first occurrence keeps the id, as a browser does when resolving `#Lorenzo` (`firstIdsOnly`).

Both fixes have regression tests in `tests/archive.test.ts`.

## Verification

- 79 script tests, type check and lint passed.
- Full build passed: all 86 reading texts compared in full with their sources (prose, anchors, images, tables); 325,962 links and resources checked, no email or active content.
- `reports/publication-batch-02-browser.json`: 60 layout cases (twenty new routes at 320/390/1440 px, text at 200%, details expanded) with no horizontal overflow, no emails and a visible title; four reconstructions with asterisks, one `#Lorenzo` anchor.
