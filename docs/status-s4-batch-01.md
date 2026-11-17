# S4 first owner-approved batch — 17 November 2026

The owner approved the prepared 20-proposal packet with “Le proposte ok. Vai.” The exact packet, source hashes, intended routes and authorization are preserved in `reports/publication-batch-01.json`. These approvals apply to those 20 proposals only; no classifications or subsequent packets have been approved.

## Delivery

- Twenty explicit approved decisions are persisted in `data/review-decisions.json`; their twenty publication selections are pinned in `data/publication.json`. The original map, archive and 43-item S2 baseline are unchanged.
- The edition now contains 66 reading items: 63 canonical items and three compatibility previews. `/library/` contains 53 canonical work editions; ten canonical short divergences remain in the home collection. Author navigation expands to 106 exact source signatures and 1,050 signed-intervention links across the two interfaces.
- Every new item participates in the full reading/search/source/discovery workflow, historical-catalog availability and source-fidelity checks. Source provenance has 140 reading-to-source links across both interfaces; the edition's in-page note audit checks 224 links.
- The next pending packet is generated separately in `reports/publication-next.md` and `.json`. It remains unapproved. Structural review and progressive publication remain partial S4 tasks.

## Conversion fixes revealed by the batch

One source's displayed catalog title contained a literal FrontPage icon-link tag. The converter removes this presentation artifact from displayed title metadata while preserving the approved map title, reading route and immutable original.

Another source's original heading starts with “1940:” while its catalog title omits that date. The strict fidelity comparison correctly refused to lose this heading. The anatomy parser now exposes original header text, and the reader retains it under **Original heading** in the source/provenance section. This also preserves original byline forms. The full text comparison remains strict; no loss exception was added.

Long source filenames and flex headings such as “Discussione” exposed overflow on small screens with enlarged text. The reader now permits wrapping in source provenance and computes text wrapping correctly inside its flex headers. Wide historical tables keep their existing horizontal scrolling.

## Verification

- 77 script tests passed, including the regression for a dated original heading differing from the catalog title. Type and repository lint checks passed.
- Full build passed with all 66 reading texts compared in full, retaining prose, anchors, images and tables. The fixed random sample is unchanged. All 7,093 prompts, 825 historical catalog entries and 927 resource records passed checks in both interfaces.
- `reports/publication-validation.json` confirms the 43-item baseline plus exactly 20 selected additions, with every reading item included in the comparison report. Private approval/selection files remain absent from the site.
- Browser evidence is recorded in `reports/publication-batch-01-browser.json`. All 60 layout cases passed: twenty new reading routes at widths 320/390/1440 px with text at 200%, including expanded source headers. Library filtering, a matching English route and opening the original dated heading also passed.

## Remaining S4 work

1. Review the remaining map, especially worlds/cycles and pages to split or merge.
2. Publish the remaining recovered works and attachments progressively, with complete fidelity checks.
3. Close the reviewed era and theme vocabularies.
4. Implement world, era, place and theme pages using reviewed metadata.
5. Optionally add catalog-to-reading View Transitions if they improve orientation; this is not a publication dependency.
