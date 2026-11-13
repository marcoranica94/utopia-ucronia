# S1 status — resumed on 12 November 2026

13 November 2026, later: the 12 failed attempts all failed the content check, not the transfer. The two with Wayback captures turned out to be real originals: `Keikyo/United_Nations_Moon.jpg` is a complete GIF with a `.jpg` name, and `Napoleone_IV.htm` lacks its closing tags in every capture. The validator now has a lenient fallback that keeps such files with their `defects` recorded; both are recovered. The other ten (`Joseph_Stahl.jpg`, `Alessandro_Shi_Huangdi.jpg`, `ilcavalierepallido.jpg`, `Ulivi.jpg`, `Kashmir1.jpg`, `mini_Fanta_Crociate_1815.jpg`, `Roma_in_America_21–24.htm`) had no Wayback capture; the owner ran `pnpm recovery:origin`, which recovered all ten with defects noted (images in another format or with trailing bytes, pages without closing tags but with complete text) and ten more images linked from the Roma_in_America chapters. Final count: 6,995 URLs, 6,900 recovered (98.6%), 95 missing, zero failed attempts. `recovery verify` passes and rerunning `download` downloads nothing: the S1 demo succeeds.

13 November 2026 final update: the CDX index and repeated HTML/CSS link scans produced a queue of 6,985 URLs. The owner requested one further retry of all 107 unresolved URLs; it recovered no additional files. The final coverage is 6,878 recovered (98.5%), 95 missing, 12 failed attempts, and zero not attempted. Eight unresolved URL entries are email addresses mistaken for files; two more resemble malformed external links. All remaining links and their referring pages are recorded in `archive/coverage.md` for future review. Hash verification completed. S1 is closed; the owner deferred further searches. The reference date for the future `/original/` view belongs to S5, when that view is built.

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
