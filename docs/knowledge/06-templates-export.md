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

### Cover letter

`CoverLetterTemplatePDF.jsx` (+ `CoverLetterHeaderPDF.jsx`) — uses the résumé's design settings
and letterhead so the two match.

## Design application

PDF path uses `resolveTemplateSettings` + `resolveSection` for template-specific section defaults.
Design-panel spacing is CSS px and converts to points once (`pdfUnits.js`); font sizes are
already points.

## PDF export (primary)

**Entry:** `src/utils/pdfExportReactPDF.js`

1. `registerPdfFont(settings)` — react-pdf font registration  
2. Dynamic import template PDF component  
3. Resolve settings/sections  
4. `pdf(<Template />).toBlob()` → download  

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

Not a pixel-perfect match to PDF; structural DOCX for ATS/HR systems.

## Text exports

- **Markdown** — `markdownExport.js`
- **ATS plain text** — `atsPlainText.js` (re-exported from `atsChecker.js`)
- **JSON Resume** — `jsonResumeExport.js` / `jsonResumeImport.js` (the jsonresume.org schema)

## JSON backup export/import

Full resume object (with new id on import). Every import goes through `normalizeResume()`.

## Bundle impact

`manualChunks` in Vite keeps `@react-pdf/renderer` and `docx` out of the main app chunk so dashboard/job tracker load stays lighter.
