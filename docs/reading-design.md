# Reading design, 16 November 2026

The owner rejected the cramped reader and the unclear timeline, requested full-width text and explicit light mode, and clarified that separate story branches (particularly in the presidential uchronias) should stay. The result is one reader on both the normal and earlier comparison URLs. Owner visual approval remains pending.

## Direction

- White `#ffffff`, pale blue `#f7f9fc`, ink `#202e3d`, secondary text `#586b7c`, blue `#315f83`. The dark palette remains available with pale blue links.
- Georgia for titles and reading; local Titillium Web for navigation, dates and author headings. Left-aligned text, full available width, responsive gutters. Dates and authors sit above their text, without nested margin columns.
- A quiet catalog with title/author search and language filter leads straight to the works. The decorative sample tree no longer takes over the catalog header.
- A sticky, single-row reading toolbar opens contents and branches on demand. Branches have complete author names; dated events expand inside their own branch. The diagram expresses the work's structure, not a shared historic time axis or a verified divergence relationship. No fabricated dates or compressed logarithmic scale.
- A visible floating back-to-top link appears after 500 px. The toolbar also links to the title. Escape closes contents and restores focus; selecting an item closes contents, opens folded target comments and focuses the destination. Existing deep links work.
- Auto, Light and Dark are explicit options. Selection persists across navigation; the current-page selection still works when browser storage is unavailable.

## Research

Used the repository's [frontend-design skill](../.claude/skills/frontend-design/SKILL.md), also found in the [skill catalog](https://www.skills.sh/anthropics/skills/frontend-design). No additional runtime UI library was introduced.

[NN/g: Table of Contents](https://www.nngroup.com/articles/table-of-contents/) informed the distinction between navigation and content, descriptive labels and direct links to sections. [GOV.UK: Layout](https://design-system.service.gov.uk/styles/layout/) recommends restrained line lengths for ordinary prose. Here the owner's explicit full-width preference takes precedence; the reader uses a larger serif font and generous leading rather than reserving space for a permanent rail.

## Verification

Checks run against the built static site, not just the development server:

- All 15 published works at 320 and 1440 CSS pixels in both light and dark modes: 60 combinations, no page-wide horizontal overflow.
- Presidential branches at 320, 390, 768, 1440 and 1920 pixels in both modes: panel fits the viewport; five independent variants retain their labels; event lists preserve narrative order.
- Desktop and phone screenshots inspected for the catalog, reader and branches. On phones branches appear before the long list of discussion authors.
- Date-to-passage navigation, closed contents after navigation, Escape focus restoration, back-to-top, theme persistence and catalog filter persistence checked in the browser.
- The content converter and originals are unchanged. The build still compares all 14 HTML texts; the PDF remains outside that automated fidelity comparison.

Screenshots are local review artifacts in `reports/` and are ignored by Git. This is a reading redesign, not completion of S2 or final accessibility certification.

## Production-header correction, 16 November 2026

A follow-up report exposed a gap in the initial checks: Astro's preview does not apply Cloudflare's `_headers`. The global `script-src 'none'` hid the theme selector and blocked reading controls; Astro also inlined the small catalog script. Reproduced this using `wrangler dev --local` against the built assets: the theme group was hidden and the browser logged CSP violations.

The new edition now permits same-origin external scripts, while `/original/*` adds a second policy forbidding all scripts. Catalog filtering lives in `/catalog.js`, with inline scripts still forbidden. The build checks each page's external scripts against the matching response policies and rejects inline scripts even in the catalog. Three regression tests cover both languages and the combined restrictive original-page policy. The lint warning in the old design preview was also removed.

Verified the correction in Wrangler's local runtime at 390 px: light mode, persisted filters (one presidential result), story-branch navigation and back-to-top all work, without console errors. A request under `/original/` returns both policies, retaining `script-src 'none'`. The footer and the HTML `data-build` attribute now show the GitHub commit revision, so deployed versions can be distinguished directly. Cloudflare's active deployment and custom-domain mapping were checked; no competing Worker routes were present. The authenticated production HTML cannot be inspected anonymously through Access.

Header composition follows [Cloudflare's static-asset header rules](https://developers.cloudflare.com/workers/static-assets/headers/); script restrictions follow [MDN's CSP documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).
