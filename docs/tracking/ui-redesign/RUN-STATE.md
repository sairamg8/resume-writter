# UI rebuild: run state and cadence (the resume point; keep it current)

Worktree `/home/user/resume-writter/.claude/worktrees/ui-rebuild`, local branch `worktree-ui-rebuild`, pushed to the session's
designated branch with `git push -u origin HEAD:claude/wonderful-maxwell-vu8xqw`. Never to master (a push to master deploys the
site; that is the owner's call and needs the full gate). Rules: PARITY-RULE.md (UI only, every function stays), CLAUDE.md,
CONTRIBUTING.md, README.md "BUILD CONSTRAINTS". Tests run only on CI.

## Cadence (owner, 2026-10-06): work 3 hours, rest 2 hours, then pick up where it left off
| Window | Work | Gap after it |
|---|---|---|
| 1 | 2026-10-06 07:52Z to 10:52Z | to 12:52Z |
| 2 | 12:52Z to 15:52Z | to 17:52Z |
| 3 | 17:52Z to 20:52Z | to 22:52Z |
| n | start = previous start + 5 h | end = start + 3 h |
Only ONE wake is pending at a time: the wrap-up schedules the next resume, the resume schedules the next wrap-up.

## One batch at a time
A batch = code + bug hunt (loop until a round finds nothing new) + CI proof + docs. The NEXT batch starts only when the current
one's gate is passed (below); a batch may span several windows. Each batch is run as ultracode workflows (several small ones, each
agent owning its own files; the lead merges, reads the CI logs itself, never trusts a report).
Batch gate: every parity row the batch owns is SAME / MOVED / RESTYLED in the built UI and pinned by a test that fails without it
(`failfirst` on CI); the full gate (`ci.yml`, no inputs) is green on the batch's head, 71-startup-chunks included; the bug hunt's last
round found nothing new; stale tests were updated to the intended behaviour with evidence, never weakened; RUN-STATE and the batch
report (`docs/tracking/ui-redesign/batches/B<n>-report.md`) are written and pushed.

## Wrap-up procedure (at a window's end)
1. Schedule the resume wake FIRST (`send_later`, text below), record its trigger id here.
2. List running workflows: note each run id and script path; stop them (TaskStop). A cached `Workflow({scriptPath, resumeFromRunId})`
   resumes in the SAME session only; after a container restart relaunch from the files and this state instead.
3. Update this file ("Where we are"), commit (owner identity, no trailers, no mention of Claude or AI), push to the designated branch.
4. Go idle. Do not start a new batch in the wrap-up.

## Resume procedure (at a window's start)
1. FIRST schedule this window's wrap-up wake (`send_later`, start + 3 h), record its trigger id.
2. Read this file, then `git fetch origin claude/wonderful-maxwell-vu8xqw`. If the worktree is gone (container restarted):
   `git worktree add .claude/worktrees/ui-rebuild -b worktree-ui-rebuild origin/claude/wonderful-maxwell-vu8xqw`, then EnterWorktree with
   `path`. Set `git config user.name sairamgudiputi && git config user.email sairamgudiputi8@gmail.com`.
3. Re-read the newest CI runs on the branch (the gate may have finished during the gap), then continue at "Where we are".

## Resume wake (text for the send_later at the end of a window)
"WINDOW START (owner's cadence: work 3 hours, rest 2 hours, pick up where it left off). Do this now, in order: (1) FIRST schedule this
window's wrap-up wake with send_later at start + 3 hours (text: RUN-STATE.md 'Wrap-up wake'); (2) read docs/tracking/ui-redesign/RUN-STATE.md
in the worktree and follow its 'Resume procedure'; (3) continue exactly where 'Where we are' says, one batch at a time."
## Wrap-up wake (text for the send_later at the start of a window)
"WINDOW END (owner's cadence: work 3 hours, rest 2 hours, then pick up). In order: (1) FIRST schedule the resume wake with send_later at end +
2 hours (text: RUN-STATE.md 'Resume wake'); (2) follow RUN-STATE.md 'Wrap-up procedure': record run ids and script paths, stop workflows,
update this file, commit, push `HEAD:claude/wonderful-maxwell-vu8xqw`; (3) go idle; start nothing new."

## Where we are
- Window 1 (07:52Z to 10:52Z) is running. Pending wake: wrap-up `trig_01LTVBkVsgPdfAgBJGC3Ha6N` (fires 10:52Z).
- Done: worktree made from master `eb8e46c` with the redesign notes merged (`67b414a`); PARITY-RULE.md written.
- Now: PLANNING. Step 1: parity audit (7 area auditors + a reviewer each, writes `parity/<area>.md`) and three scouts
  (`parity/_constraints.md`, `_tests.md`, `_ci.md`). Step 2: the plan workflow (3 planners, judges, completeness critic against the
  parity rows, two skeptics) writes `PLAN.md` and `batches/B<n>.md`. Step 3: Batch 1 (the first batch of PLAN.md).
- Running since 08:00Z: parity audit `wf_25338028-897` (task wdmtim3pl, script `/root/.claude/projects/-home-user-resume-writter--claude-worktrees-ui-rebuild/08ba08c3-89c1-545a-bfa7-bc4ae58a0a66/workflows/scripts/ui-parity-audit-wf_25338028-897.js`) and scouts `wf_d09e4136-527` (task wt3lxuowk, script `.../workflows/scripts/ui-rebuild-scouts-wf_d09e4136-527.js`). Their files land in `docs/tracking/ui-redesign/parity/` (uncommitted until the lead commits them).
- Open owner calls left after the parity rule: see README "Product calls"; the rule settles most of them (PARITY-RULE.md).
