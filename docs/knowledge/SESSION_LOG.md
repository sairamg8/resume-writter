# Session Log

Append-only. Newest entries at the top.

---

## 2026-07-14 — React-PDF fidelity + performance (worktree)

**Branch / worktree:** `fix/react-pdf-fidelity` @ `/home/sairam/Documents/flowcv-pdf-worktree`

**Problem:** Canvas preview (HTML) and “Export PDF” (react-pdf) diverged; two export paths (print legacy vs react-pdf). Goal: make react-pdf the competitive primary path.

**Changes**

- Shared unit bridge `pdfUnits.js` (CSS px → PDF pt @ 0.75)
- Shared photo sizing `pdfPhoto.js` matching `templateShared` canvas sizes
- `resolveTemplateSettings` / `getPageStyle` / `getDocumentProps` rewrite in `PdfPage.jsx`
- All template PDFs: classic/modern/minimal/executive/sidebar + cover letter branding CPWT-CV
- Rich text parser hardened; contact gaps match canvas
- Export performance: template cache, font prefetch, hyphenation off, `warmPdfExport` on editor mount
- Classic canvas now applies `lineHeightValue` on root (was missing)

**Verification**

- `npm run build` OK
- Playwright `08-pdf-design-fidelity.spec.js` — 8/8 passed
- Worktree isolated from master

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
