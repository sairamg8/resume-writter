# CI proof recipe (scout, 2026-10-06)

Sources read: `.github/workflows/ci.yml` (386 lines), `docs/tracking/CLUSTER-PROTOCOL.md`, `CONTRIBUTING.md`, `wf-reports/1006-f-fonts.json`,
HANDOFF.md top 40 lines, ui-redesign README "BUILD CONSTRAINTS" and RUN-STATE.md. One live read of the run list through the GitHub MCP tool.
Nothing was run; wall times below come from the run list's created_at/updated_at.

## 1. `ci.yml` (workflow id 365701547, file name `ci.yml`)

Triggers (ci.yml:14-17): `push` on `master` only, and `workflow_dispatch`. A branch push does NOT start CI; a dispatch on a branch does
(the file is on the branch because it was cut from master). Concurrency (ci.yml:42-44): a push to master cancels the run it supersedes; each
dispatch has its own group (`ci-<run_id>`), so side-by-side dispatches on one branch never cancel each other.

### Dispatch inputs (ci.yml:18-37), all strings, all optional

| input | what it does | jobs it turns on |
|---|---|---|
| none (all empty) | the full gate: suite 6 + build 1 + playwright 3 + lint 1 + cypress 4 = **15 jobs** (the task says "about 13 machines"; the logs of HANDOFF count 15 jobs; failfirst-plan is not part of it) | suite, build, playwright, lint, cypress |
| `tests` = `"tests/pdf/a.test.mjs tests/unit/b.unit.mjs"` (space-separated paths or globs) | `node --test --test-concurrency=4 $TESTS` on ONE machine in the `ubuntu:26.04` container (Poppler 26.01, mupdf-tools, Node 22). Setting it turns the full suite, build, Playwright and Cypress OFF unless you also name them. Lint still runs (it has no `if`, ci.yml:281). | tests, lint |
| `failfirst` = `"sha:test1,test2 sha2:test3"` (space-separated pairs, tests comma-separated) | one machine PER pair (matrix from `failfirst-plan`, ci.yml:152-161, timeout 60 min). Per pair (ci.yml:198-225): `fetch-depth: 0`; list the commit's changes under `src/ .yarn/patches/ yarn.lock vite.config.js` (error if none); reverse that diff (or checkout the parent's files if it does not apply); run the tests, which MUST FAIL; `git reset --hard`; run again, which MUST PASS. Prints `ok <sha> ... fail without the fix` / `::error::... pass WITHOUT the fix`. Turns the suite/build/playwright/cypress off; lint runs. | failfirst-plan, failfirst (1 per pair), lint |
| `playwright` = `all` / `none` / `"tests/playwright/x.spec.mjs tests/playwright/y.spec.mjs"` | spec files go to `playwright test $SPECS --shard=k/3 --pass-with-no-tests` on all 3 shards (the shards that get no spec pass empty). Empty = all, unless `tests` or `failfirst` or `perf` is set, then nothing. `none` skips build and Playwright. Needs `build` (dist artifact). | build, playwright 3 |
| `cypress` = `all` / `none` / `"cypress/e2e/y.cy.js ..."` | same rule as playwright. The specs are sorted and dealt to 4 machines by `(NR-1) % 4 == shard-1`; a shard with none says "no specs on this shard". Each shard runs its own `vite build --mode e2e` (the fake sign-in seam) then `start-server-and-test` on port 4173. | cypress 4 |
| `perf` = `node` / `browser` / `all` | `tests/perf/run.mjs --only=...` (+ production build, Chromium and `perf-gate-b.spec.mjs` for browser/all) on one machine, 30 min. NEVER part of the gate. When set it turns the suite off, but `build`'s condition ignores perf when `playwright` is set... note: with only `perf` set, `playwright` is '' and `perf != ''` so build/playwright/cypress are off; lint still runs. Fails when a ceiling of `tests/perf/budgets.mjs` is missed; the table is on the job summary. | perf, lint |

Combine inputs to run several things in ONE dispatch, for example `tests` + `playwright` + `cypress` (a named `playwright`/`cypress` value turns
those jobs on even when `tests` is set: build's condition is `playwright != 'none' && (playwright != '' || ...)`). `failfirst` and `tests` can also be
set together (both jobs run). Spec paths in one input are space-separated; the same path twice runs once (node de-duplicates; the fonts report notes it).

### Jobs and machines
| job | name in the run | machines | timeout | reads |
|---|---|---|---|---|
| `suite` | `suite (k/6)` | 6, container ubuntu:26.04, apt installs poppler-utils + mupdf-tools (3 retries, ci.yml:67-77) | 45 min | `node --test --test-shard=k/6 --test-concurrency=4 "tests/pdf/**/*.test.mjs" "tests/unit/*.unit.mjs"`, log `suite.log`; Summary step greps `^# (tests|pass|fail|todo|skipped|cancelled)`, first 40 `^not ok`, and warns each `# SKIP` |
| `tests` | `tests` | 1, same container | 45 | the `tests` input |
| `failfirst-plan` / `failfirst` | `failfirst (<sha:tests>)` | 1 + N | 60 | see above |
| `build` | `build` | 1 | 20 | `vite build --mode production`, uploads `dist` (3 days) |
| `playwright` | `playwright (k/3)` | 3, needs build | 40 | `tests/playwright/*` against `dist`; failure uploads `playwright-report-k` |
| `lint` | `lint` | 1 | 10 | `oxlint src tests cypress` (runs on EVERY dispatch, also targeted ones) |
| `cypress` | `cypress (k/4)` | 4 | 45 | `cypress/e2e/*.cy.js` on the e2e build; failure uploads `cypress-screenshots-k` |
| `perf` | `perf (<value>)` | 1 | 30 | `tests/perf` |

Timing (measured from the run list, 2026-10-06): the full gate takes about **16 min** wall (run 37429442862 07:24:16 to 07:40:34 = 16 m 18 s;
37423216675 06:20:49 to 06:37:01 = 16 m 12 s; master push 37424954253 06:39:21 to 06:55:31 = 16 m 10 s). The failfirst run 37429491216 (two pairs
worth of tests/pdf/176 and 177) took about 1 m 03 s between created and updated, but that is the dispatch-to-last-update stamp, treat as
"a few minutes" with the 26.04 container and `yarn install --immutable` on each machine (CLUSTER-PROTOCOL says "a few minutes" for `tests`). I did
not measure a Playwright-only or Cypress-only run: unknown. The longest single job of the gate was Playwright before it was sharded in 3 (ci.yml:246).

### Known flakes and traps
- Suite shard 2/6: `tests/pdf/102-r4-dout-09-letter-title-weight.test.mjs` is a known flake (HANDOFF 2026-10-05 evening). Re-run only the failed shard once
  (`rerun_failed_jobs`), never weaken the test.
- `tests/pdf/05-fonts.test.mjs` flaked when the live font CDN was slow; since batch b it runs on a local stand-in (`tests/pdf/fake-fontsource.mjs`, 23/23,
  3-4 s). NINE other files still reach the live font CDN (HANDOFF line 11: 05-fonts-scripts, 164-sidebar-token-break, 85-font-glyph-coverage,
  01-text-extraction, 13-sidebar, 74-academic-look, parity/12-fonts, parity/17-lists, 94-bullet-style); `tests/pdf/164-huge-paste-linear` asserts a wall-clock ratio.
- The apt mirror for 26.04 is sometimes mid-sync: the System packages step retries 3 times (run 36015200631 was the case).
- A failfirst on a commit that changes nothing under `src/`, `.yarn/patches/`, `yarn.lock` or `vite.config.js` fails with "changes nothing under src/". A UI commit
  that only adds tests cannot be failfirst'ed; the fix commit (the one with `src/`) must carry or precede the test (the reverse of its src diff is applied to the
  HEAD checkout; the test file at HEAD stays).
- A failfirst log prints only `# fail N` for the reverted run, not which tests (HANDOFF line 8): read the `ok <sha> - ... fail without the fix` line and count.
- Push-trigger runs on master are not relevant to the branch; never push to master (deploys the site, owner's call).
- Master's 71-startup-chunks margin: 0.2 kB at `ccb068ee` per the README; the HANDOFF says 0.0 kB at `3f579152`, then 0.2 after A moved `hasDataUrlInTag`. I did NOT read
  a newer figure. Read it from a run (section 2) before the first batch.

## 2. Dispatching and reading a run without the `gh` CLI

Tools are deferred: load them first with `ToolSearch` query
`select:mcp__github__actions_run_trigger,mcp__github__actions_list,mcp__github__actions_get,mcp__github__get_job_logs`.
Repo: owner `sairamg8`, repo `resume-writter`. Dispatch ref: the pushed branch `claude/wonderful-maxwell-vu8xqw` (RUN-STATE: push with
`git push -u origin HEAD:claude/wonderful-maxwell-vu8xqw` from the worktree; the SHA you name in `failfirst` must be on that pushed branch, because the job checks out the ref with full history).
Push BEFORE you dispatch; a dispatch runs the branch tip at dispatch time.

1. Dispatch (returns no run id in this tool, so list afterwards):
   `mcp__github__actions_run_trigger` `{ method: "run_workflow", owner: "sairamg8", repo: "resume-writter", workflow_id: "ci.yml", ref: "claude/wonderful-maxwell-vu8xqw", inputs: { tests: "tests/pdf/x.test.mjs tests/unit/y.unit.mjs" } }`
   Full gate: omit `inputs` (or `{}`). Fail-first: `inputs: { failfirst: "<40-char or short sha>:tests/pdf/x.test.mjs,tests/unit/y.unit.mjs" }`.
   Specs: `inputs: { tests: "...", playwright: "tests/playwright/a.spec.mjs", cypress: "cypress/e2e/b.cy.js" }`; `playwright: "none"` / `cypress: "none"` to skip.
   All input values are strings.
2. Find the run: `mcp__github__actions_list` `{ method: "list_workflow_runs", owner, repo, resource_id: "ci.yml", workflow_runs_filter: { branch: "claude/wonderful-maxwell-vu8xqw", event: "workflow_dispatch" }, perPage: 5 }`.
   Newest first; confirm `head_sha` is your commit (several dispatches can be in flight; match on `created_at`). `status` queued / in_progress / completed, then `conclusion` success / failure.
3. Poll the jobs: `{ method: "list_workflow_jobs", resource_id: "<run_id>", workflow_jobs_filter: { filter: "latest" } }` (use "latest": after a re-run "all" lists old attempts too).
   Each job has `name`, `status`, `conclusion`, `id`, and steps. Wait with the Monitor tool or a `send_later`, not a foreground sleep.
4. Read a log: `mcp__github__get_job_logs` `{ owner, repo, job_id: <id>, return_content: true, tail_lines: 300 }`, or every failed job at once:
   `{ owner, repo, run_id: <id>, failed_only: true, return_content: true, tail_lines: 300 }`. Default is 500 lines; raise `tail_lines` (2000+) when you need the TAP of a
   whole shard.
5. What to read:
   - Pass/fail counts: the Summary step prints `# tests N`, `# pass N`, `# fail N`, `# skipped N` (node TAP). Every shard must show `# fail 0`; `# skipped` entries are named in a `::warning`. Quote the numbers in your report; "conclusion success" alone is not read.
   - Failures: `not ok ...` lines (first 40 in Summary).
   - Fail-first: for each pair look for `ok  <sha> - <files> fail without the fix (...): # fail N` and then `ok  <sha> - <files> pass with it`. `::error::... pass WITHOUT the fix` means the test proves nothing.
   - Start-up margin: `tests/pdf/71-startup-chunks.test.mjs:115` prints the diagnostic `start-up path X kB of the 1,100 kB cap: Y kB to spare` in the TAP of whichever suite shard holds that file (the shards are an even split of the file list by `--test-shard`, so the shard is not known in advance; I could not determine which). Fastest way to read it: dispatch `tests: "tests/pdf/71-startup-chunks.test.mjs"` alone (one machine, builds the app via Vite in node) and read the log tail; the line starts `# start-up path`. The cap assertion is `total < 1100 * KB` (line 116). Margin as last read in the repo's notes: 0.2 kB. UI code must live in the lazy Editor chunk, not shell or `src/components/ui/*`.
   - Playwright/Cypress: job conclusions per shard; on failure the artifacts `playwright-report-k` / `cypress-screenshots-k` (`actions_list` `list_workflow_run_artifacts`, `actions_get` `download_workflow_run_artifact`).
6. Re-run only what failed: `actions_run_trigger` `{ method: "rerun_failed_jobs", owner, repo, run_id }` (once, for a known flake only). `cancel_workflow_run` to stop a wasted dispatch.
7. `get_job_logs` content for a long shard can be truncated by `tail_lines`; a log that ends before the Summary step means the job is still running or timed out: check the job `status` first.

## 3. BATCH GATE for a UI-only batch

A UI rebuild batch edits `src/` (React components, the Editor chunk), updates stale tests and adds new ones, and touches Cypress/Playwright specs that drive the real Editor
(README BUILD CONSTRAINTS lists them: Cypress 04-design*, 05-cover-letter, 13, 14, 16, 17, 23, 25, 26, 27, 30; Playwright parity-ui-controls, pdf-templates,
pdf-typography-spacing, picker, pw-helpers.openDesignPanel; plus the tab tests 103-r4-dvis-12-editor-tabs-truncate, 32-editor-tab-scroll, 103-r4-dph-31-pill-clears-tab-bottom,
and the parity walker `tests/pdf/parity/panels.mjs`, `walker.mjs`). Order that wastes the least CI (each step is cheaper than the next; stop and fix at the first red):

0. Before dispatching: the lead's own read of the diff (no tests, no local build). `oxlint` is the one thing a worker may run, only on a cloud machine with `yarn install`; here (4-CPU box, rule: no yarn install, no build) lint runs in CI.
1. **ONE targeted dispatch per commit group, combining everything it needs** (inputs can be combined, so this is one run, not three):
   `failfirst: "<fix sha>:<its new tests> ..."` (one machine per commit) for each commit with new `src/` changes.
   Then, as a second dispatch right after (a failfirst and a `tests` run are independent jobs, both can be in one dispatch: `tests` + `failfirst` + `playwright` + `cypress` together):
   `tests`: every new test file plus every existing test file that mounts a changed component (`grep -rl <Component> tests/`: DesignPanel about 70, PersonalInfoEditor about 40, CoverLetterPanel about 25, AtsCheckerPanel about 20, the section editor 60+, the parity walker files, the editor-tab tests above);
   `playwright` and `cypress`: only the spec files the batch changed or that drive the changed screens.
   Add `tests/pdf/71-startup-chunks.test.mjs` to `tests` whenever any non-lazy file was touched (cheap, and it prints the margin).
2. Fix what is red; re-dispatch only the red files (`tests` input), not the whole run. A failure present on the base commit too is a baseline failure (dispatch the same `tests` on the base ref, `master` or the commit before the batch) and is reported, not fixed.
3. **ONE full gate (no inputs) on the final head of the batch**, after all targeted steps are green and everything is pushed. The batch is complete only when it is green: 15 jobs (suite 6/6, build, Playwright 3/3, Cypress 4/4, lint) and 71-startup-chunks passes.
   If one shard is red only on a known flake (102-r4-dout-09 on 2/6): `rerun_failed_jobs` once, record both attempts.
4. A later commit (docs only, or a test-only fix) after the gated head: either re-gate or state exactly which files differ from the gated head (`git diff --stat <gated>..HEAD` must show docs/ only; the HANDOFF entries for master do this).

Why this order: failfirst (1 machine per commit, minutes) catches tests that do not prove their fix; the targeted run catches the 90 percent of reds on 1 to 3 machines;
only then the 16-minute, 15-machine full gate. Never run the full gate per commit or per agent: CLAUDE.md says "gate a batch with one CI run, not one per merge". Do not dispatch the
full gate while a targeted run on the same head is still running (dispatches do not cancel each other, so GitHub just bills both). Playwright is the most costly thing to repeat
(build + 3 machines), so when a UI batch changes browser specs, put them in the single targeted dispatch and re-run only the red spec files.

Stale tests that pin the old layout (editor tabs, the sidebar panel order): update the assertion to the intended behaviour with the evidence in the commit message (PARITY-RULE and
CLAUDE.md: "a stale test is updated to the app's intended behaviour, with the evidence", never skip/delete/weaken). Report each such change.

## 4. Sharing one branch among agents (this box: 4 CPUs, 16 GB, one workflow runs CPUs minus 2 = **2 agents at a time**)

Layout: the main checkout `/home/user/resume-writter` has `claude/wonderful-maxwell-vu8xqw` (the designated push branch) checked out at `eb8e46c`; the lead's worktree is
`/home/user/resume-writter/.claude/worktrees/ui-rebuild` on local branch `worktree-ui-rebuild` (locked; at `0daf99d` when I read it, with `docs/tracking/ui-redesign/parity/` untracked).
Git refuses to check one branch out in two worktrees, so the lead pushes with `git push -u origin HEAD:claude/wonderful-maxwell-vu8xqw` (RUN-STATE) from the worktree; agents never push.
Workers must not `cd` out of the worktree (the task rule). `git config user.name sairamgudiputi && git config user.email sairamgudiputi8@gmail.com` is already needed in any new checkout; no `Co-Authored-By`, no Claude/AI mention, no session trailer (CLAUDE.md overrides the harness' attribution reminder).

Rules:
- **Disjoint files.** Each agent owns a list of files (its component directory, its own tests); the lead's batch file (`batches/B<n>.md`) assigns them. Shared files (`Editor.jsx`, `src/components/editor/*` index files, `vite.config.js`, `package.json`/`yarn.lock`, test helpers like `tests/pdf/harness.mjs`, `pw-helpers`) belong to ONE named owner per batch; others ask the lead.
- **Agents do not commit and do not push** in the read-only/scout phases (this task); in build phases the safe default is: agents edit only their own files in the shared worktree and the LEAD commits, one commit per agent's group (so authorship, message style `fix(<area>): ... ` / `feat(ui): ...`, and no trailers are uniform). If agents must commit (their own worktrees, per README: `ln -s <main>/node_modules`, work works with Vite), each commits only to its own local branch cut from the batch head, and the lead merges.
- **Merge, not rebase, on a branch we created**: the lead merges each agent's branch with `git merge --no-ff` (or cherry-picks) into `worktree-ui-rebuild`; no rebase and no force-push of anything that has already been pushed (CLUSTER-PROTOCOL: "never `--force`", "never another branch"). Rebase is allowed only on an agent's own unpushed local branch before the lead merges it.
- **Push conflict (non-fast-forward)**: `git fetch origin claude/wonderful-maxwell-vu8xqw`, `git merge origin/claude/wonderful-maxwell-vu8xqw` into `worktree-ui-rebuild`, resolve by keeping both sides' intent (never take "theirs" blindly on a test), re-read the conflicted files, push again. Never `--force`, never `--force-with-lease` over somebody's work, never push to master. If the same file was touched by two agents, stop: the lead decides the owner and redoes the smaller change on top.
- Nothing in `src/` is committed without a test that fails without it (failfirst proves it); docs commits need no CI.
- A "rejected" tool call may still have run: check `git log` before retrying (README lessons). `ln -sf <file> /dev/null` and `pkill -f '<pattern in your own command>'` are banned (README lessons).
- **Box limits**: CLAUDE.md "keep this machine's CPU and memory under 80%" = about 3.2 CPUs and 12.9 GB. Agents only read and edit files: no yarn install, no dev server, no build, no tests (HARD RULES), so the box is not the bottleneck; the only limit is the workflow's 2 concurrent agents (`CPUs - 2`). Do not queue many agents in one workflow; spread over several small workflows or cloud sessions if more are needed (CLAUDE.md "Go fast"), and keep the sum under the limits. At start I read 562 MB used of 16,094 MB, 4 CPUs.
- Cadence (RUN-STATE): 3 hours on, 2 hours off; only ONE wake pending at a time; stop workflows at wrap-up and record run ids so the next window continues from "Where we are". CI runs started before a window ends keep running during the gap: read them at the next resume (RUN-STATE "Resume procedure" step 3).

## 5. Lead's checklist before declaring a batch complete

1. `git status` clean in the worktree; `git log origin/claude/wonderful-maxwell-vu8xqw..HEAD` is empty (everything pushed); author of every new commit is `sairamgudiputi <sairamgudiputi8@gmail.com>`; `git log --format=%B <base>..HEAD | grep -iE 'co-authored|claude|generated|session'` finds nothing.
2. Every parity row the batch owns (`parity/<area>.md`) is SAME / MOVED / RESTYLED in the built UI and each is pinned by a test; no CHANGED or MISSING left for it.
3. For each commit with `src/` changes: a `failfirst` run in which the log line says "fail without the fix" and then "pass with it" (read in the log; run id recorded).
4. The targeted `tests` run (new tests, tests of every touched component, the parity walker `tests/pdf/parity/` files, the editor-tab tests) is green; each shard's `# fail 0`, `# skipped` explained.
5. Touched Cypress/Playwright specs are green (job conclusions of each shard read, not only the run's).
6. Stale tests updated, never weakened/skipped/deleted; each change is listed with its evidence in the batch report.
7. ONE full gate (no inputs) on the exact final head (the sha in the run's `head_sha` equals `git rev-parse HEAD`, or the later commits are docs-only): all 15 jobs green (suite 1-6/6, build, playwright 1-3/3, cypress 1-4/4, lint). Run id recorded.
8. 71-startup-chunks passed and its margin (`# start-up path ... kB to spare`) was read in that run or a `tests` run on the head and written in the report; any growth of the start-up path was offset (new UI is in the lazy Editor chunk; nothing edited in `src/components/ui/*` or shell files unless the lead owns the byte budget).
9. The perf budgets: not part of the gate; dispatch `perf: "all"` once per batch only if the batch changed the editor's typing path (the editor header/section renders are pinned by tests/pdf/165 and 173, which must stay green).
10. The bug-hunt round found nothing new (RUN-STATE batch gate); accessibility items noted but not fixed.
11. `docs/tracking/ui-redesign/batches/B<n>-report.md` and RUN-STATE "Where we are" updated (run ids, head sha, known flakes hit, what was not proven), committed, pushed, and no master push (deploy is the owner's call after the same gate).

## What I could not determine
- The exact wall time of a `tests`-only, Playwright-only or Cypress-only dispatch (no such run appeared in the six runs read); the 15-job gate is about 16 min.
- Which suite shard holds `71-startup-chunks` and master's current start-up margin (0.2 kB is the README's last figure; run 37431691149 on master was still in progress when I read the list).
- Whether the workflow-dispatch ref `claude/wonderful-maxwell-vu8xqw` has been pushed with the worktree's commits yet (the main checkout shows it at `eb8e46c`, the worktree at `0daf99d`, so `0daf99d` and the parity docs are not yet on GitHub: push first).
- The dispatch tool's reply shape (it was not called); step 2 lists runs to get the id.
- The task says "about 13 machines"; the workflow defines 6 + 1 + 3 + 1 + 4 = 15 jobs (HANDOFF also says 15).
