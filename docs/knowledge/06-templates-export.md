# 06 — Templates and Export

## HTML preview templates

Registered in `src/constants/resume.js` → `TEMPLATE_MAP`:

| Key | Component | Notes |
|-----|-----------|-------|
| `classic` | `ClassicTemplate.jsx` | Default ATS-oriented |
| `modern` | `ModernTemplate.jsx` | Blue accent defaults |
| `minimal` | `MinimalTemplate.jsx` | More whitespace |
| `sidebar` | `SidebarTemplate.jsx` | Two-column + side color |
| `executive` | `ExecutiveTemplate.jsx` | Underline headings, title case |

Helpers/sections often split: `*Helpers.jsx`, `*Sections.jsx`.

Shared utilities: `templateShared.jsx`, `sectionCase.js`.

### Cover letter preview

`CoverLetterTemplate.jsx` (+ helpers) — uses resume settings for visual match.

### Dark template gap

`defaultResumeDataDark` seeds `template: 'dark'` but no `TEMPLATE_MAP.dark` and no PDF loader entry. UI falls back to ClassicTemplate. Either implement Dark or re-map seed to `sidebar`/`classic`.

## Design application

Editor computes:

- `computeMargin` / `computeLineHeight` (`utils/resume.js`)
- `FONT_SIZE_MAP` for CSS preview
- Google font loading via `fonts.js` when settings change

PDF path uses `resolveTemplateSettings` + `resolveSection` for template-specific section defaults.

## PDF export (primary)

**Entry:** `src/utils/pdfExportReactPDF.js`

1. `registerPdfFont(settings)` — react-pdf font registration  
2. Dynamic import template PDF component  
3. Resolve settings/sections  
4. `pdf(<Template />).toBlob()` → download  

PDF components:

```
src/templates/pdf/
  ClassicTemplatePDF.jsx
  ModernTemplatePDF.jsx
  MinimalTemplatePDF.jsx
  SidebarTemplatePDF.jsx
  ExecutiveTemplatePDF.jsx
  CoverLetterTemplatePDF.jsx
  shared/
    PdfPage.jsx, PdfRichText.jsx, PdfSections*.jsx,
    PdfContact.jsx, PdfIcons.jsx, pdfFontLoader.js, …
```

Fidelity work often requires parallel edits to HTML + PDF + sometimes Playwright fidelity tests (`08-pdf-design-fidelity.spec.js`).

## PDF export (legacy)

`src/utils/pdfExport.js` — print-oriented path used as “Export PDF (Legacy)” in the dropdown. Kept for fallback / comparison.

## Word export

- `wordExport.js` — orchestration  
- `wordExportBuilders.js` — per-section builders  
- `wordExportUtils.js` — text/html helpers, headings, bullets  

Not a pixel-perfect match to PDF; structural DOCX for ATS/HR systems.

## JSON export/import

Full resume object (with new id on import). Validation on import requires `personal` + `sections[]`.

## Bundle impact

`manualChunks` in Vite keeps `@react-pdf/renderer` and `docx` out of the main app chunk so dashboard/job tracker load stays lighter.
