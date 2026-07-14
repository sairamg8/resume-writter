# Agent Memory (load first)

Short-form project memory for AI/human continuity. Details live in numbered docs.

## Identity

- **Repo path:** `/home/sairam/Documents/flowcv`
- **Product name:** CPWT-CV (UI + README). Folder/package name: `flowcv`.
- **Inspiration:** Free FlowCV-style online resume builder.
- **Owner/author:** Sairam Gudiputi (`sairamgudiputi8@gmail.com`)
- **Declared license in README:** MIT — **LICENSE file may be missing on disk**
- **Owner goal (2026-07-14):** Share freely with fellow developers (open-source / free tool)

## Stack (locked)

| Layer | Choice |
|-------|--------|
| UI | React 19 + Vite 8 |
| CSS | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Router | `react-router-dom` v7 **`HashRouter`** |
| DnD | `@dnd-kit/*` |
| Auth/DB | Firebase Auth (Google) + Firestore offline cache |
| PDF | `@react-pdf/renderer` (primary) + legacy print path |
| Word | `docx` + `file-saver` |
| Lint | oxlint |
| E2E | Playwright |

Path alias: `@` → `src/` (`vite.config.js`, `jsconfig.json`).

## Entry points

- `src/main.jsx` → `HashRouter` + `App`
- `src/App.jsx` → routes; wires `useAppStore` + `useAuth` + `useCloudSync` into Dashboard/Editor
- Resumes store: `src/hooks/useResumeStore.js` (`useAppStore`)
- Jobs store: `src/hooks/useJobStore.js` (local only)

## Routes

| Hash path | Page |
|-----------|------|
| `#/` | Dashboard |
| `#/resume/:id` | Editor (`?tab=coverletter` supported) |
| `#/jobs` | Job tracker |
| `#/jobs/new`, `#/jobs/:id`, `#/jobs/:id/edit` | Job form/detail |
| `#/terms`, `#/privacy` | Legal |

## Storage keys & versions

| Key | Content | Version field |
|-----|---------|---------------|
| `cpwtcv_v1` | resumes, activeId, deletedIds | `dataVersion: 6` |
| `cpwtcv_jobs_v1` | jobs array | `dataVersion: 2` |
| `cpwtcv-panel-width` | editor sidebar width | — |

## Templates (HTML preview)

`TEMPLATE_MAP` in `src/constants/resume.js`:

- `classic`, `modern`, `minimal`, `sidebar`, `executive`

**Quirk:** Seed data includes `defaultResumeDataDark` with `template: 'dark'`, but **`dark` is not in `TEMPLATE_MAP`** → preview falls back to Classic. PDF loaders also lack `dark`.

## Section types

Core: experience, education, skills, projects  
More: languages, certifications, awards, volunteering, references, interests, custom

Factories: `SECTION_TYPE_DEFAULTS` in `src/utils/defaultDataSectionTypes.js`.

## Export matrix

| Format | Implementation |
|--------|----------------|
| PDF (primary) | `exportToPDFReact` / `exportCoverLetterPDFReact` — dynamic template chunks |
| PDF (legacy) | `exportToPDF` print/canvas path in `pdfExport.js` |
| Word | `exportToWord` + builders |
| JSON | client download of resume object |

Bundle splits: `react-pdf`, `docx`, `firebase` (`vite.config.js` `manualChunks`).

### React-PDF fidelity notes (branch `fix/react-pdf-fidelity`)

- CSS spacing (design panel px) → PDF points via `pdfUnits.js` (`* 0.75`) once in `resolveTemplateSettings` / `getEffectiveSpacing`.
- Photo sizes must match `templateShared.photoStyle` / `modernPhotoStyle` (`pdfPhoto.js`).
- Warm export: `warmPdfExport(resume)` from Editor on template/font change.
- PDF metadata creator/producer: **CPWT-CV** (not FlowCV).

## Cloud sync (resumes only)

- Path: `users/{uid}/resumes/{id}`, deletions meta: `users/{uid}/meta/deletions`
- Merge: per-resume `updatedAt` last-write-wins; honor deleted IDs
- Debounced writes ~1.5s after local edits
- Jobs **not** synced to Firestore
- Env: `VITE_FIREBASE_*` in `.env.local` (see README)

## Important filesystem notes (as of 2026-07-14)

- **Not a git repository** in this workspace (`fatal: not a git repository`)
- No `.gitignore` / `LICENSE` observed at project root
- `dist/` build artifacts present
- `graphify-out/` exists (prior code graph)
- `TODO_RESOLVE_CONFLICTS.md` is historical branch-merge context; many items may already be integrated

## Naming for contributors

Prefer **CPWT-CV** in user-facing copy. “FlowCV clone” is fine in internal knowledge docs only — do not brand as FlowCV officially.

## Session protocol for agents

1. Read this file + `PROGRESS.md`.
2. Log work in `SESSION_LOG.md`.
3. Update `PROGRESS.md` when status changes.
4. Do not invent git history; re-check `git status` if needed.
