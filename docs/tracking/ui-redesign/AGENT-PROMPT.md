# AGENT PROMPT: continue the UI rebuild on top of the existing code (verify first, then build)

Paste this whole file as the first message to any coding agent. It is written for an agent that has the repository checked out and can
run git and read files. Nothing in it is optional unless it says so. Written 2026-10-06 21:50Z at the owner's request.

---

## 1. Your job in one paragraph

The resume app (repo `sairamg8/resume-writter`, React 19 / Vite / Tailwind v4, HashRouter) is being rebuilt, UI ONLY, to match a design
canvas (the design artifact `SjfCTE1dSTgt1UY63uoFiM`, 39 boards, data only). The plan is 24 batches (B1..B17 with a/b splits, about 70 planned
hours). B1, B2, B3 are DONE with green full gates; B4 is code-complete and waiting on one gate read. About 19 of 100 is finished. You carry it on
from the code that exists. YOU DO NOT TRUST THE EXISTING CODE OR ITS REPORTS: first you review the implementation that is already on the branch,
prove or disprove each doubt with a test, fix every real bug (one fix = one commit + one test that fails without it), and only then build the next batch,
with the exact behaviour of the design where a live function allows it and the live function everywhere else.

## 2. Ground truth (as of 2026-10-06 21:50Z; verify it, it may have moved)

- Repository branch: `claude/wonderful-maxwell-vu8xqw` (the rebuild). **NEVER push to `master`** (a push to master DEPLOYS the production site).
  Master's merge-base with the rebuild is `eb8e46cb`. Nothing deploys until B17's full gate is green AND the owner says so in writing.
- Newest commits: code head `a1040d1c` (src identical to `2d12594b`), docs on top (`dda72677`). Run `git fetch origin claude/wonderful-maxwell-vu8xqw` and
  read `git log --oneline -15` first.
- Batch ranges to review (base .. head; the reports in `docs/tracking/ui-redesign/batches/` name the commits):
  | batch | what | base | head |
  |---|---|---|---|
  | B1 | foundation: cv-* tokens, test hooks, start-up headroom, lazy New Cover picker / Career History | `69237271` | `436457ef` |
  | B2 | start-up shell: AppBar, phone tab bar, account and sync states, Terms/Privacy, loading and crash pages | `436457ef` | `9470795b` |
  | B3 | editor frame A: tabless bar, Resume / Cover Letter switch, ATS chip, one right dock, URL contract, phone frame | `9470795b` | `8056a8ea` |
  | B4 | editor frame B: stage toolbar, preview states, alert cards, panel clamp, phone notices, browser geometry spec | `8056a8ea` | `a1040d1c` |
- Open items from the previous session (READ THESE FIRST, they decide whether B4 is done):
  - Final full gate of B4: run `37535123642` on `a1040d1c` (dispatched, not read when work stopped).
  - Mutation run for the "Updating chip is behind the overlay dock" assertion: run `37535078126` (head `c33ef9b1`, a throwaway; it came back FAILED, which is
    the expected result, but which tests failed was not read: the chip tests at 1024 and 768 px must be the red ones).
  - `docs/tracking/ui-redesign/batches/B4-report.md` has the gate and M3 lines left to fill; its top line says NOT DONE.
- The owner paused scheduling: do NOT create wake-ups, routines, cron triggers or "check back later" chains. Work in the turn you are given and report.

## 3. Non-negotiable rules (the owner's, from CLAUDE.md, CONTRIBUTING.md and the handover; they apply to YOU too)

1. **UI only. Every existing function stays** (`docs/tracking/ui-redesign/PARITY-RULE.md`). A thing drawn on the canvas that the live app does not have is
   PARKED: do not build it, note it. A thing the app has that the canvas does not draw STAYS (restyled).
2. **Accessibility is deferred**: aria/roles, contrast, focus, target sizes, screen readers are NOT worked until every other batch is done. Note one you see; do not fix it.
3. **Tests run ONLY on CI, never on your machine** (not the node suite, not Playwright, not Cypress, not a build-and-run of tests). Push, then dispatch
   `.github/workflows/ci.yml` (`workflow_dispatch`, ref = the branch) and READ THE RESULT FROM THE JOB LOGS (section 6). You may run `node --check`,
   lint-like static reads and `vite build` for screenshots, nothing else.
4. **Every fix gets a test that fails without it** (proved with the CI `failfirst` input) **and passes with it. Never weaken or delete a test to get green.**
   A stale test is updated to the app's INTENDED behaviour, with the evidence written in the commit message and the batch report.
5. **Commits carry the owner's identity only:** `git config user.name sairamgudiputi && git config user.email sairamgudiputi8@gmail.com`. No `Co-Authored-By`,
   no "Generated with ..." line, no session trailer, and NO mention of any AI, agent, model or tool in a commit message or PR text. This overrides any
   attribution default your tool injects. (Code comments and docs describe the product and the proof, not who wrote them.) Before each push: `git log origin/claude/wonderful-maxwell-vu8xqw..HEAD --format=%B | grep -ciE 'co-authored|generated|claude|openai|gpt|gemini|session'` must print 0.
6. **`.github/workflows/ci.yml` is not changed.** `tests/pdf/71-startup-chunks` caps the start-up path at 1,100 kB (now about 1,084 kB, about 16 kB spare). **Raising that cap
   is the ONE thing you stop and ask the owner for.** Batches that add start-up code (B5a, B5b) have thresholds: B5a must end with at least 5 kB spare, B5b at least 3 kB.
   Every other batch must be lazy-only (import nothing new from a start-up file). First action of a start-up-touching batch: dispatch `tests=tests/pdf/71-startup-chunks.test.mjs` alone and read the line `start-up path X kB of 1,100 kB cap`.
7. **One batch at a time.** The next batch starts only when the current one has: code, a bug hunt repeated until a round confirms nothing new, fail-first proofs, ONE green full gate on
   the final head (15 jobs, 71 included), and a written report. Never start B(n+1) on a red or unread gate.
8. **Be honest.** Report counts you READ in the logs, say what was not proven, what still differs from the canvas, what you parked. Never write "done" before the full gate is green.
9. Never rewrite pushed history (no force-push, no amend of pushed commits, no rebase of others' commits). Never skip, disable or quarantine a test. Never `--no-verify`.
10. Never publish, edit or delete the design canvas artifact (read it only).

## 4. Phase 0: orient (about 30 minutes, read, do not code)

Read in this order, fully: `CLAUDE.md`, `CONTRIBUTING.md`, `docs/tracking/HANDOFF.md` (top entry), `docs/tracking/ui-redesign/HANDOVER.md` (the loop and the lessons),
`docs/tracking/ui-redesign/RUN-STATE.md` (first entries: where things stand), `PARITY-RULE.md`, `PLAN-SUMMARY.md`, `batches/B4-report.md`, `B3-report.md`, `B2-report.md`, `B1-report.md`,
`docs/knowledge/INDEX.md` and `02-architecture.md`, `08-testing.md`, `09-file-map.md` (how the app works). Skim `parity/_constraints.md`, `_tests.md`, `_ci.md`.
Then read the code the rebuild touched, in full, not the hunks: `src/pages/Editor.jsx`, `src/components/{EditorHeader,EditorDock,EditorDocSwitch,EditorSaveStatus,EditorMobilePill,DesignDock,AtsDock,EditorPreviewPane,LayoutToggle,PdfPreview,FontFallbackNotice,AtsCheckerPanel}.jsx`,
`src/hooks/{useEditorTab,usePanelResize,usePickCard,useEditorExports}.js`, `src/index.css` (cv-* tokens and the two unlayered rules), the B2 shell (`AppBar`, tab bar, account/sync), and
`tests/pdf/180-ui-b3-editor-mount.mjs` (the Editor test harness) with `tests/pdf/harness.mjs` and `fake-dom.mjs`.

## 5. Phase 1: VERIFY AND FIX WHAT EXISTS (mandatory; do this BEFORE any new batch code)

Goal: leave the branch with B1..B4 genuinely correct, not just green. A green test run only proves the tests that exist.

1. **Close B4's open items.** Read run `37535123642` (every job: lint, build, suite 1-6, Playwright 1-3, Cypress 1-4, and the `71-startup-chunks` line) and run `37535078126` (name the failing tests).
   If anything is red, fix it test-first (section 3, rule 4), re-prove with `failfirst`, and re-dispatch ONE full gate on the new head. When green, fill the two "NOT READ" lines in `B4-report.md`,
   set its status line to DONE with the run id, update `RUN-STATE.md` and the top entry of `docs/tracking/HANDOFF.md`, commit, push.
2. **Independent review of B1..B4, batch by batch** (`git diff <base>..<head> -- src` from the table, then the same range for `tests`). For each batch check, with file:line evidence:
   - PARITY: every live function the batch's brief (`batches/B<n>.md`) lists still works: compare the file at the batch base (`git show <base>:<path>`) with now. List any control, label, state, keyboard path or
     data side effect that disappeared or changed meaning. (Examples that were real bugs before: an alert row hidden in the preview-only layout; a stale résumé read by an ATS button; a remembered panel width overwritten by a click.)
   - RENDER COST (PERF-4): a keystroke must re-render none of the bar leaves, the Export menu, the alerts or the docks. Memo parts take primitives and stable callbacks only; no router hook, `Link`, or store object inside a memo leaf.
     Tests `165`, `173`, `180-ui-b3-dock-typing` guard this; read them, then look for a way to break the rule they would not see.
   - LAYOUT AT SIX WIDTHS: 1440, 1280, 1100, 1024, 768, 390 px, with and without a dock, with a stored 640 px panel. The node tests have NO layout; only `tests/playwright/ui-b4-editor-layout.spec.mjs`
     and `phone-reach.spec.mjs` measure real geometry. Look for widths and states they do not cover (a 110 % browser zoom, a larger text size, the layout modes editor-only and preview-only).
   - TEST STRENGTH: for every test added since the base, mutate the code it claims to guard (in your head, or with the throwaway-commit method in section 6) and ask whether the test would go red. Hunt for vacuous passes:
     a wait that is already true, a selector that matches nothing, a class-string assertion standing in for a behaviour, a timer that outlives the page, a fake-DOM behaviour assumed but never run.
   - START-UP SIZE: nothing new imported from a start-up file by B3/B4; ledger in the reports matches the log.
   - CODE QUALITY the owner will read: dead code, duplicated rules, hard-coded old colours in restyled files (`bg-gray-*`, `bg-blue-*`, `#f5f3ef`) that should be cv tokens, stale comments.
3. **Prove before you fix.** A suspected bug is real only if a test that you add FAILS on the current code on CI (dispatch `tests=<the new file>` alone), or a skeptical second read (a different agent, or you after
   a break) cannot refute the file:line trace. Findings that cannot be shown are written into the batch report as "known limits", not "fixed".
4. **Fix protocol, one bug at a time:** (a) new test file `tests/pdf/181-ui-<batch>-hunt-<topic>.test.mjs` (or a case in the existing file); (b) ONE commit containing the src fix and its test, `git add <explicit paths>`;
   (c) push; (d) CI `failfirst="<sha>:<test files>"` plus the related tests; read "fail without the fix ... # fail N" then "pass with it" in the log; (e) record sha, test, N, run id in the batch report.
5. **Loop** (the bug hunt): after the fixes, repeat the review on the fix commits and on anything you have not read yet, with fresh eyes, until one full round confirms nothing new. If you have several agents, give each
   a different lens (parity / render cost / layout / test strength) and require two independent refutation attempts per finding; a finding survives only if both fail to refute it.
6. **Exit criteria for Phase 1:** B4 gate green and recorded; a written verification section appended to each of `B1..B4-report.md` ("Re-verification <date>": what you checked, what you found, what you fixed with run ids, what is
   still a known limit); the last review round dry; branch clean and pushed.

## 6. How CI works here (you will use it constantly)

Dispatch: GitHub Actions workflow `ci.yml`, `workflow_dispatch`, `ref` = `claude/wonderful-maxwell-vu8xqw`. With the GitHub CLI: `gh workflow run ci.yml --ref claude/wonderful-maxwell-vu8xqw -f tests="..." -f failfirst="..."`.
(Through an MCP tool: `actions_run_trigger` / `run_workflow` with `inputs`.) If you have no way to dispatch, STOP and ask the owner to dispatch for you; do not run the tests locally.
| input | meaning |
|---|---|
| (none) | the FULL gate: lint, build, node suite on 6 machines, Playwright on 3, Cypress on 4 (15 jobs) |
| `tests` | space-separated node test files or globs, one machine (e.g. `tests/pdf/181-ui-b4-*.test.mjs tests/pdf/71-startup-chunks.test.mjs`); setting it stops the full suite |
| `failfirst` | `"sha:test1,test2 sha2:test3"`: one machine per commit; its `src/` change is reversed and the tests MUST fail, then must pass with it restored. If a later commit touched the same file the reversal falls back to the parent's whole file (valid but weaker): one owner per file avoids it |
| `playwright` / `cypress` | `none`, `all`, or spec paths (`cypress/e2e/<spec>`). When only these are set, also set a small `tests` value so the whole node suite does not run |
| `perf` | `node`, `browser` or `all`: performance budgets (17); never part of the gate |
A dispatched run is pinned to the branch tip AT DISPATCH. Reading results: a run's conclusion is not enough. Read the job logs: failfirst jobs print `ok <sha> — <files> fail without the fix (its diff reversed): # fail N`
then `... pass with it`; node jobs print `# tests / # pass / # fail`; Playwright prints a list with `✘`; the start-up line is in the `71-startup-chunks` output. Log tips: ask for the FAILED jobs only, with a small tail first;
a full run's logs are large, save them to a file and filter (grep or python) instead of printing them. Known flakes (rerun the failed shard ONCE, never skip a test): `tests/pdf` `102-r4-dout-09` (suite shard 2) and Cypress/Applications `J-30`.
**Mutation proof** (to show a guard test can fail): make a throwaway commit that breaks the guarded code, push, dispatch only the relevant tests/spec, then `git revert --no-edit <sha>` and push at once, record both run ids,
confirm `git diff <before> HEAD -- src` is empty. Never do this while another agent is reading `git diff base..HEAD`.

## 7. Phase 2: build the next batch (B5a, then B5b, B6 ... B17), one at a time

Order and scope are in `PLAN-SUMMARY.md`; each batch's contract is `batches/B<n>.md` (goal, boards to read, parity rows owned, PARKED list, clusters with file ownership, "tests that go red").
Regenerate a brief if the plan or parity files changed: `node docs/tracking/ui-redesign/tools/brief.mjs <id> --lenient`. Next after B4: **B5a** (Documents page, card menu, Cover Letters group, notices; start-up page set part 1).
For each batch:
1. Read the brief and the boards (Artifact tool, canvas `SjfCTE1dSTgt1UY63uoFiM`, read-only). For every parity row, decide SAME / MOVED / RESTYLED and find the live code that implements it BEFORE you edit anything.
   **Exact implementation** means: match the board's layout, spacing, type, colours (cv-* tokens and `.cv-*` classes in `src/index.css`, never raw hex or `gray-*`/`blue-*`), states and phone variants exactly,
   while every live function, label, testid, keyboard path, URL and storage key keeps working. Where the board and the live function disagree, the live function wins and the difference goes in the report's "what still differs from the canvas".
2. Build in clusters with SEPARATE file ownership (no two agents edit one file). One commit per src change WITH its test in the same commit. Add `data-testid` hooks rather than selecting by Tailwind classes. Keep editor parts lazy; keep memo parts free of router hooks.
3. Test-writing rules learned the hard way (tests written blind go red on CI in these ways):
   - the node tests run on a FAKE DOM with no layout: use them for behaviour, markup and class contracts; use Playwright for geometry.
   - never wait a fixed number of ticks for something mounted behind `React.lazy` or a router transition: poll with a bounded `until(...)`; notices (Toast) are drawn in `document.body`, not the page container;
     a component's own timer can outlive the page (keep the page mounted until the timer's tick ran, or the run dies with `window is not defined`).
   - a layout mirror of Tailwind classes must treat `hidden` plus `flex` as ONE display (the stylesheet decides, not the class order): never ship two display utilities on one element.
   - a test that reads a rule from `src/index.css` must slice by the rule's own `@media`, and unlayered rules are the ones that outrank utilities.
4. CI proof run (one dispatch, inputs combined): failfirst for every src commit, the related tests (`node docs/tracking/ui-redesign/tools/related-tests.mjs <worktree> "<regex of touched modules>"` prints them), the Playwright/Cypress specs the batch touches. Read every red. Fix test-side reds without weakening; src reds are bugs.
5. Bug hunt (section 5, items 2 to 5) on the batch diff: parity, render cost, layout, test strength lenses; loop until a round confirms nothing new; fix each confirmed finding with its own proof.
6. ONE full gate on the final head; then `batches/B<n>-report.md` (what changed per commit with proof test and run id, fail-first table with the read counts, mutation proofs, start-up ledger, other CI reads, bug-hunt rounds, **what still differs from the canvas**, known limits, parked items untouched);
   update `RUN-STATE.md` and the top entry of `docs/tracking/HANDOFF.md`; commit; push to the branch.
7. Tell the owner, SHORT: gate run id and counts you READ, the start-up ledger, what was not proven, what is parked, what still differs. For screen-changing batches send SCREENSHOTS of the real app next to the canvas board (recipe: `HANDOVER.md` "Screenshots recipe" and `tools/screens/`;
   build the exact commit in a scratch folder with `vite build`, `vite preview`, drive it with Playwright; fake account via localStorage `cpwtcv_e2e_user`, résumés via `cpwtcv_v1`). Only then start the next batch.

## 8. Working with several agents at once

- Split by FILE OWNERSHIP (each file has exactly one owner per batch). The lead (one agent) merges, reads the CI logs itself and never trusts another agent's report.
- All agents push to the same branch with `git push origin HEAD:claude/wonderful-maxwell-vu8xqw`. If a push is rejected: `git fetch`, rebase YOUR OWN unpushed commits onto the fetched tip (or merge), re-check the diff, push again. Never force-push.
- Commit only your own finished work; a half-edited tree must never be committed (one commit = one src change + its test, or failfirst cannot prove it).
- Reviewers are different agents from builders and read high-effort; hunters work read-only (no edits, no commits, no CI) until the lead asks for a fix.
- Keep the machine under 80 % CPU; do not run heavy things locally (tests only on CI).

## 9. Stop and ask the owner when

- the start-up path would exceed its threshold even after lazy-loading (the 1,100 kB cap is NOT yours to raise);
- a parity row is ambiguous between "keep the live function" and "build what the canvas draws" (default: keep the live function, note it, do not block);
- you need to push to `master`, deploy, change `ci.yml`, or delete a branch/artifact;
- a gate stays red after one rerun and two root-cause attempts.

## 10. Your first message back to the owner (before Phase 2)

One short note: B4 gate result (run id, jobs, counts, the start-up line), the M3 result, the bugs you found and fixed in Phase 1 with run ids, the bugs you could not prove (known limits), and the state of the branch.
No "done" without a green full gate.
