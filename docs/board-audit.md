# Board audit — 16 November 2026

Reconciled against source routes, build scripts, package dependencies, the editorial map and saved validation reports. This is an implementation audit, not a new full-site test or editorial approval. The board is generated from the plan plus operational metadata; it no longer accepts browser-local card moves or collapses backlog/waiting into to-do.

| Sprint | Verified delivery | Remaining work |
| --- | --- | --- |
| S0 | Foundations, Access-gated deploy, initial backups and historical restore trials | R2 sync paused by the owner; drive copy deferred to the owner. Both remain non-blocking. |
| S1 | Recovery closed: 6,900 files recovered, 95 documented missing, no failed attempts | Missing sources remain recorded gaps, not unfinished download jobs. |
| S2 | Conversion demo closed: model/map, fixed validation sample, 46 source-faithful reading items and approved reader | Editorial proposals are not approved; publishing every recovered work belongs to S4. |
| S3 | Complete for the 46-item edition: reader/catalog, Pagefind search, local source text/provenance, note/resource audit, local review queue and faded period illustrations | No remaining implementation task in S3. Full archive publication and final certification remain S4/S6. See [status-s3.md](status-s3.md). |
| S4 | Approved home/catalog, light/dark UI, all historical indexes, tables, pagination, title shortcuts, whole-period filters and reading popup | Progressive editorial review and publication; final era/theme vocabularies; author/world/era/place/theme pages. View Transitions remain optional. |
| S5 | Three-work tree prototype; real contribution branches in the reader | Full archive divergence tree with verified dates and hard cases; reference-date decision and cleaned `/original/`; site history; random-content view. |
| S6 | Existing targeted regression evidence is available | All-view axe/device/assistive-technology audit, Lighthouse assessment, fresh final restore and final documentation reconciliation. |

## What the current counts mean

- 7,093 prompt entries: 6,797 from the 18 current source sections and 296 from an older list kept separately.
- 825 historical works-catalog entries across nine categories: an entry is not necessarily an already published reading edition.
- 927 distinct resource records shared by the historical indexes, with availability distinctions.
- 46 validated reading items (43 canonical items plus three legacy previews).
- 222 prompts have conservative source-supported documented development links. This is not proof that every other prompt was never developed.

Evidence: `docs/status-s2.md`, `reports/sample-comparison.json`, `reports/browse-validation.json`, `reports/browse-filter-browser.json` and `reports/browse-filter-payloads.json`. Published implementation commit `4c30549` passed 63 tests, 256,684 link/resource checks, all 46 reading comparisons and complete historical-index validation in both languages. Its Cloudflare deployment was verified active at 100%.

## Execution order after S3

1. **Review the next publication batch in S4.** The local development queue is ready for explicit owner decisions; no live proposals have been approved automatically.
2. **Expand reading publication.** Convert reviewed works progressively beyond the validated 46 items, including pending attachments, with full source-fidelity checks.
3. **Complete reviewed classification and discovery pages.** Final era/theme vocabularies and author/world/era/place/theme pages still need implementation and metadata review.
4. **Build the full S5 tree and cleaned original-layout copy**, followed by the complete S6 audit/restore.

The final classification, full archive tree and complete publication should not be labelled done merely because the source lists are browsable.

## Board verification

After S3 delivery the regenerated board contains 62 tasks: 46 done, two to do, one partial and 13 in backlog (including two non-blocking deferrals). S4 is active; all eight S3 tasks are delivered. Browser checks verified all five columns, sprint/search/reset controls, next-step priorities, immunity to stale local overrides and responsive layouts. These task counts measure the plan, not the percentage of archive texts published. S3 feature verification is documented separately in [status-s3.md](status-s3.md).
