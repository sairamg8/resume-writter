# How Claude works on this repo (the owner's standing orders)

Read `docs/tracking/HANDOFF.md` first: it is the live resume point. How the app works: `docs/knowledge/`.
Contributor rules: `CONTRIBUTING.md`. How a bug cluster is fixed: `docs/tracking/CLUSTER-PROTOCOL.md`.

## Go fast, keep quality

- Split the work into independent clusters (related files together, 1–3 hours each) and run them in
  parallel: a cloud session per cluster (its own machine), or several small workflows side by side — one
  workflow runs only CPUs − 2 agents at a time (2 on a 4-CPU box), so never queue many agents in one.
- Reading and scoping at medium effort; high effort only where a wrong call is costly (verification).
  Pipeline the stages; no barrier unless a stage truly needs every result.
- Keep this machine's CPU and memory under 80%.
- Merge each finished cluster as soon as it lands; gate a batch with one CI run, not one per merge.
- Commit and push everything as you go, and keep `docs/tracking/HANDOFF.md` current, so a cold start
  can carry on.

## Accessibility waits until last

- Accessibility is deferred (owner, 2026-09-25): no a11y bug or feature (aria/roles, contrast, focus, target sizes,
  screen readers) is worked until no other bug or feature is left. Note one you see; don't fix it.

## Tests run only on CI

- Never run tests on this machine, a cloud session's or an agent's worktree. Push, then dispatch
  `.github/workflows/ci.yml` (GitHub MCP `actions_run_trigger`, `run_workflow`) and read the result
  back (`actions_list`, `get_job_logs`):
  - no inputs: the full gate on ~13 machines — the node suite on 6, Playwright on 3, Cypress on 4,
    plus build and lint;
  - `tests`: named test files on one machine;
  - `failfirst`: `"sha:test1,test2 …"` — one machine per commit; its change is undone and its tests
    must fail, then pass with it restored;
  - `playwright` / `cypress`: named specs, or `none`.
- Every fix gets a test that fails without it (proved with `failfirst`) and passes with it. Never
  weaken a test to pass: a stale test is updated to the app's intended behaviour, with the evidence.

## Deploying

- A push to `master` deploys the site. Fast-forward `master` only when the full gate on that exact
  commit is green; mark the tracker rows ✅ in the same step.

## The same pattern for any project

Shard the test suite across CI machines with a matrix; give the workflow dispatch inputs for targeted
runs and fail-first checks; run nothing heavy locally; spread agents over several workflows or cloud
sessions; keep the local machine under 80%.
