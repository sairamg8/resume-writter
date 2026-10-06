# Session Handoff — Resume Here

**2026-10-06 — FOUR CLUSTER SESSIONS RUNNING (the owner approved the leftovers and the third batch). Coordinator: session_01CgPsaykjwUSaG9jYctbiHP on `claude/pending-bugs-review-epd21f` (= master `3f579152`, push gate GREEN, run 37312953580).**
Each session owns its cluster alone, runs on claude-sonnet-5-5 with at most ONE sub-agent that splits the work and cross-reviews, proves each fix with `failfirst` on CI, pushes only to its own branch (never master, no PR) and writes `wf-reports/<cluster>.json` last; each also messages the coordinator when done. The effort level could not be set from the create call (no such parameter): set it in the app per session if Max is wanted.
- **A** `session_018EW2Z7FA9mS1fGkrt3v7U1` → `claude/wf-1006-a-redos`: sanitizer link addresses redone (budget in escaped characters or none; never drops links; the parked `archive/fix-tf-redos-link-budget`), importFile.js `withLinks` copy per link, extractJobKeywords on 12,000 repeats (reproduce first), differential test for `hasDataUrlInTag`, the three output-changing bounds (toRoman, MARKER_CAP, bracketYears).
- **B** `session_0162qUGy89jsNZ4eradjpmYF` → `claude/wf-1006-b-perf4`: PERF-4, render-count test first, then the minimal fix; before/after numbers from the perf harness.
- **C** `session_01MxyqABnyrEiQcnMbYhewct` → `claude/wf-1006-c-jobtracker`: Job Tracker 3000-job search stall (work counts), 5.7 MB paste stall (reproduce at HEAD first).
- **D** `session_01P5HFvQQf5VxhgFphoEb5m4` → `claude/wf-1006-d-preview-dash-import`: stuck-preview state-machine invariant test, second-agent review of the round-12 dashboard fixes (51cc5eb4), Executive/Timeline company/role and right-sidebar PDF import round trips.
**Status 2026-10-06 ~02:00 UTC:** C reported first (head `97729abe`): C-1 fixed (per-job cached search text, memoised cards; proved by counts for 3000 jobs); C-2 PARTIAL: the hunt never names the field of the 5.7 MB paste, the only slow path measured in node was the ATS job-description box (now composed once, and capped at 200,000 characters with a visible notice: C's product call, which changes what that box takes); C-3 not a bug. C was sent two follow-ups: the memoised cards freeze DatePill's overdue state past midnight (fix with a day prop), and one CI browser measurement round for the 5.7 MB paste. **START-UP MARGIN: master `3f579152` itself prints "start-up path 1100.0 kB of the 1,100 kB cap: 0.0 kB to spare" (run 37401441776, 71-startup-chunks, green); the 7.9 kB in the entries below is stale. Any net growth of the start-up path fails the gate: A, B and D were told to offset any bytes they add and to report the figure.**
**Next:** as each report lands, merge the branches into one batch branch (A and D both touch importFile.js), run ONE full gate on it, fix any red, then fast-forward master only on a green gate of that exact commit (the owner's call); update the tracker rows (R2-142, bug-status) in the same step. Do not dispatch the full gate per cluster.

**2026-10-05 night — MASTER = `2844c8fe` + this docs commit, pushed at the owner's order WITHOUT reading a full gate. GitHub has ONE branch, master (plus archive tags); every other branch was merged and deleted; no local worktrees remain.**
**FIRST on a cold start: read master's push gate (`gh run list -R sairamg8/resume-writter --branch master --limit 3`, then `gh run view <id> --json jobs`) and fix any red on master, fix-forward.** The previous master `2f20b796` was red on three stale reference tests
(tf-redos-bullet-autofix, tf-redos-bullet-tail-runs, tf-redos-phone compared the new code with frozen old copies in tests/fixtures/typing-freeze-reference, and the small-bug fixes had changed behaviour on purpose since); `8c0c3e40` refreshed those two copies (targeted run 37310625495 green).
Also on master now: the ReDoS leftovers of the second review, with tests/unit/tf-redos-rest.unit.mjs (fail-first proved, run 37311768975; 794 related tests + lint green, 37311338104): importText.js bareAddress (trailing slashes by index) and takeContacts (a suffix array, not slice().some per line); importFile.js PAGE_OF/FURNITURE (no \s* before \s*$), Word date cell (white-space runs made one space before readDateRange), the PDF paragraph's link list (copied once, then pushed to);
atsChecker.js email check (looksLikeEmail, by index) and extractBulletsFromItem's continuation lookup (cached per depth). Not run yet: the full gate on this tree.
Not on master, kept as the tag `archive/fix-tf-redos-link-budget` (`d1eabe2c` + `7ece57d3`): the sanitizer's link-address change that DROPS links on small documents (budget in input characters, cost in escaped characters) and is still N x L quadratic; redo it with the budget in escaped characters or without a budget.
Still open (small, from the reviews, not hunted for): importFile.js withLinks `kept.links = [...]` per link; no differential test for `hasDataUrlInTag`; bounds that change output on huge inputs (toRoman >= 100000, MARKER_CAP 256, bracketYears 1000 characters). Third batch NOT started (owner has not approved): PERF-4, Job Tracker 3000-job search + 5.7 MB paste stalls,
stuck-preview state machine, review of the round-12 dashboard fixes (51cc5eb4), Executive/Timeline import (R2-148-c) and right-sidebar PDF import. Owner items: tag v0.1.0; Terms/Privacy vs the hosting domain; env vars. Accessibility deferred. Tracker rows (R2-142, bug-status) are not updated for these fixes.

**2026-10-05 evening (superseded by the night entry above) — MASTER = the merge of the typing-freeze leftovers and the small bugs; pushed at the owner's order WITHOUT waiting for the full gate.**
**FIRST on a cold start: read master's push gate on this commit (`gh run list -R sairamg8/resume-writter --branch master --limit 3`, then `gh run view <id> --json jobs`) and fix any red on master (the owner's instruction: fix forward, never leave it).**
Likely reds to look for first, because they could not be checked: tests/pdf 71-startup-chunks (the start-up path had 7.9 kB of margin and the cross-tab merge adds `src/utils/mergeResume.js` to it), tests of `src/utils/importText.js`
(two branches rewrote it: the ReDoS linearisation and the header-town recogniser; git merged them without a conflict) and of `src/utils/contacts.js` (one conflict, resolved by keeping the vanity-phone `dial` rule; the 200-character cap bounds its loop), the flake tests/pdf/102-r4-dout-09-letter-title-weight (suite 2/6).
What master now carries, each with its own fail-first proof and second-agent review on its branch (branches stay on GitHub, nothing deleted):
- typing-freeze finding 5, cross-tab: `claude/fix-tf-xtab` (a tab reads storage before it writes; résumé, job, board and stage stores; `src/utils/mergeResume.js`).
- finding 6, ATS job-description regex and per-key recompute: `claude/fix-tf-ats`. Finding 7: composition flag `claude/fix-tf-comp`; Sidebar long token and huge paste `claude/fix-tf-sidebar`;
  paste/import ReDoS `claude/fix-tf-redos` UP TO `42ad69ea` (35 commits: richText tokenizer and buildTree iterative, bulletOptimizer, import text/PDF/Word, Markdown export, letter, dashboard card, share panel, contacts phone).
- the four small bugs (`claude/small-leftovers-1005` = fix-sl-import town recogniser, fix-sl-chip verb chip, fix-sl-tel vanity phone, fix-sl-sync second-tab deletion during the cloud read).
NOT on master, on purpose: the last two commits of `claude/fix-tf-redos`, `d1eabe2c` (a link's address written once per run, with a size budget) and its test commit `7ece57d3`: the reviewers found the budget silently DROPS links on small ordinary documents
(budget in input characters, cost in escaped characters), and the sanitizer is still N x L quadratic after the budget; d1eabe2c is also red on its own. The old per-run anchors stay (fast on normal text).
**Open, from the last ReDoS review (nothing fixed yet; findings with file:line in the review text of workflow wf_6959facc-5ff, journal under ~/.claude/projects/-mnt-Storage-Projects-flowcv/*/subagents/workflows/):** `src/utils/importText.js:101` bareAddress `.replace(/\/+$/,'')` is quadratic on a long run of slashes
(contacts.js got the loop fix, this copy did not); importFile.js PAGE_OF/FURNITURE_TAIL adjacent `\s*` loops; readDateRange on raw docx cell text; importFile.js ~707 `last.links = [...]` copies per joined line; atsChecker.js emailRegex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (two places);
atsChecker extractBulletsFromItem continuation copies the open-item array; importText takeContacts `placeAt.slice(k+1).some(Boolean)` (a text résumé with no heading is quadratic in its lines); extractJobKeywords still 2-5 s on 12,000 repeats of one token (POSTING_ADDRESS leftovers);
no differential test for `hasDataUrlInTag`; toRoman >= 100000, MARKER_CAP 256 and the 1000-character bracketYears bound change output on huge inputs (bounds, not linearisations). Then redo d1eabe2c's link fix (budget in escaped characters, or do it without a budget).
**Third batch, NOT started (the owner has not approved launching it; ask first, check plan usage first):** PERF-4 (the whole editor re-renders per keystroke), Job Tracker 3000-job search stall + 5.7 MB paste stall, the stuck-preview state machine (the hunt's unreproduced "rendering for minutes"), a review of the round-12 dashboard fixes (merge 51cc5eb4, never second-agent reviewed), Executive/Timeline import company/role (R2-148-c, reverted once) and right-sidebar PDF import. The empty local branches `claude/fix-kn-*` can be deleted.
Owner items still open: tag v0.1.0; Terms/Privacy against the hosting domain; env vars. Accessibility stays deferred. Housekeeping: delete `claude/fix-tf-xtab-mut1`, `-mut2`, `-ffcheck`, `claude/proof-*` (mutation/proof branches, they fail on purpose) and the merged `claude/fix-*` once master's gate is green; tracker rows (R2-142, bug-status) are not updated for these fixes yet.
Usage lesson: on 2026-10-05 three workflows (about 45 agents, two reviewers each, up to 3 rounds) took the 5-hour window to 94%; check `get_usage` before launching and ask the owner (the owner pays attention to usage; extra usage is off).

**2026-10-05 — MASTER (LIVE) = `38e7b70e`; the review's follow-ups are on `claude/review-followups-1005` (not merged yet).**
Master `38e7b70e` carries everything: rounds 11-12, the dash/editor/sync fixes, PR #10's features (PERF-5/6, the perf harness,
per-skill level R2-147, public copies index R2-148, Sidebar column layout) and the typing-freeze work reconciled into ONE watchdog
(PERF-6's budgets), the bounded font wait, the one-queued-build preview and the React #185 guard signed out and in. GitHub has a
single branch, master (plus this one until it merges); archive tags kept: `archive/wf-r5-hunt10-pdf-probe` (throwaway probe test),
`archive/typing-freeze-session-notes` (the typing-freeze session's pending notes) and the older `archive/*` ones.
This branch fixes the minor defects an independent review found in `38e7b70e`, each with a fail-first proof on CI:
(1) a font face that lands after its wait lands prepared, never over the donor it was lent, and is not downloaded again (`4e14c0f7`, tests/pdf/118);
(2) font metadata lookups share the build's font deadline; a timed-out lookup is not asked again for a minute (`1c7f4345`, 119, unit fontsource-silent-retry) —
a dead CDN no longer fails every build "took too long"; (3) a CDN wait that starts with the deadline spent gets a bounded grace, no wait past 13 s (`1d25180e`, 120);
(4) a main-thread build past its budget is not overlapped by the next, and Retry takes its file (`0fc9243f`, 121); (5) the lazy public link's retry path is
tested and its laziness checked by module name (`bcb1fdc5`), and the JSON Resume export left the start-up path (`503c3343`, 122): 1,092.1 of 1,100 kB,
7.9 kB to spare (was 4.7); (6) tests 110/111/114 renumbered to 115/116/117, the typing-freeze write-up says what shipped, two comments fixed (`02e27012`).
**Still open:** the typing-freeze hunt's remaining findings (two tabs typing at once lose edits, the ATS job-description regex, richText/bulletOptimizer
ReDoS on paste, the composition flag, the Sidebar long-token cost: TYPING-FREEZE-HUNT-2026-10-05.md); PERF-4 (not started); small leftovers (import:
"Walnut Creek" goes to Additional Information; tools: "Worked extensively on…" + a verb chip; editor: vanity number 1-800-FLOWERS links to tel:1800; sync:
a second tab's deletion during the cloud read can be re-sent); owner items (tag v0.1.0, Terms/Privacy vs the hosting domain, env vars); deferred
accessibility (the new layout buttons lack aria-pressed / group labels). **Next:** the coordinator merges this branch once its full gate is green.

**2026-10-05 — TYPING-FREEZE WORK RECONCILED WITH MASTER on `claude/typing-merge-1005` (master `69fdb98a` + `claude/fix-error-185` up to `7a57c73b`; not merged).**
The hunt's branches (entries below) were cut from old master `e1267bc9`; master has since shipped PERF-5 (PdfPreview) and PERF-6 (its own
worker watchdog). The merges keep master's code and the hunt's docs; each concern is then ported as one commit with its own fail-first proof:
dev-server worker (`e68f64cf`, vite.config.js), one queued preview build (`4a9dcfc9`), preview status after an undone or hidden change
(`7580111a`, new), React #185 (`d22467ca`; signed in too: useCloudSync's status, a later commit), the 10 s font wait, now one deadline per build for all CDN faces (`de914f83`), and ONE watchdog:
PERF-6's budgets (20 s + 250 ms/entry, 40 s cold), now also on the main thread's builds; the hunt's 60 s watchdog is not kept, its cases are
in tests/pdf/112 (`07e823c4`). Knowledge docs and the R2-142 row updated. **Next:** the coordinator merges it after its full gate is green.
Open from the hunt, unchanged: two tabs typing at once lose edits; the ATS job-description regex; richText/bulletOptimizer ReDoS on paste;
the composition flag. A fully dead CDN still costs 8 s per uncached font metadata lookup (fontsource.js, before any face wait).

**2026-10-05 ~11:30 UTC — TYPING-FREEZE HUNT DONE; three fixes + review fixes are on `claude/typing-freeze-fixes` (NOT on master).**
Write-up with file:line, numbers and the open list: [TYPING-FREEZE-HUNT-2026-10-05.md](TYPING-FREEZE-HUNT-2026-10-05.md). **Next: read the newest full-gate run on this
branch's head (dispatched with the final docs commit), fix anything red, then PR it -> master for the owner.** The branch = master + `claude/fix-dev-worker-refresh`
(`13733061`) + `claude/fix-preview-build-backlog` (`dd572528`, `9782f300`, `4692e20a`) + `claude/fix-worker-watchdog` (`7dbf69e9`, `f34a9d0a`); each fix has its own CI proof and a second-agent review.
- **1. The owner's one-off "Website freeze" was `yarn dev`, not the Website field:** the PDF worker died at load on the dev server ("window is not defined": plugin-react's
  Fast Refresh runtime is imported by every JSX module the worker loads), so every preview build ran on the main thread (0.5-1 s stalls per build, any field).
  Fix: `react({ exclude })` keeps `src/templates/pdf/` out of Fast Refresh (vite.config.js, anchored `PDF_WORKER_JSX`). Dev, same 46-key run: worst stall 1165 -> 284 ms.
  CI: fail-first 37258868807 green (it now also reverts vite.config.js: ci.yml), unit 37258878675 green. Production never had it.
- **2. Preview build backlog (prod):** a pause in typing while a build ran started another, and the PDF worker lays jobs out in turn: 72 keys -> 25 builds, 15 queued, preview
  21.6 s behind. PdfPreview now holds ONE queued build (the latest change's) behind the running one. Prod bundle, same run: 6 builds, 1 queued, 1.45 s oldest wait, 5.1 s
  to settle. CI: fail-first 37259106000 green. Existing preview tests that held two builds in flight were updated to the documented contract (commit messages say why).
- **3. Stalled worker watchdog (prod):** a PDF worker job that never replies (a font fetch that stalls) is stopped after 60 s: that build fails with Retry, the jobs behind it go to
  a fresh worker; the main-thread fallback has the same limit. A font face's first fetch is waited for 10 s, then the font prints in Noto Sans with the usual notice
  (pdfBuild.js, pdfFontLoader.js; tests 112 and 113). Checked in the real app on the prod bundle with a stand-in worker: stalled CDN -> ready in ~12 s in Noto Sans; a mute worker ->
  alert + Retry at exactly 60.0 s, Retry works. A face that was only slow rebuilds the preview when it lands (`f34a9d0a`, from the second-agent review). CI: `7dbf69e9` fail-first 37260427341 + related tests 37260435645 green; the same tests on the unfixed parent (branch `claude/tmp-watchdog-unfixed`, delete it) fail by hanging, as they should (37260736638); `f34a9d0a` and the final head: newest runs on this branch.
- **Superseded, owner may delete:** `claude/fix-dev-pdf-worker` (first version of 1, rejected in review: dead-code unit test + wrong-reason fail-first), `claude/tmp-dev-worker-unfixed` and `claude/tmp-watchdog-unfixed` (proof branches).
- **4. React error #185 (a burst of >=51 keystrokes dropped one): FIXED signed out on `claude/fix-error-185`, and signed in on `claude/typing-merge-1005`** — effects asked React for a state on every keystroke (the store's `setSaving`, the preview's `setStatus`, and signed in useCloudSync's sync status, 'syncing' per change); each now asks only for a change. Real key events: 100 of 100 characters kept (signed out). Tests 114 and 117-keystroke-burst-signed-in.
- **Still open from the hunt** (details in the write-up): (5) two tabs of one résumé typing at
  once lose edits even in different fields (whole-résumé merge, useResumeStore.js:71-89); (6) quadratic regex in the ATS job-description box (atsChecker.js:450-457); plus
  richText.js:111 ReDoS on pasted HTML, bulletOptimizer trailing runs, the composition flag, the Sidebar unbreakable-token cost.

**2026-10-05 — FINAL MERGE of the open features (branch `claude/final-1005` = master `4b8b9018` + `claude/wip-link` + `claude/wip-col`).**
Master `4b8b9018` (live; full gates 37255448511 and push run 37256579337 GREEN) already carries rounds 11-12 and the dash, editor and
sync fixes. This branch adds the features that sat in PR #10: PERF-5/6, the perf harness, the per-skill level (R2-147), the public
copies index (R2-148) and the Sidebar column layout (R2-147-col: Design → Layout → Columns, Details, Width; PDF, Word Mixed, JSON
Resume `meta.columnLayout`; no DATA_VERSION change). Every behaviour has a fail-first proof on CI (runs 37256321641, 37256541092,
37258151604, 37259063879). Full gate on this branch's head decides the deploy. Left after it: PERF-4 (one commit per keystroke, not
started), the owner items (tag v0.1.0, Terms/Privacy against the hosting domain, env vars), deferred accessibility (the new layout
buttons have no aria-pressed / group labels), and the small leftovers the agents named: import — a multi-word town not in the known list
("Walnut Creek") goes to Additional Information; tools — "Worked extensively on…" plus a verb chip reads "Spearheaded Worked…";
editor — a vanity number (1-800-FLOWERS) links to tel:1800; sync — a deletion made in a second tab during the cloud-read round trip can
be re-sent. Start-up path 1,098 of the 1,100 kB cap (71-startup-chunks): a few kB more fail the gate. Dash round-12 fixes (3) have no
recorded second-agent review (CI green). Branch clean-up follows this deploy: every branch merged into master is deleted, and the
throwaway probe test is kept as the tag `archive/wf-r5-hunt10-pdf-probe`.

**2026-10-05 — `claude/wip-link` (= wip-open-features-1005 + review): public link, skill level and perf harness verified.** Public
link (R2-148): the `users/{uid}/meta/publicCopies` index reviewed (transactions read first, rerun-safe, no rules change) and pinned by
`tests/pdf/148-*` (failfirst 2be3993b). Skill level (R2-147): 147-* tests proven (failfirst 2be3993b); fixed a public copy publishing
levels of skills deleted from the text (a5aa6647) and JSON Resume dropping the level of a "Python; Go" skill (928d169d). PERF-5/6: tests
110/126 proven; fixed the watchdog letting a worker go when a frozen tab wakes (7a5f6389). Perf harness green (node 12/12, browser 3/3);
a `perf=browser|all` dispatch now also runs Gate B (perf-gate-b spec, skipped by the gate). Still red on the branch, column layout's
(claude/wip-col): dead `PdfSidebarBand.jsx` (dead-code R6-6) and `layoutOptions.js` restating photo options (AUD-25). Start-up path is
1,098 of the 1,100 kB cap (71-startup-chunks): the next few kB on it fail the gate.

**2026-10-05 — SAVED WIP (not deployed, not gated, nothing run): branch `claude/wip-open-features-1005`, based on master `e1267bc9`.** The
weekly usage limit (resets 5 Oct 00:30 IST) killed 5 of 7 feature agents mid-run, so the tree holds partial work. Done: PERF-5 (PdfPreview
paint-before-text + canvas pool, test 110), PERF-6 (pdfBuild.js watchdog, test 126, perf-gate-b spec). Partial/unfinished, edits sit in the
tree: perf harness (tests/perf/, ci.yml, package.json, perf-budget-check unit), skill level (skillLevels.js, tests/pdf/147-*, skills.js,
sidebar skills), column layout (layoutOptions.js, templates.js, PdfPage/PdfSidebar*), public link (publicLink.js). perf-keystroke (PERF-4)
returned nothing: not started. Resume: review each file's diff, finish the five, run CI on the branch, then merge. Open item list: PERF-4,
column layout, per-skill level, deleted-résumé public link; owner actions (v0.1.0, Terms/Privacy, env vars); deferred a11y.

**2026-09-30 06:05 UTC — ROUND 12 import/export/tools merged: r4-green `c283b4b1`** (11 fixes + review fixes: import 4 — stacked
company/role/place/dates, one-word header city, LinkedIn degree abbreviation and grouped role; export 3 — bare-scheme links and labels;
tools 4 — auto-fix and verb chips, share-link 'changed since' counting a blank entry). Seen-list 202. Full gate on c283b4b1 dispatched.
PR #9 (b414cd6) is still open for the owner; a newer deploy PR follows a green c283b4b1. Running: wf_3d096ca1-696 (round 12 dash,
pdf, sync, editor, jobs) and wf_4f72ce87-720 (round 13 import, export, tools). boards DONE.

**2026-09-30 05:20 UTC — master `e1267bc9` (live, the owner's deploy) is GREEN (run 36670757485). DEPLOY: PR #9**
(`claude/deploy-r11-b414cd6`, full gate 36671003710 on `b414cd6a` GREEN) = master + the 5 round-11 import review fixes (live
regressions from the unreviewed import changes). Owner: merge #9 (or `git push origin b414cd6a:refs/heads/master`). Round 12 running.

**2026-09-30 04:55 UTC — ROUND 11 DONE and merged: r4-green `b414cd6a`** (17 seen-list rows; import 5 +review fixes merged now;
jobs review fix 0403359c; dash/sync review fixes). The Website-freeze lead is fixed (33647938: two regexes in displayUrl/safeHref
took quadratic time on long values; test r5-hunt11-website-typing-linear-time). boards DONE (dry in rounds 10 and 11); pdf dry in 11.
Full gate on b414cd6a dispatched ~04:55; when green, pin `claude/deploy-r11-b414cd6` and open the deploy PR (master 33c7c1da is
round 11 before review). Round 12 running: wf_3d096ca1-696 (dash, pdf, sync, editor, jobs) and wf_25bcc698-261 (import, export,
tools), base b414cd6a. Seen-list 191.

**2026-09-30 ~05:00 UTC — DEPLOYED by the owner's order (no CI wait): master = `fa9c6ba4`** = everything: r4-green (round 11 review fixes:
dash, sync, jobs), every claude/wf-r5-hunt11-* branch (incl. import, unreviewed), plus the 7 leftovers (JSON Resume bare-scheme label fixed;
Website typing quadratic paths in contacts.js/richText.js fixed, freeze itself still unreproduced; AUD-09/19/23/25/26 were already fixed,
stale notes closed). r4-green = master. Not merged: claude/wf-r5-hunt10-pdf-probe (probe test), claude/coordinator-lock. The full gate on
`fa9c6ba4` is unread: read it and fix anything red first (new tests still need their fail-first proof).

**2026-09-30 04:40 UTC — LIVE STATE (coordinator session_01CAwUZJx2CYW1r6VSh7tBT6; lock on claude/coordinator-lock):**
- **Deployed:** master `33c7c1da` (owner, 04:15) = rounds 7-10 (60 fixes, gated) + round 11 before review. Master push gate: run 36668036603.
- **r4-green `bff46228`** = master + round-11 review fixes: dash (saved design picked from an imported .json), sync (first-sync
  read order), editor (review clean). Full gate on bff46228 dispatched ~04:40. Next deploy: pin `claude/deploy-r11-<sha>` at a green
  head and open a PR (a PR from r4-green can carry untested code).
- **Jobs review done:** fixed a live regression (re-importing a file with todos: null over a job with emptied to-dos added a copy): 0403359c, merged into r4-green `848da9ff`; full gate on 848da9ff dispatched ~04:45 (supersedes bff46228 for the next deploy). Master's push gate 36668036603 was CANCELLED mid-run; a full gate on master was dispatched ~04:37.
- **Running:** workflow wf_93d8eea6-b09
  (round 11 import fixer, tools fixer and review, export done).
- **Dry tally:** boards has 2 dry rounds (10, 11) and is DONE. pdf is dry in round 11. editor was dry in round 10 but had a
  finding in round 11. Round 12 is next for every area except boards, after round 11's import/tools/jobs land.
- **Rules:** tests run only on CI. Every fix needs a fail-first test and a second agent's review. Commits are authored
  sairamgudiputi with no trailers. Accessibility is deferred. Don't touch private/.

**2026-09-30 04:25 UTC — DEPLOYED BY THE OWNER: master = `33c7c1da`.** PR #8 (rounds 7-10, gated 11ba2ea1) was merged at 04:15,
and the owner then pushed `claude/deploy-all-0930` to master: it also merges the round-11 branches dash, editor, export, jobs,
sync and tools **before their second-agent reviews** (a usage limit, reset 04:00, killed review:sync, review:jobs, review:editor,
fix:dash, fix:import and fix:tools mid-run). Master's own push gate is run 36668036603. If it's red, fix it first: the live site
has the failure. r4-green was fast-forwarded to master. Resumed: wf_8ef0f8a5-e12 and wf_93d8eea6-b09, which finish the round-11
fixes and reviews. A review fix now lands on r4-green, and needs a new deploy PR. Merge note: one conflict in
`src/utils/normalizeResume.js` (withFontChoices + withProjectRoles), both kept. `claude/wf-r5-hunt10-pdf-probe` (probe test) not merged.

**2026-09-30 01:45 UTC — DEPLOY: PR #8** (`claude/deploy-r10-11ba2ea`, rounds 7-10 = 60 fixes, full gate 36654399622 on `11ba2ea1`
GREEN) replaces #7 (marked superseded). Owner: merge #8 (or `git push origin 11ba2ea1:refs/heads/master`), then close #4-#7.

**2026-09-30 02:10 UTC — ROUND 10 DONE (all 9 areas, 12 fixes): `11ba2ea1`.** import 3 (Title-Case sub-label pair swallowed jobs —
a gap in round 9's fix; Markdown blank line after '###' split every entry; unbracketed award years), export 2 (JSON Resume wrote
unprinted entries), tools 3. boards, editor dry. Seen-list 174. Full gate on `11ba2ea1` dispatched; when green, pin
`claude/deploy-r10-11ba2ea` and open the deploy PR replacing #7. Running: round 11 — wf_8ef0f8a5-e12 (six areas) and the
import/export/tools workflow launched 02:10.

**2026-09-30 01:50 UTC — ROUND 10 six areas merged: `79dc42a2`** (boards and editor DRY; dash 1 — a non-list hiddenFields in an
imported .json crashed the editor/PDF; pdf 1 — Skills title orphaned by the category keep; sync 1; jobs 1 — repeat job import
duplicated; each with review fixes). Seen-list 166. Full gate on `79dc42a2` dispatched. Running: wf_4af2d4d7-c83 (round 10 import/
export/tools) and wf_8ef0f8a5-e12 (round 11 dash, pdf, boards, sync, editor, jobs; base 79dc42a2). PR #7 (0373b9e) is the deploy PR.
Dry tally: boards and editor have one dry round (round 10); an area is done after two dry rounds in a row.

**2026-09-30 01:05 UTC — DEPLOY: PR #7** (`claude/deploy-r9-0373b9e`, rounds 7-9 = 48 fixes, full gate 36650099739 on `0373b9e9`
GREEN) replaces #4/#5/#6 (#6 has round-8 import regressions). Owner: merge #7 (or `git push origin 0373b9e9:refs/heads/master`),
then close #4, #5, #6. Round 10 running (wf_98d5855d-049, wf_4af2d4d7-c83).

**2026-09-30 00:45 UTC — ROUND 9 DONE (all 9 areas, 14 fixes): `0373b9e9`.** Import's 3 were REGRESSIONS from round 8's import
fixes (a sub-heading under a job becomes a blank entry; a line ending in bracketed years splits off; a Title-Case sub-heading starts a
section). **PR #6 (1f7ed0e) carries them: marked [Hold], don't merge.** Full gate on `0373b9e9` dispatched ~00:45; when green, pin
`claude/deploy-r9-0373b9e` and open the deploy PR replacing #6. Round 10 running: wf_98d5855d-049 (dash, pdf, boards, sync, editor,
jobs; base 5c6c1e38) and wf_4af2d4d7-c83 (import, export, tools; base 0373b9e9). Seen-list 162.

**2026-09-30 00:25 UTC — ROUND 9 six areas merged: `5c6c1e38`** (8 fixes: dash 1 — a non-text résumé name crashed the editor and
Dashboard; pdf 1 — picked icons fetched as images; boards 1 — float noise in point sums; sync 1 — first-sync record dropped when storage
is full; editor 2; jobs 2). Seen-list 156. **Full gate on `5c6c1e38` dispatched ~00:25.** Running: wf_3bfd91c4-700 (round 9
import/export/tools, base 1f7ed0e8; note editor round 9 also touched atsChecker.js) and wf_98d5855d-049 (round 10 dash, pdf, boards,
sync, editor, jobs, base 5c6c1e38). PR #6 (1f7ed0e) is still the one for the owner to merge.

**2026-09-30 00:05 UTC — DEPLOY: PR #6** (`claude/deploy-r8-1f7ed0e`, rounds 7 + 8 = 34 fixes, full gate 36646361492 on `1f7ed0e8`
GREEN) supersedes #4 and #5. Owner: merge #6 (or `git push origin 1f7ed0e8:refs/heads/master`), then close #4/#5. Round 9 running.

**2026-09-29 23:45 UTC — ROUND 8 DONE (all 9 areas, 13 fixes) and merged: `1f7ed0e8`.** import 4 (+review fixes: undated entry,
bracket dates), export 1 (Word line tab glued words), tools 3 (+review fixes). dash and jobs dry. Seen-list 148. **Full gate on
`1f7ed0e8` dispatched ~23:45 UTC**; when green, pin `claude/deploy-r8-1f7ed0e` and open a deploy PR that supersedes #5. Running:
wf_0a064088-d78 (round 9 dash/pdf/boards/sync/editor/jobs, base ca009d49) and wf_3bfd91c4-700 (round 9 import/export/tools, base 1f7ed0e8).
The container restarted at ~23:50; both round-9 workflows were resumed by run id (journals kept). Gate run 36646361492 on 1f7ed0e8.

**2026-09-29 23:15 UTC — DEPLOY: PR #5** (`claude/deploy-r8-ca009d4`, rounds 7 + 8-first-six = 26 fixes, full gate 36638036654 on
`ca009d49` GREEN) supersedes PR #4; owner merges #5 (or `git push origin ca009d49:refs/heads/master`). A usage limit (reset 22:50)
killed agents mid-run; resumed at 23:10 with the same run ids: wf_df15e7b0-cf8 (round 8 import: fixer partial on its branch,
tools: fixer, export: review) and wf_0a064088-d78 (round 9: skeptics for dash/pdf/boards/sync 1 finding each, finders for editor
and jobs). The fixer now continues an existing claude/wf-r5-hunt<N>-<area> branch instead of restarting it.

**DEPLOY PR RULE (2026-09-29 22:15 UTC):** r4-green moves while the hunt runs, so a PR from r4-green can carry untested
code. To deploy, pin a branch at the exact green-gated commit (`git push origin <sha>:refs/heads/claude/deploy-<tag>-<sha7>`)
and open the PR from that branch. **PR #4** (`claude/deploy-r7-186c06a`, round 7's 21 fixes, full gate 36636419610 GREEN) is
the one for the owner to merge. PR #3 (from r4-green) is marked rolling, don't merge.

**2026-09-29 22:35 UTC — ROUND 8 (first six areas) merged: `ca009d49`.** dash and jobs dry; pdf 1 (Skills Stacked/Tags/Bars category
orphan), boards 2 (+1 review fix), sync 1 (+1 review fix: nested job id), editor 1 (bare 'https://' prints an empty contact). Website-freeze
lead: the editor finder found no loop or pathological regex (still unreproduced). Seen-list 140. **Full gate on `ca009d49` dispatched
~22:35 UTC**; gate on 186c06ab also running. Running: wf_df15e7b0-cf8 (round 8 import/export/tools), wf_0a064088-d78 (round 9 dash, pdf,
boards, sync, editor, jobs; base ca009d49). Round 9 import/export/tools follow round 8's.

**2026-09-29 22:00 UTC — HUNT ROUND 7 DONE (all 9 areas, 21 fixes) and merged into claude/r4-green `186c06ab`.** import (4 +1 review fix),
export (3 +1 review fix: lone surrogate), tools (3 +1 review fix: optimizer Apply anchor) merged after the six below; seen-list 135.
**Full gate on `186c06ab` dispatched ~22:00 UTC** (PR #3's head now includes it; 9519ef6b was the last green). Round 8 running:
wf_e11feb54-e85 (dash, pdf, boards, sync, editor, jobs; base 9519ef6b) and wf_df15e7b0-cf8 (import, export, tools; base 186c06ab).

**2026-09-29 21:20 UTC — COORDINATOR RUN session_01CAwUZJx2CYW1r6VSh7tBT6 (scheduled; lock on claude/coordinator-lock, refreshed every 30 min):**
- The 18:31 coordinator (session_01RkixKL4TAb2mizpdwJHkot) stalled at 18:54 on a permission prompt; its six round-7 areas were all
  finished (CI fail-first + second-agent review) and are now **merged into claude/r4-green** (dash, pdf, boards, sync, editor, jobs:
  11 fixes; aa4fef8b..7bf94d30; seen-list updated 9519ef6b, 125 entries). **Full gate 36630881766 on `9519ef6b` GREEN (21:21 UTC).** Owner deploy: merge PR #3, or `git push origin 9519ef6b:refs/heads/master`.
- PR #3 (r4-green → master) carries round 7 + the starter-test fix; body updated; its head is 9519ef6b + docs only. If more code lands on r4-green before it is merged, gate the new head first.
- Running: workflow wf_4ea29045-3a8 = **round 7 import, export, tools**; workflow wf_e11feb54-e85 = **round 8 dash, pdf, boards,
  sync, editor (+ Website-freeze lead), jobs** (base 9519ef6b). Script: flowcv-hunt-round (finder → skeptic → fixer with fail-first
  on claude/wf-r5-hunt<N>-<area> → reviewer). Still to run: round 8 import, export, tools (after round 7's merge).
- To merge a finished area: `REPORTS=<dir> bash docs/tracking/tools/merge_cluster.sh r5-hunt<N>-<area>`, then
  `git checkout HEAD -- wf-reports`, copy in only that area's report, commit; add its row titles to wf-reports/r5-hunt-seen.json.

**2026-09-29 19:02 UTC — PR #3 (https://github.com/sairamg8/resume-writter/pull/3, r4-green → master) is ready for the owner:**
full gate 36613904350 on `edf0c8fd` GREEN (tests-only fix below; head after it is docs only). If hunt-7 code lands on
r4-green before it is merged, the PR carries that code too: gate the new head before the owner merges.

**2026-09-29 18:45 UTC — master `b4c62440` full gate (run 36611528115) RED, only on 4 stale starter tests:** 91-starter-modal,
93-picker-new-resume, 96-dashboard and playwright picker.spec still expected the sample person ("Sarah Chen") on a role
starter; the app now gives the user's own details (owner's idea, intended). The tests are updated to the intended behaviour
in `edf0c8fd` (no weakening: each asserts the user's own name/contacts and not the sample). Targeted run + full gate on
r4-green dispatched ~18:42 UTC. When green: PR claude/r4-green → master for the owner (tests only; the site doesn't change).

**ROUND 7 RUN (coordinator session_01RkixKL4TAb2mizpdwJHkot, from 18:31 UTC 2026-09-29; lock on claude/coordinator-lock):**
- The previous coordinator (session_01FdiasXrhydMkPZHWFFd4KS) died mid round 7 and left orphaned branches:
  `claude/wf-r5-hunt7-pdf` (1 fix + report, unreviewed), `-boards` (2 fixes), `-editor` (2 fixes), `-jobs` (3 fixes), no reports.
- Workflow wf_ec06ef4f-1f8: round 7 **dash** then **sync** (finder → skeptic → fixer with fail-first → reviewer).
- Workflow wf_a625ed62-47f: finishes the orphaned **pdf, boards, editor, jobs** branches (CI proof, report, second-agent review).
- Still to run for round 7: **import**, then export, tools. Merge each reviewed area into `claude/r4-green`
  (`merge_cluster.sh`, then `git checkout HEAD -- wf-reports` and add only that area's report), add its findings to
  the seen-list, one full gate per batch, then a PR r4-green → master for the owner.
- CI 36611051400 (starter code 9e8817a6) and 36611528115 (master b4c62440): in progress at 18:31, to read.

**OWNER'S HUNT ORDER (2026-09-29 18:30 UTC, applies to round 7 onward):** run the area finders in this priority:
**1 Dashboard, 2 PDF, 3 Boards, 4 Sync, 5 Editor, 6 Import**, then the rest (Export, Jobs, Tools). Start the top areas
first; with the 3-agents-at-a-time limit, lower areas wait. Dashboard includes the new own-details role starters
(`starterFrom`, src/utils/newResume.js) — new code, check it. Deployed: master `b4c62440` (PR #1 + PR #2); full gate
36610064297 on the round-6 code GREEN; runs 36611051400 / 36611528115 on the starter code still to read.

**2026-09-29 18:25 UTC (owner's live session, session_01ETYRFaE8puvYdti25f3jzT):**
- **master = `a561259c`** (owner merged PR #1, `claude/r4-green` → master, at 18:18 UTC, before its gate finished).
  Its code is exactly `8acb687` (round 6 + listOwner fix); full gate 36610064297 on `8acb687` was still running
  (lint, build, fail-first green). If that gate is red, the live site has the failure: fix it first.
- **Owner's idea done:** role starters on /new take the user's own name, contacts, links and photo from their latest
  résumé, not a sample person; the role's title, summary and sections stay as the example (`starterFrom`,
  src/utils/newResume.js; `3a8c295`, test `9e8817a`). Fail-first + unit + Cypress 30 green (run 36611048610), second-agent
  review clean. Now on `claude/r4-green` (`9e8817a`); full gate 36611051400 running on it. PR #2 (r4-green → master)
  opened for the owner — merge only on a green full gate of its head.
- The owner deploys by merging the r4-green → master PR on GitHub (no local push needed).

**HUNT ROUND 6 DONE and merged (coordinator session_01FdiasXrhydMkPZHWFFd4KS, 2026-09-29):** 25 confirmed + fixed +
reviewed (boards 3, jobs 3, dash 4, sync 3, editor 1, pdf 3, import 5, export 3; tools dry; Website-freeze lead: no loop
found). Merge fixes: 8f0e3ad (category Undo sign-out guard, own test), 8acb687 (duplicate listOwner from jobs+sync broke
lint/build: gate 36608111378 on 9c4aaec red for that only). Full gate on 8acb687 dispatched ~18:45 UTC. Round 7 next,
base 8acb687 (script: workflows r5-hunt6 script; finders must only git show/grep, never checkout the shared tree).
Merge note: merge_cluster.sh drops the tracked wf-reports/ — run `git checkout HEAD -- wf-reports` after it and add only
the area's report.

**BUG HUNT RESUMED by the owner 2026-09-29 ~17:00 UTC.** The coordinator routine trig_01NqtyqnKGMDHRm8VnNuJLYL is
re-enabled (every 3 h). Next: resume hunt round 6 from the state below and loop until two consecutive dry rounds.
**Commits (owner rule, 2026-09-29):** author and committer `sairamgudiputi <sairamgudiputi8@gmail.com>`, with no
Co-Authored-By, no Claude-Session trailer and no "Generated with" line. See CLAUDE.md, "Commits carry the owner's identity only".
**DoD progress (2026-09-29, sessions 521f8276 + 45558ac8):** 8 real applications submitted with the owner's résumé, rendered
by FlowCV's own react-pdf code: GitLab, Atlassian and Netflix, then abroad Brex, Databricks, Verkada, Harvey and OpenTable.
Eightfold parsed the PDF header correctly. Greenhouse and Ashby don't parse, and iCIMS kept old profile data. No export
bug found. One editor freeze was seen while typing in Personal Info → Website, not yet reproduced; worth a hunt finder.
Do NOT touch `private/` or the owner's FlowCV app data (owner: "repo data is clean, leave it"). Job-hunt state/next steps live OUTSIDE the repo: `~/Documents/job-hunt/README.md`, `applications.md`,
`shortlist.md` (57 roles abroad, top 20 ranked). Owner's résumé source of truth: `private/sairam-resume.json` (website now
itsairam.netlify.app — owner does not own sairamg.dev). Idea from the owner (not started): for the owner's account, starter
templates should prefill from the private résumé instead of sample people ("Alex Morgan").
Latest green: `910237e` — DEPLOYED to master 2026-09-29 (full gate run 36567126236 GREEN).
Stopped: hunt round 6 (had just started its finders; nothing pushed), the coordinator routine trig_01NqtyqnKGMDHRm8VnNuJLYL
(disabled), the lock refresher. Hunt state to resume from: rounds 1–5 merged (78 fixes; seen-list wf-reports/r5-hunt-seen.json;
round script = finder → skeptic → fixer with fail-first → reviewer per area); not yet dry. Not yet done: STATUS.md/tracker row
updates for Round 5 and ROUND 5 COMPLETE.

> **DEPLOYED 2026-09-29 ~21:45 IST by the owner:** `master` fast-forwarded `17c1430 → 910237e1` (full gate 36567126236
> green; Round 5 + hunt rounds 1–5, 78 fixes). Tracker marked with `r4_tracker.py --deployed 910237e1` (354 ✅). Local
> checkout synced. Nothing newer is green yet.

## ⏩ COLD START HERE — 2026-09-29 03:15 UTC (coordinator session_013S3xa7VBjcBV3avHWTbYQF, scheduled run; owner travelling)

**Lock:** `claude/coordinator-lock` (LOCK refreshed every 30 min while this run works).
**Done this run:** imp (3e4b2e5; 9 rows, review fixed 4 import regressions; open: IMP-REV-4 dash in an issuer-less
certificate/award or a project name splits it — as on master, needs an export-side change; a Word custom list style numbered only in
styles.xml), opt (58b8460; R6a verdicts hold; review fixed the sanitizer closing a list before a quote, and the verb chip on No/Nobody/Zero openers), out (4c404e4, 6 rows; review widened the keep-with-next measuring to Projects and every item header; Awards/Certifications title keep still counts one line per field — for the hunt), brd (72af18e, 8 rows + 2 review fixes in boardOps), job (0ffbe5b, 8 rows fixed, reviewer found nothing; main.jsx is now a data router for the Back guard), dash (2d7d165), panels (182e232) and dlg (04ec3bf; 10 rows fixed, product call: the CL Generator ignores a click
beside it once a field is edited, as the optimizer does) merged into `claude/r4-green` (1f99a1a). Gate 36515623771 on 3426a09
(dash+panels) was dispatched; the batch gate for the merged head is still to run.
**In progress:** unfinished r5 clusters, two at a time, each = finish scope → adversarial review → fix → report
`wf-reports/r5-<key>.json` on `claude/wf-r5-<key>`. All 8 r5 clusters merged (27bfddf; full gate 36522551523 GREEN). R2-148 merged (0222f6b: the sync's flush takes a deleted résumé's public copy
down; the takedown skips a résumé that is back; known limit: an unrecorded stray public/ copy can't be listed). Hunt round 1 DONE and merged (5a471df): 13 bugs confirmed + fixed with fail-first
and review in 8 areas (reports wf-reports/r5-hunt1-<area>.json; boards: 1 finding refuted). High: a late document import took over the
open editor (editor); another tab's sign-out could delete every cloud résumé (sync). Full gate 36528111587 on 988681d RED: 2 import tests (96-dashboard 'Import (R2-167)', 99-cover-letters
'letter's JSON… opens on its letter') — stale tests after the hunt1-editor importResume change (the test pages lacked the editor's useOpenResume);
fixed test-only in 0cdc8f3 (CI 36531274182 green, 351/351). Candidate for hunt round 3: the editor's first render after
/resume/:id may briefly show the previous résumé (useOpenResume runs in useEffect).
Gate 36531535738 on 54b9ec2 GREEN (deploy line above). Hunt round 2 DONE and merged (8e2ab9e): 19 bugs confirmed + fixed in all 9 areas
(reports wf-reports/r5-hunt2-<area>.json). Gate 36537511498 on 397f1bb RED only on cypress 06-job-tracker ('Imported 2 job applications.'
never shows after a jobs JSON round-trip; likely hunt2-jobs backup-restore fix) — stale spec (the file's demo_1 now replaces the untouched
demo on purpose); fixed spec-only in 7a05d0f (CI 36539433206 green). Gate 36540411545 on 17c1430 GREEN (deploy line above).
Hunt round 3 DONE and merged (6770951): 15 bugs confirmed + fixed in 9 areas; full gate 36548527667 on e164a94 RED only on 71-startup-chunks (start-up path over 1100 kB again) — trimmed by 885d0d9 (1,078 kB, 22.7 kB margin; fail-first 36551269699, tests 36551295397); gate 36551804673 on 0a0148f GREEN (deploy line above). Hunt round 4 DONE and merged (3e9f28d): 17 bugs confirmed + fixed (export dry; quick-search
exact-key fixed twice — boards' kept, tools' test kept as -limit). Gate 36558724989 on 3e9f28d GREEN. Hunt round 5 DONE and merged (1b82c51): 14 confirmed + fixed (dash, sync dry). Gate 36567126236 on 910237e GREEN. Running since 12:53: hunt round 6
(seen = wf-reports/r5-hunt-seen.json on claude/r4-green; the
round script: 9 area finders → skeptic → fixer with fail-first → reviewer, branches claude/wf-r5-hunt<N>-<area>). Loop rounds until two in a row find nothing new. Batch gate 36517981819 on 0f03b71 was red only on
71-startup-chunks (the data router for R4-DUX-06 + the kit Dialog on the Dashboard: 1107 kB > 1100 kB); fixed by ea59ac6
(1097 kB, fail-first 36520176676; margin ~3 kB). Full gate 36520793636 on ea59ac6 GREEN (owner deploy line above). The 20 dsg-layout rows
all have verdicts (12 in r5-dsgv.json, all fixed-verified — DPH-25/26 fail-first proven in run 36521258078; the rest in r5-dash/panels/dlg/opt). Next: R2-148 (deleted résumé keeps its public link), the whole-app hunt (dry twice).
A cluster is done only when its report is on its branch; merge it then. No full gate yet on the merged head.

## ⏩ COLD START HERE — 2026-09-28 17:10 UTC (coordinator session_01PeuUcY5NWWpCxy878FtEE1, scheduled run; owner offline)

**What happened on 28 Sep:** `master` was pushed to `b8d7667` (Round 4 + wave 2 dsg-flow + dsg-layout) at **03:05 UTC,
before its gate finished**, and Cloudflare deployed it (the deploy does not wait for ci.yml). That gate (run
36372350271) was **red on one job, `suite (3/6)`**: both R4-DVIS-23 tests (`tests/pdf/103-r4-dvis-23-optimizer-not-faded`)
crashed with `container.querySelector is not a function` in the kit Dialog's focus trap — a stale test (it never called
`patchFakeDom` after e3b2030 moved the optimizer onto the kit Dialog), not an app regression. **Fixed in `56e42bf`** on
`claude/r4-green`: the test patches the fake DOM; the redundant outer Portal in RichTextEditor is removed, so the test is
proven fail-first against e3b2030 (run 36453755199: fails 2 without, passes with). 5f52d43's old red fail-first is
thereby resolved: the Dialog's own portal is the fix now. Full gate on `56e42bf`: run 36453759135.

**Work branch:** `claude/r4-green` (from master `b8d7667`). Round 5 clusters (branches `claude/wf-r5-<key>`, reports
`wf-reports/r5-<key>.json`, run by workflows in this session): opt (optimizer review + DUX-22 + wave-3 writing tools),
dash (dashboard review), panels (Design/CL/ATS review), dlg (R4-DVIS-25 + DVIS-07 rest: CL Generator, Header Icon,
NewLetter, ShareLink on the kit Dialog), job (R4-DUX-06 Back/links, Field.jsx, Job not found, quick-search height,
Projects Name cell, Pipeline Close-as wrap), out (DOUT-04/07 leftovers, Word reference e-mail gap, ExportDropdown hint,
Word band), brd (wave 3 boards), imp (wave 3 import). Then a loop-until-dry finder pass over the whole app.
Each cluster is done when its report is on its branch: merge into `claude/r4-green`, one full gate per batch,
fast-forward master only on a green full gate of that exact commit.

**Owner-only:** delete the 14 merged `claude/wf-r4-*` branches (the git proxy refuses deletes) and, once merged, the
`claude/wf-r5-*` ones; tag `v0.1.0`; confirm the Terms and Privacy pages against the hosting domain.
**Trackers:** R4-TRACKER.md now also carries wave 2 (dsg-flow, dsg-layout) and Round 5 rows (`r4_tracker.py` reads
`fixes3/reports/r4-*.json` and `r5-*.json`); R2-137 and R2-133 updated from r4-exp.json (RES-R2-137).

## ⏩ COLD START HERE — 2026-09-26 13:50 UTC (coordinator session_013BXDvmy7T9XQ7CsZWdofVX; the owner's usage is spent)

**State:** every Round 4 bug is fixed on the work branch `claude/awesome-cerf-t3sh88`, and **gate 36235083234 on
`94b4d9b` is GREEN** (full suite, build, lint, Playwright, Cypress). `master` is still `843dded` — nothing of Round 4 is
live. The coordinator's push to master was refused by the session's auto-mode check ("Production Deploy"), so:

1. **Owner: deploy** — `git push origin 94b4d9b:refs/heads/master` (a fast-forward; the commits after it are docs only),
   or merge the work branch on GitHub at that commit. Then `python3 docs/tracking/tools/r4_tracker.py --deployed 94b4d9b`,
   commit, push. No firestore.rules change in Round 4: nothing to publish.
2. **Wave 2 (design) is paused, nothing fixed:** both sessions resumed after the 13:20 UTC reset and saved their
   findings, not yet confirmed, before stopping again. dsg-flow (session_01AmmKmEdcQjMsXCr6cxbAXZ) has 48 rows in
   `wf-reports/r4-dsg-flow-findings.md`. dsg-layout (session_01K2dRPYe8fZU5xwrczhag7U) has 36 rows from 3 of 4 finders in
   `wf-reports/r4-dsg-layout.findings.md`. Both are idle, waiting for a message to carry on. The whole done/pending list
   is in [STATUS.md](STATUS.md).
3. **Wave 3 (final sweep):** the small leftovers the clusters saw and left, listed in R4-CLUSTERS.md "Wave 3".
4. Tracker rows R2-137 and R2-133 (bug-status-r2) still describe the old Word band: set them from
   `fixes3/reports/r4-exp.json` (RES-R2-137, commits `39b3bf7` `a96cebb`).

**Round 4 by cluster** (row lists in R4-CLUSTERS.md, outcomes in [fixes3/R4-TRACKER.md](fixes3/R4-TRACKER.md), reports in
`fixes3/reports/`): the six fixes3 patches (6/6, fail-first 36230047589) · imp 14/14 · brd 13/13 · cl 10/11 (CL-05 not a
bug) · exp 7/8 + RES-R2-137 (EXP-05 already fixed by it) · ed 7/7 (incl. R4-ED-01) · dsn-pdf 10/11 + PDF-02 partly (its
other half is LO-17, fixed) · sync-job 10/10 · app 9/9 (found by the session) · lo-imp 9/9 · lo-cl 7/7 · lo-misc 9/9 —
108 rows: 106 fixed, 1 already fixed, 1 not a bug; every fix fail-first on CI and reviewed by a second agent.
Merges: `bb200f4` (seven clusters; Dashboard.jsx conflict kept R4-IMP-12 and R4-APP-09), `d1af2c5` (the first gate's
three test-only failures), `17c6af2` (brd, lo-cl), `f049af8` (lo-imp, lo-misc). Cluster branches `claude/wf-r4-*` are
merged; the owner may delete them on GitHub (the git proxy refuses deletes).

## ⏩ 2026-09-26 10:15 UTC (cloud coordinator session_013BXDvmy7T9XQ7CsZWdofVX)

**Gate 36233934185 on `5f94749` is GREEN** (eight wave-1 clusters + lo-cl + the six fixes3 fixes + the gate's test fixes
`d1af2c5`). The coordinator's `git push origin 5f94749:refs/heads/master` was refused by the session's auto-mode
permission check ("Production Deploy"): **the owner deploys** — push `5f94749` (or the newer head once its gate is green)
to master, or allow the push in the session. Then `python3 docs/tracking/tools/r4_tracker.py --deployed <sha>`.
All eleven Round 4 clusters are merged on the work branch (lo-imp `4a09893`, lo-misc `f049af8`); 108 rows; a full gate
on the new head was dispatched at 10:15 UTC. No firestore.rules change in Round 4.
Wave 2 (design) sessions from `94b4d9b` (10:13 UTC): dsg-layout session_01K2dRPYe8fZU5xwrczhag7U · dsg-flow
session_01AmmKmEdcQjMsXCr6cxbAXZ (branches `claude/wf-r4-dsg-*`, reports `wf-reports/r4-dsg-*.json`).


**Work branch now `claude/awesome-cerf-t3sh88`** (master `843dded` + the six reviewed fixes of `fixes3/`: R2-148-c
`50b9566`, R2-148-b `9af536c`, RES-R2-140-a `746afa7`, RES-R2-140-c `00b6d78`, R2-147-pn `b58b87f`, PERF-1 `c036c8d`;
oxlint clean). Their fail-first and tests runs were dispatched on the branch (read the two newest `ci.yml`
workflow_dispatch runs on it). The owner is resetting the laptop: nothing depends on it any more; its store's
checklist and pending-bugs.md were not copied up, so work goes on from `fixes3/` alone.
**Round 4 clusters** — the brief and the row lists: [fixes3/R4-CLUSTERS.md](fixes3/R4-CLUSTERS.md). Wave 1 (bugs): eight
cloud sessions on `claude/wf-r4-<cluster>` (imp, brd, cl, exp, ed, dsn-pdf, sync-job, app); each is done when
`wf-reports/r4-<cluster>.json` is on its branch. Then: merge each into the work branch → one full gate → master →
tracker rows; wave 2 (design: dsg-layout, dsg-flow) from the merged branch.
Sessions (08:34 UTC): imp session_016ehqgYvX9wwgL1x6gEQyZz · brd session_019hpMafzJsJDtWkUkC8kn1A · cl
session_01LpUCmQtmevxSyTxCJCWFzT · exp session_01T22uErGMhDgQM2AoHvteUv · ed session_01RmULbsAQNiRSHXyGfvj1ut · dsn-pdf
session_015jr7EiFHdBDX2DFKBB3yU7 · sync-job session_018ykA8zSVUR3WwqSd69zRP6 · app session_014snET2MtPBA5AvN32tmnF7.
**09:20 UTC:** seven clusters reported and merged into the work branch (`bb200f4`; Dashboard.jsx conflict kept both
R4-IMP-12 and R4-APP-09); full gate dispatched on `bb200f4`; brd still working (nudged by trigger at 09:24). Reports kept
in `fixes3/reports/`, tracker `fixes3/R4-TRACKER.md` (`python3 docs/tracking/tools/r4_tracker.py [--deployed <sha>]`).
Wave 1b leftovers (R4-LO-01…25, clusters lo-imp, lo-cl, lo-misc) in R4-CLUSTERS.md.
Wave 1b sessions (09:20 UTC, from `e6edfc4`): lo-imp session_01SgWdHjxzSS97CRbYHJW6Wj · lo-cl session_01CefnMCJBUjNUyADrJ4H76X ·
lo-misc session_01VnvtdsZ8V9QekYoa8wYrEF. Wave 2 (design) starts once wave 1 + 1b are merged and gated.
**09:55 UTC:** gate 36232347364 on `bb200f4` red on 3 test-only causes, fixed in `d1af2c5` (contact guard comments, job-form
stages below the fold, Thickness box counted); brd + lo-cl merged (`17c6af2`); full gate dispatched on `5f94749`. Still
working: lo-imp, lo-misc. Small pre-existing leftovers named in the brd/lo-cl reports' notes go to the final sweep.
Check: `for c in imp brd cl exp ed dsn-pdf sync-job app; do git fetch -q origin claude/wf-r4-$c && git cat-file -e
FETCH_HEAD:wf-reports/r4-$c.json && echo "$c REPORTED"; done`.

## ⏩ COLD START HERE — 2026-09-26 ~14:10 IST (cloud session; only `master` exists)

**Live: `master` = this commit** = wave 3 (B-20c, J-12; full gate 36223045204 ✅ on `1daf0f0`) + docs. Every other branch was
deleted on the owner's order; the unmerged ones are kept as tags `archive/<branch>` (wf-locale = English-only parked,
wf-templates = a11y parked, sweet-turing, wf-pdf-pagination, wf-round2-resume).
**Owner's order:** every bug first, then design bugs; zero pending (Claude makes the product calls); every fix reviewed by a
second agent; no accessibility; English only; tests only on CI; master only on a green full gate.
**Next, in order:** (1) land the six reviewed fixes in `docs/tracking/fixes3/` (`bash docs/tracking/fixes3/land.sh <ID>`):
R2-148-c, R2-148-b, RES-R2-140-a, RES-R2-140-c, R2-147-pn, PERF-1-woff → fail-first on CI (each manifest's `failfirst_tests`)
→ (2) review, then land RES-R2-137 and R4-ED-01 (`.fix.json` only, unreviewed) → (3) fix the 73 findings in
`fixes3/findings-R4.json` (9 areas; each: fix + node test + independent review) → (4) sweep the areas never run: APP
(dashboard, routing, shell, kit) and design (phone layout, visual consistency, UX flows, printed output) → one full gate →
master → tracker rows. The workflow that made them: `fixes3/workflow.js`.

## ⏩ COLD START HERE — 2026-09-26 ~13:00 IST (session 26b8b31a ended; owner starts a new session)

**▶ FIRST, a new session does exactly this:** read CI run **36223045204** (full gate on `1daf0f0` = wave 3):
`gh run view 36223045204 -R sairamg8/resume-writter --json conclusion,jobs`. Green → `git push origin 1daf0f0:refs/heads/master`
(deploys B-20c `5b5c048` + `edbca14` and J-12 `1daf0f0`; fail-first 36223043609 ✅) → in `docs/tracking/boards-jobs-bugs/`
mark J-12 ✅ (deployed in 1daf0f0) → bug-status.md header "deployed = 1daf0f0" → this block → commit, push. Red → read
`gh run view 36223045204 --log-failed`, fix on the work branch, one gate, deploy. Then: R2-148-c (below), the checklist.
Laptop rules: no local tests/builds (CI only), no worktrees, stage explicit paths, ≤5 agents (owner may say none).

**Owner's orders today:** merge everything to master + deploy; fix the pending bugs; **English only** (locale parked);
**no new agents** from here (owner, 11:10). Tests only on CI; master only on a green full gate of that exact commit.
Cloudflare branch builds are OFF (only a master push deploys). Accessibility last.

**Live: `master` = `cb58695`** (waves 1–2 of the bug fixes, combined gate 36221896125, deployed 2026-09-26; before it `e6b1a4a`) — batches 3–5: perf2 + section-look (`91c91c9`), owner-ui R3-009…012 (`f20a62d`), the ten
designed layouts R2-138 + R3-008 (`e6b1a4a`, gate 36218934694). Parked, not merged: `claude/wf-locale` `ac50cf4` (English
only), `claude/wf-templates` (a11y).

**✅ DEPLOYED in `cb58695` — Wave 1 (16 bug fixes, R2-148-c reverted) + wave 2** (36221038666 on `45b6b60` failed only suite 3, R2-148-c) (its previous gate 36220057010
on ebcaab4 failed only the J-38 test, fixed since). Every fix's fail-first is green except the reverted DatePill change.
- B-20 `617f24f` · J-30 `5f86d40` · B-29 `4345a13` · RES-R2-140-b `5fc8925` · R2-148-a `9af32ac` · J-36 `62f024a` ·
  B-05 `ff7e89a` + `9e20f77` · R2-041 `ba0a938` · RES-R2-126 `29fb954` · B-17 `f568ac3` · J-38 `ca13cdb` (+ test fix) ·
  R2-148-d `53ee844` (firestore.rules — ✅ the owner published them, 2026-09-26) · B-13
  `702fb61` · J-39 `d524d97` · RES-R2-135 `ead4f93` · RES-R2-045 `2b12f38` · RES-R2-104 `785b34a` · ~~R2-148-c `95afab8`~~ **reverted** (gate 36221038666: 99-import-roundtrip-columns sidebar read the education's field of study into its description; R2-148-c open again — patch in the store `fixes/R2-148-c.patch`, fix its sidebar-education regression, then re-land).
  RES-R2-043 was already fixed (28b15c6). Owner decides: RES-R2-140-a (offline reorder lost to the cloud's order),
  RES-R2-140-c (a sync icon for jobs/boards — where, what it says), RES-R2-137 (Word Modern banner: reverses R2-133).
- **Next:** 36221038666 green → `git push origin 45b6b60:refs/heads/master` → `python3 docs/tracking/tools/deploy_rows.py
  45b6b60` → set the fixed rows (tracker rows for the RES-* leftovers and Lane C B-/J- rows by hand; `update_tracker.py
  --recount`) → bug-status.md header → this file. Red → read `gh run view <id> --log-failed`, fix, re-gate.

**Wave 2 — landing on the work branch after 45b6b60** (workflow `flowcv-bugfix-wave2`, may still be running; patches in the
store `flowcv/wip/execution-2026-09-26/fixes2/` + the session scratch; land one with
`FIXDIR=<dir> bash /mnt/Storage/my-learning/claude/flowcv/wip/execution-2026-09-26/land.sh <ID>`, then push and dispatch
`gh workflow run ci.yml --ref claude/busy-darwin-yjb13t -f failfirst="<sha>:<tests>"`; `landed.txt` lists what landed).
Landed: RES-R2-151 `68f5d56`, J-38b `2ece50b`, RES-R2-131 note `b8e84eb` (already shipped ab74277), B-29b `b9805bb`,
RES-R2-126b `052b4c0`, RES-R2-137 note `977c89b`, R2-041b `cdd0dd7`, LC-FLIP `395f5e5`, B-20b `e8c0e67` (ff 36221510003), LC-TWINS `2ccd722`, LC-WAVE1 `a1396a7`, H-02 `bf8c750`, H-03 `37e2f31`, H-06 `994e550`, H-07 `d818f80`, H-09 `0aea790`, H-11 `102ee1c`, H-13 — **wave 2 complete**. Then one full gate → deploy.
**Wave 3 (coordinator alone — owner: no new agents), on the work branch after `d67e32f`:** B-20c `5b5c048` (IME Enter in the
11 fields outside the board + a source guard test, tests/unit/ime-enter-guard.unit.mjs), B-20c `edbca14` (the kit's Dialog
and Popover ignore an input method's Escape), J-12 `1daf0f0` (job page one column on phones, long values wrap).
Fail-first 36223043609, full gate 36223045204 on `1daf0f0` → green → `git push origin 1daf0f0:refs/heads/master`, rows.
Still open for the next wave: R2-148-c (re-land its patch after fixing the Sidebar-education import regression), then
the checklist. (The RES-row notes for today's fixes are in the rows.)
**After that:** the checklist's rest (store `flowcv/CHECKLIST-2026-09-25*.md`), accessibility last.
Pending-bug list: store `flowcv/wip/execution-2026-09-26/pending-bugs.md`.

## ⏩ COLD START HERE — 2026-09-25 17:00 UTC (laptop session, owner's execution brief of 21:45 IST)

🔴 **A push to ANY branch deploys the live site** (found 16:40 UTC by the revision session, confirmed here): Cloudflare
Workers Builds builds and deploys every branch, not only master — the live bundle carried claude/wf-owner-ui's /new
page. Until the owner turns off non-production deploys in the Cloudflare dashboard (Settings → Builds), **every branch
must carry `4e68e6a`** (`claude/deploy-guard`: vite.config.js refuses a Workers build of any branch but master,
vite-deploy-guard.js) **before it is pushed**. This docs push to the work branch (code = master `6e19667`) is what
puts master's code back on the live site. The owner was asked to roll back to version 7d1efb15 (6e19667's build).

**Deployed:** `master` = `6e19667` = Round 3 batches 1–2: typography, public link (`e006835`, gate 36109292470; the owner
published the new `firestore.rules`), page numbers and the picker (gate 36158213786 green on `6e19667`). R2-146 ✅.
**Work branch:** `claude/busy-darwin-yjb13t` = master + docs.

**In progress (each on its own branch, the work branch merged into it, reviewed by an agent, fixes committed):**
- perf2 `claude/wf-perf2`: merge `8dbf7f7`, reload-once on a stale page file `580923e`, worker first-build fallback
  `bd3ff9a` (fail-first 36161417165 ✅), lazy workspace shell `cf3ad0e` (start-up path was 1,133 kB > 1.1 MB).
- section-look `claude/wf-section-look`: merge `9fe4865`, Underline colour `1d1b95a`, guard narrowed `e3ff5bc`,
  review fixes `e87aa95` `761696d` `0c0ef29` `a11e174`, `e62647b` reverted (Word already right).
- owner-ui `claude/wf-owner-ui` (R3-009 cursor, R3-010 modals, R3-011/012 the /new page): fail-firsts ✅; its gate
  36161763933 failed only 91-starter-modal (fixed `bf62e48`).
Next per branch: guard merged in → push → full gate → `wf-reports/<cluster>.json` → merge here → gate → deploy.
Then layouts (an agent is diagnosing its failures) → locale (its RTL test fails with its own fix) → R3-008.

**Picker's product calls** (owner left them to Claude): (1) leaving a saved design resets what still holds its values —
kept, Undo covers it; (2) deleting a saved design must hold on every device — **R3-008**; (3) a design saved from an
older résumé keeps only the keys it had — kept.
**New rows R3-009…012 = the owner's four asks of 09-24:** hand cursor, modals close on an outside click, a new résumé
from the account's own data, a `/new` page of template pictures.

**Next, in order:** perf2 (`7a768b4`, gate green, no report; conflicts in `src/AppRoutes.jsx`) → section-look
(`f0fe67f`, red) → layouts (`3e2ed65`, red) → locale (`2f5d9d0`, red) — one at a time, each on its own branch to a
green gate and a `wf-reports/<cluster>.json`, then merged here. Then R3-008…012, the rest of the checklist,
accessibility last.

## ⏩ COLD START HERE — 2026-09-25 07:47 UTC (coordinator session_01XeVJDQKh78wxFo4dTK6ZpW, about to run out)

**Deployed:** `master` = `0a79974` = Round 2 (ten clusters, ATS-7) + the Jira-style revamp of Boards and the Job Tracker.
**Work branch:** `claude/busy-darwin-yjb13t` (head = this commit). Owner's orders: finish the project, fast, agents allowed;
tests only on CI; `master` moves only on a green full gate on that exact commit; accessibility last.

**Do next, in order:**
1. **Gate run 36109292470 on `e006835`** (batch 1: typography + public-link merged, the revamp-merge gaps `a09f005`,
   `3d50022`, and `e006835` — publicLink.js used its own copy of the contact table; the previous gate on `3d50022`, run
   36108339083, failed only `31-contact-fields` for that; its fail-first run 36108340868 is green). Read it with
   `actions_get get_workflow_run 36109292470`; failures with `get_job_logs run_id=… failed_only=true`. On green:
   `git push origin e006835:refs/heads/master`, then `python3 docs/tracking/tools/deploy_rows.py e006835 &&
   python3 docs/tracking/tools/update_tracker.py --recount` (R2-146 ⏸ → ✅), update bug-status.md's "Updated" line,
   commit, push.
2. **Round 3 cluster sessions** (each from `c5acb93`, branch `claude/wf-<cluster>`, done when
   `wf-reports/<cluster>.json` is on its branch). Check: `for c in page-numbers locale perf2 section-look layouts picker;
   do git fetch -q origin claude/wf-$c && git cat-file -e FETCH_HEAD:wf-reports/$c.json && echo "$c REPORTED"; done`.
   Merge each: `REPORTS=/tmp/wf-reports bash docs/tracking/tools/merge_cluster.sh <c>` → resolve → `python3
   docs/tracking/tools/update_tracker.py /tmp/wf-reports/<c>.json` → commit (only the merge + tracker files) → push →
   batch → one full gate (`actions_run_trigger run_workflow ci.yml ref=claude/busy-darwin-yjb13t inputs={}`) → deploy
   as in 1. At 07:45: typography ✅ reported+merged (`323991e`), public-link ✅ reported+merged (`091f00c`);
   **07:55: page-numbers ✅ reported+merged (`3a70d91`**, R2-147 part; conflicts in importFile.js — page furniture is
   now dropped from a page's items before its column split — and wordExport.js — font table + footer, both kept;
   rerere recorded). Not yet gated: batch 2 = `3a70d91` + the next merges. Still working: locale, perf2,
   section-look, layouts, picker.
   Sessions: page-numbers session_01PL4e5MkwcqPVF1pzRc4tAg · typography session_01VrpBFXbHBAp8Aow3YbjvwA ·
   locale session_01DjbrY7hHtJmKD6GJcXHFx7 · perf2 session_017oTZg6ZNCXoJwpKhSURxST · section-look
   session_01A8Pc1gVNQNk225roXUbEns · public-link session_01H7o4mAMVufFnaL8mMiYhCJ · layouts
   session_018uk2NM3EkjexkRoDkRHEEz · picker session_01MkCArZxvT5mbX1ELBQKrAu.
   Watch in merges: the guard `tests/pdf/31-contact-fields` (no second contact table: use `CONTACT_FIELDS`), the
   Design ↺ test `91-design-resets` (new Design keys belong in a section's ↺ list), `tests/unit/knowledge-docs`
   (docs must state the current `DATA_VERSION`), the Playwright parity walk (every new control must repaint).
   **R2-148** is split: public-link did the link and import (partial); set the row fixed when locale's report lands.
3. **After all eight:** the a11y pass (R2-139's A7, A8, A11, A13, A14; A11Y-1…6; parked branch `claude/wf-templates`,
   `67c88c5`) — last, by the owner's rule.

**Owner actions:** publish the new `firestore.rules` to the Firebase project (Share a public link fails permission-denied
until then); tag v0.1.0 when ready; delete merged branches on GitHub (the git proxy refuses deletes): every
`claude/wf-*` of Rounds 1–2, `claude/beautiful-heisenberg-x3bsvo`, `claude/confident-goldberg-2uig8b`,
`claude/sweet-feynman-ro5q2g`, `claude/wf-round2-resume`, `claude/jira-revamp` (all merged); keep `claude/wf-templates`.

## Older handoffs (moved verbatim 2026-09-26, the 300-line cap)

- 2026-09-24 … 2026-09-25 rounds (Round 2 relaunch, its gate and deploy, fix-every-row): [HANDOFF-HISTORY-2026-09.md](HANDOFF-HISTORY-2026-09.md)
- Earlier (2026-07-14, 2026-09-14; where the work lives, what was finished, key PDF files): [HANDOFF-HISTORY-EARLIER.md](HANDOFF-HISTORY-EARLIER.md)

## Conventions established (keep using)

1. Design-panel **spacing is CSS px** → convert **once** to PDF points via `CSS_PX_TO_PT` / `pxToPt`.
2. **Font sizes** are already pt numbers on canvas — **do not** multiply by 0.75.
3. Photos: use `getPdfPhotoStyle(settings, accent, 'classic'|'modern')` — never hardcode sm/md/lg to 40/50/65.
4. Document metadata: creator/producer **CPWT-CV**, not FlowCV.
5. Primary export path: react-pdf; legacy print is fallback only.

---

## Suggested next session prompts

1. “Visually compare canvas vs Export PDF for all 5 templates.”
2. “Prepare repo for free public release (LICENSE, env example, README).”
3. “Continue improving multi-page PDF / sidebar edge cases.”

---

## Quick mental model

```
master (this folder)  = includes React-PDF fidelity + warm export  ← CONTINUE HERE
fix/react-pdf-fidelity = historical feature branch (merged)
```
