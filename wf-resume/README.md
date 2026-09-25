# Round 2 resume kit (worker session_01KDXZzZfUEUyKqzYyULQbRi, stopped by the session limit 2026-09-24)

Task: the 22 open 🔴 rows of docs/tracking/bug-status-r2/03-features-and-test-gaps.md, from branch
`claude/confident-goldberg-2uig8b` (base 802d0a5). Rules: docs/tracking/CLUSTER-PROTOCOL.md + the owner's
(tests only on CI via ci.yml dispatch; push only to claude/wf-<cluster>; no docs/tracking edits; max 10 agents).

- `state.md` — per cluster: commits already pushed on `claude/wf-<cluster>` (kept, CI status not yet read)
  and the uncommitted work-in-progress saved as `wip/<cluster>.patch` (untested; apply on the named base with
  `git apply --index`, then review before committing).
- `r2-cluster.workflow.js` — the workflow script (one worker per row in turn → independent reviewer →
  `wf-reports/<cluster>.json`). `args.json` — the 10 clusters' args (rows + briefs). Worktree paths in args are
  `/home/user/wf/<cluster>`; recreate them from `origin/claude/wf-<cluster>` (or 802d0a5 where nothing was
  pushed) and symlink one shared `node_modules` (`yarn install --immutable` once).

Resume: for each cluster, create the worktree, apply its patch if any, then run the workflow with that
cluster's args, telling the first worker what is already pushed (state.md) so it continues rather than redoes.
No cluster finished; no wf-reports/ file exists yet.
