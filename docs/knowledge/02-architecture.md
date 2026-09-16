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
   Dashboard         Editor        Job pages
   Terms/Privacy                   (own useJobStore)
```

## Layering

| Layer | Responsibility | Key paths |
|-------|----------------|-----------|
| Pages | Route-level UI composition | `src/pages/*` |
| Components | Reusable panels/editors | `src/components/*` |
| Hooks / stores | State + side effects | `src/hooks/*` |
| Constants | Template map, section groups, job statuses | `src/constants/*` |
| Templates (HTML) | Live preview renderers | `src/templates/*.jsx` |
| Templates (PDF) | `@react-pdf/renderer` trees | `src/templates/pdf/*` |
| Utils | Firebase, fonts, export, defaults | `src/utils/*` |

## Routing strategy

- **`HashRouter`** so static hosting works without rewrite rules (`#/resume/xyz`).
- Resume editor syncs URL `:id` to `store.activeId`; missing id → navigate home.
- Cover letter deep-link: `#/resume/:id?tab=coverletter` (query parsed from `window.location.hash` in Editor).

## Resume data flow

```
User edit (PersonalInfoEditor / SectionEditor / DesignPanel)
    → store methods (updatePersonal, updateSection, updateSetting, …)
    → useState appState
    → useEffect → localStorage `cpwtcv_v1`
    → useCloudSync observes resumes[] + updatedAt
    → debounced Firestore setDoc / deleteDoc (if signed in)
```

Live preview:

```
activeResume.template → TEMPLATE_MAP → *Template.jsx
settings → margin/fontSize/lineHeight helpers
PaginatedPreview → A4 page simulation in the editor
```

Export:

```
ExportDropdown
  → dynamic import of pdfExportReactPDF / wordExport / pdfExport
  → blob download via anchor click
```

## Auth + sync coupling

- `useAuth` owns Firebase user lifecycle.
- `useCloudSync` only activated when `user` is non-null; merges cloud/local once, then watches mutations.
- Dashboard and Editor receive `{ store, auth, sync }` props; Job pages currently **do not** use cloud sync.

## Build architecture

- Vite 8 + React plugin + Tailwind v4 plugin
- `manualChunks` isolates heavy vendors: react-pdf stack, docx, firebase
- PDF templates use dynamic `import()` per template key for code splitting

## Cycles (from graphify)

Known import cycles (soft / shared modules):

- `App.jsx` ↔ `useCloudSync` / `useAuth` ↔ `firebase.js`

These are common in SPA bootstrap patterns; not necessarily runtime bugs.

## God nodes (complexity hotspots)

From `graphify-out/GRAPH_REPORT.md` (2026-06-29):

- PDF rich text / section builders (`PdfRichText`, `buildSection`, `sectionHeading`)
- Word export builders (`buildExperience`, `buildEducation`, …)
- Editor navigation helpers in tests (`gotoEditor`)

When changing layout fidelity, expect to touch **both** HTML template and PDF template for the same design.
