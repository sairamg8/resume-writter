# Round 4 clusters — the brief every cluster session follows (2026-09-26)

The coordinator (cloud session_013BXDvmy7T9XQ7CsZWdofVX) works on the branch **`claude/awesome-cerf-t3sh88`**, which
replaces `claude/busy-darwin-yjb13t` as the work branch. It already carries the six reviewed fixes of this folder
(R2-148-c `50b9566`, R2-148-b `9af536c`, RES-R2-140-a `746afa7`, RES-R2-140-c `00b6d78`, R2-147-pn `b58b87f`, PERF-1
`c036c8d`). Each cluster below is one cloud session on its own branch **`claude/wf-r4-<cluster>`**, started from the
work branch. The coordinator merges each finished branch, runs one full gate and moves `master`.

## How a cluster works

Follow [CLUSTER-PROTOCOL.md](../CLUSTER-PROTOCOL.md) (set-up, tests on CI only, fail-first, commit style, review,
report), with these differences:

1. **Your rows are the R4 findings**, not tracker rows. They are in [findings-R4.json](findings-R4.json), one entry
   per area (`"area": "find:<AREA>"`). A finding's ID is `R4-<AREA>-NN`: sort that area's `findings` by severity
   (high, medium, low; keep the file's order within a severity) and number from 01. The list below gives every ID
   with its title. Each finding has `files` (file:line at `d11d5a0`, may have drifted), `repro`, `actual`,
   `expected` and `fix_hint`. A sweep cluster (APP) first finds its own rows, then fixes them the same way.
2. **Confirm each finding at your base** by reading the code path end to end. The six fixes above or an earlier
   row may already cover it; a ✅ row in `docs/tracking/bug-status-r2/`, `boards-jobs-bugs/` or
   `templates-ui-bugs.md` may be its twin. Not real, already fixed or a duplicate: no code change, the proof in
   the report.
3. **Zero pending (the owner's order).** When a fix needs a product call, make the sensible one yourself, say it
   in the report's summary, and fix it. Never stop to ask; no human is watching the session.
4. **Every fix is reviewed by a second agent** before it counts: a separate subagent (the Agent tool, or the
   Workflow tool's agents) that did not write it reads the finding, the diff and its test, and tries to prove it
   wrong (not the root cause, a missed variant or caller, a test that passes without the fix). Fix what it finds.
   The protocol's end-of-cluster review still runs on top.
5. **Every fix has a node test that fails without it**, proven on CI with the `failfirst` input, and the existing
   tests of every module you change pass on CI (the `tests` input). Never on your machine.
6. **Parallel inside the session, gently:** the machine has 4 CPUs, so a workflow runs 2 agents at a time; keep CPU
   and memory under 80%. Agents that change files at the same time use `isolation: 'worktree'` or separate files.
7. **Scope:** no accessibility (aria/roles, contrast, focus, target sizes, screen readers) — note one you see, never
   fix it; English only (never touch `src/utils/resumeLanguage*` or right-to-left); a feature never built is not a
   bug. If you change what a `docs/knowledge/` line states, update that line (and `tests/unit/knowledge-docs`'s
   expectations if it pins it). Never edit `docs/tracking/`.
8. **Before the report:** merge the latest `origin/claude/awesome-cerf-t3sh88` into your branch (a merge commit,
   never a rebase or force-push), resolve, and re-run the affected tests on CI. Then write
   `wf-reports/r4-<cluster>.json` as the protocol says (`"cluster": "r4-<cluster>"`, rows keyed by the R4 IDs) and
   push. That file is the coordinator's signal.

## Wave 1 — bugs (started 2026-09-26)

| Cluster | Rows |
|---|---|
| `imp` — import (PDF, Word, text, Markdown, JSON) | R4-IMP-01 … R4-IMP-14 |
| `brd` — boards | R4-BRD-01 … R4-BRD-13 |
| `cl` — cover letters and the writing tools | R4-CL-01 … R4-CL-11 |
| `exp` — exports | R4-EXP-01 … R4-EXP-07, plus **RES-R2-137** (below) |
| `ed` — résumé editor | R4-ED-01 … R4-ED-07 (R4-ED-01 has a patch here, below) |
| `dsn-pdf` — design panel, templates, PDF rendering | R4-DSN-01 … R4-DSN-07, R4-PDF-01 … R4-PDF-04 |
| `sync-job` — accounts, sync, public link; Job Tracker | R4-SYNC-01 … R4-SYNC-06, R4-JOB-01 … R4-JOB-04 |
| `app` — sweep: dashboard, routing, workspace shell, error handling, the UI kit, static pages | found by the session: R4-APP-01 … |

**Two unreviewed patches in this folder:** `RES-R2-137.patch` (+ `.fix.json`: the Word résumé's Modern and Sidebar
header band, the Word letter's contacts beside the name) goes to `exp`; `R4-ED-01.patch` (+ `.fix.json`: the
language Proficiency select) goes to `ed`. Review each with a second agent as in 4, fix what it finds, land it
(`git apply --index --3way`, commit with the manifest's `commit_subject` and `commit_body` and the trailers), and
prove it with `failfirst`. R4-EXP-05 (the Word tooltip's photo line) overlaps RES-R2-137's tooltip change.

**The `app` sweep's files:** `src/App.jsx`, `AppRoutes.jsx`, `main.jsx`, `src/pages/Dashboard.jsx`, `TermsPage.jsx`,
`PrivacyPage.jsx`, `src/components/ResumeCard.jsx`, `ErrorBoundary.jsx`, `src/components/shell/**`,
`src/components/ui/**`, `src/hooks/useBackOrHome.js`, `useUrlState.js`, `useSessionState.js`, `useMediaQuery.js`,
`useOverlayClose.js`, `src/utils/lazyPage.js`, `ids.js`, `uiFormat.js`, `index.css` — follow imports as needed. Find
every real bug confirmed by reading the code end to end (wrong result, crash, data loss, stale state, a control
that does nothing, a race, an edge case: empty, very long, pasted, many items, offline, two tabs), with file:line,
a repro, what the user sees and should see. No speculation, no style nits. Then fix them, highest severity first.

## Wave 2 — design (after wave 1 merges; the owner: every bug first, then design bugs)

| Cluster | Scope |
|---|---|
| `dsg-layout` | Phone width (≤ 640 px) of every page and dialog; visual consistency on desktop and tablet against the UI kit |
| `dsg-flow` | Flow and UX flaws (dead ends, missing empty/loading/error states, wrong copy, no feedback, destructive actions with no confirm or undo, settings that do nothing, lost input); the printed résumé and letter (typography, spacing, Word vs PDF differences) |

Each finds its rows first (`R4-DPH-`, `R4-DVIS-`, `R4-DUX-`, `R4-DOUT-`), then fixes them as above. The fake DOM has
no layout: a layout fix's test asserts the classes or structure that make the layout right.
