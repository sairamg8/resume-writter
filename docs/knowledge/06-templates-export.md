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
`PdfItemHeader.jsx`, `PdfContact.jsx`, `PdfRichText.jsx`, `pdfFontLoader.js`, …). At a page break a
heading never ends a page alone: a section title keeps its first content, an entry header two lines of
body text (`headerKeep`), a grid row its cells' headers, and in Skills styles Stacked, Tags and Bars a
group's category the first lines of its skills — in the Sidebar's side column too — as Word's Stacked
category keeps with its skills (`tests/pdf/r5hunt8-skills-category-keep.test.mjs`). The Playwright
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
table, under it where a name or title word would not fit beside them (R2-137). Its photo prints as the
letter PDF's — the letter's own, else the résumé's, none with Show photo off — above a centred name, else
in a column beside it at Photo → Position (`wordLetterPhoto`, R4-DOUT-06).

Both .docx files are built from the résumé with the characters XML 1.0 forbids left out (`xmlSafe` in
`wordExportUtils.js`: C0 controls but tab, LF and CR — a pasted U+000B or U+0002 — U+FFFE/U+FFFF, and
a lone surrogate, half an emoji, which the browser's zip writes as bytes that are not UTF-8; a whole emoji
is kept), which docx would write as they are and Word would then refuse the file
(R5-HUNT7-WORD-CONTROL-CHAR-CORRUPT-DOCX, R5-HUNT7-REVIEW-WORD-LONE-SURROGATE). A line tab (U+000B, Word's
Shift+Enter) or form feed (U+000C) becomes a space instead, so the two words it parts stay apart, as in
the Markdown and ATS text (R5-HUNT8-WORD-XMLSAFE-GLUES-WORDS). Their document properties are the PDF's
(`getDocumentProps`): Title "<Name> Resume" or "<Name> Cover Letter", Author and Last Modified By the
name — never docx's default "Un-named" (R5-HUNT7-DOCX-AUTHOR-UN-NAMED).

## Text exports

- **Markdown** — `markdownExport.js`; an entry section's entries are the ones that print (`printedEntries`
  in `entryPrints.js`), as the PDF's and Word's, so a blank or all-hidden entry never splits a company's
  grouped roles (R5-HUNT7-MD-GROUP-ROLES-SPLIT-BY-BLANK-ENTRY); a list section (skills, languages,
  interests) leaves its blank entries out itself. A language row with no language (a new row keeps
  its default "Professional") prints in none of the four exports, and its section alone prints no
  heading (`entryPrints`, R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE)
- **ATS plain text** — `atsPlainText.js` (re-exported from `atsChecker.js`)
- **JSON Resume** — `jsonResumeExport.js` / `jsonResumeImport.js` (the jsonresume.org schema)

## JSON backup export/import

Full resume object (with a new id on import: `importResume`). Every import goes through
`normalizeResume()`, so a file from an older build is migrated like stored data, and every field the
app reads as text holds text (`textFields.js`), the record's own `name` included: a name that is an
object or missing becomes 'Untitled Resume' ('Cover Letter' for a letter), a number its digits.

## Import from a PDF, Word, Markdown or text (R2-148)

The Dashboard's and the editor's Import accept `.json,.pdf,.docx,.txt,.text,.md,.markdown` (`IMPORT_ACCEPT`,
`src/utils/importDocument.js`); a `.json` goes the JSON way above, the rest are read best-effort:

- `importFile.js` gets the text out as lines: a PDF through pdf.js (lines by baseline, wide gaps as
  tabs, wrapped lines joined, a Link annotation's address after a label it covers), a `.docx` by
  unzipping `word/document.xml` with `DecompressionStream` (the top Heading level used marks sections,
  deeper ones entries; the first page's header read first; a text box once; a hyperlink's target after
  a label, a HYPERLINK field's too; a list item's level), Markdown through `markdownLines` (`#` name,
  `##` headings, `###` entries, a deeper heading under an entry a grouped role; a link as "label
  (address)", a reference-style one ("[label][id]" with its "[id]: address" line) too; an indented list
  item nested), and text in UTF-8, UTF-16 (with its mark) or Windows-1252.
  Each line keeps its links' labels and addresses, so a link in body text is a link in the rich text
  (R4-LO-05). A password-protected PDF is told so (R4-IMP).
- `importText.js` (pure) reads the lines: name, job title, contacts, summary; a section per known
  heading (the app's titles and `ATS_STANDARD_SECTIONS` aliases), others custom — but in a file with no
  heading marks, a Title-Case "Key Achievements", "Tech Stack" or "Tools" inside a job or project with
  another dated entry after its own lines (past a blank line or a list; no "Label: value" line) is that
  entry's part, no section (R5-HUNT9); several years in brackets ("(2019, 2021)") date a line only in
  Certifications and Awards, or (not in Education) first in its section or over a list; entries found by
  their dates (the PDF's and Word's "Group roles by company": the undated employer line over dated
  roles, R4-LO-01), and in a dated section an undated block (first, or after a blank line) that opens
  with a title line an entry of its own (R5-HUNT8) — but not a sub-heading label inside the entry above
  ("Key Responsibilities", "Highlights", "Relevant Coursework", "Activities": `SUBHEADING`, R5-HUNT9),
  which stays that entry's text; every line it cannot place in a custom "Additional
  Information".
- The editor then shows a dismissable notice (`useImportNotice`, route state `importNotice`). An
  import from the editor's own Export menu ("Import as a new résumé", JSON or document) also says it
  is a new résumé (a letter's JSON: a new cover letter) and the open one is unchanged
  (`NEW_RESUME_NOTICE` / `NEW_LETTER_NOTICE`, R4-DUX-17); names are not de-duplicated.
- Tests: `tests/unit/import-text.unit.mjs`, round trip of the four exports in
  `tests/pdf/99-import-roundtrip.test.mjs`, the UI in `tests/pdf/99-import-ui.test.mjs`.

## Bundle impact

`codeSplitting.groups` in `vite.config.js` keeps `@react-pdf/renderer` and `docx` out of the main app chunk so dashboard/job tracker load stays lighter (`tests/pdf/71-startup-chunks.test.mjs`).
