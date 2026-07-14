# CPWT-CV / FlowCV Clone — Knowledge Base Index

> **Purpose:** Persistent project memory for humans and AI agents.  
> **Product goal:** Free, open resume + cover letter + job tracker for fellow developers.  
> **Last full audit:** 2026-07-14  
> **Canonical product name in UI/README:** **CPWT-CV** (repo folder: `flowcv`)  
> **Active work:** worktree `fix/react-pdf-fidelity` — see [HANDOFF.md](./HANDOFF.md)

---

## Start here

| Doc | What it covers |
|-----|----------------|
| **[HANDOFF.md](./HANDOFF.md)** | **← Next session: resume here first** |
| [PROGRESS.md](./PROGRESS.md) | Current status, maturity, known gaps, next work |
| [AGENT_MEMORY.md](./AGENT_MEMORY.md) | Condensed facts every future agent session should load first |
| [SESSION_LOG.md](./SESSION_LOG.md) | Chronological decisions and session notes |
| [01-overview.md](./01-overview.md) | Product vision, naming, stack, privacy model |
| [02-architecture.md](./02-architecture.md) | App shell, routing, layering, data flow |
| [03-data-model.md](./03-data-model.md) | Resume JSON shape, storage keys, versions |
| [04-features.md](./04-features.md) | Feature inventory mapped to code |
| [05-state-auth-sync.md](./05-state-auth-sync.md) | localStorage, Firebase Auth, Firestore sync |
| [06-templates-export.md](./06-templates-export.md) | Templates, design system, PDF/Word/JSON |
| [07-job-tracker.md](./07-job-tracker.md) | Job pipeline, statuses, local store |
| [08-testing.md](./08-testing.md) | Playwright suite layout and how to run |
| [09-file-map.md](./09-file-map.md) | Directory map (actual tree vs outdated README) |
| [10-open-source-goals.md](./10-open-source-goals.md) | Sharing plan, repo hygiene, community checklist |

## Related project files (outside this folder)

| Path | Role |
|------|------|
| [`README.md`](../../README.md) | User-facing setup + feature list |
| [`TODO_RESOLVE_CONFLICTS.md`](../../TODO_RESOLVE_CONFLICTS.md) | Historical merge/rebase notes (react-pdf branch) |
| [`firestore.rules`](../../firestore.rules) | Production Firestore security rules |
| [`graphify-out/GRAPH_REPORT.md`](../../graphify-out/GRAPH_REPORT.md) | Code knowledge graph (communities, god nodes) |
| [`package.json`](../../package.json) | Scripts and dependencies |

## How to maintain this knowledge base

1. After meaningful work: append to `SESSION_LOG.md` and update `PROGRESS.md`.
2. After architecture changes: edit the relevant numbered doc; bump **Last full audit** on this index.
3. Keep `AGENT_MEMORY.md` short (facts only) so it can be re-read every session.
4. Prefer facts over aspirations; put roadmap items only in `10-open-source-goals.md` and `PROGRESS.md`.

## Quick mental model

```
Browser (HashRouter)
  ├── Dashboard          → list resumes, import JSON, enter job tracker
  ├── Editor             → resume / cover letter / design / export
  ├── Job Tracker        → kanban/list + detail/form
  └── Terms / Privacy

State:
  Resumes → localStorage `cpwtcv_v1`  (+ optional Firestore users/{uid}/resumes)
  Jobs    → localStorage `cpwtcv_jobs_v1`  (no cloud sync yet)
```
