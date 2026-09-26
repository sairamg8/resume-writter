# 06 — Templates and Export

## Templates

There is no separate HTML preview any more: the editor's preview is the exported PDF itself,
rendered by react-pdf and painted by pdf.js (`src/components/PdfPreview.jsx`). A template is one
react-pdf component plus a row in the template table.

- **Table:** `src/constants/templateTable.js` → `TEMPLATES` — each template's label, ATS tier, the
  heading style it brings and its header gaps. `src/constants/templates.js` reads it
  (`TEMPLATE_IDS`, `templateId`, `templateLabel`, …).
- **Unknown ids** (the old seed's `dark`, an imported file's id) print as Classic: `templateId()`.

| Key | PDF component | ATS tier |
|-----|---------------|----------|
| `classic` | `ClassicTemplatePDF.jsx` | certified |
| `modern` | `ModernTemplatePDF.jsx` | good |
| `minimal` | `MinimalTemplatePDF.jsx` | certified |
| `executive` | `ExecutiveTemplatePDF.jsx` | certified |
| `sidebar` | `SidebarTemplatePDF.jsx` | risky (two columns); Design → Layout "Single · ATS-safe" prints Classic's page |
| `timeline` | `TimelineTemplatePDF.jsx` | certified |
| `banner` | `BannerTemplatePDF.jsx` | good |
| `academic` | `AcademicTemplatePDF.jsx` | certified |
| `compact` | `CompactTemplatePDF.jsx` | good |

### Designs (presets)

Design → Template also lists **designs** (`src/constants/templatePresets.js` → `TEMPLATE_PRESETS`): a
named look — Harbor, Ledger, Nordic, Crimson, Midnight, Sunrise, Grove, Inkwell — over a template above
(its `engine`) with a bundle of design settings (font, colours, heading style, header, spacing). No
layout code of their own. Picking one is `setTemplate(engine, presetId)` (`src/utils/templateSwitch.js`
→ `withTemplate`): the engine, the design's settings, and `settings.templatePreset` so the picker marks
its card; a plain template clears it and its look leaves where the user kept it (`styleOnSwitch`); Reset
returns to the design (`defaultSettings(template, settings)`). JSON Resume writes it as `meta.design`,
Backup keeps it with the settings. Section settings are never touched. Every design runs the ATS field
battery (`tests/pdf/42-ats-fields.test.mjs`); its badge is `atsRating(engine, settings)`.

### Cover letter

`CoverLetterTemplatePDF.jsx` (+ `CoverLetterHeaderPDF.jsx`) — uses the résumé's design settings
and letterhead so the two match.

## Design application

PDF path uses `resolveTemplateSettings` + `resolveSection` for template-specific section defaults.
Design-panel spacing is CSS px and converts to points once (`pdfUnits.js`); font sizes are
already points.

## PDF export (the only PDF path — the preview renders the same PDF)

**Entry:** `src/utils/pdfExportReactPDF.js` — `renderResumePdf` / `renderCoverLetterPdf` (preview and
export), `exportToPDFReact` / `exportCoverLetterPDFReact` (download), `warmPdfExport` (caches)

1. `resolvePdfFonts(settings, text)` — registers the fonts the text needs (`pdfFontLoader.js`)  
2. Dynamic import of the template's PDF component (`LOADERS`; an unknown id loads Classic)  
3. Resolve settings/sections (`resolveTemplateSettings`, `resolveSection`)  
4. `pdf(<Template />).toBlob()` → the preview paints it, or `downloadBlob` saves it  

Shared building blocks live in `src/templates/pdf/shared/` (`PdfPage.jsx`, `PdfSections*.jsx`,
`PdfItemHeader.jsx`, `PdfContact.jsx`, `PdfRichText.jsx`, `pdfFontLoader.js`, …). The Playwright
suites in `tests/playwright/` check that the preview is the downloaded PDF and that every design
control repaints it.

## Word export

- `wordExport.js` — orchestration  
- `wordExportBuilders.js` — per-section builders  
- `wordExportHeader.js`, `wordExportContacts.js` — the header and contact line  
- `wordExportCoverLetter.js` — the letter  
- `wordExportUtils.js`, `wordExportLook.js` — text/html helpers, headings, bullets, colours  
- `wordExportPhoto.js` — the photo, as the PDF prints it  

Not a pixel-perfect match to PDF; structural DOCX for ATS/HR systems. Modern's banner and the
two-column Sidebar's header print on their band, a shaded table (`frameTable` in `wordExportLook.js`);
Banner's and Banded's headers print on the white page. The letter's letterhead takes the same band or
rule, and at Right of Name (its default Fields Position) its contacts sit beside the name in a two-cell
table, under it where a name or title word would not fit beside them (R2-137).

## Text exports

- **Markdown** — `markdownExport.js`
- **ATS plain text** — `atsPlainText.js` (re-exported from `atsChecker.js`)
- **JSON Resume** — `jsonResumeExport.js` / `jsonResumeImport.js` (the jsonresume.org schema)

## JSON backup export/import

Full resume object (with a new id on import: `importResume`). Every import goes through
`normalizeResume()`, so a file from an older build is migrated like stored data.

## Import from a PDF, Word, Markdown or text (R2-148)

The Dashboard's and the editor's Import accept `.json,.pdf,.docx,.txt,.text,.md,.markdown` (`IMPORT_ACCEPT`,
`src/utils/importDocument.js`); a `.json` goes the JSON way above, the rest are read best-effort:

- `importFile.js` gets the text out as lines: a PDF through pdf.js (lines by baseline, wide gaps as
  tabs, wrapped lines joined, a Link annotation's address after a label it covers), a `.docx` by
  unzipping `word/document.xml` with `DecompressionStream` (the top Heading level used marks sections,
  deeper ones entries; the first page's header read first; a text box once; a hyperlink's target after
  a label), Markdown through `markdownLines` (`#` name, `##` headings, `###` entries, a deeper heading
  under an entry a grouped role; a link as "label (address)"), and text in UTF-8, UTF-16 (with its
  mark) or Windows-1252. A password-protected PDF is told so (R4-IMP).
- `importText.js` (pure) reads the lines: name, job title, contacts, summary; a section per known
  heading (the app's titles and `ATS_STANDARD_SECTIONS` aliases), others custom; entries found by
  their dates; every line it cannot place in a custom "Additional Information".
- The editor then shows a dismissable notice (`useImportNotice`, route state `importNotice`).
- Tests: `tests/unit/import-text.unit.mjs`, round trip of the four exports in
  `tests/pdf/99-import-roundtrip.test.mjs`, the UI in `tests/pdf/99-import-ui.test.mjs`.

## Bundle impact

`codeSplitting.groups` in `vite.config.js` keeps `@react-pdf/renderer` and `docx` out of the main app chunk so dashboard/job tracker load stays lighter (`tests/pdf/71-startup-chunks.test.mjs`).
