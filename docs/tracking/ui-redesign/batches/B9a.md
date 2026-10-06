# B9a (2.5 h): Cover letter panel (letterhead, recipient, body, closing)

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Restyle the cover-letter panel (Letterhead block with every control, recipient, rich-text body, closing and signature) keeping every live control; no new capability. Draft and Improve follow in B9b.

## Why here
The switch and preview already show the letter (B3/B4) and the rich text toolbar exists (B6).

## Depends on
B3, B6

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- EditorLetter
- MobileEdit (letter view)
- Letter (printed-page render check)

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-letter-ats-export: ELAE-001..ELAE-033, ELAE-134..ELAE-137, ELAE-139..ELAE-140, NEW-06..NEW-08
- mobile: MOBI-183

## PARKED: do NOT build
- word counter and plain text hint (NEW-06), 1 page caption (NEW-07)
- Letterhead one-line summary (NEW-08): display only

## Clusters (separate file ownership)

### Cluster: letter-panel
Files owned: src/components/CoverLetterPanel.jsx, src/components/CoverLetterPanelShared.jsx, src/index.css (this batch's single editor)
New files: none

Optional groups prop (default all). Letterhead block (collapsible, opens with every control): photo target with status line (every wording), Remove own, eye, photo text position, Fields Position (3 layouts) with the side gap, contact style Icon/Bullet/Bar, contact layout Single/Justify/2 Grid, six visible-contact eyes, the template note; Who it is for: Date with Today, recipient name/title/company, subject; body = rich text (toolbar, STAR button; not the drawn plain box); closing phrase, signature space Tight/Wide, signature name and designation; fallbacks kept; Auto-Generate entry and the letter-generated Undo toast; 16 px fields on touch; letter data keys unchanged.

### Cluster: tests
Files owned: tests/pdf/walk-extra/letter-panels.mjs, cypress/e2e/05-cover-letter.cy.js, cypress/e2e/14-contacts.cy.js, cypress/e2e/22-regressions-letters.cy.js, tests/playwright/pdf-cover-letter.spec.mjs
New files: tests/pdf/walk-extra/letter-panels.mjs, tests/pdf/188-ui-b9a-letter-walker.test.mjs

A parity walker over CoverLetterPanel (the audit found none walks the letter today): every control found is asserted to write the same key as before. It lives in tests/pdf/walk-extra/, outside tests/pdf/parity/: read the discovery code of 00-registry and 01-offered first and state in the report that the matrix is untouched.

## New tests
- tests/pdf/188-ui-b9a-letter-panel.test.mjs (letterhead controls, photo status wordings, date+Today, signature space/designation, rich body, groups default all)
- tests/pdf/188-ui-b9a-letter-walker.test.mjs

## Existing tests to update
- CoverLetterPanel users: 31-contact-fields, 102-r4-dux-04-letter-apply-undo, 83-letter-signature-photo, 12-cover-letter, 44-cover-letter-generator-shapes, 21-cover-letter-looks-panel, 22-cover-letter-loo*, r4cl-generator-letter-fields, 103-r4-dph-34-letter-fields-touch-text, r5hunt2-letter-undo-other-resume, 105-r5-hunt2-late-upload, 16-saved-data-photos
- the letter body is rich text: the 99-rich-text-* tests stay green
- cypress 21-a11y

## Start-up size plan
Lazy-only (Editor chunk). Nothing imported by the Dashboard; NewLetterModal (B1 lazy) untouched.

## Bug-hunt focus
- functions that stopped working: letter photo/position/contact controls reach the PDF, Auto-Generate Undo, export follows the open document
- persistence: letter data keys, letter-linked jobs open on the letter, ?tab=coverletter
- narrow widths: 390 px letter panel, 16 px fields
- error and empty states: photo budget messages

## Done when
- RUN-STATE batch gate for the owned rows; CHANGED ELAE-020 and ELAE-137 each with a negative twin (the body is rich text with the STAR button; label and placeholder kept)
- letter walker added and green for the panel
- standing phone guard green

## Risks
- letter photo and letterhead controls are undrawn: design from the Personal info photo pattern (B7)

## Owner calls here
- none

## Parity rows of this batch

43 row IDs (40 live-function rows: SAME 7, MOVED 1, RESTYLED 13, CHANGED 2, MISSING 17; 3 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

none (this batch is not the catch-all of any parity file).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-020 [CHANGED: the drawing alters or loses the live function] Letter body = rich text
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-06 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdLetter "112 words" counter and hint "Plain text, blank line between paragraphs" / Word count; says the body is plain text
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-07 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdLetter caption "Cover letter · 1 page · A4" / Page count
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-08 (drawn item) [cited in this batch's PARKED list] EdLetter Letterhead summary "Follows the résumé · no photo" / One-line summary on a collapsed row
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-137 [CHANGED: the drawing alters or loses the live function] Letter body label and placeholder

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| ELAE-004 | MISSING | Not drawn. Letterhead row only says "no photo" | Cover-letter photo: upload target | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the round photo target inside the opened Letterhead block (EdLetter, Letterhead). |
| ELAE-005 | MISSING | Not drawn ("no photo" summary only) | Photo status line | Keep the line under the photo target in the Letterhead block (summary text may reuse its first words). |
| ELAE-006 | MISSING | Not drawn | "Remove own" photo | Add to the Letterhead block next to the photo line. |
| ELAE-007 | MISSING | Not drawn | Show / hide photo on the letter | Add the eye to the photo row in the Letterhead block (same titles). |
| ELAE-008 | MISSING | Not drawn | Photo text position | Add the chip row (and the centred sentence) to the Letterhead block. |
| ELAE-009 | MISSING | Not drawn | Fields Position (3 layouts) | Add to the Letterhead block (3 buttons, or a 3-way segmented control). |
| ELAE-010 | MISSING | Not drawn | Right-of-Name side gap | Add under Fields Position in the Letterhead block. |
| ELAE-011 | MISSING | Not drawn | Contact style Icon / Bullet / Bar | Add to the Letterhead block. |
| ELAE-012 | MISSING | Not drawn | Contact layout Single / Justify / 2 Grid | Add to the Letterhead block. |
| ELAE-013 | MISSING | Not drawn | Visible contact fields (6 eyes) | Add the 6 rows to the Letterhead block. |
| ELAE-014 | MISSING | EdLetter "Who it is for": Name, Title, Company, Subject. No Date | Date field + Today | Add a Date field with its Today button to the "Who it is for" card (EdLetter). |
| ELAE-020 | CHANGED | EdLetter "Letter": a plain bordered box, hint "Plain text, blank line between paragraphs" | Letter body = rich text | Keep the rich-text editor and its toolbar in the "Letter" card (restyled); the drawn plain box and its hint must not be built. The PDF, Word and text exports all read the rich body. |
| ELAE-021 | MISSING | Not drawn on EdLetter | STAR / Bullet Optimizer button on the letter body | Keep it in the body toolbar (see ELAE-076). |
| ELAE-026 | MISSING | Not drawn | Signature space Tight / Wide | Add to the Sign-off card (EdLetter). |
| ELAE-028 | MISSING | Not drawn (Letter paper prints "Full Stack Engineer" under the name) | Signature designation | Add a "Designation" field to the Sign-off card. |
| ELAE-135 | MISSING | Not drawn (summary "no photo" only) | Letter photo status line: every wording | Same home as ELAE-005 (the Letterhead block); keep all the lines. |
| ELAE-136 | MISSING | Not drawn | Letterhead control labels and option sets | Keep these labels and the option sets in the opened Letterhead block and the Sign-off card (restyle only). |
| ELAE-137 | CHANGED | EdLetter "Letter": a plain bordered box | Letter body label and placeholder | As ELAE-020; cite EDIT-077..083 and EDIT-147 for the editor, do not duplicate them. |
| MOBI-183 | MISSING | ME draws the Résumé / Cover letter segment, no letter form | Cover Letter tab body | Owned by editor-letter-ats-export.md; the phone Edit column must carry it. [added by review] |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### editor-letter-ats-export

**1. PARITY TABLE 1a. Cover letter sidebar and preview**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-001 | **Open the letter (tab, switch, deep link)**: "Cover Letter" mode tab swaps the sidebar to CoverLetterPanel and the preview to the letter PDF; `?tab=coverletter` deep link (Dashboard letter cards use it; letter records open there via `editorPath`). src/components/EditorHeader.jsx:127-132, src/pages/Editor.jsx:176-180, src/utils/letters.js:18 (= EDIT-009, EDIT-012) | EdLetter top bar: two-way group "Document" Résumé / Cover letter (active) | MOVED | n/a (owner decision 6). Keep `?tab=coverletter` mapping to the switch. |
| ELAE-002 | **"Header style follows your résumé template (X). Change the template in Design." note**: Palette icon + sentence naming the template label (`templateLabel(template)`). src/components/CoverLetterPanel.jsx:126-129 | EdLetter "Letterhead" row: "Follows the résumé · no photo" (collapsed, chevron) | RESTYLED | Keep the template name and the "change it in Design" pointer inside the opened Letterhead block. |
| ELAE-003 | **Letterhead block is collapsible**: Photo, Header Layout, Date/Recipient/Subject are `SectionBlock`s, all open by default, state not kept. src/components/CoverLetterPanelShared.jsx:43-61, CoverLetterPanel.jsx:132,201,303 | EdLetter: Who it is for / Letter / Sign-off are plain cards; only "Letterhead" is a disclosure, drawn closed | RESTYLED | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Letterhead disclosure OPEN (see ELAE-004..ELAE-013 for its content). |
| ELAE-004 | **Cover-letter photo: upload target**: Round 56 px dashed target (click opens a file input, `image/*`); shows own photo, else the résumé photo faded, else a "Photo" placeholder; `readImageFile` with the whole résumé so the cloud-document budget applies (R2-097); the result is written to this letter's résumé by its id (R5-HUNT2); an unreadable file shows `alert(err.message)`. CoverLetterPanel.jsx:53-62,132-150 | Not drawn. Letterhead row only says "no photo" | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the round photo target inside the opened Letterhead block (EdLetter, Letterhead). |
| ELAE-005 | **Photo status line**: "Using own photo" / "Using resume photo (faded = preview)" / "No photo — upload or add to resume" / "Résumé photo hidden — upload one for the letter" / amber warnings when a photo is a link that cannot load or a format that cannot print. data-testid `letter-photo-note`. CoverLetterPanel.jsx:152-156, src/hooks/usePrintableImage.js:36-57 | Not drawn ("no photo" summary only) | MISSING | Keep the line under the photo target in the Letterhead block (summary text may reuse its first words). |
| ELAE-006 | **"Remove own" photo**: Red text button, only when the letter has its own photo; writes `clPhoto: null`. CoverLetterPanel.jsx:157-166 | Not drawn | MISSING | Add to the Letterhead block next to the photo line. |
| ELAE-007 | **Show / hide photo on the letter**: Eye toggle, only when a printable photo exists; writes `showPhoto`; titles "Hide photo from cover letter" / "Show photo on cover letter". CoverLetterPanel.jsx:169-178 | Not drawn | MISSING | Add the eye to the photo row in the Letterhead block (same titles). |
| ELAE-008 | **Photo text position**: Chips from `PHOTO_OPTIONS.photoTextAlign`, shown only when the photo is shown and the header is not centred; a centred header says "Centred header: the photo sits above the name." CoverLetterPanel.jsx:181-197 | Not drawn | MISSING | Add the chip row (and the centred sentence) to the Letterhead block. |
| ELAE-009 | **Fields Position (3 layouts)**: Buttons Right of Name / Below Name / Below Everything with a mono sketch each; replaced by a "Centred like your résumé's header" sentence when the résumé header is centred; unknown stored value reads as 'right'. CoverLetterPanel.jsx:200-239, coverLetter.js:60-70 | Not drawn | MISSING | Add to the Letterhead block (3 buttons, or a 3-way segmented control). |
| ELAE-010 | **Right-of-Name side gap**: `GapStepper` for `contactsSideGap` with reset, only under Right of Name. CoverLetterPanel.jsx:231-237 | Not drawn | MISSING | Add under Fields Position in the Letterhead block. |
| ELAE-011 | **Contact style Icon / Bullet / Bar**: Chips writing `headerStyle`; marked value = the letter's own, else the résumé's, else icon. CoverLetterPanel.jsx:241-255, coverLetter.js:49-52 | Not drawn | MISSING | Add to the Letterhead block. |
| ELAE-012 | **Contact layout Single / Justify / 2 Grid**: Chips writing `headerLayout`. CoverLetterPanel.jsx:257-271 | Not drawn | MISSING | Add to the Letterhead block. |
| ELAE-013 | **Visible contact fields (6 eyes)**: One row per `CONTACT_FIELDS` (email, phone, location, website, LinkedIn, GitHub) with its value (truncated) and an eye; the letter keeps its OWN hidden list, which starts from the résumé's until first toggled. Titles "Hide/Show <field> on/from the cover letter". CoverLetterPanel.jsx:273-299, coverLetter.js:88-90 | Not drawn | MISSING | Add the 6 rows to the Letterhead block. |
| ELAE-014 | **Date field + Today**: Text field "Date" (placeholder "15 January 2026") with an inside "Today" button writing today's date; printed through Design → Date format. CoverLetterPanel.jsx:305-313, coverLetter.js:22-25 | EdLetter "Who it is for": Name, Title, Company, Subject. No Date | MISSING | Add a Date field with its Today button to the "Who it is for" card (EdLetter). |
| ELAE-015 | **Recipient name**: Text field "Recipient Name" (placeholder "Jane Smith"). CoverLetterPanel.jsx:314 | EdLetter "Name" (value Sarah Smith) | RESTYLED | Label it so it is clearly the recipient ("Recipient name"). |
| ELAE-016 | **Recipient title**: Text field "Recipient Title" (placeholder "Hiring Manager"). CoverLetterPanel.jsx:315 | EdLetter "Title" (value Engineering Manager) | RESTYLED | Same: "Recipient title". |
| ELAE-017 | **Company**: Text field "Company". CoverLetterPanel.jsx:316 | EdLetter "Company" | RESTYLED | n/a |
| ELAE-018 | **Subject**: Text field "Subject" (placeholder "Application for the Senior Engineer role"). CoverLetterPanel.jsx:317 | EdLetter "Subject" | RESTYLED | n/a |
| ELAE-019 | **Fields print only when filled**: The letter block prints each filled line, nothing for an empty one (no label, no gap). coverLetter.js:32-41 | Letter paper prints the same lines | SAME | (live behaviour is the spec) The letter block prints each filled line, nothing for an empty one (no label, no gap). coverLetter.js:32-41 |
| ELAE-020 **DO NOT BUILD AS DRAWN** | **Letter body = rich text**: `RichTextEditor` "Body", 12 rows, contentEditable: toolbar Bold / Italic / Underline (Ctrl+B/I/U), Bullet list, Numbered list, Insert link, Align left / centre / right, Justify; paste cap notice (`paste-cut`: at most N paragraphs / first N characters); drag-move; IME composition guard; 16 px on touch. CoverLetterPanel.jsx:334-340, src/components/RichTextEditor.jsx:325-403 | EdLetter "Letter": a plain bordered box, hint "Plain text, blank line between paragraphs" | CHANGED | Keep the rich-text editor and its toolbar in the "Letter" card (restyled); the drawn plain box and its hint must not be built. The PDF, Word and text exports all read the rich body. |
| ELAE-021 | **STAR / Bullet Optimizer button on the letter body**: The same toolbar carries "STAR Optimizer" (title "Bullet Optimizer & STAR Formula Helper"), acting on the sentence at the caret or the selection. RichTextEditor.jsx:358-371 (see ELAE-076) | Not drawn on EdLetter | MISSING | Keep it in the body toolbar (see ELAE-076). |
| ELAE-022 | **Auto-Generate from Resume (entry)**: Blue button "Auto-Generate from Resume" with sparkle, right of the "Letter Body" label; opens the generator. CoverLetterPanel.jsx:322-333 | EdLetter "Letter" card header: "Draft from my résumé" (sparkle) | RESTYLED | Renamed only. |
| ELAE-023 | **Apply writes the whole recipient block**: Apply sets recipientName (blank clears the old), recipientTitle (kept only for the same person), company (blank clears), subject, body, closing; leaves a user-typed signature; drops only the old 'Candidate' / 'Professional' placeholders (AUD-31, R4-CL-01, R4-DUX-04, R2-043). CoverLetterPanel.jsx:70-95 | EdDraft footer "Apply to letter" | SAME | Keep every rule (invisible). |
| ELAE-024 | **"Generated letter applied" notice with Undo**: Toast id `letter-generated`, 10 s, "Its body, subject and recipient replaced the letter's." + Undo that restores every field Apply touched, only while the same résumé is open; the toast is dismissed when another résumé opens or the panel unmounts (R4-DUX-04, R5-HUNT2). CoverLetterPanel.jsx:22-27,96-110 | EdDraft footer says "Undo is offered after you apply."; the toast itself is not drawn (States has the shared toast-with-Undo) | RESTYLED | Build with the States toast; keep the same-résumé guard and the 10 s Undo. |
| ELAE-025 | **Closing phrase**: Text field "Closing Phrase" (placeholder "Sincerely"). CoverLetterPanel.jsx:347 | EdLetter Sign-off "Closing" | RESTYLED | n/a |
| ELAE-026 | **Signature space Tight / Wide**: Two chips writing `signatureSpace` (Wide = hand-sign space, prints an extra blank line). CoverLetterPanel.jsx:348-360, coverLetter.js:106-115 | Not drawn | MISSING | Add to the Sign-off card (EdLetter). |
| ELAE-027 | **Signature name**: "Signature Name", placeholder = the résumé's name. CoverLetterPanel.jsx:361 | EdLetter Sign-off "Signature" | RESTYLED | Keep the résumé-name placeholder and the empty-follows-résumé rule. |
| ELAE-028 | **Signature designation**: "Signature Designation", placeholder = the résumé's title. CoverLetterPanel.jsx:362 | Not drawn (Letter paper prints "Full Stack Engineer" under the name) | MISSING | Add a "Designation" field to the Sign-off card. |
| ELAE-029 | **Signature / closing fallbacks**: Closing gets one comma unless it ends in punctuation; empty name / designation print the résumé's name / title (R1-7, R9-9, R2-044). coverLetter.js:106-115 | Letter paper "Sincerely," + name + title | SAME | Keep (invisible). |
| ELAE-030 | **Fields 16 px on touch**: Inputs use `pointer-coarse:text-base` so iOS does not zoom. CoverLetterPanelShared.jsx:21, RichTextEditor.jsx:393 | Not drawn (desktop only) | SAME | Keep (invisible). |
| ELAE-031 | **Letter preview**: The real letter PDF (`buildCoverLetterPdf` preview), rebuilt after a typing pause, in `PdfPreview` id `cover-letter-preview`. src/components/EditorPreviewPane.jsx:13,70-71 | EdLetter stage: `Letter` paper (794x1123, accent rule) at 90% | RESTYLED | Build keeps the real PDF preview; the drawn HTML paper is an illustration. |
| ELAE-032 | **Preview zoom**: − / % / + buttons, 50 % to 150 % in steps of 25 %, default 100 %, disabled at the ends. EditorPreviewPane.jsx:61-65 | EdLetter stage toolbar "− 90% +" | RESTYLED | Keep the 50-150 % / 25 step limits (90 % is a drawing choice). |
| ELAE-033 | **Preview caption**: "Cover Letter · <page size label>" (A4 / Letter by Design). EditorPreviewPane.jsx:57-59 | "Cover letter · 1 page · A4" | RESTYLED | Keep the page-size label; "1 page" is new (section 2). |

**5. ADDED BY REVIEW (independent reviewer, 2026-10-06) 5a. Rows added by review**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-134 | **Letter data keys and what carries them**: The letter's fields persist in `resume.coverLetter`: date, recipientName, recipientTitle, company, subject, body, closing, signatureSpace, signatureName, signatureDesignation, clPhoto, showPhoto, photoTextAlign, fieldsPosition, headerStyle, headerLayout, hiddenFields (via `updateCoverLetter(field, value, id)`: a no-op when the value is unchanged; `id` pins a late photo write to its résumé), plus the résumé setting `contactsSideGap`. They save with the résumé (autosave, "Saved" status, cloud sync). Carried by: Backup JSON (whole record), the letter PDF, Word and text exports; NOT by JSON Resume, Markdown, ATS text or the public copy. src/hooks/useResumeStore.js:517-519, src/utils/jsonResume.js, src/utils/publicLink.js:87-120 | Not drawn | SAME | Keep (invisible). The new cards (Who it is for, Letter, Sign-off, Letterhead) must write exactly these keys: Name / Title = recipientName / recipientTitle, Signature = signatureName. |
| ELAE-135 | **Letter photo status line: every wording**: One line under the photo target: "Using own photo"; "Using resume photo (faded = preview)"; "Résumé photo hidden — upload one for the letter"; "No photo — upload or add to resume"; amber (`warn`): "This photo is a link that could not be loaded[, so the letter uses your résumé photo]. Upload the image itself." / "This photo's format can't be printed[, so the letter uses your résumé photo]. Upload it again as a PNG or JPEG." (own photo), "Your résumé photo is a link that could not be loaded. Upload a photo here, or again under Personal Info." / "Your résumé photo's format can't be printed. Upload a photo here, or again under Personal Info." (résumé photo); an own photo that cannot print no longer hides a résumé photo that can; a photo whose copy is still being made counts as printing. src/hooks/usePrintableImage.js:23-57, CoverLetterPanel.jsx:152-156 | Not drawn (summary "no photo" only) | MISSING | Same home as ELAE-005 (the Letterhead block); keep all the lines. |
| ELAE-136 | **Letterhead control labels and option sets**: The 56 px round target shows the own photo, else the résumé photo at 50 % opacity, else a camera icon with "Photo"; label "Cover Letter Photo"; section titles "Photo", "Header Layout", "Date, Recipient & Subject", "Letter Body", "Closing & Signature"; photo text position chips "↑ Top / ↕ Center / ↓ Bottom" under "Text Position (relative to photo)" (default center); Fields Position buttons carry a mono sketch each: `[Photo · Name/Title] ··· [Fields →]`, `[Photo] [Name/Title above · Fields below]`, `[Photo · Name/Title] then [Fields ↓]`; Contact Style chips "⊕ Icon / • Bullet / \| Bar"; Signature Space "Tight" / "Wide (hand-sign space)"; the centred-header sentence reads "Centred like your résumé's header: photo, name and contacts on the centre line (Personal Info → Header Customization → Text Alignment)." CoverLetterPanel.jsx:132-300, src/constants/photoOptions.js:23 | Not drawn | MISSING | Keep these labels and the option sets in the opened Letterhead block and the Sign-off card (restyle only). |
| ELAE-137 **DO NOT BUILD AS DRAWN** | **Letter body label and placeholder**: The body is the rich-text editor labelled "Body" (12 rows), placeholder "Dear Hiring Manager, I am writing to express my interest in..."; the toolbar and editing rules are EDIT-077..083 and EDIT-147 in editor-content.md (Bold / Italic / Underline, lists, Insert link with `window.prompt` and `window.alert`, alignment, paste and drop cleaning, 200,000-character and block caps, IME-safe value sync). CoverLetterPanel.jsx:334-340 | EdLetter "Letter": a plain bordered box | CHANGED | As ELAE-020; cite EDIT-077..083 and EDIT-147 for the editor, do not duplicate them. |
| ELAE-139 | **Letter-linked jobs open on the letter tab**: A job linked to a letter record opens it with `editorPath` (the letter tab); the job's "Resume used" picker lists résumés only (the one letter it is already linked to stays listed). src/components/job/OverviewTab.jsx:173-182, src/utils/jobQuery.js:308-316 (cross-reference: Applications area) | Not drawn (Jobs boards) | SAME | Keep (invisible). |
| ELAE-140 | **Keyboard and focus in this area**: No app-level shortcut opens Export, Share or ATS. Ctrl/Cmd+B / I / U work inside the letter body (browser-native, the toolbar titles say so); Escape closes the generator, Share and New Cover Letter dialogs always, the Bullet Optimizer only while the statement is untouched (R5-OPT-01), and does NOT close the Export menu; Tab goes from the Export button into its items (the menu is not in a portal). `data-autofocus` marks the first source in NewLetterModal. ExportDropdown.jsx:27-41, BulletOptimizerModal.jsx:118-122, NewLetterModal.jsx:38 | Not drawn | SAME | Keep (invisible). |

#### mobile

**6. ADDED BY REVIEW (independent pass, 2026-10-06; every row below was added by review) 6c. Editor on a phone: entries, e**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-183 | **Cover Letter tab body**: The tab shows CoverLetterPanel (letter fields, photo, draft generator) in the Edit column (Editor.jsx:176-180) | ME draws the Résumé / Cover letter segment, no letter form | MISSING | Owned by editor-letter-ats-export.md; the phone Edit column must carry it. [added by review] |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-06 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdLetter "112 words" counter and hint "Plain text, blank line between paragraphs" | What the canvas draws: Word count; says the body is plain text | Live today: No word count; the body is rich text | Handling: PARK the counter; drop the hint (it describes a plain-text body the live app does not have, ELAE-020)
- NEW-07 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdLetter caption "Cover letter · 1 page · A4" | What the canvas draws: Page count | Live today: Caption has the page size only | Handling: PARK "1 page" (small); keep the A4 / Letter label
- NEW-08 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdLetter Letterhead summary "Follows the résumé · no photo" | What the canvas draws: One-line summary on a collapsed row | Live today: The same facts live in the Header and Photo blocks (template note, photo line) | Handling: Same function under another form: keep as the closed-state summary of the Letterhead block (ELAE-002/003)

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (3): src/components/CoverLetterPanel.jsx, src/components/CoverLetterPanelShared.jsx, src/index.css. Labels scanned: 11 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 44; listed in this batch's "Existing tests to update": 12; NOT listed: 32.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL cypress/e2e/05-cover-letter.cy.js: labels "15 January 2026", "Sincerely"
- FAIL cypress/e2e/07-regressions-store.cy.js: label "Hiring Manager"
- FAIL cypress/e2e/22-regressions-letters.cy.js: labels "Hiring Manager", "Sincerely"
- FAIL tests/fixtures/sampleResumes.js: label "Sincerely"
- FAIL tests/fixtures/typing-freeze-reference/coverLetterGenerator.mjs: label "Hiring Manager"
- FAIL tests/helpers.js: label "Sincerely"
- FAIL tests/pdf/16-saved-data-import.test.mjs: label "Hiring Manager"
- FAIL tests/pdf/16-saved-data-item-gaps.test.mjs: label "Hiring Manager"
- FAIL tests/pdf/16-saved-data.test.mjs: label "Hiring Manager"
- FAIL tests/pdf/19-cover-letter-details.test.mjs: labels "15 January 2026", "Sincerely"
- FAIL tests/pdf/21-cover-letter-looks.test.mjs: label "15 January 2026"
- FAIL tests/pdf/23-cover-letter-looks-word.test.mjs: label "15 January 2026"
- FAIL tests/pdf/27-header-spacing.test.mjs: label "Jane Smith"
- FAIL tests/pdf/29-date-format.test.mjs: label "15 January 2026"
- FAIL tests/pdf/33-cover-letter-header-rule.test.mjs: label "15 January 2026"
- FAIL tests/pdf/33-cover-letter-inline-title.test.mjs: label "15 January 2026"
- FAIL tests/pdf/61-cover-letter-generator-recipient.test.mjs: imports src/components/CoverLetterPanel.jsx; labels "Jane Smith", "Hiring Manager"
- FAIL tests/pdf/68-banner-header.test.mjs: label "15 January 2026"
- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/index.css
- FAIL tests/pdf/80-upload-budget-sections.test.mjs: imports src/components/CoverLetterPanel.jsx
- FAIL tests/pdf/86-sidebar-single-letter-colours.test.mjs: label "Application for the Senior Engineer role"
- FAIL tests/pdf/92-header-spacing-rows.test.mjs: imports src/components/CoverLetterPanel.jsx; label "Jane Smith"
- FAIL tests/pdf/163-tf-redos-letter-closing.test.mjs: label "Sincerely"
- FAIL tests/perf/fixtures.mjs: label "Sincerely"
- FAIL tests/unit/cover-letter-generator.unit.mjs: label "Hiring Manager"
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/dates.unit.mjs: label "15 January 2026"
- FAIL tests/unit/import-text.unit.mjs: label "Sincerely"
- FAIL tests/unit/r5-hunt5-ats-name-parentheses.unit.mjs: label "Jane Smith"
- FAIL tests/unit/touch-reveal.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css

Hits already in the update list:

- tests/pdf/12-cover-letter.test.mjs: labels "15 January 2026", "Hiring Manager", "Application for the Senior Engineer role"
- tests/pdf/16-saved-data-photos.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/21-cover-letter-looks-panel.test.mjs: imports src/components/CoverLetterPanel.jsx; label "15 January 2026"
- tests/pdf/22-cover-letter-looks-options.test.mjs: imports src/components/CoverLetterPanel.jsx; labels "15 January 2026", "Hiring Manager"
- tests/pdf/31-contact-fields.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/44-cover-letter-generator-shapes.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/83-letter-signature-photo.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/102-r4-dux-04-letter-apply-undo.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/103-r4-dph-34-letter-fields-touch-text.test.mjs: imports src/components/CoverLetterPanel.jsx; labels "15 January 2026", "Jane Smith", "Hiring Manager" (+3)
- tests/pdf/105-r5-hunt2-late-upload.test.mjs: imports src/components/CoverLetterPanel.jsx
- tests/pdf/r4cl-generator-letter-fields.test.mjs: imports src/components/CoverLetterPanel.jsx; labels "Jane Smith", "Hiring Manager"
- tests/pdf/r5hunt2-letter-undo-other-resume.test.mjs: imports src/components/CoverLetterPanel.jsx; label "Generated letter applied"

## Progress log
(append: time, what, run ids, head sha)
