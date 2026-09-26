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

## Wave 1b — leftovers the wave 1 clusters found and left out of their rows (the owner: zero pending)

From the reports in [reports/](reports/) (`notes` and `remaining`). Each is a row like the others: confirm it at your
base, fix it with a fail-first test and a second-agent review, or close it with the proof. Accessibility items in the
reports stay deferred and are not listed.

**`lo-imp` — import and Markdown**
- R4-LO-01 PDF and Word "Group roles by company": the employer line with no date over dated roles goes into the previous job and the roles get no company (R4-IMP-09 fixed only Markdown).
- R4-LO-02 A bulleted certificate or award with indented sub-bullets becomes one entry per sub-bullet (markdownLines/clean lose the list depth).
- R4-LO-03 Word hyperlinks written as HYPERLINK field codes (w:instrText) are not read as links.
- R4-LO-04 A Word file with Heading-2 job entries and a later section typed in bold capitals keeps that section inside the last job (R4-IMP-08's guard).
- R4-LO-05 A link inside body text ("text (url)", a Markdown [text](url)) imports as plain text instead of a link in the rich text.
- R4-LO-06 The text import reads "Computer Science - MIT" (no degree) or an unknown degree ("Bootcamp, Full Stack - GA") with the field as the degree.
- R4-LO-07 markdownLines' heading regex drops a trailing "#" ("## C#" → "C"); a link label holding [ ] does not round-trip.
- R4-LO-08 The Markdown export leaves & and | unescaped; a certificate's description prints only in the Markdown export (markdownExport.js certifications) — make the exporters agree.
- R4-LO-09 Export file names: Windows device names (CON, NUL, COM1 …) are not handled (R4-EXP-07).

**`lo-cl` — the writing tools**
- R4-LO-10 STAR Auto-Fix rewrites "did not" to "delivered not" (a helper verb treated as weak).
- R4-LO-11 atsChecker's WEAK_PHRASES uses includes(): "Networked with" counts as "worked with", "unhandled" as "handled".
- R4-LO-12 A <br> inside an inline wrapper (<p><b>A<br>B</b></p>) reads as one statement (R4-CL-04).
- R4-LO-13 A proper noun leading a statement ("Kubernetes cluster…") is lowercased when a power verb is put before it (R4-CL-07).
- R4-LO-14 A statement ending in an abbreviation's dot ("etc.") loses it before the metric (R4-CL-08).
- R4-LO-15 "FY2021" counts as a metric: the year rule checks only the first digit (R4-CL-09).
- R4-LO-16 Text after a nested list inside the same outer item joins the nested bullet, not the outer one (R4-CL-10).

**`lo-misc` — PDF, editor, sync, shell**
- R4-LO-17 prepareFonts gives a face that failed once (a bold on a network hiccup) a donor face's data for the whole session (R4-PDF-02's other half).
- R4-LO-18 PdfPreview's 'online' handler rebuilds only after a font fallback, so a photo that failed offline comes back only on the next edit.
- R4-LO-19 Design → Section Headings' "Section border thickness (pt)" box cannot be emptied, and typing 5 after 2 stores the maximum (the R4-ED-05 bug in DesignPanelHeadings.jsx; update tests/pdf/10-section-headings and cypress/e2e/04-design-left-bar to the intended behaviour).
- R4-LO-20 R4-ED-07 opens any untouched entry, so a blank entry left from an earlier visit opens on load and on each re-expand; untouched() ignores non-string fields (an entry holding only current:true is deleted without asking).
- R4-LO-21 The other month pickers (Experience/Education Start/End, Award and Certificate dates) cut free text they cannot read (R4-ED-03's other half).
- R4-LO-22 Two Publishes within one round trip can both read "no record" and leave an orphan public copy: close it with runTransaction in publicIo.publish (R4-SYNC-01's race).
- R4-LO-23 CollectionSyncDot maps 'offline' to isOnline=false, but failureReport can give 'offline' while the browser is online (update tests/unit/collection-sync-status.unit.mjs:141 to the intended behaviour).
- R4-LO-24 InlineEdit acts on an input method's Escape (and Enter) without isImeKey — the B-20c bug class (IME handling is not accessibility).
- R4-LO-25 QuickSearch's active index can point past a list that shrank while it is open, so Enter does nothing; shell/PlaceholderPage.jsx's ProjectViewPlaceholder is mounted by no route (remove it if nothing uses it).

## Status 2026-09-26 13:50 UTC

Waves 1 and 1b are merged and gated green on `94b4d9b` (gate 36235083234), waiting on the owner's push to master.
Wave 2 did not run: both design sessions stopped at the five-hour usage limit at 10:20 UTC with nothing pushed; start
them again with the Wave 2 brief above.

## Wave 3 — final sweep (the leftovers the clusters saw and left; low, pre-existing)

One session, rows R4-SW-NN in this order, same rules as above. Accessibility items in the reports stay deferred.
- boards (reports/r4-brd.json): a column delete's toast has no Undo; a Kanban row still in a sprint dropped on the
  backlog's foot lands after the last row in no sprint, and the row menu's Move to still lists sprints in Kanban; the
  Epic panel's composer placeholder still reads "What needs to be done?"; R4-BRD-05's second close in the gap before a
  pending open commits has a code guard (0da56a4) but no test.
- writing tools (reports/r4-lo-cl.json): body text after a list (a blockquote) joins the last ATS bullet; text after a
  nested list opens as its own line in the optimizer but joins the outer item in the ATS bullets; the ATS and optimizer
  weak-phrase lists differ ("did", "changed", "ensured" / "tasked with"); a power-verb chip on a negative statement
  ("Did not miss…") gives "Spearheaded did not miss…".
- import (reports/r4-lo-imp.json): PDF sub-bullets carry no depth, and a Word list whose level comes only from its style
  (List Bullet 2, no w:ilvl) reads as level 0; a line that holds a link does not also autolink a bare address; a
  [**bold**](url) label is not linked; a typed " | " inside a Markdown heading or meta field splits into two fields on
  import; CONIN$/CONOUT$ file names.
- Word (reports/r4-exp.json): the Sidebar's Word band can grow when Contacts ↔ Summary exceeds its padding; the Markdown
  import drops a trailing "#" was fixed as R4-LO-07 — check the rest of that note still holds.
