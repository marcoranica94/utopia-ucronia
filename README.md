# UtopiaUcronia

Personal historical archive and new edition of the UtopiaUcronia site. The site is meant for the owner only, behind Cloudflare Access.

Analysis and plan: [docs/analysis.md](docs/analysis.md), [docs/development-plan.md](docs/development-plan.md). Conversion status: [docs/status-s2.md](docs/status-s2.md). The first trial is documented in [docs/status-s0.md](docs/status-s0.md).

The [Kanban board](board.html) opens directly in the browser, even without a server or network. It shows verified Backlog, To do, In progress / partial, Waiting and Done states, with sprint/assignee filters, search, evidence notes and the next implementation priorities. Tasks come from the plan; operational statuses, assignees, postponements and priorities come from `data/board.json`. After an update run `pnpm board`. Cards are read-only; browser-local moves never override verified results. See the [implementation audit and next steps](docs/board-audit.md).

The copy to the owner's drive is postponed, to be done by the owner: it is still to do but, as the owner decided, it does not block development.

## Getting started

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

The build regenerates the Markdown from the recovered files, validates the schema, generates the static site, checks links and active content and fully compares the sample texts with their sources. To develop: `pnpm dev`, after the first build. For the scripts: `pnpm test`; for types and style: `pnpm exec tsc --noEmit` and `pnpm lint`.

### Build cache

The build is incremental: `scripts/build-cache.ts` keeps verified per-unit results in `.cache/build/<namespace>/` (gitignored, restored in CI by `actions/cache`). Each entry is keyed by a digest of all inputs of its unit plus a toolchain digest of every file under `scripts/`, `src/` (except generated `src/content/works` and `src/generated`), `data/corrections/`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` and the Astro configuration: any code change recomputes everything, identical inputs give the identical verdict. Cached units: conversion pages (`convert`, with every routing lookup replayed against the current tables), PDF illustrations, source text (`sources:generate`), per-page link facts (`links:check`; link resolution itself runs every time), fidelity reports (`compare:sample`), passing `browse:check` pages and page facts for `s3:check` and `discovery:check`. Failures are never cached; corrupted entries are recomputed; entries unused by a successful run are pruned. Outputs are byte-identical with and without the cache. `BUILD_CACHE=off pnpm build` disables it entirely; `rm -rf .cache/build` clears it.

## Contents

- `archive/original/`: immutable original files, **never served by the site**; Git does not convert their line endings. Images and PDFs are in LFS.
- `archive/manifest.json`: provenance, date, size and SHA-256 of every document.
- `archive/queue.json`: discovery queue from the Wayback CDX index, with resume cursor.
- `data/sample.json`: initial selection, with role and language where verified.
- `src/content/works/`: generated Markdown, with validated metadata; do not edit by hand.
- `data/corrections/<slug>.json`: optional persistent corrections, a list of objects `{ "from": "existing text", "to": "corrected text" }`. A correction that cannot be applied blocks the build.
- `reports/`: gaps and comparison with the sources, including the aspects still to verify.

S2 uses the editorial map rather than one page per original file. The selected edition contains 46 items: the fixed random sample of 30, previous trials and an explicit five-document merge. Ten short prompts have their own `/divergences/` routes. The prepared Sardinia PDF includes its text layer and three illustrations; other raw attachments remain unserved. The map contains proposals for the full recovered inventory, awaiting progressive review.

See [the content model](docs/content-model.md) for schemas, provenance, review preservation and the fixed sample. To regenerate proposals deliberately, run `pnpm editorial:map`, `pnpm editorial:sample`, then `pnpm editorial:enrich`. Normal builds consume the committed map and sample without redrawing them. Use `pnpm exec wrangler dev --local` after building when checking production CSP and interactive controls; Astro preview does not apply `_headers`.

```sh
pnpm recovery download --only data/sample.json --batch 10 --pause 30 --delay 2
pnpm recovery verify
```

Recovery uses only the Wayback, one request at a time. Files that are already intact are not downloaded again; an altered original blocks the operation and requires a restore. The full discovery and coverage commands belong to S1.

## Historical indexes

`/divergences/` contains the complete recovered Lista by period, with prompt text and links to related developments. `/works/` contains all nine original works categories, including Utopias and stories. Both have English counterparts, wide tables with current-page title navigation, adjustable pagination (20/40/80/100 entries) and source records showing whether a linked text is already readable, recovered, missing or external. The 2013 historical prompt list is separated from the current menu's 18 sections.

`pnpm browse:generate` derives these indexes from hash-verified original menus, catalog cells and the editorial map; `pnpm browse:check` compares all rendered entries and records in both languages. Normal `pnpm build` runs both, alongside the existing reading fidelity checks. Details: [historical-indexes.md](docs/historical-indexes.md).

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

The new edition permits only same-origin external scripts; inline scripts stay blocked. `/original/*` adds a stricter policy that forbids all scripts. The build validates script compatibility with these headers. To test the actual response policies locally after building, use `pnpm exec wrangler dev --local`; Astro preview alone does not apply `_headers`. Production pages show the deployed GitHub revision in the footer.

`workers_dev` and `preview_urls` are disabled; there is no application Worker, SSR or database. To check the configuration without publishing: `pnpm exec wrangler deploy --dry-run`.

Pull requests run no deploys. The workflow currently runs no remote backup. Never put tokens or `.env` files in the repository.

Historical period lists include whole-period text/author/availability filters and a documented-development filter for prompts, with shareable query URLs and synchronized pagination. Long proposals open in a reading popup after six rendered lines. Run `pnpm build` before local development to generate the full-period filter payloads. See [historical indexes](docs/historical-indexes.md).

S3 is delivered for the 46-item reading edition: [status and checks](docs/status-s3.md). Use `/search/` (or `/en/search/`) for full-text search; `/` opens/focuses it. Reading pages link to safe local source text/provenance. After `pnpm build`, run `pnpm dev` and open `/review/` locally to review proposals in blocks of 20. Each explicit owner decision is saved in `data/review-decisions.json`; it is separate from automatic proposals and survives regeneration. The development queue and raw decision/map files are not deployed. Full archive publication remains S4 work.

### Reading and author navigation

Use `/library/` (English: `/en/library/`, **Read** in the header) for canonical works already prepared for reading. `/works/` remains the complete historical works index, including works awaiting publication. `/authors/` and `/en/authors/` list source signatures in the canonical reading edition, with separate works, prompts and signed contributions. Possible aliases remain separate until editorial review. `pnpm discovery:check`, included in `pnpm build`, verifies both libraries, author routes and signed anchors. See [S4 discovery delivery](docs/status-s4-discovery.md).

### Progressive reading publication

`pnpm publication status` shows the baseline, explicit selections and approvals eligible for selection. `pnpm publication next` prepares a read-only batch of up to 20 pending proposals in `reports/publication-next.md`; run `pnpm dev` to follow its local review and full-source links. After an explicit owner review, `pnpm publication select <proposal-id> --dry-run` validates a choice, and the command without `--dry-run` writes `data/publication.json`. Run `pnpm build` before deployment: every selected addition must pass the full source-fidelity and membership checks. Approval alone never selects or deploys a text. See [S4 publication workflow](docs/status-s4-publication.md) for split/merge handling, source conflicts and removal.

### Current reading edition — second reviewed batch

Two owner-approved batches add 40 texts: 86 reading items total (83 canonical plus three legacy previews), with 73 canonical work editions at `/library/` and 123 source signatures under `/authors/`. All selected texts receive complete source comparisons. The approved packets are preserved in `reports/publication-batch-01.json` and `reports/publication-batch-02.json`; `reports/publication-next.md` is the next unapproved packet. See `docs/status-s4-batch-02.md`.
