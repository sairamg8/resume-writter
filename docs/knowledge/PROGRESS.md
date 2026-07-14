# Progress Snapshot

**Date:** 2026-07-14 (merged to master)  
**Phase:** React-PDF fidelity **merged** to `master` → next: visual QA + open-source packaging  
**Overall maturity:** High for resume/cover letter/export; medium for open-source packaging  
**Active checkout:** `/home/sairam/Documents/flowcv` · branch `master`  
**Resume guide:** [HANDOFF.md](./HANDOFF.md)

---

## What works (implemented)

| Area | Status | Notes |
|------|--------|-------|
| Multi-resume dashboard | Done | Create, rename, duplicate, delete, JSON import |
| Resume editor | Done | Personal info, sections, DnD reorder, design panel |
| 5 layout templates | Done | Classic, Modern, Minimal, Sidebar, Executive |
| Cover letter | Done | Panel + matching template + PDF export |
| Design system | Done | Colors, fonts, spacing, heading styles, per-section overrides |
| PDF export (react-pdf) | Done | Per-template PDF components + font registration; canvas-aligned fidelity |
| PDF export (legacy) | Done | Fallback via `pdfExport.js` |
| Word (.docx) export | Done | `docx` builders |
| JSON backup/restore | Done | Dashboard + editor |
| Google Auth | Done | Firebase popup |
| Resume cloud sync | Done | Offline-first Firestore + merge |
| Job tracker | Done | Kanban/list, statuses, todos, notes, history |
| Terms / Privacy pages | Done | Hash routes |
| Playwright E2E | Done | 8 spec files under `tests/` |
| Manual chunks / code-split | Done | PDF, docx, firebase chunks |

---

## Partial / inconsistent

| Item | Issue |
|------|-------|
| “Dark” template | Seeded in store defaults (`template: 'dark'`) but **not** registered in `TEMPLATE_MAP` or PDF loaders |
| README structure section | Out of date (missing job tracker, PDF tree, split components; still lists DarkTemplate.jsx) |
| Job cloud sync | Jobs stay in localStorage only |
| Open-source packaging | LICENSE file may still be missing; git + worktree now in use |
| Branding | Product is CPWT-CV; PDF metadata updated off FlowCV |
| Print vs react-pdf | Legacy print path kept as fallback; react-pdf is primary and fidelity-improved (2026-07-14) |

---

## Historical / maybe stale

- `TODO_RESOLVE_CONFLICTS.md` — merge plan between `gemma_feature/react-pdf-export` and main. Many listed features (Playwright, CoverLetter PDF, manualChunks) **appear already present** in the tree. Treat as archive until re-verified against a real remote.

---

## Owner goals (explicit)

1. Understand the full codebase (knowledge base: **this folder** — started 2026-07-14).
2. Share the tool **for free** with fellow developers.
3. Keep agent/human progress **in-repo** with index + structured docs.

---

## Suggested next milestones (not started unless noted)

See [10-open-source-goals.md](./10-open-source-goals.md). Priority order for sharing:

1. Initialize git + `.gitignore` + real `LICENSE`
2. Fix README accuracy (structure, job routes, scripts, templates)
3. Resolve or remove Dark template inconsistency
4. Env example file (`.env.example`) without secrets
5. CONTRIBUTING.md + clean first-run experience without Firebase
6. Publish public repo + short demo GIF/docs
7. Optional: job sync, multi-language, template marketplace

---

## Knowledge base status

| Artifact | Status |
|----------|--------|
| Index + core docs | Created 2026-07-14 |
| Graphify graph | Exists (`graphify-out/`); dated 2026-06-29 |
| Automated test run this session | Not run (docs-only session) |
