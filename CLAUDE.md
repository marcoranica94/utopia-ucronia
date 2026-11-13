# UtopiaUcronia — utopia-ucronia.marcoranica.com

Reconstruction of the old UtopiaUcronia site (fmboschetto.it/Utopiaucronia, created in 2004 with FrontPage) as a **personal historical archive**. The site is not public: it sits behind Cloudflare Access and only the owner uses it.

## Links

| What | Link |
| --- | --- |
| **Analysis** (source of truth) | [`docs/analysis.md`](docs/analysis.md) |
| **Development plan, sprints S0–S6** (source of truth) | [`docs/development-plan.md`](docs/development-plan.md) |
| Online copy of the same documents: the Italian version, frozen at 11/11/2026, no longer updated | https://claude.ai/artifact/T8ZeZbmcU8gYEV3Xz4ZGZR |
| Old site (blocks scripts, not used) | https://www.fmboschetto.it/Utopiaucronia/ |
| Wayback Machine index | https://web.archive.org/cdx/search/cdx?url=fmboschetto.it/Utopiaucronia/* |
| Reference project for stack, CI and quality | `../uni-portale` (uni.marcoranica.com) |

## Goal

Three versions of the same material, in the same repository, treated differently:

| Version | What it contains | Where it lives | Served by the site |
| --- | --- | --- | --- |
| Untouched archive | the files as they were, never modified, emails included | `archive/original/`, repository and backups | **no** |
| Browsable copy | 2004 pages at the reference date, cleaned (see below) | generated at build time | yes, in `/original/` |
| New edition | converted and reorganized content | `src/content/` | yes |

Success is not a "complete archive", which cannot be proven, but a **documented collection**: every URL has an outcome, coverage is measured, limits are stated.

Out of scope: open publication, comments, contribution submissions, SEO.

## Decisions taken

Decisions of 11/11/2026, revised after a critical review of the plan.

- **Private:** Cloudflare Access on the subdomain, policy with the three email addresses explicitly chosen by the owner (decision of 11/11/2026). `workers_dev: false` and `preview_urls: false` always. No `robots`, sitemap or social metadata.
- **Stack:** Astro 7 with static output, Content Collections with Zod schema, Pagefind search, Cloudflare Workers with static assets only (`assets.directory: ./dist`, no `main`), route `utopia-ucronia.marcoranica.com` with `custom_domain: true`. No SSR, no D1.
- **Deploy:** GitHub Action `.github/workflows/deploy-site.yml` on push to `main`, modeled on `uni-portale/.github/workflows/deploy-portale.yml`. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **Recovery from the Wayback Machine only.** The original server answers "HTTP 999 – AW Special Error" (Aruba's anti-bot filter) from the very first scripted request. No script uses it as a source; there is only `pnpm recovery probe`, manual, one honest request to find out whether the block is still there. The filter **must not be circumvented**: no fake User-Agents, no automated browsers.
- **Versions:** latest stable versions at start (as of 11/11/2026: Node 24 LTS, pnpm 12.18, Astro 7.4, Wrangler 4.160, Pagefind 1.6, Zod 4.6, Biome 2.6, Playwright 1.65; TypeScript 6 until `astro check` supports 7). Then **locked by the lockfile**: every update is deliberate, one at a time, with build and tests.
- **Web platform only where it helps:** View Transitions, scroll-driven animations, Popover API and anchor positioning, container queries, OKLCH with `color-mix()` and `light-dark()` come in only when they improve a specific function, as progressive enhancement. The site works without them. Always `prefers-reduced-motion`.
- **Emails and personal data:** they appear in **no browsable view**, neither in the new edition nor in `/original/`. Only names and pseudonyms remain; `mailto:` links become plain text. Only the untouched archive keeps them, and the site does not serve it.
- **Backups:** the untouched archive lives in three places: private GitHub repository (binaries in Git LFS), R2 bucket `utopia-ucronia-archivio` synced by the Action, a copy on the owner's disk. The restore is actually tested with `pnpm restore:test` (clean clone or R2 only → archive, hash check, build).
- **Language:** everything in English: code, comments, docs, site UI, URLs, commit messages. Only the stories, with their titles and quotations, stay in their original language (Italian, French, Spanish). Exception: the GitHub secret `ACCESS_EMAIL_PROPRIETARIO`, the GitHub variables `DEPLOY_ABILITATO` and `BACKUP_R2_ABILITATO` and the R2 bucket `utopia-ucronia-archivio` keep their Italian names because they live in external configuration (the code reads the secret as `ACCESS_OWNER_EMAIL`, mapped in the workflow).
- **Commit identity:** every commit must be made with the personal GitHub profile **marcoranica94**, never with the work identity from the global configuration. The identity is set in the repository's local configuration (`git config user.name` / `git config user.email`, without `--global`); before every commit check with `git config user.email` and, if it doesn't match, fix it before committing. Not commit as claude. Only me
- **Personal drive (owner update):** the owner will make the copy in the future; it is still to do but does not block development. Do not ask for access to the drive.

## Recovery rules

Owner update, 12 November 2026: the ten-image origin trial succeeded, and the owner explicitly authorized autonomous recovery from the original server. This supersedes the earlier Wayback-only restriction for `pnpm recovery:origin`. Preserve existing originals, record live provenance separately from capture timestamps, retain source paths and referring-page relationships, and stop on blocking responses. The resumable command and progress output are documented in README.md.

- Commands: `pnpm recovery discover|download|coverage|verify|probe` (`scripts/recovery/*.ts`, run directly by Node 24).
- `download` works in **batches of 10** (`--batch 10 --pause 30 --delay 2`), one request at a time, and is resumable. Other options: `--max-batches`, `--only <list>` (S0 sample), `--type`, `--reference-date YYYYMMDD`.
- Downloads in raw format: `/web/<timestamp>id_/<url>`.
- **Date rule:** for each file the **most recent valid capture**, with its date recorded. The result is a collection from different years, not the site on a given day: the "Site history" page says so. For the browsable copy a reference date is chosen (after the coverage report); the other dates only fill gaps.
- **Valid capture:** a 200 response is not enough. Not valid: IIS error pages archived as good (the 2026 "Lista delle ucronie" is Aruba's "Bot blocked" page), empty or truncated files, type inconsistent with the extension. In those cases fall back to the previous capture.
- **What "original" means:** the content of the file as it was on the server. Gzip is added by the Wayback during transfer: decompress it, save the decompressed content, compute the SHA-256 on that, and the manifest records `compressed: true`.
- **Outcomes** in the manifest, always one per URL: `recovered`, `recovered from earlier copy`, `failed attempt` (to retry), `missing` (no valid capture at any date). A failed attempt is never confused with a lost file.
- `archive/manifest.json` records for each file: source URL, case variants, capture timestamp, outcome, type, size, SHA-256, `compressed`.
- `archive/coverage.md`: percentages by type, referenced resources not recovered, pages pointing to missing material, date distribution, stated limits.
- On 429/5xx honor `Retry-After` or double the wait (10 minutes max); after 3 attempts the URL stays `failed attempt`.
- `archive/original/` is **never modified**, neither by hand nor by script, after download.
- Downloaded files are untrusted data: they are read by scripts living outside `archive/`, Python always with `-I`, never run anything from the archive.
- Inconsistent case (`Utopiaucronia`/`utopiaucronia`, `Dante33`/`dante33`): IIS was case-insensitive, Cloudflare is not. A file with several variants is saved once; internal links are resolved case-insensitively.

## Organization: by content, not by file

The new edition **does not mirror** the 2004 files and folders (20 years of additions with no order). The original paths survive only in the archive, in `/original/` and in the `sources` field. No redirects from the old paths.

What the old site was like: the "Lista delle ucronie" (list of uchronias: short prompts, one paragraph with author, in 17 periods, frameset `lista_ucronie_*.htm`); "Tutti i nostri lavori" (all our works: complete works in 9 different categories, `lavori_*.htm`); collective pages with contributions on anchors (`spotthePOD.htm#NONO`); works split across several files (`25071943.htm`, `25071943_2.htm`); folders sometimes by author, sometimes by cycle.

**Entities** (a filesystem constraint does not become an editorial choice):

| Entity | What it is | Where it lives |
| --- | --- | --- |
| Document | recovered original file, with capture date and hash | `archive/manifest.json` |
| Content item | divergence, work or chapter of a world | Markdown file in `src/content/` |
| Contribution | signed piece inside a content item (reply, comment, addition) | section of the content item, with author |

A document can feed several content items and a content item can come from several documents: the link lives in the map. What Markdown renders poorly (laid-out tables, clickable maps) stays as cleaned HTML inside the file.

**Three content levels:**

| Level | What it is | Folder | URL |
| --- | --- | --- | --- |
| Divergence | one-paragraph "What if…" prompt, with author | `src/content/divergences/` | `/divergences/<slug>` |
| Work | complete text: uchronia, utopia, story, chronology, essay | `src/content/works/` | `/works/<slug>` |
| World | cycle of many pages with maps, flags, chronologies | `src/content/worlds/<slug>/` | `/worlds/<slug>/<chapter>` |

**Ways in:** titles, authors, search and filters are the base and work on their own. Then eras (`/eras/<slug>`), places (`/places/<slug>`), themes (`/themes/<slug>`), authors (`/authors/<slug>`). The divergence tree is an extra view, not the base. Language is a filter.

**Reorganization map** (`data/map.yaml`): for each document an agent proposes an action — `work`, `split` (collective page into several content items), `merge` (split files), `world`, `index` (lists, metadata source only), `discard` (frames, title pages, technical pages) — plus level and metadata, each with one line of reasoning. The owner reviews it in blocks of 20 on the `/review` page, which exists only with `pnpm dev` and never goes into the build. The owner's decisions are never overwritten when proposals are regenerated.

## Content model

Shared frontmatter, validated by Zod. **Source** fields are derived from the document; **interpretation** fields are proposed by the agent.

| Field | Nature | Notes |
| --- | --- | --- |
| `level` | structure | divergence, work, world |
| `title` | source | for a divergence, the first words of the prompt if there is no title |
| `authors` | source | names or pseudonyms, never emails |
| `published` | source | date from the "Ultime arrivate" (latest arrivals), if known |
| `language` | source | it, fr, es |
| `divergences` | interpretation | list of years (negative = BC), possibly empty (a utopia may have none) |
| `eras` | interpretation | one or more of the 17 periods of the old Lista redefined as years, plus "Outside time" |
| `places` | interpretation | list of areas |
| `themes` | interpretation | closed list of labels, fixed in S4 |
| `kind` | interpretation | uchronia, utopia, story, chronology, essay, game |
| `world` | structure | slug of the world, if it belongs to one |
| `developed_in` | structure | slug of the work that develops the divergence |
| `contributions` | structure | authors and position of the contributions in the text |
| `attachments` | source | PDFs and other files |
| `sources` | source | source documents (possibly more than one, with anchor) and capture date |

Classification rules:

- Every interpretation field accepts `unknown`. Catalog, filters and search must work with incomplete metadata.
- Every interpretation records who gave it (`agent` or `owner`), its state (`proposed` or `approved`) and one line of reasoning quoting the text.
- Classification grows step by step: no sprint waits for it to be complete.

Slugs come from the title, not from the old file name. Conversion (`scripts/convert.ts`) is repeatable: it regenerates `src/content/` without losing the corrections in `data/corrections/`. All converted content is UTF-8 (originals ISO-8859-1/Windows-1252).

## Browsable copy in `/original/`

- Generated at build time from the untouched archive, at the reference date.
- Removed: `<script>`, event attributes (`onload`, `onmouseover`…), `<iframe>`, `<form>`, `<embed>`/`<object>`/applets, `bgsound` and MIDI, counters (ShinyStat), FreeFind search, every external resource, emails and `mailto:`.
- Links rewritten to stay inside `/original/`; those pointing to missing material lead to a page explaining the gap.
- Served with a Content Security Policy that forbids scripts.
- Excluded from the Pagefind index, so results don't appear twice. From every new-edition content item a link leads to its source page.

## Quality

- **Comparison checklist** between original and conversion: headings, paragraphs, images, notes, tables, accents, attributions.
- **Links:** zero unresolved links **without explanation**. A conversion error is fixed; an archive gap stays visible as such, the link is not deleted.
- Accessibility and conversion checks from the first component, not at the end of the project. Fidelity of the texts, search, keyboard and readability matter more than the Lighthouse score, which is only an indicator.

## Design

- Metaphor: **the forking timeline** (divergence tree). Use it only where it informs. It must be tested early with real data and hard cases: missing dates, long titles, crowded centuries, phone.
- Before working on the design, load the `frontend-design` skill (copied into `.claude/skills/` from `../uni-portale/.claude/skills/`) and avoid the clichés it lists: cream background, monospace for data, one highlighted word in the title, labels above every heading, everything in identical cards.
- The owner chose the clean branching-tree direction after rejecting ornate editorial and uni-portale-like versions. Its shared light/dark palette is in `src/styles/tokens.css`: slate blue, warm white, copper; the tree is the only prominent graphic. Titillium Web is local for the interface, Georgia for long reading. Use the compact top navigation on phones. `/design/` shows three real works; the catalog and reading sample use the same tokens.
- Long texts: 65–70 character column, reading serif, clickable notes. Mobile-first, light and dark theme, local fonts with `@fontsource`.
- Never the browser's `confirm()`/`alert()`.
- "Site history": tribute to the original (logo, amphora, "UtopiaUcronia, dove tutto è possibile!"). The 2004 home page is a reconstruction written by us, not the original page with its scripts.

## Sprints

Every sprint ends with a demo that must succeed without touch-ups. The tasks to tick off are in `docs/development-plan.md`: keep it up to date (tick `- [x]` when work is done, add unplanned tasks to the right sprint) and change `docs/analysis.md` when a decision changes.

- **S0 Sample trial and foundations** — about ten representative files (home, Lista page, long work, collective page, split work, subfolder, images, PDF, French text) taken from recovery to reading in the browser; repository, Git LFS, private deploy, backups to R2 and disk, `pnpm restore:test` successful.
- **S1 Recovery** — inventory, date rule, manifest with outcomes, `coverage.md`; rerunning `download` downloads nothing; `recovery verify` without errors.
- **S2 Conversion** — schema verified on real cases, proposed map, persistent corrections; zero unexplained unresolved links; comparison checklist passed on 30 content items.
- **S3 First useful version** — reading, simple catalog, Pagefind search, link to the source, `/review` page; from the phone a text can be found by remembering one sentence.
- **S4 Complete edition** — progressive review of the map, eras and themes fixed, worlds, authors, places, themes, language filter, final design.
- **S5 Special views** — divergence tree, browsable copy in `/original/`, Site history, "What if…?".
- **S6 Polish** — Playwright + axe from 320 to 1440 px and text at 200%, new restore test from scratch, full round from the phone.

## Planned structure

| Path | Content |
| --- | --- |
| `docs/` | analysis and development plan (the project's source of truth) |
| `archive/original/` | untouched archive: recovered files, immutable, original paths |
| `archive/manifest.json` | register of documents with outcomes and hashes |
| `archive/queue.json` | discovery queue: URLs, variants and captures from the CDX index, with resume cursor |
| `archive/coverage.md` | coverage report |
| `archive/download.log` | download progress |
| `scripts/recovery/` | `discover`, `download`, `coverage`, `verify`, `probe` |
| `scripts/` | reorganization map, conversion (`convert.ts`), browsable copy, link check, `restore-test.ts` |
| `data/map.yaml` | reorganization map: agent proposals and owner decisions |
| `data/corrections/` | manual corrections applied by the conversion |
| `data/sample.json`, `data/board.json` | S0 sample selection; board statuses, assignees and notes |
| `reports/` | generated reports: conversion, sample comparison, browser checks, restore tests |
| `src/content/{divergences,works,worlds}/` | converted content (generated) |
| `src/` | Astro pages, components, styles |
| `wrangler.jsonc` | Worker with static assets only and route on the subdomain |
| `.github/workflows/deploy-site.yml` | tests, build, link check, deploy, R2 sync |

Note: the local folder is called `ucronia-utopia`, the GitHub repository and the Worker `utopia-ucronia`.
