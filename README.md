# UtopiaUcronia

Personal historical archive and new edition of the UtopiaUcronia site. The site is meant for the owner only, behind Cloudflare Access.

Analysis and plan: [docs/analysis.md](docs/analysis.md), [docs/development-plan.md](docs/development-plan.md). Status of the first trial: [docs/status-s0.md](docs/status-s0.md).

The [Kanban board](board.html) opens directly in the browser, even without a server or network. It has Backlog, To do, In progress, Waiting and Done columns, filters by sprint and assignee, search, and cards that open with details and dependencies. Tasks come from the plan; operational statuses, assignees and postponements from `data/board.json`. After an update run `pnpm board`. The board does not modify the plan and does not save local moves that could misrepresent the state of the work.

The copy to the owner's drive is postponed, to be done by the owner: it is still to do but, as the owner decided, it does not block development.

## Getting started

Node 24 LTS, pnpm 12.18.0 and Git LFS. Dependency versions are locked by the lockfile.

```sh
git lfs install --local
pnpm install --frozen-lockfile
pnpm recovery verify
pnpm build
pnpm preview
```

The build regenerates the Markdown from the recovered files, validates the schema, generates the static site, checks links and active content and fully compares the sample texts with their sources. To develop: `pnpm dev`, after the first conversion. For the scripts: `pnpm test`; for types and style: `pnpm exec tsc --noEmit` and `pnpm lint`.

## Contents

- `archive/original/`: immutable original files, **never served by the site**; Git does not convert their line endings. Images and PDFs are in LFS.
- `archive/manifest.json`: provenance, date, size and SHA-256 of every document.
- `archive/queue.json`: discovery queue from the Wayback CDX index, with resume cursor.
- `data/sample.json`: initial selection, with role and language where verified.
- `src/content/works/`: generated Markdown, with validated metadata; do not edit by hand.
- `data/corrections/<slug>.json`: optional persistent corrections, a list of objects `{ "from": "existing text", "to": "corrected text" }`. A correction that cannot be applied blocks the build.
- `reports/`: gaps and comparison with the sources, including the aspects still to verify.

In S0 documents are represented one per page, as a reading trial. Splitting prompts, merging split works and structured attributions come in S2. The Lista frameset does not become an empty work: the link leads to the recovered text frame. PDFs are kept but excluded from the output until they are checked and prepared for reading.

```sh
pnpm recovery download --only data/sample.json --batch 10 --pause 30 --delay 2
pnpm recovery verify
```

Recovery uses only the Wayback, one request at a time. Files that are already intact are not downloaded again; an altered original blocks the operation and requires a restore. The full discovery and coverage commands belong to S1.

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

To test the restore using only the bucket as the source of the documents: `pnpm restore:test --r2`. Cloudflare credentials are needed in the environment. Manifest and objects are downloaded into a new temporary folder, with path and hash checks before the clone is rebuilt. The download path is covered by tests without network (intact copy, corrupt object, unsafe path); testing against the real bucket is still necessary.

## Cloudflare and GitHub configuration

The workflow runs tests, lint, archive verification, build and comparison even without Cloudflare credentials. Deploy is initially disabled.

Before enabling it:

1. Configure Access for the whole domain `utopia-ucronia.marcoranica.com`, with no path restrictions, an Allow policy for the three email addresses chosen by the owner and no bypass. Proposed session: 30 days.
2. Add the secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ACCESS_EMAIL_PROPRIETARIO` to the repository (the workflow passes the last one to the code as `ACCESS_OWNER_EMAIL`). Besides deploying the Worker, the token must also be able to read Access applications and policies.
3. Set the repository variable `DEPLOY_ABILITATO=true`. On every deploy `pnpm deploy:verify` checks domain and policies via the API; if it cannot prove them, it fails before publishing.
4. The **private** bucket `utopia-ucronia-archivio` has been created; upload and restore from the real bucket succeeded. Give the token the needed R2 permissions and set `BACKUP_R2_ABILITATO=true` to test the automatic sync. `pnpm backup --r2` uploads the verified files and the manifest last.
5. After the deploy, check the login from a private window and reading from the phone.

The GitHub secret and variable names and the bucket name stay in Italian because they live in external configuration.

`workers_dev` and `preview_urls` are disabled; there is no application Worker, SSR or database. To check the configuration without publishing: `pnpm exec wrangler deploy --dry-run`.

Pull requests run neither deploys nor remote backups. Never put tokens or `.env` files in the repository.
