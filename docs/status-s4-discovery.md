# S4 discovery — 17 November 2026

This records the initial navigation increment. The expanded 66-item edition is documented in [batch 01 delivery](status-s4-batch-01.md).

This increment adds direct reading access and author navigation to the existing edition. It does not publish additional archive texts or approve editorial proposals. Implementation and checks are local; no new production deployment is claimed.

## Delivered behavior

- **Read** in the header opens `/library/` (English: `/en/library/`). Its 33 canonical work editions exclude the ten short divergences and three legacy previews still visible in the home collection. Existing cover/list views, text/author search, language and format filters work on this selection. **Works index** continues to open `/works/`, containing all 825 historical catalog entries and their availability distinctions. The home and historical works index link directly to the reading library.
- `/authors/` and `/en/authors/` provide an alphabetical index of 88 source signatures across the 43 canonical reading items. Author pages separate principal works, principal prompts and contributions to collective texts. A principal author who also contributes has their signed interventions linked under their work, without duplicating the text in a second section.
- Author and contributor names in the reader link to the signature pages. Collective credits expand through native `details`, work with JavaScript disabled and keep long lists out of the reading text. The 303 distinct signed interventions have direct anchor links in each interface, for 606 checked links.
- No biography, identity reconciliation, classification or missing attribution is invented. Exact source spellings are grouped after trimming and Unicode NFC normalization only; different case, punctuation and pseudonyms retain distinct identities. Slugs combine readable names with a stable hash to prevent punctuation and accent collisions. Pages expand automatically as canonical publication expands.

## Design and accessibility

The increment retains the approved palette: white `#ffffff`, slate `#202e3d`, blue `#315f83`, navy `#141b27` and pale blue `#99c7ed`. Titillium Web continues to serve the interface, Georgia the reading text. Existing covers carry the reading library; author navigation uses an alphabetical directory and linked titles, without invented portraits or decorative identity cards. The source signatures and signed interventions supply its structure.

Native links, letter navigation and disclosure controls remain available without JavaScript. Filter controls appear only when their existing enhancement is available. Shared header wrapping and catalog minimum widths/long-word wrapping were corrected for enlarged text. All reading prose remains in its original language; interface pages have matching Italian and English routes.

## Verification

- 69 script tests passed, including author-identity collisions, Unicode normalization, role separation, anchor deduplication, unknown authors and legacy-preview exclusion.
- Type checking and repository lint passed. A pre-existing implicit `any` in the review save lock was corrected with the existing Node `FileHandle` type; runtime behavior is unchanged.
- `pnpm discovery:check` is included in the build and checks both reading libraries, all 176 author pages, index completeness, reader credits and 606 signed contribution targets. The CI artifact list includes its report.
- The full build passed: 278,882 links/resources, all 46 complete reading texts, all 7,093 prompts, 825 catalog entries and 927 historical resource records. The library's existing catalog script and form are permitted only on the two additional library pages by the active-content checker.
- Browser checks passed 60 layout cases: library, author index and an author page in both interfaces, widths 320/390/768/1024/1440 px and text at 100%/200%. Dark theme, keyboard disclosure, filters/reset/empty state, list-view persistence, author-to-signed-intervention navigation, locale switching and access without JavaScript also passed. These checks used the local Astro preview; they do not claim a new production-header browser audit. Precise coverage is saved in `reports/discovery-browser.json`; generated-page coverage is in `reports/discovery-validation.json`.

Complete publication, reviewed world/era/place/theme pages, alias reconciliation and the S6 comprehensive accessibility audit remain pending. The live review decision ledger was not changed.
