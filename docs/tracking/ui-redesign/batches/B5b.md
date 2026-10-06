# B5b (3 h): Import dialog, New page and role starters (start-up page set, part 2)

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Rebuild the Import dialog (file picker kept in the entry, lazy chrome with fallbacks) and the New page with every live function: all 28 looks (19 templates + Sidebar single-column + 8 designs + saved designs), live category chips, role starters, Your details from select, Start blank, Import a file link, phone layout.

## Why here
Second half of the start-up page set; it needs B5a's ledger margin and Documents entry points, and it reuses TemplateThumb props that B8b later restyles without changing.

## Depends on
B5a

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- ImportModal
- New

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-letter-ats-export: NEW-28
- mobile: MOBI-031..MOBI-032, MOBI-166
- shell-docs: SHEL-059..SHEL-082, SHEL-119, SHEL-122, SHEL-125..SHEL-126, D-07..D-08, D-11..D-12, D-17

## PARKED: do NOT build
- drop zone (D-07, ELAE NEW-28) and the 'It becomes a new resume' wording (D-08)
- New page One/Two column/ATS-safe filter chips (D-11) and the use-this-template footer bar copy (D-17)

## Clusters (separate file ownership)

### Cluster: import
Files owned: src/components/ImportMenu.jsx
New files: src/components/ImportDialog.jsx

Import keeps the file input and the native picker click path in the entry (ImportMenu.jsx), so choosing a file works offline exactly as today; the lazy ImportDialog (idle + hover/focus prefetch, own ErrorBoundary, no reload guard) carries the chrome: accepted types hint from DOCUMENT_HINT (PDF, Word, Markdown, text, JSON backup, JSON Resume), Reading state with the busy guard, error strip with Dismiss and every refusal reason and the 20 MB limit, Import as my original (demo accounts), import after sign-out message. If the dialog chunk fails, the picker opens directly and errors show in the existing import-error strip. importDocument.js untouched; Dashboard receives the same callbacks.

### Cluster: new-page
Files owned: src/pages/NewResume.jsx, src/components/StarterTemplateModal.jsx, src/index.css (this batch's single editor)
New files: none

Back arrow with back-or-home semantics, title and lead, looks drawn with the user's resume and the Your details from select, live category chips, ALL looks selectable (19 templates + Sidebar single-column card + 8 designs + saved designs: scroll, filter, group, never fewer), look card content (ATS badge, description), a pick makes the resume exactly once, Start blank, role starters (all five) with the dynamic look line, Import a file link, no-resume-yet state, phone layout. TemplateThumb.jsx is NOT edited here (B8b owns it); props stay stable.

## New tests
- tests/pdf/183-ui-b5b-import-dialog.test.mjs (states, error reasons, 20 MB, demo original, busy guard; a rejected dialog chunk still opens the picker and shows errors in the import-error strip; ImportDialog is off the start-up path)
- tests/pdf/183-ui-b5b-new-page.test.mjs (every look selectable incl saved designs, categories, starters, once-guard, back semantics)

## Existing tests to update
- 91-starter-modal, 93-picker-new-resume, 93-picker-pictures, 103-r4-dph-39-starter-badge-wraps-whole, r4dsn-new-resume-look-colours
- 80-dashboard-import-read-error, 104-r5-hunt6-dash-import-after-sign-out, 104-r5-hunt6-dash-editor-import-after-sign-out, imp-import-busy, 99-import-ui
- cypress 30-starters-and-design, 29-exports-imports, 11-demo-account

## Start-up size plan
Last batch that adds start-up JS. NewResume and StarterTemplateModal are rewritten IN PLACE with cv-* classes (no new import, icons by name only); the import dialog is a lazy chunk with prefetch, boundary and fallback (its bytes are counted), the file input stays in the entry; read 71 before and after (dispatch tests: 71-startup-chunks) and print the ledger. END STATE: spare >= 3 kB; if short apply the reserve offsets in order, then STOP and ask the owner.

## Bug-hunt focus
- functions that stopped working: import every file type, demo originals, import after sign-out, a pick makes exactly one resume (once-guard), starters, Your details from, Start blank, Import a file link
- offline: a failed ImportDialog chunk still opens the picker
- narrow widths: 390 px New page, looks grid scroll
- perf/render counts: the New page renders every look thumbnail once

## Done when
- RUN-STATE batch gate for the owned rows; CHANGED SHEL-069/073/074/076 and MOBI-031 each with a negative twin (back-or-home, only the live category chips, all looks selectable, a pick makes the resume once, the import menu on a phone)
- start-up ledger and 71 spare >= 3 kB, figure in the report
- standing phone guard green

## Risks
- TemplateThumb.jsx is NOT edited here (B8b owns it); props stay stable
- looks grid renders about 30 thumbnails: scroll and filter must not remount them

## Owner calls here
- Extra New-page filter chips (default: only the live category chips)

## Parity rows of this batch

37 row IDs (31 live-function rows: SAME 7, MOVED 1, RESTYLED 8, CHANGED 5, MISSING 10; 6 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

none (this batch is not the catch-all of any parity file).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-28 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] ImpModal "Drop your file here" drop zone and "What you can import" chips / Drag-and-drop import
- DO NOT BUILD AS DRAWN: mobile:MOBI-031 [CHANGED: the drawing alters or loses the live function] Import menu
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-069 [CHANGED: the drawing alters or loses the live function] Back arrow
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-073 [CHANGED: the drawing alters or loses the live function] Category chips
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-074 [CHANGED: the drawing alters or loses the live function] The full set of looks
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-076 [CHANGED: the drawing alters or loses the live function] Pick a look makes the résumé
- DO NOT BUILD AS DRAWN: shell-docs:D-07 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Drag-and-drop zone "Drop your file here" / Import
- DO NOT BUILD AS DRAWN: shell-docs:D-08 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "It becomes a new résumé. The one you have open is not changed." on Documents / Import
- DO NOT BUILD AS DRAWN: shell-docs:D-11 (drawn item) [cited in this batch's PARKED list] New page filters One column / Two columns / ATS-safe / New
- DO NOT BUILD AS DRAWN: shell-docs:D-17 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] New page footer "Classic · one column / Reads cleanly in applicant tracking systems." and the "Use this template" bar / New

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| MOBI-031 | CHANGED | MH tile subtitle says "file"; no Import control | Import menu | Import must be one tap away on a phone: on the New page (see shell-docs 1d) or a header action; keep "Import as my original" in demo accounts. |
| MOBI-032 | MISSING | Not drawn | Import states | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the busy label and a dismissible error banner. |
| MOBI-166 | MISSING | Not drawn | Import error copy and left-account message | Row 032 draws the banner shape; these words stay, in red with Dismiss (Dashboard) or in the editor's red alert. [added by review] |
| SHEL-061 | MISSING | Not drawn | Import menu (demo): Import as my original | Add "Import as my original" to the modal for demo accounts (named in PARITY-RULE). |
| SHEL-062 | MISSING | Not drawn | Reading... busy state | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): a reading state; keep the guard (test imp-import-busy). |
| SHEL-066 | MISSING | Not drawn (modal shows only the happy path) | Import errors | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): an error strip with Dismiss in the modal and on Documents. |
| SHEL-069 | CHANGED | Link "← Documents" (always Documents) | Back arrow | Keep back-or-home semantics. |
| SHEL-072 | MISSING | Not drawn | "Your details from" select | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the select (test 103-r4-dvis-13-new-resume-source-select). |
| SHEL-073 | CHANGED | Chips All / One column / Two columns / ATS-safe | Category chips | Different set; the drawn ones resemble the editor gallery's PICKER_FILTERS. Draw today's category chips (filters may be added, D-11). |
| SHEL-074 | CHANGED | 6 templates (Classic, Modern, Minimal, Sidebar, Academic, Executive); Empty says "28 looks" | The full set of looks | PARITY-RULE: never fewer looks. Count computed by review (unknown 6 resolved): 19 templates (constants/templateTable.js) + 1 extra card for the Sidebar's single-column Layout (variant, templateTable.js:68) + 8 designs (constants/templatePresets.js: Harbor, Ledger, Nordic, Crimson, Midnight, Sunrise, Grove, Inkwell) = 28, plus the user's saved designs. The Empty board's "28 looks" is therefore right; New draws 6 (22 short, and "My designs" absent). Scroll/group all of them. |
| SHEL-076 | CHANGED | Select a card, footer "Use this template" opens the editor; "Cancel" returns | Pick a look makes the résumé | Two steps instead of one. Allowed only if "Use this template" does exactly today's create with the same once-guard; simplest: click creates, footer button repeats it. |
| SHEL-078 | MISSING | Not drawn | Role starters | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the role starters list (all five). |
| SHEL-079 | MISSING | Not drawn | Starters' look row | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it, or fold it into the template choice. |
| SHEL-119 | MISSING | Not drawn (see SHEL-078, 079) | Role starters' dynamic template line | Part of the starters and look-row design asked in SHEL-078/079; keep the live label that updates with the pick. |
| SHEL-125 | MISSING | Import modal draws the happy path and the chips only | Import: the 20 MB limit and the reasons a file is refused | Part of SHEL-066: the error strip must carry these reasons unchanged, and the 20 MB limit stays (PARITY-RULE: same limits). [added by review 2] |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### mobile

**1. PARITY TABLE 1b. Documents on a phone (Dashboard `/`)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-031 **DO NOT BUILD AS DRAWN** | **Import menu**: Header "Import" (a menu "Import JSON, PDF, Word or text" and "Import as my original" for demo accounts); hidden `<input type=file accept=IMPORT_ACCEPT>`; JSON backup, JSON Resume, PDF, Word, Markdown, text (Dashboard.jsx:55-58,122-178,198-203, ImportMenu.jsx) | MH tile subtitle says "file"; no Import control | CHANGED | Import must be one tap away on a phone: on the New page (see shell-docs 1d) or a header action; keep "Import as my original" in demo accounts. |
| MOBI-032 | **Import states**: "Reading…" disabled while a PDF reads; second pick ignored; error banner stays until Dismiss or the next import; account left meanwhile keeps the résumé aside (Dashboard.jsx:36-53,122-148,247-254) | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the busy label and a dismissible error banner. |

**6. ADDED BY REVIEW (independent pass, 2026-10-06; every row below was added by review) 6b. Documents and import details **

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-166 | **Import error copy and left-account message**: "Invalid resume file — must be a CPWT-CV backup or standard JSON Resume (.json).", "Could not parse file. Make sure it's a valid CPWT-CV or standard JSON Resume (.json).", "That file could not be read. Check it is still there and try again.", and the importingFor message when the account left meanwhile; a letter's file opens on its letter (Dashboard.jsx:122-178, ExportDropdown.jsx:150-190) | Not drawn | MISSING | Row 032 draws the banner shape; these words stay, in red with Dismiss (Dashboard) or in the editor's red alert. [added by review] |

#### shell-docs

**1. PARITY TABLE 1d. Import**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-059 | **Import button**: Header "Import" (Upload) opens a hidden file input, accept `.json,.pdf,.docx,.txt,.text,.md,.markdown`; title "Import a résumé: a CPWT-CV or JSON Resume file (.json). PDF, Word (.docx), Markdown and text files are read best-effort: review the result." Dashboard.jsx:198-203, utils/importDocument.js:6,15 | Main header "Import a file" opens the ImportModal; Empty and New also lead to it | RESTYLED | Keep the same accept list and hint. |
| SHEL-060 | **Import chooser**: No dialog today: the native file picker. | Modal "Import a file / It becomes a new résumé. The one you have open is not changed." drop zone "Drop your file here or Choose a file", "What you can import" chips PDF, Word, Markdown, Text, JSON backup, JSON Resume, best-effort paragraph, Cancel | RESTYLED | Chips equal today's types. Drop zone and first sentence are new (D-07, D-08). "Choose a file" = today's picker. |
| SHEL-061 | **Import menu (demo): Import as my original**: In a demo account Import is a menu: "Import JSON, PDF, Word or text", "Import as my original" (pin), hints "Your originals come back whenever none of them is left." and the document hint. components/ImportMenu.jsx:14-55, Dashboard.jsx:199 | Not drawn | MISSING | Add "Import as my original" to the modal for demo accounts (named in PARITY-RULE). |
| SHEL-062 | **Reading... busy state**: While a document is read (pdf.js can take seconds) the button says "Reading…" and is disabled; a second pick is ignored (ref catches the same tick). Dashboard.jsx:46-47,125,201 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): a reading state; keep the guard (test imp-import-busy). |
| SHEL-063 | **JSON backup import**: Parses; `personal` + `sections` array: new résumé with a fresh id (kept as original only if the demo choice says so), opens the editor on it (a letter's file opens its letter tab). Dashboard.jsx:150-158, utils/letters.js editorPath | "JSON backup" chip | SAME | Function unchanged. |
| SHEL-064 | **JSON Resume import**: A standard JSON Resume is converted (jsonResumeToCpwtResume) and opens `/resume/<id>`. Dashboard.jsx:159-163, utils/jsonResumeImport.js | "JSON Resume" chip | SAME | n/a. |
| SHEL-065 | **PDF / Word / Markdown / text import**: `isDocumentFile` (.pdf, .doc(x), .txt, .text, .md, .markdown) goes to importDocument: read best-effort into a new résumé; the editor opens with an "imported as best we could read it" notice; an older `.doc` is told to save as .docx. Dashboard.jsx:129-148, utils/importDocument.js:12-45 | PDF / Word / Markdown / Text chips + best-effort paragraph | RESTYLED | Paragraph is today's DOCUMENT_HINT reworded; keep both it and the editor notice (editor area EDIT-006). |
| SHEL-066 | **Import errors**: Red strip in the header, stays until Dismiss or the next import: "Invalid resume file — must be a CPWT-CV backup or standard JSON Resume (.json).", "Could not parse file. Make sure it's a valid CPWT-CV or standard JSON Resume (.json)." (corrected by review 2: the word "standard" was missing; Dashboard.jsx:168; the reasons behind "Could not import <name>: <reason>" are SHEL-125), "That file could not be read. Check it is still there and try again.", "Could not import <name>: <reason>", and the signed-out-while-reading message. Dashboard.jsx:36-38,165-175,247-254, importDocument.js:40-43,58 | Not drawn (modal shows only the happy path) | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): an error strip with Dismiss in the modal and on Documents. |
| SHEL-067 | **Import after sign-out**: A read that ends after the account signed out files the résumé for that account, does not open it. importingFor (importDocument.js:54-61), Dashboard.jsx:52-53,136-139 | Invisible | SAME | Keep (test 104-r5-hunt6-dash-import-after-sign-out). |
| SHEL-068 | **Import from the editor**: The editor has its own Import (menu) with the same readers and a "new résumé" notice. hooks/useEditorExports.js | Not this area | SAME | Owned by the editor areas. |

**1. PARITY TABLE 1e. New page (`/new`) and starters**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-069 **DO NOT BUILD AS DRAWN** | **Back arrow**: Header arrow "Back": the previous page of this app, or Documents when the entry is the first one. pages/NewResume.jsx:54, hooks/useBackOrHome.js | Link "← Documents" (always Documents) | CHANGED | Keep back-or-home semantics. |
| SHEL-070 | **Title and lead**: "Pick a look to start"; "Each page is your résumé "<name>" in that look. Pick one: a new résumé with your details opens on it, to make your own." or, with none, "Pick one: a blank résumé opens on it. Each page shows a sample résumé in that look." NewResume.jsx:70-75 | "Start a new résumé / Pick how to begin. The template can be changed at any time." | RESTYLED | Keep the sentence that names the source résumé. |
| SHEL-071 | **Looks drawn with the user's résumé**: Every card is a picture of the source résumé on that look (TemplateThumb `picture`, the source's settings, or a blank résumé's colours when none). NewResume.jsx:29-33,109 | Paper stand-ins, six cards | RESTYLED | Build keeps the real pictures (tests 93-picker-pictures, r4dsn-new-resume-look-colours). |
| SHEL-072 | **"Your details from" select**: With 2+ non-letter résumés: select of résumés (latest default); pictures and the new résumé use the pick. NewResume.jsx:26-29,77-91 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the select (test 103-r4-dvis-13-new-resume-source-select). |
| SHEL-073 **DO NOT BUILD AS DRAWN** | **Category chips**: "All" + chips from the cards present: Simple, Professional, Modern, Creative, Compact, My designs (+ any other), a second click clears, `data-category`. NewResume.jsx:93-98, utils/templatePicker.js:12-20,113-120 | Chips All / One column / Two columns / ATS-safe | CHANGED | Different set; the drawn ones resemble the editor gallery's PICKER_FILTERS. Draw today's category chips (filters may be added, D-11). |
| SHEL-074 **DO NOT BUILD AS DRAWN** | **The full set of looks**: Every template, preset, design and saved design (pickerCards + savedDesigns of the user's résumés); 2 to 5 per row. NewResume.jsx:32-33,99-120 | 6 templates (Classic, Modern, Minimal, Sidebar, Academic, Executive); Empty says "28 looks" | CHANGED | PARITY-RULE: never fewer looks. Count computed by review (unknown 6 resolved): 19 templates (constants/templateTable.js) + 1 extra card for the Sidebar's single-column Layout (variant, templateTable.js:68) + 8 designs (constants/templatePresets.js: Harbor, Ledger, Nordic, Crimson, Midnight, Sunrise, Grove, Inkwell) = 28, plus the user's saved designs. The Empty board's "28 looks" is therefore right; New draws 6 (22 short, and "My designs" absent). Scroll/group all of them. |
| SHEL-075 | **Look card content**: Picture, name, ATS badge, two-line description. NewResume.jsx:101-118 | Picture, name, coloured label "ATS-safe" / "Two columns"; no description | RESTYLED | Keep the description (or a tooltip). |
| SHEL-076 **DO NOT BUILD AS DRAWN** | **Pick a look makes the résumé**: One click creates "Untitled Resume" from the source (copy of its details) or blank on that look, opens the editor and replaces `/new` in history; once per visit. NewResume.jsx:35-47 | Select a card, footer "Use this template" opens the editor; "Cancel" returns | CHANGED | Two steps instead of one. Allowed only if "Use this template" does exactly today's create with the same once-guard; simplest: click creates, footer button repeats it. |
| SHEL-077 | **Start blank**: Row "Start from Scratch (Blank)": blank résumé on the look chosen in the starters' look row. StarterTemplateModal.jsx:57-72, NewResume.jsx:129 | Card "Start blank: An empty résumé with the usual sections ready to fill." | RESTYLED | Keep the choice of look before blank. |
| SHEL-078 | **Role starters**: "Curated ATS Role Starters": a row per STARTER_TEMPLATES entry (name, badge, one-line description, "Template: <look>"); click creates it with the user's own name, contacts, photo (starterFrom), the role's title and summary as example, on the look picked. StarterTemplateModal.jsx:74-98, NewResume.jsx:124-130, utils/starterTemplates.js, utils/newResume.js. Added by review 2 (the list the design must hold, starterTemplates.js:10-258, starterAcademic.js:11-15, starterCompact.js:15-19): five starters, each name / badge / own template / one-line description: "Software Engineer (Full Stack)" / Tech & Engineering / classic / "High-impact bullet points with metrics (%, RPS, latency) and modern tech stack."; "Product Manager" / Product & Strategy / modern / "Outcome-oriented achievements focused on roadmap execution, ARR growth, and cross-functional leadership."; "Data Scientist & AI Engineer" / AI & Data / executive / "Features machine learning models, statistical analysis, Python data stacks, and business ROI."; "Academic CV (Researcher)" / Research & Academia / academic / "A scholarly CV: education and publications first, research and teaching appointments, grants."; "Engineering Leader (Compact one-pager)" / Senior & Leadership / compact / "Fifteen years on one page: five roles, skills and certifications in a two-column grid." With no résumé of the user's the starter keeps its fictional sample person (e.g. "Dr. Maya Okafor"); the new résumé is named after the starter and is current. | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the role starters list (all five). |
| SHEL-079 | **Starters' look row**: "Template" row: "Each starter's own" (★) + every picker card as a small picture; picks the look for Blank and starters. StarterTemplateModal.jsx:29-55 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it, or fold it into the template choice. |
| SHEL-080 | **New with no résumé yet**: Looks show a sample over default colours; a click starts a blank résumé on the look. NewResume.jsx:30-32,45-47 | Invisible | SAME | (live behaviour is the spec) Looks show a sample over default colours; a click starts a blank résumé on the look. NewResume.jsx:30-32,45-47 |
| SHEL-081 | **"Import a file" on New**: Not on today's New page (Import is on Documents). | Card "Import a file: PDF, Word or JSON. It is read best-effort, so check each section." | MOVED | Same function as SHEL-059 reached from a second place; allowed (wording D-12). |
| SHEL-082 | **Starter dialog form**: StarterTemplateModal also has a modal form ("Choose a Resume Starter", X, overlay close), but only `inline` is used by /new. StarterTemplateModal.jsx:114-139 | Not drawn | SAME | Unused path; no design needed. |

**1. PARITY TABLE 1i. Added by review (independent pass, 2026-10-06, from SOURCE and the re-opened boards)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-119 | **Role starters' dynamic template line**: Each starter row ends "Template: <look>" and changes with the look picked in the starters' look row (`templateOf`: the picked card's label, else the starter's own template label); the look row scrolls sideways and the chosen look is outlined blue (★ "Each starter's own" selected by default). Starters section also has its own heading "Or start blank, or from a role example" + "Empty sections, or pre-filled, ATS-optimized role templates to make your own", a "Curated ATS Role Starters" divider, and Blank's line "Empty sections to fill with your own custom experience." components/StarterTemplateModal.jsx:15-100 | Not drawn (see SHEL-078, 079) | MISSING | Part of the starters and look-row design asked in SHEL-078/079; keep the live label that updates with the pick. |
| SHEL-122 | **Import hint and guard on Documents**: The Import button's title is the hint text (JSON backup or JSON Resume, then DOCUMENT_HINT) and a file picked while another is being read is ignored with its input cleared (`e.target.value = ''`), so choosing the same file again fires; the input is reset after every pick. Dashboard.jsx:122-178,198-203 | Modal "What you can import" + best-effort paragraph; no reading state | RESTYLED | Keep the same-file-again behaviour (reset the input after every pick, including from the new modal's "Choose a file" and a drop). |

**1. PARITY TABLE 1j. Added by review 2 (file-by-file sweep of every source file of the area, then five user journeys, 202**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-125 | **Import: the 20 MB limit and the reasons a file is refused**: A document (PDF, Word, Markdown, text) over 20 MB (`MAX_IMPORT_BYTES`) is refused: "That file is too large to be a résumé (over 20 MB). Import the résumé itself as a PDF, Word, text or JSON file." Other reasons, each shown in the Documents strip as "Could not import <file name>: <reason>": a PDF with no text layer ("looks like a scanned image ... run the scan through OCR first"); a password-protected PDF ("Save a copy without a password"); a browser without `DecompressionStream` ("cannot open Word files. Update it, or import the résumé as PDF, text or JSON"); a file that is not a zip ("not a Word (.docx) file. An older .doc must be saved as .docx (or PDF) first"); a damaged Word file; an unsupported Word compression; a Word file with no document in it; any file with no readable text ("No text could be read ... a scanned PDF holds pictures of its pages"). A JSON file has no size check. utils/importFile.js:6-13,21-50,503,963-976,1018-1022, importDocument.js:40-43 | Import modal draws the happy path and the chips only | MISSING | Part of SHEL-066: the error strip must carry these reasons unchanged, and the 20 MB limit stays (PARITY-RULE: same limits). [added by review 2] |
| SHEL-126 | **What the import readers recognise (no UI of their own)**: PDF through pdf.js text lines (loaded only when a PDF is picked), Word by unzip and XML, Markdown, plain text: `resumeFromText` (utils/importText.js, 2331 lines) builds the name, contacts, sections and dates. A JSON Resume file reads back every section as exported (`meta.sections`: type, title, settings, entry counts; entries no section claims join the last section of their type); a CPWT-CV backup JSON is taken whole through `normalizeResume`, each résumé migrated from its own `dataVersion`. A name read from a file becomes the card's name. A JSON Resume file takes the template and layout its `meta` names (Classic when it names none or one the app does not offer; `meta.layout: 'single'` is the Sidebar's Single · ATS-safe page), its photo from `image` or the older `picture`, the website from `url` or the older `website`, and a profile that gives only a username (LinkedIn, GitHub) gets its address built from it. utils/importFile.js, importText.js, jsonResumeImport.js:30-190 | "What you can import" chips and the best-effort paragraph | SAME | Keep every reader and the round trip; nothing to draw. [added by review 2] |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-28 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: ImpModal "Drop your file here" drop zone and "What you can import" chips | What the canvas draws: Drag-and-drop import | Live today: A file picker only; no drop target on the Dashboard or the editor menu (no `onDrop` in pages/Dashboard.jsx) | Handling: PARK the drop target (a new gesture); keep the chips as the hint (same facts as `DOCUMENT_HINT`). Documents area owns
- D-07 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: Drag-and-drop zone "Drop your file here" | Where: Import | Live app: Only the file picker; no drop handler | Handling: PARK (new capability).
- D-08 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: "It becomes a new résumé. The one you have open is not changed." on Documents | Where: Import | Live app: That sentence exists only in the editor's import notice (NEW_RESUME_NOTICE) | Handling: PARK as new wording on Documents.
- D-11 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: New page filters One column / Two columns / ATS-safe | Where: New | Live app: New page has category chips; the same filters exist in the editor's gallery | Handling: Same function family as the editor gallery filters: keep as extra chips only if the owner agrees; category chips must stay (SHEL-073).
- D-12 [shell-docs]: Canvas draws: "Import a file" card on New | Where: New | Live app: Import lives on Documents | Handling: Allowed as a second entry (SHEL-081); the wording "PDF, Word or JSON" omits Markdown/text: use the live list.
- D-17 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: New page footer "Classic · one column / Reads cleanly in applicant tracking systems." and the "Use this template" bar | Where: New | Live app: None | Handling: PARK the footer bar; see SHEL-076 for the button. Review note: the "Reads cleanly in applicant tracking systems" line is the selected look's own description and ATS rating, which today sit on every look card (`c.desc`, ATS badge, NewResume.jsx:101-118): same function, new place.

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (5): src/components/ImportMenu.jsx, src/components/ImportDialog.jsx, src/pages/NewResume.jsx, src/components/StarterTemplateModal.jsx, src/index.css. Labels scanned: 0 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 14; listed in this batch's "Existing tests to update": 4; NOT listed: 10.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/index.css
- FAIL tests/pdf/96-dashboard.test.mjs: imports src/pages/NewResume.jsx
- FAIL tests/pdf/96-modal-outside-click.test.mjs: imports src/components/StarterTemplateModal.jsx
- FAIL tests/pdf/103-r4-dph-25-import-menu-left-edge.test.mjs: imports src/components/ImportMenu.jsx
- FAIL tests/pdf/103-r4-dvis-13-new-resume-source-select.test.mjs: imports src/pages/NewResume.jsx
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/ime-enter-guard.unit.mjs: imports src/components/ImportMenu.jsx
- FAIL tests/unit/touch-reveal.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css

Hits already in the update list:

- tests/pdf/91-starter-modal.test.mjs: imports src/pages/NewResume.jsx
- tests/pdf/93-picker-new-resume.test.mjs: imports src/pages/NewResume.jsx
- tests/pdf/103-r4-dph-39-starter-badge-wraps-whole.test.mjs: imports src/components/StarterTemplateModal.jsx
- tests/pdf/r4dsn-new-resume-look-colours.test.mjs: imports src/pages/NewResume.jsx

## Progress log
(append: time, what, run ids, head sha)
