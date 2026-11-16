# Board audit — 16 November 2026

Reconciled against source routes, build scripts, package dependencies, the editorial map and saved validation reports. This is an implementation audit, not a new full-site test or editorial approval. The board is generated from the plan plus operational metadata; it no longer accepts browser-local card moves or collapses backlog/waiting into to-do.

| Sprint | Verified delivery | Remaining work |
| --- | --- | --- |
| S0 | Foundations, Access-gated deploy, initial backups and historical restore trials | R2 sync paused by the owner; drive copy deferred to the owner. Both remain non-blocking. |
| S1 | Recovery closed: 6,900 files recovered, 95 documented missing, no failed attempts | Missing sources remain recorded gaps, not unfinished download jobs. |
| S2 | Conversion demo closed: model/map, fixed validation sample, 46 source-faithful reading items and approved reader | Editorial proposals are not approved; publishing every recovered work belongs to S4. |
| S3 | Reader, simple catalog, current-interface keyboard/mobile checks | Full-text Pagefind search and `/` shortcut; local source navigation for every reading item; notes/attachment navigation audit; development-only `/review` queue. |
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

## Execution order

1. **Pagefind search on the published reading edition.** Search full text rather than only catalog metadata or the selected historical period. Include IT/EN interface, `/` shortcut, no-result behavior and a test finding a work from a remembered sentence.
2. **Finish source, note and attachment navigation.** Reading pages currently display provenance as source URLs/capture dates. Historical resource records do not cover the complete reading-to-source requirement. Preserve available/missing distinctions.
3. **Development-only review queue.** Twenty proposals per batch, original excerpts and reasons, explicit unknowns, durable owner decisions. Keep review data and the queue out of the production interface.
4. **Close S3 with its end-to-end demo.** From a phone, find a work from a sentence, read it and open its local source/provenance page.
5. **Expand publication in S4.** Review metadata and work boundaries progressively, publish with source-fidelity checks, then build thematic/author/world pages. Use the reviewed divergence data for the full S5 tree.

The final classification, full archive tree and complete publication should not be labelled done merely because the source lists are browsable.

## Board verification

The regenerated board contains 61 tasks: 41 done, four to do, one partial and 15 in backlog (including the two non-blocking deferrals). S3 is active with three delivered tasks and four open tasks. Browser checks verified all five columns, sprint/search/reset controls, the four next-step priorities, immunity to stale local card overrides and no horizontal overflow at 390 and 1440 pixels. No browser errors occurred; repository lint and whitespace checks passed. These task counts measure the plan, not the percentage of archive texts published.
