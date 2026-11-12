# S1 status — suspended on 11 November 2026

The owner asked to stop and resume tomorrow.

- S0 is closed: the site is published behind Access, the R2 backup and the restore are verified, and the owner confirmed the display on the phone. The design is provisional and will be tackled in S4. The copy to the personal drive remains postponed and non-blocking.
- Implementation of `pnpm recovery discover` has started: it reads the Wayback CDX index, records URLs, variants and captures, and saves a resume cursor in `archive/queue.json`; it also collects the links of the HTML pages already in the sample.
- **Only one page** has been run: 293 URLs found, 995 captures recorded, `complete: false` and cursor present. The result is partial; it is neither a coverage report nor a complete archive.
- The Wayback first answered HTTP 503, then the request succeeded after the planned retries. The bulk download has not been started.
- The new implementation passed the TypeScript check and a first real run, but still needs tests on recorded responses, a check of resuming across several pages and handling of linked sources before the task can be considered done. In particular, if the first request fails before `queue.json` exists, the links just collected from the sample are not saved yet: fix this case.
- Tomorrow: review the local changes, add the needed tests, resume with `pnpm recovery discover --max-pages 1` and compare the queue before and after; only then consider the full recovery and the coverage report.
- 12/11/2026: the repository was translated to English (docs, code, data formats, site UI, URLs). `archive/coda.json` became `archive/queue.json` with English fields; the manifest was migrated the same way.

The screenshot provided by the owner is `img.png`, already staged before these changes: keep its state and do not include it automatically in project commits.
