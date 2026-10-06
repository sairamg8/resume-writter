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
| `sidebar` | `SidebarTemplatePDF.jsx` | risky (two columns, Mixed too); Design → Layout "Single · ATS-safe" prints Classic's page; its column layout below |
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
A design the user saved lives in `settings.myDesigns` and is read through `ownDesign`, which keeps its
settings to a look (`designLook`: plain values, none of NOT_A_LOOK such as the paper) and checks them as
normalizeResume checks a résumé's (numbers in range, colours as '#rrggbb', Name Font and
Heading Font as text), so a saved design from an imported .json cannot put unchecked values on the
résumé it is picked for.

### The Sidebar's column layout (R2-147-col)

Design → Template → Layout, on the Sidebar's two columns only (`src/components/DesignPanelLayout.jsx`;
none in Single · ATS-safe, which wins, nor on another template). One module holds the choices the panel
offers and the PDF and Word draw: `src/constants/layoutOptions.js` (`LAYOUT_OPTIONS`, `sidebarLayout`).

- **Columns** `layoutColumns`: `two` (Side column) or `mixed` — the details on a band, the main sections
  across the page, then the short sections (`SIDEBAR_COLUMN_TYPES`) two to a row, the first in a column the
  side column's width, the second in the rest; each a column of its own, one entry to a row whatever its
  Grids (`inMixedColumns`: Section Options offers no Grids there, the ATS Check reads no grid).
- **Details** `layoutDetails` (Side column only): `left` (as always), `right` (the page in `row-reverse`, so
  the name is still the first text drawn; the running header and page numbers end at the main column's
  text, their `right` props) or `top` (`src/templates/pdf/shared/PdfSidebarBand.jsx`: photo left of the name,
  contacts on lines under it, each value whole as in the column, `_sideRoomPt`; the column beneath).
- **Width** `layoutSideWidth`: % of the paper, 24–45 (`SIDE_WIDTH_PCT`, `sideWidthOf`), `sideShare` in
  `PdfPage.jsx`; in Mixed the left column's (`_columnWidthPt` sizes a Mixed column's entries).

Unset (every résumé stored before) is Side column, Left, 38 %: the page exactly as it printed. Pagination is
the Left page's in every layout: a column, or a Mixed column, starts with SPACER and splits on its own (both
stretch to their row, so the next page keeps each one's place); a Mixed row is led by a mark that keeps ten
lines of it on its page, so its two sections start side by side. Reset Design Settings returns the default
page; no section ↺ writes the layout. The cover letter keeps its own letterhead in every layout. Tests:
`tests/pdf/150-r2-147-col-layout-*`, `tests/unit/layout-options.unit.mjs`,
`tests/unit/layout-mixed-columns.unit.mjs`; the parity matrix's `template` family measures each control.

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

In the browser these steps run in a Web Worker (`pdfWorker.js` → `pdfWorkerJobs.js`), asked through
`src/utils/pdfBuild.js`; Node and a browser with no module worker build on the main thread. A worker that
never replies is let go by a watchdog (`pdfBuildTimeoutMs`: 20 s, twice that before its first reply, plus
250 ms per entry, plus 15 ms for each paragraph or bullet past the first 300, up to 4,000 of them:
`tests/pdf/177-pdf-build-budget-blocks.test.mjs`): a worker that never answered anything hands its jobs to the main thread, one that had
built before fails that build with a retryable "took too long" error and its queue goes to a fresh worker;
what a let-go worker sends late is ignored. A clock that rings 5 s or more past its time slept with the page
(a tab frozen in the background, a phone that put the browser away) and the worker with it, so it starts
again with the whole budget rather than letting the worker go. The main thread's builds (no worker, or the
jobs a let-go worker held) have the same budget, cold: one past it fails with the same retryable error and runs
on unheard, so it cannot hold the preview's queued build or an export for good. The next main-thread build does
not lay out beside it on the one thread (each slowed the other past its budget): it waits for it — the same
résumé (Retry) takes its file, another builds once it is done — and one still running 20 s later is taken to be
hung, so the next starts anyway and no later build waits for it (`tests/pdf/121-main-thread-build-overrun.test.mjs`).
This is the only watchdog on the build, and
fonts take room in its budgets, bounded: `pdfFontLoader.js` waits for the CDN `FONT_LOAD_MS` (10 s), one
deadline shared by every font metadata lookup and every CDN face of a build (bundled Noto Sans faces get the
whole wait each). A lookup or face whose wait starts with the deadline all but spent (a slow network, a CJK
face prepared on a weak phone) still gets a grace of 1.5 s — it lost a race it would have won in 100 ms, with a
false "could not be loaded" notice — but no wait ends more than 3 s past the deadline (`cdnWaitMs`): 13 s at
most, which leaves the rest of a build at least 7 s of the 20 s (27 s of the 40 s cold). Before, the lookups were outside
it — up to 8 s each, in turn (`fontsource.js`), ~24 s for a body, Name Font and Heading Font from a CDN that
answers nothing, and the build failed "took too long", Retry too. Past the deadline a font with no metadata, or
a face, counts as not loaded (the font prints in Noto Sans with the usual notice); a lookup that timed out is
not asked again for a minute (or until back online; the font check in Typography asks again), a stalled face
is not waited for again for a minute, and when slow metadata or a face's data lands the preview is told to
build again, once per family (`faceFetched`). A face's own data lands prepared, and a face lent a donor's data
keeps it until the next build puts its own in (`landPrepared`), so no build lays out with an unprepared face
(`tests/pdf/118-font-late-face-prepared.test.mjs`, `tests/pdf/119-font-metadata-deadline.test.mjs`). Tests inject a fake Worker and a fake clock with
`_setPdfWorkerForTest(create, { timers })` (`tests/pdf/97-pdf-worker.test.mjs`, `tests/pdf/126-r2-142-pdf-worker-watchdog.test.mjs`,
`tests/pdf/112-pdf-worker-watchdog.test.mjs`); the font wait with `_setFontLoadWaitForTest(ms)`
(`tests/pdf/113-font-load-stall.test.mjs`, its grace in `tests/pdf/120-font-wait-grace.test.mjs`).
The budget counts blocks, and a paste is held to a number of them, because react-pdf lays each paragraph and list item out again for every page after it, so a field's build time follows its pages times its blocks (2,000 bullets of 100 characters took 23 s on CI). A paste that would take a rich-text field past `MAX_FIELD_BLOCKS` (1,500, `src/utils/richTextCap.js`) paragraphs and bullets, the field's own counted, is cut where the limit falls and a line under the field says so (`tests/pdf/176-rich-text-block-cap.test.mjs`); typing is not held, and a stored or imported field is left as it is.

The preview's own calls to pdf.js have a budget of their own (`PdfPreview.jsx`, `pdfjsTimeoutMs`: 20 s, twice that until
a document has opened, plus a second per page, up to 100 pages). Loading the library, opening the PDF, reading its
pages and painting them are each a stage with its clock; a stage past its budget fails the build the way any other
failure does ("Preview failed to render (The preview took too long to draw)" and Retry, the next change builds), its
loading task is destroyed, its paint is cancelled and its canvases are shrunk and never pooled (a late paint would draw
into them), and what pdf.js settles late is dropped. A clock that rings 5 s or more late starts the stage again. The
pages' text, read once they are up, is let go the same way: those pages' text is empty and the status is 'ready'.
The test sets the clock with `_setPreviewClockForTest` (`tests/pdf/174-preview-pdfjs-watchdog.test.mjs`).

A skill's own level (`skillLevels`, 1–5, edited per skill in the Skills editor; R2-147) is the length of its
bar in Skills style Bars — the main column of every template and the Sidebar's side column
(`skillBarWidth`: level / 5; no level keeps the old 80 %). Word prints it as `▰▰▰▱▱` glyphs after the skill,
in Bars only; every other style, Markdown and the ATS text print nothing of it
(`tests/pdf/147-skill-level-*`, `tests/unit/skill-levels.unit.mjs`).

A pasted paragraph of more than 12 000 characters is laid out as several paragraphs of a few thousand
(`splitHugeBlock.js`, called by `PdfRichText.jsx`; the spaces at the cuts are dropped, every other character
prints in order): textkit's time on one paragraph grows with its square, and a 200 000-character paste took
12 s (`tests/unit/tf-sidebar-huge-paragraph.unit.mjs`, `tests/pdf/164-huge-paste-linear.test.mjs`). A plain text
field (a company, a skills line, a name: no rich text) is cut the same way by `Text` (`PdfText.jsx`, which every
template draws its strings with): a string of more than 12 000 characters reaches react-pdf as lines of a few
thousand, which textkit lays out apart (`breakHugeChildren`); text of 12 000 characters or fewer, and children
with an element in them, are passed on as they were. The running header's line, drawn from a render prop, is cut
the same way (`PdfRunningHeader.jsx`). Pinned by counting textkit's line-breaking work, never by timing it
(`tests/pdf/175-plain-field-linear.test.mjs`, `tests/pdf/call-counts.mjs`, `tests/unit/plain-text-cut.unit.mjs`).
What is not cut, and costs the layout's own price: thousands of short paragraphs, list items or skills in one
field, each a node react-pdf lays out again on every page that follows it (the cost grows with pages times
nodes: 2 000 list items of 100 characters, 23 s on CI). The
Sidebar's `breakToFit` (`pdfMeasure.js`) cuts a long unbroken token into runs by doubling then halving, not
character by character (`tests/pdf/164-sidebar-token-break.test.mjs`).

Shared building blocks live in `src/templates/pdf/shared/` (`PdfPage.jsx`, `PdfSections*.jsx`,
`PdfItemHeader.jsx`, `PdfContact.jsx`, `PdfRichText.jsx`, `pdfFontLoader.js`, …). At a page break a
heading never ends a page alone: a section title keeps its first content, an entry header two lines of
body text (`headerKeep`), a grid row its cells' headers, and in Skills styles Stacked, Tags and Bars a
group's category the first lines of its skills — in the Sidebar's side column too — as Word's Stacked
category keeps with its skills (`tests/pdf/r5hunt8-skills-category-keep.test.mjs`); the Skills title
keeps that first category and what it keeps (`tests/pdf/r5hunt10-skills-title-category-keep.test.mjs`). The Playwright
suites in `tests/playwright/` check that the preview is the downloaded PDF and that every design
control repaints it.

## Word export

- `wordExport.js` — orchestration  
- `wordExportBuilders.js` — per-section builders  
- `wordExportHeader.js`, `wordExportContacts.js` — the header and contact line  
- `wordExportCoverLetter.js` — the letter  
- `wordExportUtils.js`, `wordExportLook.js` — text/html helpers, headings, bullets, colours  
- `wordExportPhoto.js` — the photo, as the PDF prints it  

Not a pixel-perfect match to PDF; structural DOCX for ATS/HR systems. Word has no side column: the
two-column Sidebar prints its sections one after another in their order, so its Details (Left, Right,
Top) and Width print the same file (the fallback, R2-147-col); its Mixed layout prints the main sections,
then the short ones two to a row in a borderless table a row (`mixedRows` in `wordExport.js`), the cells
where the PDF's columns start, each section at its cell's width (`buildSection`'s `width`). Modern's banner and the
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
  heading (`entryPrints`, R5-HUNT9-LANGUAGE-DEFAULT-PROFICIENCY-PRINTS-ALONE). Nor does a certificate
  holding only a Link label with its Link URL cleared, or interests that are only commas: `entryPrints`
  counts what the renderers draw (R5-HUNT10-ENTRYPRINTS-COUNTS-UNPRINTED-LEFTOVERS). A current role's
  "Present" counts only while its End Date's eye is on: a current job with every eye off prints
  nothing (R5-HUNT10-REVIEW-CURRENT-HIDDEN-END-PRINTS). A certificate whose URL cannot be linked prints
  its Link label (else the URL) as plain text, as the PDF and Word do (R5-HUNT12-MD-CERT-LABEL-LOST-UNLINKABLE-URL)
- **ATS plain text** — `atsPlainText.js` (re-exported from `atsChecker.js`); its contact line prints
  each value as typed (or its Link URL), not the Display label, so the full address stays followable —
  but a website, LinkedIn or GitHub typed as just "https://", "www." or "https://www" under a label
  prints the label, as every other export does — `namesAddress`, the test `linkOverride` and JSON Resume
  share (R5-HUNT12-ATS-TEXT-BARE-SCHEME-UNDER-LABEL, R5-HUNT12-REVIEW-ATS-HOSTLESS-WWW-UNDER-LABEL)
- **ATS Check** — its score items (roles, dates, degrees, skills, grids) and "What a parser reads" (`printedJobs`) read only the entries that print (`entryPrints`): a blank entry just added is no role missing its title or dates, and splits no grouped roles (R5-HUNT11-ATS-SCORES-BLANK-ENTRIES)
- **JSON Resume** — `jsonResumeExport.js` / `jsonResumeImport.js` (the jsonresume.org schema); only
  what prints goes in the file: a hidden section, entry or field stays out, and so does an entry that
  prints nothing (`entryPrints`: a blank entry, a job with every eye off, a language row with only its
  default "Professional"); its section keeps its place in `meta.sections` with no entries
  (R5-HUNT10-JSON-RESUME-WRITES-UNPRINTED-ENTRIES). A project has no Role box and no renderer prints
  one, so the import puts a file's project `roles` in the description as a last "Role: …" paragraph;
  a `role` a project holds from an earlier import is moved there as the résumé loads
  (`normalizeResume` → `withProjectRoles`, whatever its data version; R5-HUNT11-REVIEW-LEGACY-PROJECT-ROLE),
  and one left anyhow is not written back, prints no heading (`entryPrints`) and counts in no Job
  Match (R5-HUNT11-JSON-RESUME-PROJECT-ROLE-INVISIBLE)
  A contact goes in only when the résumé prints it (`contactItems`): a website, LinkedIn or GitHub typed
  as just "https://" or "www.", or an e-mail or phone of only spaces, writes no `basics.url`, profile or
  field (R5-HUNT11-JSON-RESUME-EMPTY-SCHEME-CONTACT). One with a Display label still goes in, but a bare
  "https://" or "www." under it (the PDF prints the label unlinked) writes `basics.url` '' and no profile,
  and the value as typed rides as `websiteText` / `linkedinText` / `githubText` for the import to put
  back, so the label prints again after a round trip (R5-HUNT11-JSON-RESUME-BARE-SCHEME-URL-WITH-LABEL).
  The two-column Sidebar's column layout goes out as `meta.columnLayout` (`{ columns, details, width }`,
  `layoutMeta`) where it is not the default page, beside Single · ATS-safe's `meta.layout`, and the import
  brings back what this build offers (`layoutFromMeta`; R2-147-col).
  A skill group's per-skill levels (R2-147) go out as `skills[].level` (Beginner … Expert) when every
  keyword shares one, else as `keywordLevels` (`{ "Go": "Expert" }`); a level is kept per comma-separated
  skill, so each keyword of a skill typed "Python; Go" (keywords are parted by ";" and "•" too) takes that
  skill's level. The import reads `keywordLevels`, then another tool's `level` (a word, a number or a
  percentage) for every other keyword of the group

## JSON backup export/import

Full resume object (with a new id on import: `importResume`). Every import goes through
`normalizeResume()`, so a file from an older build is migrated like stored data, and every field the
app reads as text holds text (`textFields.js`), the record's own `name` included: a name that is an
object or missing becomes 'Untitled Resume' ('Cover Letter' for a letter), a number its digits. Personal
info's and each entry's `hiddenFields` is a list of keys: one that is an object, a number or `true` hides
nothing (`[]`), a list keeps only its text members, and text names the keys it hides ("email" or
"email, phone": the PDF always hid a field so named).

## Import from a PDF, Word, Markdown or text (R2-148)

The Dashboard's and the editor's Import accept `.json,.pdf,.docx,.txt,.text,.md,.markdown` (`IMPORT_ACCEPT`,
`src/utils/importDocument.js`); a `.json` goes the JSON way above, the rest are read best-effort:

- `importFile.js` gets the text out as lines: a PDF through pdf.js (lines by baseline, wide gaps as
  tabs, wrapped lines joined, a Link annotation's address after a label it covers), a `.docx` by
  unzipping `word/document.xml` with `DecompressionStream` (the top Heading level used marks sections,
  deeper ones entries; the first page's header read first; a text box once; a hyperlink's target after
  a label, a HYPERLINK field's too; a list item's level, from its own numbering, else from its paragraph style's in `word/styles.xml`, R4-SW-I-02), Markdown through `markdownLines` (`#` name,
  `##` headings, `###` entries (their date line theirs past a blank line, R5-HUNT10; an undated one's role or degree line over its date line too, a place there its location, R5-HUNT11, and its role and place a line each over it, R5-HUNT12), a deeper heading under an entry a grouped role; a link as "label
  (address)", a reference-style one ("[label][id]" with its "[id]: address" line) too; an indented list
  item nested), and text in UTF-8, UTF-16 (with its mark) or Windows-1252.
  Each line keeps its links' labels and addresses, so a link in body text is a link in the rich text
  (R4-LO-05). A password-protected PDF is told so (R4-IMP).
- `importText.js` (pure) reads the lines: name, job title, contacts (a town with no region, "London", beside a contact on its line or LinkedIn's "… Area" alone under the headline, the location, R5-HUNT12 — of more words than one only what says it is a place: a known one, "Hong Kong", one with a linking word, "Frankfurt am Main", a place's own word at its end, "Walnut Creek", "Mount Pleasant Heights", or its prefix and one more word, "Santa Rosa", a LinkedIn metro, "Greater Boston", never "Eagle Scout", "Los Angeles Native", "Smart City" or "Greater Good"; a full place on a later header line first, R5-HUNT12 review; a town with its state, country or postcode and no comma needs proof the comma form does not: a postcode with a region, or after one word or a town that says it is one, "Walnut Creek CA 94596", "10115 Berlin", or a region after a town that says it is one, "Walnut Creek CA", is a place anywhere; a region after one word, "Austin TX", only beside a contact; other words with a region stay the headline, "Family Medicine MD", "Navy Veteran TX", "12345 Followers"; a town of more words that a job line names right before its region, "Round Rock, TX", is one bare beside a contact in the header (never alone on a line or under the name, and a role or company before it, "Photographer, Studio X, Austin, TX", is no town); the value under a "Location" label, the Sidebar's, is the location in any shape; a town that says it is one alone on a header or "Contact" line, or set apart from a contact by a dash, comma or slash, first or after it, is the location too (first, the field after it that is no contact is the job title), and two towns on one line tell nothing, R5-HUNT13), summary; a section per known
  heading (the app's titles and `ATS_STANDARD_SECTIONS` aliases; in a file with no heading marks one in
  Title Case with no blank line before it too, of another type than the section it is in — not a
  summary's or a contact's, a `SUBHEADING` label, a "Languages" category in Skills, a "Volunteering" hobby in Interests nor a role over or under
  its dated line, R5-HUNT11), others custom (in a file with no marks one in capitals or over a rule, or
  one in Title Case after a blank line that ends as a section's title does, "Research Experience",
  `SECTION_WORD`, no role and no `SUBHEADING`, with a blank line under it unless it ends in "Experience" — a firm "Microsoft Research" over its role stays a job, R5-HUNT11) — but in a file with no
  heading marks, a Title-Case "Key Achievements", "Tech Stack" or "Tools" inside a job or project with
  another dated entry after its own lines (past a blank line or a list; no "Label: value" line) is that
  entry's part, no section (R5-HUNT9) — a second such label on the way ("Key Achievements", then "Tech
  Stack") too, the search going past it to a job's range, but not past one with a range-dated line of its
  own, a section (R5-HUNT10); several years in brackets ("(2019, 2021)") date a line only in
  Certifications and Awards (there, several after a tab or a comma, "Dean's List ⇥ 2014, 2015", are put
  in brackets, no issuer — an entry's own line, not the text under it; R5-HUNT10), or (not in Education) first in its section or over a list; entries found by
  their dates (the PDF's and Word's "Group roles by company": the undated employer line over dated
  roles, R4-LO-01; LinkedIn's employer over its total length alone, "5 years 2 months", then each role
  over its dates, R5-HUNT11, a role's text with lower-case words over the next role no next employer (a name's particle, "Universidad de Chile", no such word), R5-HUNT12 — a job's company, role and place a line each over its dates, in any order, that job's with the place its location (the line over them its company only when it reads as a name, else the job above's text; a role over "Mountain View, CA" alone that job's location, not its company), R5-HUNT12 — a job's place alone under its date line its location, not a next job's company over its role or dates ("Globex, Inc."); in Education a school over its degree's dated line, alone or with its place at the
  right tab, "Harvard University ⇥ Cambridge, MA", is that entry's school and location (over a "High School Diploma" too), the line under
  the dated line no second header line but its text or the next school's, R5-HUNT11; LinkedIn's "Bachelor of Science - BS, Computer Science" the degree and its field of study, the short form dropped, R5-HUNT12), and in a dated section an undated block (first, or after a blank line) that opens
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
