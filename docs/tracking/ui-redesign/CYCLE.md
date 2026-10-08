# UI build cycle: charter and log (the resume point for the owner's cadence)

Owner's orders (2026-10-08), in priority order:
1. The NEW UI (the `revamp-ui` program in this folder) is built to the end. Highest priority.
2. All test cases, bugs and edge cases are handled (a test that fails without the fix, proved with CI `failfirst`; no test weakened).
3. When complete: migrate to master and KEEP a master backup.

Cadence: work 3 hours continuously with ultracode, sleep 2 hours, repeat until the new UI is complete and on master.
Only the wake-ups below are pending at any time: the window-end wake (`send_later`), and CI check-ins during a window.

## Hard rules
- AT MOST 5 AGENTS ALIVE AT ONCE (the owner's standing cap, 2026-09-23 and again 2026-10-08; every `Agent` call and every `agent()` in a `Workflow` counts; this box runs 2 at a time). The total per window is sized to the work and never padded; trivial work is done directly with no agents. Count them in the log below.
- EFFORT RULE (owner, HARD RULE, 2026-10-08): before each launch decide every agent's effort; tell the owner in chat in the same turn, ahead of the call (how many agents, each effort, a few words why); put the effort in each agent label and in the workflow phase titles (`[medium] sweep fixes`); restate in the report which effort each ran at. Memory: claude-context `shared/feedback_agent_effort_right_size.md`.
- Effort per agent, never everything at the top: scouting, reading, mechanical or CSS-only edits and docs = `medium` (or `low`); implementation with tests = `high`; adversarial verification of a risky change = `xhigh`; `max` never, unless a wrong call would be irreversible.
- Tests run ONLY on CI (`ci.yml`: no inputs = the full gate; `tests`, `failfirst`, `playwright`, `cypress` for targeted runs). Read the logs; never run tests on a machine.
- Commits are authored `sairamgudiputi <sairamgudiputi8@gmail.com>`, no trailers, no mention of Claude or AI.
- Accessibility waits until last: note it, do not fix it.
- The start-up path stays under its cap (tests/pdf/71-startup-chunks).
- Work branch: `claude/charming-newton-5cced0` (cut from `revamp-ui`, with master merged in). Compare `git rev-parse HEAD` with `git ls-remote origin` before editing; merge `origin/revamp-ui` and `origin/master` in if either moved.

## Master backup (never move or delete)
- Branches `master-backup` and `backup/master-2026-10-08-00c7283` = master `00c7283` (Job Map and weekly refresh, push gate green) before the new UI.
- Tag pushes are refused by the git proxy, so backups are branches. Before each later master push, add `backup/master-<date>-<sha>` for the then-current master.

## STATUS 2026-10-08 ~16:25Z (owner's order, supersedes the cadence below): NO ROUTINES. The 3-hour / 2-hour cadence is OVER: every wake and check-in (window end, resume, CI check-ins) was deleted and `list_triggers` shows none enabled; do not create a `send_later` or a trigger for this project unless the owner asks. The owner ordered (1) every branch merged with master, new UI included, with the old UI kept as a backup, and (2) ONE LAST BUG HUNT across everything, then done. Branch audit: `revamp-ui`, `job-map`, `job-map-refresh` were already inside master; `claude/cool-sagan-3aw06l` (tools/tech-stacks) was merged into the work branch; the work branch reaches master with the final push. Old UI backup: `master-backup` and `backup/master-2026-10-08-00c7283` (= `00c7283`), plus `backup/master-2026-10-08-2546e6c` and `-aebb5a3`.

## STATUS 2026-10-08 15:27Z: MIGRATED (master = f43f020). The rule below was followed; it stays for every later push to master.

## Migration rule (the owner's "once completed, migrate to master")
Complete = every B-batch built, the open sweep items fixed, bug-hunt rounds dry, the Job Map page on the new shell, start-up cap green. Then: full gate (no inputs) GREEN, read in the logs, on the exact commit; backup branch added; `git push origin <sha>:refs/heads/master` (fast-forward only, no force); tracker rows and HANDOFF marked in the same step; then read master's own push gate and fix forward any red. Then disable the cycle (no more wakes) and tell the owner.

## Wrap-up procedure (at the window end)
1. Schedule the resume wake FIRST (`send_later`, now + 2 hours, name `UI build resume`, the Resume text below).
2. Reach a clean tree, record run ids dispatched and which are read, update this log and the top HANDOFF entry, commit, push `HEAD` to `claude/charming-newton-5cced0`.
3. Go idle; start nothing new.

## Resume wake (the text to send_later)
RESUME (owner's cadence: a 3-hour ultracode window now, then 2 hours asleep, until the new UI is complete and on master). In order: (1) FIRST schedule this window's end with send_later at now + 3 hours (name 'UI build window end', the Window end text in docs/tracking/ui-redesign/CYCLE.md); (2) read docs/tracking/ui-redesign/CYCLE.md (charter and log) and the top HANDOFF entry, fetch the branch, read every unread CI run listed there, fix reds; (3) run the window as Workflow scripts with at most 5 agents alive at once, the effort of each decided, announced in chat before the launch and shown in its label (CYCLE.md); (4) keep going for the whole 3 hours, with CI check-ins by send_later every 20 to 30 minutes while runs are in flight.

## Window end text (the text to send_later)
WINDOW END (owner's cadence: work 3 hours continuously with ultracode, sleep 2 hours, repeat until the new UI is complete and on master). In order: (1) FIRST schedule the resume wake with send_later at now + 2 hours, name 'UI build resume', message = the Resume wake text in docs/tracking/ui-redesign/CYCLE.md; (2) wrap up per the Wrap-up procedure in CYCLE.md; (3) go idle and start nothing new. Hard rules stay (CYCLE.md).

## Log
| Window | Start (UTC) | Agents used (of 5) | Efforts | Runs dispatched / read | Outcome and next |
|---|---|---|---|---|---|
| 1 | 2026-10-08 13:37 (ends 16:37, resume 18:37) | 10: round 1 = 4 (wf_7a356c0b-175), round 2 = 3 (wf_e7157724-d9a), release checks = 2 (wf_6bfce28a-05f), polish = 1 (wf_511aac7b-930); never more than 2 alive (4-CPU box) | round 1: hunt-editor high, hunt-workspace high, sweep-fixes medium, jobmap-shell medium (launched before the announce-first rule was applied); round 2: hunt-navigation high, hunt-content-limits high, clock-proof-tests medium; release checks: release-review xhigh (read-only), test-parity high; polish: polish-lows medium | FINAL GATE GREEN: run 37797966992 on f43f020 (15/15 jobs, first attempt). Also read: failfirst 37789034736 (10), 37791890311 (11), 37792162706 (Projects fix), 37795773293 (3 polish + targeted); red then fixed: d343701 (37789038914); 2630d61 green on its second attempt (one race in 180-ui-b3-letter-doc, hardened in f43f020) | **MIGRATED: master = f43f020 (15:27Z), fast-forward from 00c7283; backups master-backup and backup/master-2026-10-08-00c7283.** Next: read master's push gate; windows 2+ = a last hunt round until dry, then the parked items if the owner wants them |
| FINAL | 2026-10-08 16:25 to 19:05 (no cadence, no routines) | 12 + 1 + 5 = 18: round 1 = 12 (wf_fb5ed57e-bf0), review = 1 (wf_144b4a98-091), round 2 = 5 (wf_5edaa04b-4cb); never more than 2 alive (4-CPU box) | all `[high]` except the review `[xhigh]` (read-only) | failfirst 37817440012 (17 of 18, 248 was a test bug), 37818320159, 37821068246, 37824509884 (9 of 9); full gates 37818355184, 37821072673 (round 1 head 40f78b5, green), 37824514102 (red: cursor guard vs a comment), 37827025587 (green on 6e6ec33) | **master = 6e6ec33** (hunt rounds 1 and 2); the owner's orders are done |
