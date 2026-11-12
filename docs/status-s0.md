# S0 status — 11 November 2026

S0 is closed: private deploy, R2 backup, browser checks and the demo on a physical phone all succeeded. The owner confirmed the display and asked to revisit the provisional design in later epics. The copy to the drive remains postponed, to be done by the owner, and does not block development.

## Local results

- 11 files recovered from the Wayback only: 7 HTML (one technical frameset), 3 images and 1 PDF. URLs, dates and hashes in the manifest.
- 6 reading pages generated from Markdown with metadata. French is stated in the selection; attributions and editorial reorganization remain to be checked in S2.
- Rerunning the recovery skips all 11 intact files without network requests; Git LFS correctly verifies the 4 binaries.
- 12 tests pass: the initial 8, one case on empty links left by missing images, and three cases on the R2 download (intact copy, corrupt file, unsafe path).
- Build, TypeScript check and Biome pass. No emails or active elements appear in the generated HTML; 145 links and resources are verified after removing two empty links found by the axe test.
- Full comparison of the 6 texts succeeded: over 450,000 characters, normalizing whitespace and declared removals; no loss of text, accents, anchors or tables detected. Images excluded from the sample are counted in the report; their links lead to the page explaining the gaps.
- Wrangler configuration accepted by the simulated deploy, then the actual publication succeeded.
- Local backup export created and verified, ready to be copied to the owner's drive. It is not yet the independent third copy.
- Actual restore succeeded in a clean clone: the clone's archive deleted, 11 files rebuilt only from the backup, hashes verified, dependencies reinstalled and full build passed. The first offline attempt found pnpm metadata missing from the cache: offline mode is now optional; the successful test allows the network only for dependencies.
- The restore supports `--r2`: it downloads manifest and objects into a new temporary folder and verifies the hashes before rebuilding. The path is verified with simulated objects and with the real bucket.
- Private R2 bucket `utopia-ucronia-archivio` created and first backup uploaded. Restore from the real bucket succeeded: 11 files and manifest downloaded, hashes verified and build run in a clean clone.
- Browser: 10 pages (9 of the site plus the board), light/dark themes, widths 320, 390, 768 and 1440 px, text at 200% at 390 px. No overflow, broken image or axe WCAG 2 A/AA and 2.1 AA violation detected. Search, filters, card detail and closing with Esc on the board were checked too. Report: `reports/browser-s0.json`.
- The board is now Kanban, with cards per task, assignees and dependencies. The copy to the drive is postponed, to be done by the owner, and does not block development.
- The Access check before deploy reads all pages of applications and policies, rejects public exceptions and separate applications on paths of the domain. Tests cover policies, pagination and insecure configurations; the check against the real account succeeded.
- Access application verified on the real account with the three explicit addresses confirmed by the owner. The site is published; a request without a session gets HTTP 302 to the Cloudflare Access login. The GitHub pipeline completed deploy and R2 sync successfully.

## What the sample taught us

1. The Lista is a frameset: the document loaded by the frame is recovered too, avoiding an empty reading page.
2. An unclosed FrontPage form swallows the home page. The controls and the container are removed, keeping the text.
3. Markdown's automatic punctuation alters the sources. It is disabled; nested emphasis and manual numbering are preserved.
4. The originals' line endings are part of the hashes: Git must not normalize them.
5. Duplicate original anchors are consolidated; links keep pointing to the first occurrence.
6. The recovered PDF stays only in the archive: serving the binary directly would not prove that personal data and active content were removed.

## Checks still needed

- Check the configured Access session length; the anonymous redirect and the owner's access are verified.
- Actual copy to the drive: postponed by the owner, who will do it, not blocking development; not marked as done.
- Review of attributions and reorganization in S2: names in the text are preserved, editorial metadata is not automatically approved by the tests.
- The provisional design is not approved: compare the two directions planned for S4 before building the final one.

The earlier block on the browser tool was overcome after the session permissions changed. The visual check was run on desktop and emulated mobile; the demo on the physical phone was confirmed by the owner after the deploy.

The automatic reports are in `reports/conversion.json` and `reports/sample-comparison.json`. Human review is not overwritten by those generated reports: it is recorded in the documentation and, from S2, in the persistent editorial map.
