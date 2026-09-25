# 04 — Feature Map

Maps user-facing features → primary code locations.

## Dashboard (`#/`)

| Feature | Code |
|---------|------|
| List resumes | `pages/Dashboard.jsx`, `components/ResumeCard.jsx` |
| New resume | `store.createResume` |
| New cover letter (from a résumé, picker `NewLetterModal`) and the Cover Letters list | `store.createLetter`, `utils/letters.js`, navigate with `?tab=coverletter` |
| Start from a role starter | `components/StarterTemplateModal.jsx`, `utils/starterTemplates.js` |
| Import a backup JSON or a JSON Resume file | Dashboard `handleImport` (`components/ImportMenu.jsx` in a demo account) |
| Import PDF / Word / Markdown / text (best-effort, R2-148) | `importDocument.js` → `importFile.js` (text out of the file) → `importText.js` (text → résumé) |
| Job Tracker entry | navigate `/jobs` |
| Career history panel | `components/CareerHistoryPanel.jsx` |
| Auth + sync indicator | `components/AuthBar.jsx` |

## Resume editor (`#/resume/:id`)

| Feature | Code |
|---------|------|
| Tab: resume / design / cover letter / ATS check | `pages/Editor.jsx` `activeTab`, `hooks/useEditorTab.js` |
| Personal info | `PersonalInfoEditor*.jsx` |
| Sections + DnD | `SectionEditor*.jsx`, dnd-kit |
| Add section types | `SECTION_GROUPS` + `addSection` |
| Live preview (the exported PDF) | `PdfPreview.jsx` + `renderResumePdf` (`utils/pdfExportReactPDF.js`) |
| Layout modes (split/etc.) | `LayoutToggle.jsx` |
| Resizable editor panel | localStorage `cpwtcv-panel-width` |
| Export menu | `ExportDropdown.jsx` + `hooks/useEditorExports.js` |
| Share a public link (signed in, Firebase only) | `ShareLinkModal.jsx`, `utils/publicLink.js`; the page `#/r/:shareId` is `pages/PublicResume.jsx` |
| Design panel | `DesignPanel.jsx` + Colors/Typography/Headings/Dates/Shared |
| ATS check | `AtsCheckerPanel.jsx`, `utils/atsChecker.js` |
| Writing helpers | `BulletOptimizerModal.jsx` (`utils/bulletOptimizer.js`), `CoverLetterGeneratorModal.jsx` (`utils/coverLetterGenerator.js`) — rules, no AI service |

## Design system

| Feature | Code |
|---------|------|
| Template picker | Design panel + `setTemplate`; the list is `constants/templateTable.js` |
| Accent / text / sidebar colors | `DesignPanelColors.jsx` |
| Fonts + Google fonts | `utils/fonts.js` |
| Spacing / margins | Design panel keys → `settings` |
| Per-section overrides | `updateSectionSettings`, Section customizer |

## Cover letter

| Feature | Code |
|---------|------|
| Editor panel | `CoverLetterPanel.jsx` |
| Preview and PDF | `CoverLetterTemplatePDF.jsx` via `renderCoverLetterPdf` / `exportCoverLetterPDFReact` |

## Job tracker

| Feature | Code |
|---------|------|
| Board | `JobTracker.jsx` + Kanban/List |
| Detail | `JobDetail.jsx` + job/* tabs |
| Create/edit form | `JobForm.jsx` |
| Status pipeline | `constants/jobs.js`, Pipeline, StatusHistory |
| Link resume | `resumeId` field + résumés from the `store` prop |

## Boards

| Feature | Code |
|---------|------|
| Boards list, a board, its backlog and settings, "Your work" | `pages/Boards.jsx`, `Board.jsx`, `Backlog.jsx`, `BoardSettings.jsx`, `YourWork.jsx` |
| Store (localStorage `cpwtcv_boards_v2`) | `hooks/useBoardStore.js`, `utils/board*.js` |
| Cards, columns, labels | `components/board/*` |

## Legal

| Feature | Code |
|---------|------|
| Terms | `pages/TermsPage.jsx` |
| Privacy | `pages/PrivacyPage.jsx` |

## Non-features (common expectations not implemented)

- Collaborative multi-user editing
- AI rewrite / tailoring (no LLM SDK in package.json; the writing helpers are rules)
- Job and board cloud sync
- Server-side PDF rendering
