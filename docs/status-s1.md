# S1 status — resumed on 12 November 2026

13 November 2026 update: the CDX index and repeated HTML/CSS link scans produced a queue of 6,985 URLs. Recovery and a final one-time retry of all 107 unresolved URLs are complete. The coverage report records 6,878 recovered (98.5%), 95 missing, 12 failed, and zero not attempted. The final retry recovered no additional files. Hash verification completed. Remaining S1 work is a targeted search for gaps in other archives and choosing the reference date for `/original/`.

Latest owner decision: after a successful ten-image test against the original server, `pnpm recovery:origin` provides autonomous recovery in batches of 10 with progress, live-source provenance, automatic link rescanning, bounded retry and final hash verification. It preserves paths and referring-page relationships. Earlier Wayback-only restrictions below are historical. Publication and conversion remain separate steps.

Discovery was resumed on 12 November and the CDX index was exhausted after 10 pages: 2,763 URLs and 9,681 captures. Linked URLs are saved before the first CDX request, including when that request fails. Offline tests exercise failure, pagination, deduplication and resumption. Links from newly recovered pages still need scanning and reconciliation.

A two-file trial recovered an icon and an HTML page, verified their hashes and skipped both on rerun. The full download was started in batches of 10; persistent outcomes are in the manifest and `archive/download.log`. Completion, missing files, linked sources and coverage remain to be checked.

The owner subsequently approved batches of 30 and up to ten concurrent downloads. Workers start two seconds apart; each retains its request delays and retry handling, and a 30-second pause separates batches. Manifest and log writes are serialized. A simulated concurrent test and a real ten-file trial passed. An interrupted attempt remains eligible for retry.

After a burst of network failures at concurrency ten, the run was restarted with concurrency six. The precise cause of the failures was not recorded; failed attempts are retried on subsequent runs.

The initial queue pass and retries have finished: 2,714 files recovered (41 from earlier captures), 49 marked missing, and no failed attempts remain. All recovered files passed hash and size verification. This does not close S1: newly recovered pages must still be scanned for links, gaps reviewed and coverage measured.

After scanning recovered pages, the queue grew to 6,130 URLs, including over 3,100 newly discovered image links. The additional recovery is in progress. Discovery records each referring page in `foundIn`, including image and background references, and checks recovered CSS for linked resources. Originals retain their historical paths; those links provide provenance for later editorial grouping. A provisional `archive/coverage.md` lists gaps by type and referring page and must be regenerated after recovery and rescanning.

The owner asked to stop and resume tomorrow.

- S0 is closed: the site is published behind Access, the R2 backup and the restore are verified, and the owner confirmed the display on the phone. The design is provisional and will be tackled in S4. The copy to the personal drive remains postponed and non-blocking.
- Implementation of `pnpm recovery discover` has started: it reads the Wayback CDX index, records URLs, variants and captures, and saves a resume cursor in `archive/queue.json`; it also collects the links of the HTML pages already in the sample.
- **Only one page** has been run: 293 URLs found, 995 captures recorded, `complete: false` and cursor present. The result is partial; it is neither a coverage report nor a complete archive.
- The Wayback first answered HTTP 503, then the request succeeded after the planned retries. The bulk download has not been started.
- The new implementation passed the TypeScript check and a first real run, but still needs tests on recorded responses, a check of resuming across several pages and handling of linked sources before the task can be considered done. In particular, if the first request fails before `queue.json` exists, the links just collected from the sample are not saved yet: fix this case.
- Tomorrow: review the local changes, add the needed tests, resume with `pnpm recovery discover --max-pages 1` and compare the queue before and after; only then consider the full recovery and the coverage report.
- 12/11/2026: the repository was translated to English (docs, code, data formats, site UI, URLs). `archive/coda.json` became `archive/queue.json` with English fields; the manifest was migrated the same way.

The screenshot provided by the owner is `img.png`, already staged before these changes: keep its state and do not include it automatically in project commits.
