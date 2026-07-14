# Session Log

Append-only. Newest entries at the top.

---

## 2026-07-14 — Progress saved (handoff pointer on master)

Active PDF work is **not** on this `master` checkout. Full handoff:

- This folder: `docs/knowledge/HANDOFF.md` (pointer)
- Worktree: `/home/sairam/Documents/flowcv-pdf-worktree` · branch `fix/react-pdf-fidelity` @ `874f9da`
- Full detail: worktree `docs/knowledge/HANDOFF.md`

PDF fidelity + performance completed on that branch (tests green). **Not merged to master.**

---

## 2026-07-14 — Knowledge base bootstrap

**Participants:** User (Sairam), Grok agent  

**Context**

- Workspace is a FlowCV-inspired resume builder named **CPWT-CV**.
- User goal: share free with fellow developers; first ask was full project understanding with persistent memory **inside the project folder**, indexed.

**What was done**

1. Reviewed public FlowCV product positioning (free ATS resume builder) vs this clone.
2. Audited local tree: `src/`, `tests/`, `package.json`, README, Firebase rules, Vite config, graphify report.
3. Read core modules: `App.jsx`, stores, auth/sync, Editor/Dashboard, exports, constants, job tracker.
4. Created `docs/knowledge/` with INDEX + numbered docs + AGENT_MEMORY + PROGRESS + this log.

**Key facts established**

- Not currently a git repo in this workspace.
- Resumes: localStorage + optional Firestore; Jobs: localStorage only.
- Templates in UI map: classic, modern, minimal, sidebar, executive (dark seed is orphaned).
- Branding: CPWT-CV / offline-first privacy story.

**Decisions**

- Knowledge lives under `docs/knowledge/` (human + AI friendly, not hidden).
- Product name in docs: CPWT-CV; “FlowCV clone” only as internal inspiration label.
- No code changes this session beyond documentation.

**Follow-ups**

- User may want: git init, open-source packaging, feature work — await direction.

---

## Pre-history (inferred, not this agent)

- App built with React/Vite; Firebase sync; design panels split into multiple files.
- React-PDF export path + Playwright suite added (see `TODO_RESOLVE_CONFLICTS.md`, `tests/`).
- Graphify run produced `graphify-out/` (2026-06-29): 555 nodes, 38 communities; god nodes around PDF rich text / section builders.
