# TODO: Resolve conflicts between gemma_feature/react-pdf-export and origin/main

## Context

Branch `gemma_feature/react-pdf-export` has 11 commits ahead of the merge base (`56c1ff7`).
`origin/main` was updated when PR #12 (`feature/react-pdf-export`) was merged + subsequent refactor commits.

## What this branch adds (must be preserved)

1. **`src/templates/pdf/CoverLetterTemplatePDF.jsx`** — NEW FILE, doesn't exist on main
2. **`src/utils/pdfExportReactPDF.js`** — adds `triggerDownload()`, `exportCoverLetterPDFReact()`, and uses `resolveTemplateSettings`
3. **`src/pages/Editor.jsx`** — dynamic imports for all export handlers; cover letter routing in `handleExportPDF`
4. **`src/templates/pdf/SidebarTemplatePDF.jsx`** — spacing bug fixes (sideItemGap no double-scale, per-section px→pt, marginH for paddingLeft)
5. **`playwright.config.js`** — NEW FILE, doesn't exist on main
6. **`tests/`** — NEW directory with 117 tests (01-07 spec files + helpers.js), doesn't exist on main
7. **`vite.config.js`** — adds `build.rollupOptions.output.manualChunks` (bundle splitting)
8. **`package.json`** — adds `"test"` and `"test:ui"` scripts + `"playwright"` dev dep

## What main has that this branch doesn't

- `package-lock.json` — main added lock file
- `.claude/settings.json` — additional settings
- Many new component/template split files (DesignPanelColors, DesignPanelShared, ExportDropdown, etc.)
- `src/components/ExportDropdown.jsx` — export dropdown extracted to component
- All HTML template splits (ClassicTemplateSections, ExecutiveTemplateHelpers, etc.)
- Various other refactors

## Key conflict: Editor.jsx

Main's Editor.jsx:
- Has `import { ExportDropdown } from '@/components/ExportDropdown'` 
- Has static imports: `import { exportToPDF }`, `import { exportToPDFReact }`, `import { exportToWord }`
- `handleExportPDF` calls `exportToPDFReact` directly (no cover letter routing)
- `handleExportPDFLegacy` routes cover letter via `activeTab === 'coverletter'`
- Uses `<ExportDropdown>` component in JSX

My branch's Editor.jsx:
- Dynamic imports in all handlers (bundle optimization)
- `handleExportPDF` routes cover letter to `exportCoverLetterPDFReact` when `activeTab === 'coverletter'`
- Has no `ExportDropdown` component reference (pre-split version)

**Resolution**: Take main's Editor.jsx as base, then apply:
1. Convert static exports to dynamic imports inside each handler
2. Add cover letter routing: in `handleExportPDF`, import `exportCoverLetterPDFReact` and check `activeTab === 'coverletter'`

## Key conflict: pdfExportReactPDF.js

Main's version: basic `exportToPDFReact` with inline download logic, no `resolveTemplateSettings`
My version: adds `triggerDownload()` helper, `exportCoverLetterPDFReact()`, calls `resolveTemplateSettings` from PdfPage

**Resolution**: Take my version (superset of main's).

## Key conflict: SidebarTemplatePDF.jsx + other PDF files

Main's PDF files have the latest fixes from the merged PR #12 — need to check if they also include my spacing fixes or if they're different.

**Resolution**: Rebase and accept my versions for PDF files, cherry-pick any main-only changes.

## Rebase approach

```sh
git rebase origin/main
# For each conflict:
# - Editor.jsx: merge carefully (ExportDropdown structure from main + dynamic imports + CL routing from mine)
# - pdfExportReactPDF.js: keep mine (superset)
# - SidebarTemplatePDF.jsx: keep mine (has spacing fixes)
# - package.json: merge both (keep my test scripts, keep main's lock file ref)
# - vite.config.js: keep mine (adds manualChunks on top of main's base)
# - playwright.config.js: keep mine (main doesn't have it)
# - tests/: keep mine (main doesn't have it)
# - CoverLetterTemplatePDF.jsx: keep mine (main doesn't have it)
```

After resolving, run `npx playwright test` to verify 117/117 pass, then `git push --force-with-lease`.
