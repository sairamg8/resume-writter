# Boards (Jira core) + Job Tracker — redesign plan (Lane C)

Branch `boards-jobs-ui`, worktree `/mnt/Storage/Projects/flowcv-boards-jobs`, off master `8409472` (2026-09-23).

> **Done and merged:** the lane landed by `de0911f` (2026-09-24) and the Jira-style revamp built on it (`75236a2`);
> both are on master. This plan is history; the bugs' state is in [../boards-jobs-bugs/README.md](../boards-jobs-bugs/README.md).

**Owner's order (verbatim):** *"improve job portal and boards i do not like that existing UI. I Need smooth
professional UI. Boards sole task is to manage day 2 day project and life tasks just like jira i need a core part
of that process as clone here. and second tracking jobs need to be improved i believe in both of there are at least
50+ bugs are there."*

| File | What it holds |
|---|---|
| [01-design-and-kit.md](01-design-and-kit.md) | design language, the shared UI kit (`src/components/ui/`), the workspace shell and routes |
| [02-boards.md](02-boards.md) | Boards v2 — the Jira-core data model, migration from v1, store API, every view and interaction |
| [03-jobs.md](03-jobs.md) | Job Tracker — fixes first, then the redesign and the new fields |
| [../boards-jobs-bugs/README.md](../boards-jobs-bugs/README.md) | the bug tracker for this lane (verified findings, status per row) |

## Build order (WF-2) — file ownership is DISJOINT per agent

| Step | Agent | Owns (may create/edit) | Depends on |
|---|---|---|---|
| 1a | **KIT** | `src/components/ui/**`, `src/components/shell/**`, `src/hooks/useHotkeys.js`, `src/hooks/useUrlState.js`, `src/AppRoutes.jsx`, `src/index.css` (additive only), `tests/unit/ui-*.unit.mjs` | — |
| 1b | **BOARDS-MODEL** | `src/utils/board*.js`, `src/utils/normalizeBoard.js`, `src/hooks/useBoardStore.js`, `src/constants/boards.js`, `tests/unit/board*.unit.mjs`, `tests/unit/normalize-board.unit.mjs` | — |
| 1c | **JOBS-FIX** | `src/utils/{normalizeJob,jobCsv,jobStages,jobQuery,unsavedJobs}.js`, `src/hooks/useJob*.js`, `src/constants/jobs.js`, logic-only edits in `src/pages/Job*.jsx` + `src/components/job/*.jsx`, `tests/**/job*` | — |
| 2a | **BOARDS-UI-A** | `src/pages/Board.jsx`, `src/components/board/**` (board view, issue card, issue modal, create modal, filter bar) | 1a, 1b |
| 2b | **JOBS-UI** | `src/pages/Job*.jsx`, `src/components/job/**`, `src/components/CareerHistoryPanel.jsx` (styling only), `cypress/e2e/*job*` | 1a, 1c |
| 3 | **BOARDS-UI-B** | `src/pages/Boards.jsx`, `src/pages/Backlog.jsx`, `src/pages/BoardSettings.jsx`, `src/pages/YourWork.jsx`, `src/components/board/{project,sprint,backlog}*`, `cypress/e2e/*board*` | 2a |

`src/AppRoutes.jsx` belongs to KIT in step 1; after that, BOARDS-UI-A/B may add their routes to it (one line each).
Within a chain an agent inherits its predecessor's files once that agent has finished (JOBS-UI may edit
`useJobStore.js` after JOBS-FIX; BOARDS-UI-A/B may extend `boardOps.js`/`boardQuery.js` after BOARDS-MODEL).
Never edit a file another *running* agent owns. Anything outside your row → report it, do not touch it.

## Rules every agent follows

> ⛔ **Superseded (2026-09-24 onwards) — do not follow the local-run rules below.** They were Lane C's, on a laptop
> worktree. Since then: tests, the build and lint run **only on CI** (the repo's CLAUDE.md; dispatch
> `.github/workflows/ci.yml`), and **on the owner's laptop no yarn and no tests** — no `node --test`, `yarn test`,
> `vite build`, dev server, Playwright screenshots or Cypress (rules 5–8). Work goes to the work branch named in
> [../HANDOFF.md](../HANDOFF.md), per [../CLUSTER-PROTOCOL.md](../CLUSTER-PROTOCOL.md), not to this lane's worktree and
> ledger (rules 1, 2 and 4). Still true: fail-first fixes (3), source files ≤ 300 lines (9), never destroy saved data
> (10), no `window.confirm` / `alert` / `prompt` in Boards or Jobs (11), honest reports (12).

1. **Work only in the worktree.** Never touch `/mnt/Storage/Projects/flowcv` (other sessions work there). Never push.
   Never `git add -A` / `git add .`; never stash, reset or checkout another agent's file.
2. **Commit per finished unit** with explicit paths, under the lane's git lock, add + commit in one go:
   `flock /tmp/flowcv-bj-git.lock sh -c 'git add -- A B && git commit -q -m "msg" -- A B'`
   Message style as in `git log` (`fix(jobs): …`, `feat(boards): …`, `test(…)`), body says why, ends with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
3. **Bugs are fixed fail-first**: write the test, see it fail on the old code, fix, see it pass. Set the bug's row in
   `boards-jobs-bugs/` (status ⏸ + commit + test) **in the same commit** as the fix.
4. **Ledger, per commit** (cold-start safety): append one line to the store's ledger —
   `flock /tmp/flowcv-bj-ledger.lock sh -c 'echo "- <sha> <agent> <one line>" >> /mnt/Storage/my-learning/claude/flowcv/progress_boards-jobs-ui-2026-09-23.md'`
   (the store's autosave commits it; do not commit the store yourself).
5. **Tests**: `node --test <your test files>` while working. Before your final report run the whole suite once under
   the shared lock: `flock -w 1800 /tmp/flowcv-heavy.lock yarn test > <scratch>/suite.log 2>&1; echo "exit $?"`
   and grep `^# (tests|pass|fail)`. A green gate is `exit 0` + `# fail 0`; anything else did not pass. Two guards
   matter here: `tests/unit/dead-code.unit.mjs` (every module under `src/` must be reachable from `src/main.jsx`) and
   `tests/unit/touch-reveal.unit.mjs` (every `opacity-0 … group-hover:opacity-100` also needs `no-hover:opacity-100`).
6. **Build check** before the final report: `flock -w 1800 /tmp/flowcv-heavy.lock ./node_modules/.bin/vite build
   --outDir <scratch>/dist --emptyOutDir` → exit 0.
7. **Look at what you built.** UI agents take headless screenshots at 1440×900 and 375×812 (Playwright is installed,
   Chromium in `~/.cache/ms-playwright`): run `./node_modules/.bin/vite --port <your port> --strictPort` (ports: KIT
   5176, BOARDS-UI-A 5177, JOBS-UI 5178, BOARDS-UI-B 5179 — 5175 is the owner's preview), script the screenshots in your
   scratch dir, **Read the PNGs**, fix what looks wrong, and **kill the server when done**.
8. **Cypress is deferred** (`e2e-wt.sh` refuses): update any spec whose selectors you change, and write new specs for
   new flows, commit them UNRUN, report "written, not run". Never report a result you did not produce.
9. **Source files stay ≤ 300 lines** — split into components/utilities instead. Pure logic lives in
   `src/utils/*.js` with no React and no `@/` aliases so node tests import it directly (see `normalizeJob.js`).
10. **Never destroy saved data.** Stores keep the never-destroy contract (`storageBackup.js`: `loadSavedList`,
    backups, `RecoveryNotice`). Migrations read the old key and keep it.
11. No `window.confirm` / `alert` / `prompt` in Boards or Jobs — use the kit's `ConfirmDialog` / toasts.
12. Report honestly: what landed (commits), what did not, gate numbers as printed.
