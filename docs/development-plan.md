# Development plan

Updated 16/11/2026; board reconciled with implementation and validation evidence. Analysis, content model and risks are in [analysis.md](analysis.md).

Seven sprints, S0 to S6. The first proves that the material can be recovered and converted well, on about ten files chosen on purpose, and sets up repository, private deploy and backups. The third already delivers a useful version: reading, simple catalog and search. Classification, final design and the divergence tree grow around it. Every sprint ends with a demo: we move to the next one only if it succeeds without touch-ups.

## Roadmap

```mermaid
flowchart LR
  S0["S0 Sample trial<br/>10 files to the browser<br/>+ backups"] --> S1["S1 Recovery<br/>Wayback only,<br/>measured coverage"]
  S1 --> S2["S2 Conversion<br/>model verified<br/>on real cases"]
  S2 --> S3["S3 First version<br/>reading, catalog,<br/>search"]
  S3 --> S4["S4 Edition<br/>classification,<br/>worlds, themes, design"]
  S4 --> S5["S5 Special views<br/>divergence tree,<br/>cleaned originals"]
  S5 --> S6["S6 Polish<br/>accessibility,<br/>restore tested"]
  S6 --> OK(["Archive online<br/>utopia-ucronia.marcoranica.com"])
```

Each arrow is crossed only after the sprint demo. S1 is long in machine time, not in work: the download runs on its own for hours while conversion is prepared on the sample files.

## Stack

At start we take the latest stable versions (checked on npm on 11/11/2026); from then on the pnpm lockfile locks them and every update is deliberate, one at a time, with build and tests. Where the browser is enough, no libraries.

| Area | Choice | Version |
| --- | --- | --- |
| Runtime and packages | Node LTS, pnpm | 24 · 12.18.0 |
| Framework | Astro, static output, Content Collections | 7.4.10 |
| Schemas | Zod, shared between conversion and site | 4.6.7 |
| Types | TypeScript: 7.0.2 is out but `astro check` only supports 6, as in uni-portale | 6.x |
| Images | `astro:assets` with sharp: responsive AVIF and WebP generated at build time | 0.35.5 |
| Search | Pagefind, multilingual index after the build | 1.6.0 |
| Typefaces | `@fontsource-variable`, local, no requests to Google | 5.3.x |
| Lint and formatting | Biome | 2.6.6 |
| Tests | `node --test` for scripts, Playwright with axe for views and accessibility | 1.65.0 |
| Recovery | Node's native `fetch`, iconv-lite, cheerio, turndown | 0.7.3 · 1.2.0 · 7.2.5 |
| Deploy | Wrangler, Workers with static assets only | 4.160.1 |

**Web platform, only where it serves a specific function and as progressive enhancement:**

- Cross-document View Transitions (`@view-transition`): the catalog card turns into the work's title.
- Scroll-driven animations (`animation-timeline: view()`): the timeline branches split off as you scroll.
- Popover API and anchor positioning for notes: tap the number and the note opens beside it, without jumping to the bottom.
- Container queries, native nesting, OKLCH colors with `color-mix()` and `light-dark()` for the two themes.
- TypeScript scripts run directly by Node 24, with no build step, like `agente/` in uni-portale.

Everything respects `prefers-reduced-motion`: without animations the site is still complete.

## Recovery scripts

A single command, `pnpm recovery`, downloads from the Wayback Machine all pages and files (uchronias, utopias, stories, PDFs, images) in **batches of 10**, with a pause between batches, and resumes where it stopped. With the default settings the roughly 2,640 files take 4–5 hours: start it and let it run. The Aruba server is never contacted automatically.

**Subcommands** (`scripts/recovery/*.ts`, run directly by Node 24):

| Command | What it does | Produces |
| --- | --- | --- |
| `pnpm recovery discover` | merges the CDX index with the links found in recovered pages and `../racconti/`; lists the available captures for each URL | `archive/queue.json` |
| `pnpm recovery download` | takes the next 10 files from the queue, picks the most recent valid capture, downloads, checks, saves, updates the manifest, waits | `archive/original/`, `archive/manifest.json` |
| `pnpm recovery coverage` | counts outcomes, looks for referenced but unrecovered resources, measures the date distribution | `archive/coverage.md` |
| `pnpm recovery verify` | recomputes all hashes and reports corrupt or missing files | result in the terminal |
| `pnpm recovery probe` | manual, optional check: a single honest request to the original server to find out whether the block is still there | result in the terminal |

**`download` options:** `--batch 10` (files per batch), `--pause 30` (seconds between batches), `--delay 2` (seconds between two requests, with some randomness), `--max-batches` (to try on a few files), `--only <list>` (for the S0 sample), `--type html|pdf|img`, `--reference-date YYYYMMDD` (prefers captures close to that date).

**How it behaves:**

1. **Valid capture.** For each URL it starts from the most recent capture and goes back to earlier ones until it finds a valid one. Not valid: IIS error pages archived with status 200 ("Bot blocked", "Detailed Error"), empty or truncated files, type inconsistent with the extension. If no capture is clean (13/11/2026), the most recent copy that is still the right kind of file and not an error page is kept with its `defects` listed in the manifest and in `coverage.md` (for example a GIF saved as `.jpg`, or a page without its closing tags on the server itself): an incomplete original is preserved, not counted as lost. Origin downloads use this lenient check directly, since `fetch` already rejects bodies shorter than `Content-Length`.
2. **Gzip and hash.** It recognizes undeclared gzip and decompresses it. It saves the decompressed content, i.e. the file as it was on the server; the hash is computed on that and the manifest notes that the response was compressed.
3. **Outcomes.** Every URL ends up in one state: `recovered`, `recovered from earlier copy`, `failed attempt` (retried on the next run), `missing` (no valid capture at any date).
4. **Network errors.** On 429 or 5xx it honors `Retry-After`, otherwise it doubles the wait up to 10 minutes. After 3 attempts the URL stays `failed attempt` and it moves on.
5. **Resume.** A file already in the manifest with a valid hash is not downloaded again. On Ctrl+C the current batch finishes writing and the manifest stays consistent.
6. **Case variants.** `Dante33/x.htm` and `dante33/x.htm` are the same file: it is downloaded once and the variants stay recorded in the manifest.
7. **Progress.** After each batch it prints a line, for example `batch 37/264 · 10 ok · 0 missing · estimated end 21:40`, and writes it to `archive/download.log`.

No script uses the original server as an automatic source.

**Security:** downloaded files are untrusted data. They live only in `archive/`, the scripts live outside, and nothing from the archive is ever executed.

## Design

From uni-portale we take the method, not the look. There a strong, informative image (the hemicycle, one seat per credit) carries the whole home page. Here the same role belongs to **the divergence tree**: one branch per work, splitting off in the year history changes.

| In uni-portale | Adapted here |
| --- | --- |
| Hemicycle of 180 seats, one per credit, clickable | Timeline from antiquity to the future, one branch per work, clickable; pinch to zoom on the phone |
| Chamber green as a memorable surface | A "night of time" background, deep ink blue, under the tree; the rest of the site light and made for reading |
| Voting-board colors, only for mastery | Colors for the eras, always next to the era's name, never decorative |
| A single typeface, Titillium Web | Two typefaces: a book serif for long texts, a sans for the interface; candidates chosen in the prototypes |
| Local photographs of the subjects | The works' original maps, flags and illustrations, brought back to the fore in a gallery |
| Metaphor (sitting, seats) only where it informs | Metaphor (branches, divergence, "nella nostra Timeline") only where it informs |

**The spectacular moments:**

- **Divergence tree:** it opens on the present; scrolling goes back in time and the branches split off from the real line one after another. Crowded eras (Rome, twentieth century) become dense canopies.
- **From catalog to work:** the card expands into the work's title with a View Transition, if it improves orientation.
- **Reading:** 65–70 character column, drop cap at the start, notes in popovers, a thin progress bar in the era's color.
- **"What if…?":** a button opens a random content item, starting from its divergence.
- **Site history:** the 2004 home page reconstructed by us in a frame, with the text that follows the mouse, as a tribute.

The tree is an extra view, not the base: reading, catalog, search and filters work on their own and come first (S3). A three-work navigation prototype and title/language filters are now available; the full tree comes in S5, tested with verified divergence data and the hard cases.

**Method, as in uni-portale:** `frontend-design` skill loaded before touching the design, and clichés to avoid (cream background, monospace for data, highlighted word in the title, labels above every heading, identical cards). Two competing directions with real content. Testing at 320, 390, 768, 1024 and 1440 px, light and dark, text at 200%, axe with no WCAG A/AA violations.

## Publishing

A push to `main` builds, checks and publishes to `utopia-ucronia.marcoranica.com`. Access must be configured **before** the first deploy, so the site is never visible without login, not even for a minute.

In the S0 implementation the deploy also requires `DEPLOY_ABILITATO=true` and the Access check via API. Besides the two Cloudflare secrets it needs `ACCESS_EMAIL_PROPRIETARIO` (read by the code as `ACCESS_OWNER_EMAIL`); the token must be able to read Access applications and policies. R2 sync was paused by the owner on 13/11/2026, regardless of the old `BACKUP_R2_ABILITATO` variable. These GitHub secret and variable names stay in Italian because they live in the repository settings. Without this configuration the workflow verifies the build and does not publish. Details in the README.

**`wrangler.jsonc`:**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "utopia-ucronia",
  "compatibility_date": "2026-11-01",
  "assets": { "directory": "./dist", "not_found_handling": "404-page" },
  "routes": [{ "pattern": "utopia-ucronia.marcoranica.com", "custom_domain": true }],
  "workers_dev": false,
  "preview_urls": false
}
```

**`.github/workflows/deploy-site.yml`**, modeled on the uni-portale one:

1. checkout (with Git LFS), pnpm, Node 24 with cache;
2. `pnpm install --frozen-lockfile`;
3. `pnpm test` (recovery, conversion, accessibility checks) and `biome ci`;
4. `pnpm build`: conversion, historical indexes, local source pages and period images, `astro check`, static build, full-period payloads, Pagefind index and fidelity/S3 checks;
5. link check on `dist/`: an unexplained unresolved link blocks the deploy;
6. `wrangler deploy`, only if the secrets exist, otherwise a notice and the build stays verified;
7. R2 archive sync is paused; the workflow does not upload `original/`.

On a pull request branch steps 1–5 run without deploy.

**To do by hand once (me):**

- [ ] Create the private `utopia-ucronia` repository on GitHub, with Git LFS enabled.
- [ ] Add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets; check that the uni-portale token covers all Workers in the account and R2, otherwise create a new one.
- [ ] Create the R2 bucket `utopia-ucronia-archivio` for backups.
- [ ] In Cloudflare Zero Trust, check the Access application for `utopia-ucronia.marcoranica.com`, policy with the three addresses chosen by the owner, 30-day session.
- [ ] Choose the disk for the third copy.
- [ ] After the first deploy, open the subdomain from a private window and check that it asks for login.

## Sprints

### S0 · Sample trial and foundations

- [x] Sample of 11 files: home, Lista and its text frame, long and collective work, work split across two files, French subfolder, three images and a PDF
- [x] `recovery download --only` on the sample: validation, gzip, hash, outcomes; rerun without new downloads
- [x] First conversion of the sample and a minimal Astro page showing it (6 text documents, frameset excluded from reading)
- [x] Full automatic comparison of text, accents, anchors and tables; missing images recorded, PDF excluded from the output pending review
- [x] Visual comparison in desktop browser and emulated mobile, accents, anchors and attributions preserved in the text; axe A/AA with no violations, widths 320–1440 px and text at 200%
- [x] `git init`, link to the designated repository, Git LFS, static Astro 7, pnpm 12, Biome, TypeScript 6, `node --test`
- [x] `wrangler.jsonc`, workflow with deploy disabled until Access is verified via API, simulated deploy succeeded
- [x] Access application, three authorized addresses, GitHub secrets, first deploy and check of the anonymous redirect to login
- [x] Exportable backup script with hash verification and restore test script from a folder
- [x] Restore from a clean clone succeeded: 11 files rebuilt only from the backup, hashes verified, dependencies reinstalled and full build passed
- [x] `restore:test --r2` path implemented and verified with simulated objects: intact copy, corrupt file and unsafe path
- [x] R2 bucket created, sample uploaded and restore from the real bucket verified in a clean clone
- [ ] Automatic R2 sync paused by the owner; define a selective policy before re-enabling it
- [x] Demo from a physical phone: the owner confirms access and display of the sample; the provisional design will be revisited in later epics
- [ ] Copy of the backup to the owner's drive (postponed by the owner, who will do it; does not block development)

Details, limits and configuration: [status-s0.md](status-s0.md) and [README](../README.md). Removing personal data and active code never modifies the originals. In S0 conversion remains a per-document trial; editorial merging and splitting belong to S2.

Demo: from the phone, behind login, I read the converted sample content; the restore from a clean clone succeeds.

### S1 · Recovery

Started on 11/11/2026 and resumed on 12/11/2026. The CDX index and recovered-page link scan are complete; the remaining archive gaps are documented in [status-s1.md](status-s1.md).

- [x] Repository translated to English (docs, code, data formats, site UI, URLs): manifest and queue migrated to the English fields, hashes re-verified
- [x] `recovery discover`: queue from CDX and from link scanning, with the available captures for each URL
- [x] Script tests on recorded responses, without network: error pages, gzip, truncated files
- [x] Full recovery download in the background, in batches of 20
- [x] `recovery coverage`, final owner-requested retry of all unresolved URLs, and documented gaps for future review
- [x] Lenient fallback for originals with no clean copy, recorded as `defects` (13/11/2026): `United_Nations_Moon.jpg` (GIF data) and `Napoleone_IV.htm` (no closing tags) recovered from the Wayback
- [x] Retry of the 10 origin-only failed attempts with `pnpm recovery:origin`: all recovered with defects noted, plus 10 newly linked Roma_in_America images. Final: 6,995 URLs, 6,900 recovered, 95 missing, 0 failed attempts; `verify` clean, `download` rerun downloads nothing

Demo: `archive/coverage.md` with the percentages by type; rerunning `download` downloads nothing; `recovery verify` without errors.

### S2 · Conversion

- [x] Left-side reading navigation requested on 16/11/2026: a narrow year/contributor rail and an overlay drawer preserve wide text. Phone uses a compact side tab. Branches, focus handling and current-position highlighting are retained; see [reading-design.md](reading-design.md). Approved by the owner ("Bello bello"), 16/11/2026.
- [x] Reading redesign revised on 16/11/2026 after owner review: full-width text, author and date headings above paragraphs, an expandable contents panel with separate story branches and dated events, explicit light/dark/system modes and a floating back-to-top link. The earlier A/B URLs now share this reader. See [reading-design.md](reading-design.md) for research and browser checks. Approved by the owner on 16/11/2026
- [x] Bilingual interface (owner decision of 13/11/2026): Italian at `/`, English under `/en/`, IT/EN switch in the header, strings in `src/i18n.ts`, converter placeholders filled by the page; the S0 `/design/` preview stays Italian only
- [x] Trial on 10 deliberately different uchronias (`data/trial.json`): the nine HTML cases and prepared PDF pass full source fidelity. The PDF retains all three illustrations and independently checked text. Reading UI approved by the owner on 16/11/2026; browser conversion checks recorded in `reports/s2-browser.json`.
- [x] Zod schema for documents, content items, contributions, authors, eras, places, themes
- [x] Agent that proposes the reorganization map (`data/map.yaml`): action, level and metadata, each with its reasoning
- [x] Extraction of divergences from the "Lista delle ucronie" and of contributions from collective pages
- [x] `convert`: encoding, FrontPage cleanup, Markdown (cleaned HTML where needed), merging and splitting, links and anchors rewritten, emails removed, images merged
- [x] Manual corrections in `data/corrections/`
- [x] Link check: every unresolved link is explained, as an error to fix or an archive gap
- [x] First accessibility checks on the reading components

Demo: passed on 16/11/2026; valid 6,900-document map, zero unexplained unresolved links, full comparison on all 30 fixed randomly selected content items plus 16 regression/trial views. See [status-s2.md](status-s2.md) for the seed, checks, limits and evidence. Editorial proposals remain unapproved; progressive owner review and complete publication belong to S3/S4.

### S3 · First useful version

- [x] Owner-requested period illustrations: relevant archive images softly faded behind each historical-period block, preserving title/count contrast in light and dark modes and on phones.

Delivered and validated on 16/11/2026. Full-text search covers all 46 published reading items; local source-text/provenance pages, note/resource checks and the development-only review queue are implemented. The mobile sentence → work → local source demo passed. See [status-s3.md](status-s3.md).

- [x] Reading page for the validated edition: 46 complete source-faithful items, images, attributed contributions, branch/year navigation, themes and back-to-top
- [x] Complete source-page navigation from every reading item; all reading items now link to local source-text/provenance pages independently of historical-index records
- [x] Audit notes and attachment navigation across the validated edition; preserve file availability distinctions and provide usable reading/source links
- [x] Simple catalog: titles, authors and filters on what exists, even with partial metadata
- [x] Pagefind search on the new edition, with the `/` shortcut
- [x] `/review` page, development only, to review the map in blocks of 20
- [x] Keyboard use and responsive phone reading verified for the published reader, catalog and historical lists; final all-view axe/device certification remains S6

Demo: passed in a 390 px phone viewport with a remembered Petrov sentence → reading edition → full local source text. All 46 items were also found through text probes in both interfaces (92 successful checks). Review writes were tested only on isolated fixtures; no live proposals were approved.

### S4 · Complete edition

- [x] First owner-approved publication batch: 20 reviewed proposals selected and converted, bringing the edition to 66 reading items with complete source-fidelity checks
- [x] Second owner-approved publication batch: 20 more reviewed proposals, 86 reading items (73 canonical works); converter fixes for literal asterisks in kept HTML and repeated source anchors. See `docs/status-s4-batch-02.md`
- [x] Remaining publication batches 03–19 under the owner's blanket approval: 755 canonical items (712 reviewed single works), each batch built, source-compared in full and browser-checked; converter fixes for anchors with spaces, escaped parentheses in link destinations, paragraph numbers alone on a line and email-only signatures in the outline
- [x] Lista prompts stay in the period indexes, not as 7,093 separate pages (owner decision 17/11/2026); every prompt is searchable from `/search/` and opens at its row in the period table
- [x] Collective pages kept whole (owner decision 17/11/2026): 36 unpublished collective pages published as whole editions (`pnpm publication select <id> --whole`) with every piece titled, anchored and listed in the reading outline; 7 already whole in the baseline keep their split deferred. 791 canonical items
- [x] Cloudflare free plan limit of 20,000 static files (deploy of 17/11/2026 failed at 30,827): Lista prompts indexed per period-table page with one Pagefind sub-result per prompt, the obsolete `/design/b/` comparison pages removed, and `pnpm assets:check` fails the build above 18,000 files (16,241 now)
- [x] Owner approved the era, place and theme vocabulary (17/11/2026): `data/vocabulary.json`

- [x] Reviewed publication workflow: persistent explicit selections, conversion beyond the fixed sample, overlap/stale-decision checks, dry-run and full local source text for the next review batch

- [x] Direct reading library at `/library/` and `/en/library/`: only canonical works already available to read, with existing catalog filters and a clear link to the historical index
- [x] Author and contributor index and pages for the published edition: exact source spellings, separate principal works/prompts and collective contributions, direct signed-intervention links in both languages

- [x] Owner-requested whole-period filters: text, author, availability and documented development, synchronized pagination/title shortcuts; wider proposal column and six-line previews with accessible reading popup. See `docs/historical-indexes.md`.

- [x] Owner-requested table refinement: full-width period lists, distinct rows, current-page title shortcuts, page/total counts, 20/40/80/100 entries per page and direct page selection. Expanding a prompt replaces its preview instead of repeating the beginning. See `docs/historical-indexes.md`.

- [x] Owner-requested period indexes (16/11/2026): `/divergences/` lists all 6,797 prompts in the recovered menu's 18 sections, plus 296 entries from an older 2013 list kept separately; source links distinguish developments from additional references and never equate an absent link with an unwritten work.
- [x] `/works/` recreates all 825 entries of the original nine-category works catalog, including Utopias and stories. Both indexes provide paginated period/category lists, IT/EN navigation and local records distinguishing published, recovered, missing and external sources. Era classification and complete work publication remain separate pending tasks. See [historical-indexes.md](historical-indexes.md).

- [x] Home and collection redesigned after owner rejection, 16/11/2026: atlas-style map opening, original-image and typographic covers, introductions, format/language/search filters and cover/list views. Production-header browser checks pass; see [home-design.md](home-design.md). The owner approved the direction ("Bello").

- [x] Unplanned (17/11/2026): incremental build so CI stays well under its 20-minute timeout as the edition grows towards ~950 reading texts, without weakening any check. `scripts/build-cache.ts` keeps verified per-unit results in `.cache/build/` keyed by all inputs of the unit plus a toolchain digest (scripts, `src/`, corrections, lockfile, configuration); `BUILD_CACHE=off` disables it. Units: conversion pages (routing lookups replayed against the current tables; global post-pass always runs), PDF illustrations, source text, per-page link facts (link resolution always live), fidelity reports, passing `browse:check` pages, `s3:check` and `discovery:check` page facts. Outputs byte-identical with and without cache (10,000+ files compared); at 263 items: full build ≈ 360 s cold, ≈ 200 s after a 40-item batch, ≈ 135 s warm. CI restores the cache with `actions/cache`. Astro build, `astro check` and Pagefind indexing are not cached.
- [x] Publish the remaining recovered works progressively after review and full source-fidelity validation: every publishable HTML work is selected (791 canonical items); PDFs and zip archives continue in S7, the two world introductions in the task below
- [x] Progressive review of the map (closed 18/11/2026): collective pages stay whole (owner decision, "ok" on 18/11/2026 to closing the 43 overlapping split proposals: 36 published whole, 7 deferred); the 19 Lista splits stay deferred; worlds reviewed below
- [x] Eras fixed and theme list closed: 18 eras, 13 places, 16 themes (owner-approved vocabulary)
- [x] Owner review of the per-work era/place/theme proposals in `data/classification.json`: blanket owner approval on 18/11/2026 ("Le approvo tutte in blocco."), 1,952 assignments (498 eras, 732 places, 722 themes); the 421 `unknown` values stay agent proposals. Record: `reports/owner-approval-2026-11-18.json`
- [x] Language filters on the published catalog and IT/EN navigation on historical indexes
- [x] Pages for eras, places and themes (`/eras/`, `/places/`, `/themes/`, IT/EN), approved assignments apart from proposals awaiting review; each work lists its proposed entries in the reader
- [x] Worlds/cycles identified and `/worlds/` pages built (17/11/2026): `data/worlds.json` holds six agent proposals (three worlds with their own contents page: Capvt Mvndi, Roma di là dall'oceano, Fanta-Alessandro Magno; three cycles named by a heading repeated on each member: superpowers, classics as Bible books, Sandro Degiani's stories), 89 chapters in all. `pnpm worlds propose` derives chapters from the archive; `pnpm worlds check` (second build step) derives them again and fails on any disagreement, and lists every mutually linked cluster not covered or explicitly rejected. Chapters keep their `/works/` URL; the reader shows the chapter's place with previous/next. See `docs/status-s4-worlds.md`
- [x] Owner review of the six world/cycle proposals: approved in the same blanket approval of 18/11/2026
- [x] The two world introductions (`racconti/iperimpero/introduzione.htm`, `racconti/roma_in_america/introduzione.htm`) published as the first chapter of their world (owner approval of 18/11/2026, "Si"): exempted from the map's index rule in `scripts/generate-map.ts`, added to `data/map.yaml` as whole-page work proposals, approved in the ledger, selected, and no longer excluded in `data/worlds.json` (Capvt Mvndi 18 chapters, Roma di là dall'oceano 27). 793 canonical items
- [x] Two design directions for reading and catalog, with real content; choice and `tokens.css`
- [x] View Transitions between catalog and reading: cross-document `@view-transition`, catalog card title morphs into the work title, header stays still; disabled under `prefers-reduced-motion`, plain navigation where unsupported (17/11/2026)
- [x] Unplanned (owner request of 18/11/2026): the original's red text, mostly the editors presenting a proposal and its point of divergence, is kept as a mark (`scripts/source-color.ts`): red words get a distinct ink, a passage wholly in red stands apart as a panel, and works that have any show a note on what the marking means. Text, anchors, tables and images unchanged (full source comparison passes on all 796 texts); 692 works carry marks, 620 with whole editorial passages

Demo: the chosen direction, on phone and desktop, light and dark; filters work even on content not yet reviewed.

### S5 · Special views

The browsable copy of the 2004 layout in `/original/` and its reference date were dropped by the owner on 18/11/2026 ("Togliamola original"): the owner wants only the new site. Each item keeps its `/sources/` page with the complete source text and provenance.

- [x] Tree of eras at `/tree/` (owner choice of 18/11/2026, "versione2", instead of a tree by divergence year, which no work has yet): a trunk through the 17 approved eras in order, node size by number of works, works branching off ordered by the first year cited at the opening (labelled as such, not as the divergence), the first 8 per era with the rest folded, "Outside time" off the trunk and the works without an era listed openly. No JavaScript; checked at 1440, 390 and 320 px in light and dark with no horizontal scroll
- [x] Site history at `/history/` (IT/EN): the 2004 home page rebuilt by us as a still with its original logo, amphora, city-of-the-future image and compass-rose background (derived from hash-verified originals by `pnpm periods:generate`, listed in `data/history-images.json`), no script, MIDI, applet or external link; what the page did, the thirteen ticker messages quoted, how the archive was recovered and the capture-year distribution, all figures read from `archive/manifest.json`. Linked from the footer of every page
- [x] "What if…?" at `/whatif/` (IT/EN): one random work with its authors and plain opening, "Read the work" and "Another story". Without JavaScript the page shows a work chosen at build time; `public/whatif.js` draws others from the single `/whatif.json`. Linked from the footer and the home atlas

Demo: from the tree of eras to a twentieth-century work and to its `/sources/` page with the original text and provenance.

### S6 · Polish

- [x] Playwright and axe on all views, widths from 320 to 1440 px, text at 200% (18/11/2026): `pnpm views:check` (Playwright 1.65.1 and axe-core 4.14.1, pinned dev dependencies) serves `dist/` and opens 38 pages covering every kind of view, IT and EN, at 320, 390, 768, 1024 and 1440 px, in dark mode and with text at 200% (342 cases). It fails on horizontal page scroll, any axe WCAG 2.2 A/AA violation in light or dark, an email in visible text, a script error or an invisible first focus. The first run found and the fixes removed: catalog cards and the home map named only by their title (label-in-name), a reply link inside a folded contribution's `<summary>` (now plain text there, linked inside the body), the BC label of the year rail without a space, unbreakable addresses on `/gaps/` at 320 px, and overflow at 200% text on the tree of eras, the 2004 home page and `/design/`. Final run: 0 failures, `reports/s6-views.json`
- [x] Lighthouse as an indicator, not a goal (18/11/2026, mobile profile, local server without compression): accessibility 100 and best practices 96 → 100 on the pages checked; the interface font is now preloaded and the theme switch keeps its place from the first paint, which removed a layout shift of 0.3–0.7 on every page on phones; an SVG favicon removed the only console error. Performance: reader 96, tree and history 99, "What if…?" 94; home and `/library/` stay around 60 because they ship all ~790 cards in one 1.2 MB page (195 KB compressed by Cloudflare), accepted as the cost of filtering without a server
- [ ] New restore test from scratch
- [x] README and `CLAUDE.md` updated (18/11/2026): the README describes the current site (routes, editorial data, checks) instead of the S2–S3 state; `CLAUDE.md` records the red-text marking and the view audit; the obsolete `/original/*` header rule and its test were removed

Demo: full round from the phone without touch-ups; restore from scratch succeeds.

### S7 · Attachments converted to reading text

Separate epic, not part of S4 (owner decision of 17/11/2026). The 225 recovered PDFs and 103 zip archives become reading texts like every other work: converted to Markdown and read on the page. The site serves **no PDF, zip or other attachment files**; the originals stay only in the untouched archive. It can run in parallel with S5 and S6.

- [ ] Inventory: for each PDF, text layer or scan, pages, images, the pages that link to it; for each zip, its file list and formats (doc, rtf, htm, txt, images), extracted only in an isolated directory as untrusted data
- [ ] PDF to Markdown with the existing `scripts/pdf.ts` pipeline (text layer and raster illustrations), with full source-fidelity comparison like the HTML works; scanned PDFs without a text layer listed separately (OCR is a separate decision)
- [ ] Zip contents to Markdown: each document inside becomes a work or a chapter; images kept as illustrations; executable or unknown formats discarded and listed
- [ ] Publication path for attachment proposals: selection, fingerprints and overlap checks as for HTML works; a wrapper page and its attachment combined when they are the same work
- [ ] Links that pointed to a PDF or zip lead to the reading edition; none points to a file. Link check fails if the build emits a `.pdf`, `.zip` or office file
- [ ] Coverage: every PDF and zip has an outcome (published, merged into another work, scan pending OCR, discarded with reason)

Demo: a work that existed only as a PDF and one that existed only inside a zip are found by search and read on the page, on phone and desktop; no attachment file is downloadable from the site.

