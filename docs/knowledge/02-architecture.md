# 02 — Architecture

## High-level diagram

```
┌─────────────────────────────────────────────────────────────┐
│  main.jsx  (StrictMode + HashRouter)                        │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  App.jsx → AppRoutes.jsx                                    │
│    useAppStore()  useAuth()  useCloudSync({user, appState}) │
└───────┬───────────────┬───────────────┬─────────────────────┘
        ▼               ▼               ▼
   Dashboard         Editor        Job pages, Boards
   Terms/Privacy                   (own useJobStore, useBoardStore)
```

## Layering

| Layer | Responsibility | Key paths |
|-------|----------------|-----------|
| Pages | Route-level UI composition | `src/pages/*` |
| Components | Reusable panels/editors | `src/components/*` |
| Hooks / stores | State + side effects | `src/hooks/*` |
| Constants | Template table, spacing, page sizes, job statuses | `src/constants/*` |
| Templates (PDF) | `@react-pdf/renderer` trees — the preview and the export alike | `src/templates/pdf/*` |
| Utils | Data model and normaliser, exporters, cloud-sync engine, ATS checker | `src/utils/*` |

## Routing strategy

- **`HashRouter`** so static hosting works without rewrite rules (`#/resume/xyz`).
- Resume editor syncs URL `:id` to `store.activeId`; an id not in the store → navigate home
  (`useOpenResume`).
- The editor's tab is in the address: `#/resume/:id?tab=design|coverletter|ats` (`useEditorTab`); no
  `?tab=` is the Résumé tab.

## Resume data flow

```
User edit (PersonalInfoEditor / SectionEditor / DesignPanel)
    → store methods (updatePersonal, updateSection, updateSetting, …)
    → useState appState
    → coalesced save → localStorage `cpwtcv_v1` (at once after a quiet spell, then batched while typing)
    → useCloudSync observes resumes[] + updatedAt
    → debounced Firestore batch writes / deletes (if signed in)
```

Live preview — the same PDF the export downloads:

```
activeResume → renderResumePdf (utils/pdfExportReactPDF.js)
  → LOADERS[templateId(template)] → *TemplatePDF.jsx (react-pdf)
  → resolveTemplateSettings / resolveSection, resolvePdfFonts
  → PDF blob → PdfPreview.jsx paints each page with pdf.js
```

Export:

```
ExportDropdown → useEditorExports
  → dynamic import of pdfExportReactPDF / wordExport; Markdown, ATS text, JSON Resume and the backup
    JSON are plain modules
  → downloadBlob (utils/download.js)
```

## Auth + sync coupling

- `useAuth` owns Firebase user lifecycle.
- `useCloudSync` only activated when `user` is non-null; merges cloud/local once, then watches mutations.
- Dashboard and Editor receive `{ store, auth, sync }` props; Job pages currently **do not** use cloud sync.

## Build architecture

- Vite 8 (Rolldown) + React plugin + Tailwind v4 plugin
- `codeSplitting.groups` in `vite.config.js` names the vendor chunks: React, the react-pdf stack, docx,
  firebase — nothing on the start-up path downloads the PDF engine (`tests/pdf/71-startup-chunks.test.mjs`)
- PDF templates use dynamic `import()` per template key for code splitting

## Complexity hotspots

- The PDF section builders and rich text (`src/templates/pdf/shared/PdfSections*.jsx`, `PdfRichText.jsx`)
- The Word export builders (`src/utils/wordExportBuilders.js`)
- The cloud-sync engine (`src/utils/cloudSync*.js`)

The preview is the PDF, so a layout change is one react-pdf change; check that Word, Markdown and the ATS
text still agree with what it prints.
