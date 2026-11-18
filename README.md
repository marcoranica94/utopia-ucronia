# UtopiaUcronia

Personal historical archive and new edition of the UtopiaUcronia site. The site is meant for the owner only, behind Cloudflare Access.

Analysis and plan: [docs/analysis.md](docs/analysis.md), [docs/development-plan.md](docs/development-plan.md). Each sprint's delivery is in `docs/status-*.md`.

The [Kanban board](board.html) opens directly in the browser, even without a server or network. It shows verified Backlog, To do, In progress / partial, Waiting and Done states, with sprint/assignee filters, search, evidence notes and the next implementation priorities. Tasks come from the plan; operational statuses, assignees, postponements and priorities come from `data/board.json`. After an update run `pnpm board`. Cards are read-only; browser-local moves never override verified results. See the [implementation audit and next steps](docs/board-audit.md).

The copy to the owner's drive is postponed, to be done by the owner: it is still to do but, as the owner decided, it does not block development.

## Autonomous recovery from the original server

The owner authorized original-server recovery after a ten-image trial succeeded on 12 November 2026. Run `pnpm recovery:origin` from the project directory. It uses batches of 20 with starts two seconds apart, a 30-second pause between batches, a progress bar and a summary every 60 seconds. It needs no model to keep running. Keep the terminal open.

Ctrl+C finishes active saves; run the same command to resume. Existing recovered files are hash-checked and skipped. New files retain their original relative paths. The manifest records `source: origin`, `fetchedFrom`, `retrievedAt` and, when available, `lastModified`; these are current files, not historical captures. Referring pages remain in the queue's `foundIn` field. Publication requires a later conversion.

The command rescans recovered HTML/CSS, follows newly discovered archive links, retries network failures once per run and stops on HTTP 403, 429 or 999. Final results are in `archive/origin-run.json`, `archive/coverage.md` and `archive/download.log`. Use `pnpm recovery:origin --limit 10` for a limited run. Use `pnpm recovery:origin --retry-missing-once` for one more attempt at every unresolved URL, including confirmed 404/410 responses. Only one origin recovery process may run at a time; do not run the Wayback downloader simultaneously.

## Local setup

Node 24 LTS, pnpm 12.18.0 and Git LFS. Dependency versions are locked by the lockfile.

```sh
git lfs install --local
pnpm install --frozen-lockfile
pnpm recovery verify
pnpm build
pnpm preview
```

The first build is cold (10–15 minutes); later ones reuse the cache. To develop: `pnpm dev`, after the first build; `/review/` exists only there. Astro preview does not apply `_headers`: use `pnpm exec wrangler dev --local` to test the production CSP.

### Build cache

The build is incremental: `scripts/build-cache.ts` keeps verified per-unit results in `.cache/build/<namespace>/` (gitignored, restored in CI by `actions/cache`). Each entry is keyed by a digest of all inputs of its unit plus a toolchain digest of every file under `scripts/`, `src/` (except generated `src/content/works` and `src/generated`), `data/corrections/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` and the Astro configuration: any code change recomputes everything, identical inputs give the identical verdict. Cached units: conversion pages (`convert`, with every routing lookup replayed against the current tables), PDF illustrations, source text (`sources:generate`), per-page link facts (`links:check`; link resolution itself runs every time), fidelity reports (`compare:sample`), passing `browse:check` pages and page facts for `s3:check` and `discovery:check`. Failures are never cached; corrupted entries are recomputed; entries unused by a successful run are pruned. Outputs are byte-identical with and without the cache. `BUILD_CACHE=off pnpm build` disables it entirely; `rm -rf .cache/build` clears it.

## What the site contains

The new edition only; the 2004 files stay in the untouched archive and are never served.

| Route (English under `/en/`)                  | What it is                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/`                                           | Atlas home: covers, filters by format, language and search                         |
| `/library/`                                   | The 793 canonical reading works (796 reading items with the three legacy previews) |
| `/works/<slug>/`                              | Reader: full-width text, contents drawer, year/contributor rail, provenance        |
| `/works/`, `/divergences/`                    | The historical indexes: all nine works categories and the Lista by period          |
| `/eras/`, `/places/`, `/themes/`, `/authors/` | Ways in by classification and by source signature                                  |
| `/worlds/`                                    | Six owner-approved worlds and cycles, chapters in source order                     |
| `/tree/`                                      | Tree of eras: works hanging off the approved eras                                  |
| `/whatif/`                                    | "What if…?": a random work, another on request                                     |
| `/history/`                                   | Site history: the 2004 home page rebuilt, recovery figures                         |
| `/search/`                                    | Pagefind full-text search, Lista prompts included                                  |
| `/sources/<doc>/`                             | Complete source text and provenance of each document                               |
| `/gaps/`                                      | What could not be recovered                                                        |

The editors' red passages of the original are kept: whole-red paragraphs are shown as separate panels, scattered red words in a distinct colour (`scripts/source-color.ts`).

## Editorial data

- `data/map.yaml`: one proposal per document (work, split, merge, world, index, discard). Edit it as raw JSON lines; `pnpm editorial:map` refuses to rewrite reviewed proposals.
- `data/review-decisions.json`: the owner's decisions, fingerprinted. Never written by scripts without an owner decision.
- `data/publication.json`: selected editions; `pnpm publication status|next|select|select-approved|remove`.
- `data/vocabulary.json`, `data/classification.json`: eras, places and themes; `pnpm classify` adds agent proposals and keeps owner entries.
- `data/worlds.json`: worlds and cycles; `pnpm worlds propose` derives the chapters, `pnpm worlds check` (in the build) fails on any disagreement.
- `data/corrections/<slug>.json`: persistent text corrections `{ "from", "to" }`; one that no longer applies blocks the build.
- `src/content/`: generated by `pnpm convert`; never edit by hand.
- `reports/`: conversion, fidelity, link gaps, approval packets, browser checks.

## Checks

`pnpm build` runs conversion, worlds check, Astro check and build, search, link check, full source fidelity on every reading text, index/discovery/publication checks and the 18,000-file budget (`pnpm assets:check`; the Workers free plan stops at 20,000).

Outside the build:

```sh
pnpm test            # unit tests
pnpm lint            # Biome
pnpm views:check     # Playwright + axe on every kind of page (S6), after pnpm build
```

`pnpm views:check` serves `dist/` locally and opens 38 representative pages (Italian and English) at 320, 390, 768, 1024 and 1440 px, in dark mode and with text at 200%. It fails on horizontal page scroll, any axe WCAG 2.2 A/AA violation (light and dark), an email in visible text, a script error or a first Tab without a visible focus. Report: `reports/s6-views.json`. It needs Playwright's Chromium once: `pnpm exec playwright install chromium`.

## Backup to your drive

```sh
pnpm backup
```

The command creates a folder in `backup/`, with originals and manifest, and verifies the copy's hashes. Copy **the whole folder printed by the command** to your drive. As long as it stays on the project computer it is not an independent backup. No drive access or credentials are needed to develop the site.

To verify the copy, point to the folder containing `manifest.json` and `original/`:

```sh
pnpm restore:test --from /path/to/the/copy
```

The test clones the local repository into a temporary folder, deletes the clone's archive, rebuilds the files exclusively from the given copy, verifies the hashes, reinstalls the dependencies from the lockfile and runs the full build. It modifies neither the project nor the backup. The network is needed for dependencies, not to recover the documents again. `--offline` is available only with a complete pnpm cache. The report stays in `reports/restore-*.json`.

The R2 restore path (`pnpm restore:test --r2`) was tested before R2 uploads were paused. It cannot run while the bucket is empty. Its download and validation logic remains covered by offline tests.

## Cloudflare and GitHub configuration

The workflow runs tests, lint, archive verification, build and comparison even without Cloudflare credentials. Deploy is initially disabled.

Before enabling it:

1. Configure Access for the whole domain `utopia-ucronia.marcoranica.com`, with no path restrictions, an Allow policy for the three email addresses chosen by the owner and no bypass. Proposed session: 30 days.
2. Add the secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ACCESS_EMAIL_PROPRIETARIO` to the repository (the workflow passes the last one to the code as `ACCESS_OWNER_EMAIL`). Besides deploying the Worker, the token must also be able to read Access applications and policies.
3. Set the repository variable `DEPLOY_ABILITATO=true`. On every deploy `pnpm deploy:verify` checks domain and policies via the API; if it cannot prove them, it fails before publishing.
4. R2 archive uploads are paused at the owner's request. The bucket `utopia-ucronia-archivio` is empty; `pnpm backup --r2` refuses to upload originals. The archive remains in the private GitHub repository with binaries in LFS. A selective R2 policy can be designed later.
5. After the deploy, check the login from a private window and reading from the phone.

The GitHub secret and variable names and the bucket name stay in Italian because they live in external configuration.

The new edition permits only same-origin external scripts; inline scripts stay blocked. The build validates script compatibility with these headers. To test the actual response policies locally after building, use `pnpm exec wrangler dev --local`; Astro preview alone does not apply `_headers`. Production pages show the deployed GitHub revision in the footer.

`workers_dev` and `preview_urls` are disabled; there is no application Worker, SSR or database. To check the configuration without publishing: `pnpm exec wrangler deploy --dry-run`.

Pull requests run no deploys. The workflow currently runs no remote backup. Never put tokens or `.env` files in the repository.
