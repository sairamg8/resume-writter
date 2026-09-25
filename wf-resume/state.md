## design-page
- 302335d fix(json-resume): a US Letter résumé's JSON Resume file names its paper, and the import brings it back on Letter (R2-136)
- ccc9c21 feat(design): Design → Spacing offers Page size, A4 or US Letter, and the résumé, its letter and both Word files print on the paper picked (R2-136)
## header-type
- WIP patch (uncommitted, untested): wip/header-type.patch — apply on 802d0a5 with `git apply --index`; 14 files: src/constants/templateHeaderGaps.js src/templates/pdf/CoverLetterHeaderPDF.jsx src/templates/pdf/ModernTemplatePDF.jsx src/templates/pdf/SidebarTemplatePDF.jsx src/templates/pdf/shared/letterhead.js src/templates/pdf/shared/pdfUnits.js src/utils/headerSpacingRows.js src/utils/wordExportCoverLetter.js src/utils/wordExportHeader.js tests/pdf/27-header-spacing.test.mjs tests/pdf/73-typed-number-fields.test.mjs tests/pdf/92-header-spacing-rows.test.mjs tests/pdf/parity/01-offered.test.mjs tests/pdf/parity/registry-header.mjs 
## templates
- 67c88c5 feat(design): the template cards and Design's option rows are radios that say which one is chosen, the descriptions read, and the Design button is labelled, 44 px and pressed while open (R2-139)
## section-style
- WIP patch (uncommitted, untested): wip/section-style.patch — apply on 802d0a5 with `git apply --index`; 15 files: src/components/DesignPanel.jsx src/components/DesignPanelLists.jsx src/templates/pdf/shared/PdfRichText.jsx src/utils/defaultData.js src/utils/pdfExportReactPDF.js src/utils/richText.js src/utils/wordExport.js src/utils/wordExportBuilders.js src/utils/wordExportCoverLetter.js src/utils/wordExportHeader.js src/utils/wordExportLook.js src/utils/wordExportUtils.js tests/pdf/parity/17-lists.test.mjs tests/pdf/parity/registry-design.mjs tests/pdf/parity/registry.mjs 
## cloud-sync
- ae65084 test(jobs): the Notes tab test reads the editor's contentEditable from what React rendered, not a lower-cased attribute the fake DOM does not fold (R2-159)
- b2a73c6 test(jobs): a job's Notes tab shows its stored notes sanitized, and typing, the toolbar, a link, a paste and clearing write them through the job store (R2-159)
## structure-tests
- WIP patch (uncommitted, untested): wip/structure-tests.patch — apply on 802d0a5 with `git apply --index`; 3 files: tests/pdf/96-section-structure.test.mjs tests/pdf/96-structure-keyboard.test.mjs tests/pdf/resume-tab.mjs 
## perf
- 541c85f test(preview): the steady-typing case types on while its first build runs, so the preview still owes the latest keys when those pages go up (R2-142)
- 239ea7f fix(store): a sign-out right after typing takes the account's résumés off storage at once, not a moment later (R2-142)
- 992725a perf(store): a setting, field or letter value set to what it holds already is not an edit — no store write, no preview build, no sync (R2-142)
- 9633e36 perf(preview): typing that never pauses repaints the preview at least every 1.2 s instead of freezing until it stops (R2-142)
## ats-view
- 39c7925 fix(ats): the layout check says what pdf.js and Poppler read, and a LinkedIn label that hides the address warns (R2-141)
- WIP patch (uncommitted, untested): wip/ats-view.patch — apply on 39c7925 with `git apply --index`; 2 files: src/components/AtsParserView.jsx src/utils/parserText.js 
## letters-import
- WIP patch (uncommitted, untested): wip/letters-import.patch — apply on 802d0a5 with `git apply --index`; 12 files: cypress/e2e/01-dashboard.cy.js docs/knowledge/03-data-model.md docs/knowledge/04-features.md src/components/NewLetterModal.jsx src/components/ResumeThumbnail.jsx src/hooks/useResumeStore.js src/pages/Dashboard.jsx src/utils/dataVersion.js src/utils/letters.js src/utils/normalizeResume.js tests/helpers.js tests/pdf/99-cover-letters.test.mjs 
## release
- 731ae2c docs(knowledge): the knowledge docs say what src/ does today, and a unit test fails when they drift (R2-169)
- 1f6a4cb chore(deps): @napi-rs/canvas is a declared devDependency, so the photo paint tests always run; file-saver, imported by nothing, is gone (R2-169)
- 7741845 chore(repo): graphify-out/ is no longer tracked — generated output that named deleted files, read by nothing (R2-169)
