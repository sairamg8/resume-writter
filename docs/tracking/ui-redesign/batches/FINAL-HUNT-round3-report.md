# Final hunt, round 3 (2026-10-09): the left-on-purpose fixes and four more lenses

Master `2a35cd1` (full gate 37961989005 green on that exact commit; the gate on `8efc2fa` 37960482709 green too).

## Left-on-purpose items fixed (clusters A to D)
- A: phone sticky headers on List, Timeline, Board (`usePhoneStickyTop`); PDF tall-item fit measured with real font widths; Dashboard 'import as my original' marks only the right résumé(s). Tests 371, 391, 392, a Playwright geometry spec.
- B: interview-stage tombstones (additive `removedStages`, local `cpwtcv_job_stages_gone_v1_<uid>`); the browser's old stage names no longer seed a new account; the signed-out empty Documents page says to sign in.
- C: pdfminer installed in CI so the date test runs (it is a documented todo, R3-004 layout limit); bounded waits in six timing tests; V1 pin test.
- D: per-record version stamps (`syncRev`, `syncBy`, record `revs`, `device`), transactions on replace and delete, tie rule, never-synced items keep both copies with a notice (design note docs/knowledge/11-sync-versions.md). Tests 390 to 398. Review at xhigh: no blocker; four mediums fixed (395 to 398).

## Hunt lenses
- H1 sync: 29 fixes, tests 400 to 429, a three-device seeded fuzz (410) with resurrection, duplication and order oracles; wide runs green (3000 seeds, 1000 seeds x 300 steps). Two older tests (397, 401) updated: a restart's first sync waits up to the cloud timeout for a flush an older line left on its way.
- H2 new changes: PDF item with many hard line breaks, Documents hint only where sign-in exists, sticky header ResizeObserver. Tests 420 to 422 (numbers reused in a different folder from H1's 420 to 422; both exist).
- H3 résumé product: text import (title line, one-line contacts, date-first lines, certification level), PDF entry header alone at a page foot, ATS keyword ranking and CJK, cover-letter closing alone (PDF and Word), Grids word wider than a cell. Tests 450 to 459.
- H4 workspace: failed route chunk recovery, double click history, job history steps, import size cap, out-of-range job times, Job Map counts, security headers. Tests 480 to 488.

## Left, honest
No CSP; no service worker; Job Map write rule open to any allowed account (owner's call); `hiddenFields` on non-Experience entries still print in PDF/Word; Arabic/Hebrew direction in Word; non-English headings in text import; stale-midnight counts; sync edges in the 11-sync-versions note; start-up spare 15 kB of 1,100 kB (lazy-load the sync stack next); accessibility last.
