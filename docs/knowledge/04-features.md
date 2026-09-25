# 04 — Feature Map

Maps user-facing features → primary code locations.

## Dashboard (`#/`)

| Feature | Code |
|---------|------|
| List resumes | `pages/Dashboard.jsx`, `components/ResumeCard.jsx` |
| New resume | `store.createResume` |
| New cover letter (from a résumé, picker `NewLetterModal`) and the Cover Letters list | `store.createLetter`, `utils/letters.js`, navigate with `?tab=coverletter` |
| Import JSON | Dashboard `handleImport` |
| Import PDF / Word / Markdown / text (best-effort, R2-148) | `importDocument.js` → `importFile.js` (text out of the file) → `importText.js` (text → résumé) |
| Job Tracker entry | navigate `/jobs` |
| Career history panel | `components/CareerHistoryPanel.jsx` |
| Auth + sync indicator | `components/AuthBar.jsx` |

## Resume editor (`#/resume/:id`)

| Feature | Code |
|---------|------|
| Tab: resume / design / cover letter | `pages/Editor.jsx` `activeTab` |
| Personal info | `PersonalInfoEditor*.jsx` |
| Sections + DnD | `SectionEditor*.jsx`, dnd-kit |
| Add section types | `SECTION_GROUPS` + `addSection` |
| Live A4 preview | `PaginatedPreview.jsx` + `TEMPLATE_MAP` |
| Layout modes (split/etc.) | `LayoutToggle.jsx` |
| Resizable editor panel | localStorage `cpwtcv-panel-width` |
| Export menu | `ExportDropdown.jsx` + handlers in Editor |
| Design panel | `DesignPanel.jsx` + Colors/Typography/Shared |

## Design system

| Feature | Code |
|---------|------|
| Template picker | Design panel + `setTemplate` |
| Accent / text / sidebar colors | `DesignPanelColors.jsx` |
| Fonts + Google fonts | `utils/fonts.js` |
| Spacing / margins | Design panel keys → `settings` |
| Per-section overrides | `updateSectionSettings`, Section customizer |

## Cover letter

| Feature | Code |
|---------|------|
| Editor panel | `CoverLetterPanel.jsx` |
| Preview | `CoverLetterTemplate.jsx` |
| PDF | `CoverLetterTemplatePDF.jsx` via `exportCoverLetterPDFReact` |

## Job tracker

| Feature | Code |
|---------|------|
| Board | `JobTracker.jsx` + Kanban/List |
| Detail | `JobDetail.jsx` + job/* tabs |
| Create/edit form | `JobForm.jsx` |
| Status pipeline | `constants/jobs.js`, Pipeline, StatusHistory |
| Link resume | `resumeId` field + resumes from `useAppStore` |

## Legal

| Feature | Code |
|---------|------|
| Terms | `pages/TermsPage.jsx` |
| Privacy | `pages/PrivacyPage.jsx` |

## Non-features (common expectations not implemented)

- Collaborative multi-user editing
- AI rewrite / tailoring (no LLM SDK in package.json)
- Job cloud sync
- Template “Dark” as a real registered template
- Server-side PDF rendering
