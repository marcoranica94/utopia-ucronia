# Development plan

Updated 12/11/2026. Analysis, content model and risks are in [analysis.md](analysis.md).

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
4. `pnpm build`: conversion, `astro check`, build, Pagefind index;
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

- [ ] Zod schema for documents, content items, contributions, authors, eras, places, themes
- [ ] Agent that proposes the reorganization map (`data/map.yaml`): action, level and metadata, each with its reasoning
- [ ] Extraction of divergences from the "Lista delle ucronie" and of contributions from collective pages
- [ ] `convert`: encoding, FrontPage cleanup, Markdown (cleaned HTML where needed), merging and splitting, links and anchors rewritten, emails removed, images merged
- [ ] Manual corrections in `data/corrections/`
- [ ] Link check: every unresolved link is explained, as an error to fix or an archive gap
- [ ] First accessibility checks on the reading components

Demo: schema without errors; zero unexplained unresolved links; comparison checklist passed on 30 randomly chosen content items.

### S3 · First useful version

- [ ] Reading page: text, notes, attachments, images, contributions with author, link to the source page
- [ ] Simple catalog: titles, authors and filters on what exists, even with partial metadata
- [ ] Pagefind search on the new edition, with the `/` shortcut
- [ ] `/review` page, development only, to review the map in blocks of 20
- [ ] Keyboard use and phone reading verified

Demo: from the phone I find a work by remembering just one sentence, and from there I open its source page.

### S4 · Complete edition

- [ ] Progressive review of the map: first worlds and pages to split or merge
- [ ] Eras fixed and theme list closed
- [ ] Pages for worlds, authors, eras, places and themes; language filter
- [x] Two design directions for reading and catalog, with real content; choice and `tokens.css`
- [ ] View Transitions between catalog and reading, if they improve orientation

Demo: the chosen direction, on phone and desktop, light and dark; filters work even on content not yet reviewed.

### S5 · Special views

- [ ] Choose the reference date for `/original/` when building the browsable copy, using the available capture dates
- [ ] Divergence tree, tested with the hard cases: missing dates, long titles, crowded centuries, phone
- [ ] Browsable copy in `/original/`: cleanup, internal links, Content Security Policy without scripts, emails removed
- [ ] Site history, with the 2004 home page reconstructed by us
- [ ] "What if…?": a random content item

Demo: from the tree to a twentieth-century work and to its cleaned original page, with no 2004 script running.

### S6 · Polish

- [ ] Playwright and axe on all views, widths from 320 to 1440 px, text at 200%
- [ ] Lighthouse as an indicator, not a goal
- [ ] New restore test from scratch
- [ ] README and `CLAUDE.md` updated

Demo: full round from the phone without touch-ups; restore from scratch succeeds.
