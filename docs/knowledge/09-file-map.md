# 09 — File Map (actual tree)

README’s structure section is partial. This is the living map as of 2026-07-14.

```
flowcv/
├── docs/knowledge/          # ← this knowledge base
├── dist/                    # production build output
├── graphify-out/            # code knowledge graph artifacts
├── public/                  # favicon, fonts, icons
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css, index.css
│   ├── assets/
│   ├── components/
│   │   ├── AuthBar.jsx
│   │   ├── CareerHistoryPanel.jsx
│   │   ├── CoverLetterPanel.jsx
│   │   ├── DesignPanel*.jsx
│   │   ├── EditorHeader|EditorResumeTab|EditorPreviewPane.jsx  # the Editor page's parts
│   │   ├── ExportDropdown.jsx
│   │   ├── LayoutToggle.jsx
│   │   ├── PaginatedPreview.jsx
│   │   ├── PersonalInfoEditor*.jsx
│   │   ├── ResumeCard.jsx
│   │   ├── RichTextEditor.jsx
│   │   ├── SectionEditor*.jsx
│   │   ├── JobModal.jsx
│   │   └── job/             # tracker UI pieces
│   ├── constants/
│   │   ├── resume.js
│   │   └── jobs.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useCloudSync.js
│   │   ├── useEditorExports.js, usePanelResize.js  # the Editor's export menu and panel drag
│   │   ├── useResumeStore.js
│   │   ├── useResumeSectionActions.js
│   │   ├── useJobStore.js
│   │   └── useJobStages.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Editor.jsx
│   │   ├── JobTracker.jsx
│   │   ├── JobDetail.jsx
│   │   ├── JobForm.jsx
│   │   ├── PrivacyPage.jsx
│   │   └── TermsPage.jsx
│   ├── templates/
│   │   ├── Classic|Modern|Minimal|Sidebar|Executive*.jsx
│   │   ├── CoverLetterTemplate*.jsx
│   │   ├── headingStyle.js, sectionCase.js, templateShared.jsx
│   │   └── pdf/             # react-pdf templates + shared/
│   └── utils/
│       ├── defaultData*.js
│       ├── firebase.js
│       ├── fonts.js
│       ├── pdfExport.js
│       ├── pdfExportReactPDF.js
│       ├── resume.js
│       ├── wordExport*.js
│       └── brandIcons.jsx
├── tests/                   # Playwright
├── firestore.rules
├── index.html
├── jsconfig.json
├── package.json
├── package-lock.json
├── playwright.config.js
├── README.md
├── TODO_RESOLVE_CONFLICTS.md
├── vite-plugin-owner-resume.js  # the owner's private résumé on the dev server only
└── vite.config.js
```

## Rough size

- ~100+ JS/JSX modules under `src/`
- ~9.5k lines across src (approx; includes templates)

## Config files of note

| File | Role |
|------|------|
| `vite.config.js` | React, Tailwind, `@` alias, manualChunks, owner-résumé plugin |
| `vite-plugin-owner-resume.js` | `virtual:owner-resume`: `private/sairam-resume.json` on the dev server, `null` in every build |
| `jsconfig.json` | editor path alias |
| `firestore.rules` | owner-only user subtree |
| `playwright.config.js` | E2E server + browser defaults |
