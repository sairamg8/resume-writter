# 09 — File Map (actual tree)

The living map as of 2026-09-24. `tests/unit/knowledge-docs.unit.mjs` checks that every `src/` and
`tests/` path these docs name in backticks exists.

```
resume-writter/
├── .github/workflows/ci.yml   # the CI gate: node suite, build, Playwright, lint, Cypress, fail-first
├── .yarn/patches/             # yarn patches (react-pdf's textkit)
├── cypress/
│   ├── e2e/                   # end-to-end specs (*.cy.js)
│   └── support/               # commands, stored-state and demo-account steps, selectors
├── docs/
│   ├── knowledge/             # how the app works (this folder)
│   └── tracking/              # every tracker, plan, audit and session log — see its README
├── public/                    # favicon, icons
├── src/
│   ├── main.jsx               # StrictMode + HashRouter
│   ├── App.jsx                # the app's state: store, account, sync, demo restore
│   ├── AppRoutes.jsx          # the routes, and what each page gets from App
│   ├── index.css
│   ├── assets/
│   ├── components/
│   │   ├── AtsCheckerPanel.jsx, AuthBar.jsx, CareerHistoryPanel.jsx
│   │   ├── CoverLetterPanel*.jsx, CoverLetterGeneratorModal.jsx, BulletOptimizerModal.jsx
│   │   ├── DesignPanel*.jsx, HeaderIconPickerModal.jsx, HeaderSpacingControls.jsx
│   │   ├── EditorHeader|EditorResumeTab|EditorPreviewPane|EditorTabContent.jsx  # the Editor page's parts
│   │   ├── ExportDropdown.jsx, ImportMenu.jsx, LayoutToggle.jsx
│   │   ├── PdfPreview.jsx     # the preview: the exported PDF, painted by pdf.js
│   │   ├── PersonalInfoEditor*.jsx, RichTextEditor.jsx, SectionEditor*.jsx
│   │   ├── ResumeCard.jsx, ResumeThumbnail.jsx, StarterTemplateModal.jsx
│   │   ├── TemplateGallery.jsx, TemplateThumb.jsx  # Browse templates, and each card's page picture
│   │   ├── ErrorBoundary.jsx, RecoveryNotice.jsx
│   │   ├── job/               # Job Tracker pieces (kanban, list, detail tabs)
│   │   ├── board/             # Boards pieces (cards, columns, labels)
│   │   ├── shell/             # the workspace shell around the Job Tracker and Boards
│   │   └── ui/                # the shared UI kit (dialogs, menus, toasts, fields…)
│   ├── constants/             # templateTable.js + templates.js, resume.js (section groups), jobs.js,
│   │                          # boards.js, pageSize.js, pageMargins.js, headerSpacing.js, photoOptions.js…
│   ├── hooks/
│   │   ├── useResumeStore.js, useResumeSectionActions.js, useResumeSyncActions.js, useResumeDesignActions.js
│   │   ├── usePickCard.js, usePicture.js  # a picker card picked (with Undo); a page picture once on screen
│   │   ├── useAuth.js, useCloudSync.js, useCollectionSync.js (jobs + boards sync), useDemoSeed.js
│   │   ├── useJobStore.js, useJobStages.js, useBoardStore.js
│   │   ├── useEditorExports.js, useEditorTab.js, usePanelResize.js, useOpenResume.js
│   │   ├── useOverlayClose.js  # a modal's backdrop: a click beside the box closes it
│   │   └── useMediaQuery.js, useHotkeys.js, useSmallerPhotos.js, …
│   ├── pages/                 # Dashboard, Editor, JobTracker, JobDetail, JobForm, Boards, Board,
│   │                          # Backlog, BoardSettings, YourWork, PrivacyPage, TermsPage,
│   │                          # PublicResume (#/r/:shareId), NewResume (#/new: every look drawn
│   │                          # with the user's own résumé; a click starts a copy of it on that look)
│   ├── templates/pdf/         # one react-pdf file per template, the cover letter, and shared/
│   └── utils/
│       ├── normalizeResume.js, dataVersion.js, defaultData*.js, starter*.js  # the data model
│       ├── letters.js, newResume.js  # a new letter / a new résumé from one of the user's résumés
│       ├── pdfExportReactPDF.js                                      # PDF render + download
│       ├── templatePicker.js   # Design → Template's cards, built from the table, designs and saved designs
│       ├── pageImage.js, pageImageStore.js, pdfjsLoader.js  # page-1 pictures: painted, queued, kept
│       ├── wordExport*.js, markdownExport.js, atsPlainText.js, jsonResume*.js  # the other exporters
│       ├── atsChecker.js, bulletOptimizer.js, coverLetterGenerator.js
│       ├── cloudSync*.js, syncMerge.js, localDeletions.js, demo*.js, siteOwner.js, firebase.js
│       ├── job*.js, normalizeJob.js, board*.js, normalizeBoard.js
│       └── storageBackup.js, ids.js, richText.js, fonts.js, …
├── tests/
│   ├── pdf/                   # node:test suites that render real PDFs (harness.mjs); parity/
│   ├── unit/                  # node:test unit suites
│   ├── playwright/            # browser suites against a built ./dist
│   ├── fixtures/              # fictional sample résumés
│   └── helpers.js, pdf-utils.js  # stored-state builders and PDF text-run readers the browser suites share
├── cypress.config.js
├── firestore.rules
├── index.html
├── jsconfig.json
├── package.json, yarn.lock, .yarnrc.yml  # Yarn 4, node-modules linker
├── playwright.config.js
├── README.md, CONTRIBUTING.md, LICENSE
├── vite-plugin-owner-resume.js  # the owner's private résumé on the dev server only
├── vite.config.js
└── wrangler.jsonc             # Cloudflare static-assets deploy of ./dist
```

## Rough size

- ~290 JS/JSX modules under `src/`
- ~36k lines across `src/`

## Config files of note

| File | Role |
|------|------|
| `vite.config.js` | React, Tailwind, `@` alias, named vendor chunks (`codeSplitting.groups`), owner-résumé plugin |
| `vite-plugin-owner-resume.js` | `virtual:owner-resume`: `private/sairam-resume.json` on the dev server, `null` in every build |
| `jsconfig.json` | editor path alias |
| `firestore.rules` | owner-only user subtree; `public/{shareId}` readable by id, written by its owner (public links) |
| `playwright.config.js` | serves a built `./dist` (`PW_DIST`) on port 4173 (`PW_PORT`) for `tests/playwright/` |
| `cypress.config.js` | the e2e build on 4173; tasks that read downloaded PDFs and .docx files |
| `.github/workflows/ci.yml` | the CI gate and its dispatch inputs (08-testing.md) |
