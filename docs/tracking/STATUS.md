# Project status — done and pending (2026-09-26 14:00 UTC)

Rechecked from the source at this time: every cloud session, the branches, CI, `master` and every tracker.
The live resume point is [HANDOFF.md](HANDOFF.md); this page is the whole list in one place.

## 1. Live on the site (`master` = `843dded`)

- Rounds 1–3 and the bug-fix waves 1–3 of 2026-09-26 (the last one was B-20c and J-12, gate 36223045204).
- bug-status.md's lists (AUD, ATS, TUI, prompt tasks, R2-001…134, R3-): all closed. Of R2-135…171, 5 feature rows
  are still open (section 4).
- Boards and Job Tracker (Lane C, 72 rows): 53 ✅ and 19 🔴. All 19 open rows are accessibility (section 6).

## 2. Done but not live: Round 4 on `claude/awesome-cerf-t3sh88`

**Full gate 36235083234 on `94b4d9b` is green**: node suite, build, lint, Playwright and Cypress. It is waiting only
on the owner's push to master, because the session's auto-mode check refused it as a production deploy.

| Work | Rows | Outcome |
|---|---|---|
| fixes3's six reviewed patches (R2-148-c, R2-148-b, RES-R2-140-a, RES-R2-140-c, R2-147-pn, PERF-1) | 6 | 6 fixed |
| imp: import | 14 | 14 fixed |
| brd: boards | 13 | 13 fixed |
| cl: cover letters and writing tools | 11 | 10 fixed; CL-05 not a bug |
| exp: exports, plus RES-R2-137 (the Word header band) | 8 | 7 fixed; EXP-05 already fixed by RES-R2-137 |
| ed: résumé editor, incl. R4-ED-01 | 7 | 7 fixed |
| dsn-pdf: design panel and PDF | 11 | 10 fixed; PDF-02 partly, its other half is LO-17 (fixed) |
| sync-job: sync, public link, Job Tracker | 10 | 10 fixed |
| app: dashboard, shell, UI kit (found by the session) | 9 | 9 fixed |
| lo-imp, lo-cl, lo-misc: the leftovers of the above | 25 | 25 fixed |

Every fix has a test proven fail-first on CI and a second agent's review. Outcomes are per row in
[fixes3/R4-TRACKER.md](fixes3/R4-TRACKER.md), and the reports are in `fixes3/reports/`. No fix changed
`firestore.rules`.

## 3. Pending: owner actions

1. **Deploy:** `git push origin 94b4d9b:refs/heads/master` (a fast-forward). Then run
   `python3 docs/tracking/tools/r4_tracker.py --deployed 94b4d9b`, commit and push.
2. After the deploy, delete the merged `claude/wf-r4-*` branches on GitHub. Keep the two `dsg-*` branches until
   wave 2 is merged.
3. From R2-143: tag v0.1.0; confirm the Terms and Privacy pages match the hosting domain; set the live build's env
   vars.

## 4. Pending: work

**Wave 2, design: started, paused at the usage limit, nothing fixed.** Both sessions are idle, waiting for a message.
The seven-day limit resets Sun 27 Sep 19:00 UTC.

| Session | Found so far (not yet confirmed by a second agent) | Left |
|---|---|---|
| dsg-flow session_01AmmKmEdcQjMsXCr6cxbAXZ | 48 rows: R4-DUX 30 (4 high), R4-DOUT 18, in `wf-reports/r4-dsg-flow-findings.md` on `claude/wf-r4-dsg-flow` | confirm, fix, review, report |
| dsg-layout session_01K2dRPYe8fZU5xwrczhag7U | 36 rows (R4-DPH, R4-DVIS) from 3 of 4 finders, in `wf-reports/r4-dsg-layout.findings.md` on `claude/wf-r4-dsg-layout` | re-run the résumé-side phone finder, then confirm, fix, review, report |

**Wave 3, the final sweep:** about 15 low, pre-existing leftovers the clusters saw, listed in
[fixes3/R4-CLUSTERS.md](fixes3/R4-CLUSTERS.md) under "Wave 3". They cover boards, the writing tools, import and the
Word Sidebar band.

**Open feature rows** (bug-status-r2/03), with what is left on each:
- R2-139 (Templates UI suggestions): only accessibility items A7, A8, A11, A13 and A14 are left.
- R2-142 (performance): PERF-1's WOFF cache is done in Round 4. Left: the perf harness (N1/N2 budgets, Gate A/B),
  PERF-4 (one commit per keystroke), PERF-5 (pdf.js paint order, canvas reuse) and PERF-6 (Gate B, a worker
  watchdog).
- R2-143 (open-source release): only the owner items in section 3 are left.
- R2-147 (per-section styling): column layout (details top/left/right, mixed columns, widths) and a per-skill level
  are left.
- R2-148 (import, localisation, letters): the PDF column and Executive/Timeline items are fixed in Round 4. Left: a
  résumé deleted on another device keeps its public copy; résumé language and RTL are parked (English only).

**Bookkeeping, after the deploy:**
- Rows R2-137 and R2-133 still describe the old Word band; update them from `reports/r4-exp.json`.
- Update R2-142's and R2-148's "Left" notes to what Round 4 fixed.
- bug-status.md's header still says `cb58695`.

## 5. Parked by the owner

`archive/wf-locale` (résumé language: English only for now) · `archive/wf-templates` (accessibility).

## 6. Last: accessibility (deferred by the owner)

- The 19 open Lane C rows: B-08…B-12, B-24…B-28, J-13…J-15, J-31…J-35 and J-37.
- R2-139's A7, A8, A11, A13 and A14.
- The items each Round 4 report lists as "accessibility, noted not fixed".

## 7. Lost with the laptop reset

The store's `CHECKLIST-2026-09-25*.md` and `wip/execution-2026-09-26/pending-bugs.md` were never uploaded. Whatever
they held beyond the lists above is unknown.
