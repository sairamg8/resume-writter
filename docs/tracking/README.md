# Tracking — every tracker, plan, audit and session log in one place

All project tracking lives in this folder. It used to be spread across the repo root and
`docs/knowledge/`, and was moved here on 2026-09-24. How the app works is documented in
[`../knowledge/`](../knowledge/INDEX.md); this folder records what is wrong, what is planned and what
happened.

## Bugs

| File | What it tracks |
|---|---|
| [bug-status.md](bug-status.md) | **The master bug tracker.** Its Summary counts every row, including those in `bug-status-r2/`. |
| [bug-status-r2/](bug-status-r2/README.md) | The full-audit rows from 2026-09-23 (`R2-`), plus rows the build lanes found (`R3-`), split by severity. A third file holds features and test gaps. |
| [boards-jobs-bugs/](boards-jobs-bugs/README.md) | The Boards and Job Tracker lane's verified bugs (`B-`, `J-`), with links to their R2 rows. |
| [templates-ui-bugs.md](templates-ui-bugs.md) | The six bugs from the Templates UI audit (`TUI-1`…`TUI-6`), in tracker row format. |

## Plans and what is still owed

| File | What it covers |
|---|---|
| [PENDING-ALL.md](PENDING-ALL.md) | Everything requested and not yet built, test gaps, performance items, the open-source checklist and open owner decisions. Bugs are not duplicated here. |
| [templates-ui-plan.md](templates-ui-plan.md) | The Templates UI plan. Phase 1 was a read-only audit. |
| [templates-ui-suggestions.md](templates-ui-suggestions.md) | Phase 1's result: suggestions for the template picker, waiting on the owner's picks. |
| [boards-plan.md](boards-plan.md) | The original Boards plan (phases 1–4). |
| [boards-jobs-plan/](boards-jobs-plan/README.md) | The Boards (Jira core) and Job Tracker redesign spec: design kit, boards, jobs. |
| [TODO_RESOLVE_CONFLICTS.md](TODO_RESOLVE_CONFLICTS.md) | Historical notes from the react-pdf branch merge. PENDING-ALL marks it stale. |

## Audits and evidence

| Path | What it is |
|---|---|
| [qa-templates-audit/](qa-templates-audit/live-pass-notes.md) | The Templates UI audit's live-app notes, plus renders made from fictional résumés. |

## Session continuity

| File | What it is |
|---|---|
| [HANDOFF.md](HANDOFF.md) | The in-repo handoff for a new session. The authoritative resume cursor lives in the owner's memory store, outside the repo. |
| [PROGRESS.md](PROGRESS.md) | A progress snapshot. |
| [AGENT_MEMORY.md](AGENT_MEMORY.md) | Short-form facts for an agent to load first. |
| [SESSION_LOG.md](SESSION_LOG.md) | Append-only session log, newest first. |

## Rules for this folder

- New trackers, plans and audit write-ups go here, never at the repo root.
- Edit a tracker row and re-total the Summary in the same commit.
- No private data. Evidence is rendered from fictional résumés only.
