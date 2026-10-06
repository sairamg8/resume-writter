# B9b (2.5 h): Draft from resume dialog and Improve (Bullet Optimizer)

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Restyle the Draft dialog with the three live archetypes and the Improve dialog with every live tool (60 verbs, six metric chips, seven X-Y-Z templates, Auto-Fix, Copy, Apply through the editor's undo stack); no new capability.

## Why here
Shares the generator and optimizer files and tests; follows the letter panel (B9a) so the Auto-Generate entry and the rich text body already exist.

## Depends on
B9a

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- EditorDraft
- EditorImprove

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-content: EDIT-165
- editor-letter-ats-export: ELAE-036..ELAE-047, ELAE-076..ELAE-089, ELAE-144..ELAE-145, NEW-01..NEW-05, NEW-13..NEW-18
- mobile: MOBI-068

## PARKED: do NOT build
- Draft: pasted job posting, Or use an application chips, Tone cards, Length (NEW-01..05)
- Improve: Shorter suggestion, Add a number with invented figures, best-verb row, word count in the strength line, Undo toast after Apply (NEW-13..17); the Improve button on Summary is the existing STAR button (NEW-18: same function, kept)

## Clusters (separate file ownership)

### Cluster: draft-dialog
Files owned: src/components/CoverLetterGeneratorModal.jsx
New files: none

Same dialog restyled: target company/role, recipient, the THREE live archetype cards (Impact and Metrics-Driven, Strategic and Leadership, Adaptability and Growth), amber no-details warning, live preview, Apply with the replace note and the Undo notice, Cancel, Escape and outside-click rules, phone full-screen. NO tone, length, posting or application controls. index.css is edited by the improve-dialog cluster only in this batch.

### Cluster: improve-dialog
Files owned: src/components/BulletOptimizerModal.jsx, src/index.css (this batch's single editor)
New files: none

Improve surface (dialog or drawer with room for 60 verbs): opens on the sentence at the caret/selection, editable statement box, Quality N/100 with the verb and metric indicators, weak-phrase indicator with Auto-Fix, tip lines, verb-blocked tip, power verb chips by category (60), six metric placeholder chips, seven Google X-Y-Z templates with Restore, Copy, Apply to Resume through the editor's own undo stack, Cancel/Escape/backdrop keep edits; defaults and scroll limits kept; phone sheet. utils/bulletOptimizer.js untouched.

### Cluster: tests
Files owned: tests/pdf/walk-extra/letter-panels.mjs, cypress/e2e/28-writing-helpers.cy.js, tests/playwright/bullet-optimizer.spec.mjs, tests/pdf/103-r4-optimizer-helpers.mjs
New files: none

Extend the letter walker to the generator and the optimizer (same walk-extra location).

## New tests
- tests/pdf/189-ui-b9b-draft-dialog.test.mjs (three archetype cards, warning, apply+Undo, cancel; negative twin: no tone/length/posting/application controls)
- tests/pdf/189-ui-b9b-improve.test.mjs (60 verbs, 6 metrics, 7 templates+Restore, Auto-Fix, Copy, Apply through undo; negative twin: no invented figures, no Shorter)

## Existing tests to update
- generator: 61-cover-letter-generator-recipient, 43-cover-letter-generator-escape, 104-r5-dlg-generator-dialog, 102-r4-dux-13-generator-no-details, 96-modal-outside-click, 104-r5-dlg-dph-36-generator-share-touch-text
- optimizer: r4cl-optimizer-chips, 102-r4-dux-09-optimizer-backdrop-keeps-edits, 103-r4-dvis-23-optimizer-not-faded, 104-r5-opt-01-escape-keeps-edits, 104-r5-opt-dux-22-restore-through-edits, 102-r4-dux-22-template-undo, r5hunt11-verb-chip-worked-with, r5hunt13-verb-chip-adverb-in-weak-phrase, 104-r5-opt-sw-wt-04-verb-chip-negative, 103-r4-dph-30-optimizer; tests/unit/touch-reveal.unit.mjs
- known flake 102-r4-dout-09-letter-title-weight on shard 2/6: rerun the failed shard once, never weaken

## Start-up size plan
Same as B9a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.

## Bug-hunt focus
- functions that stopped working: optimizer Apply writes back into the right field through the undo stack; generator Apply and its Undo notice
- narrow widths: 390 px Draft and Improve full screen, 16 px fields
- keyboard: Escape in generator/optimizer keeps edits; IME guards
- tests that pass for the wrong reason: archetype test passing with three cards but wrong text

## Done when
- RUN-STATE batch gate for the owned rows; CHANGED ELAE-076/079/080/084/086 each with a negative twin
- no tone/length/posting/application control in the DOM (negative twin); no invented figures
- standing phone guard green

## Risks
- optimizer shares RichTextEditor with Job notes (B13a): keep its props stable

## Owner calls here
- Confirm the PARK list for Draft and Improve (default: parked; live archetypes and chips are built)

## Parity rows of this batch

41 row IDs (30 live-function rows: SAME 3, MOVED 1, RESTYLED 12, CHANGED 5, MISSING 9; 11 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

none (this batch is not the catch-all of any parity file).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-076 [CHANGED: the drawing alters or loses the live function] Entry: STAR Optimizer toolbar button
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-079 [CHANGED: the drawing alters or loses the live function] Editable statement box
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-080 [CHANGED: the drawing alters or loses the live function] Quality score
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-084 [CHANGED: the drawing alters or loses the live function] Power verb chips
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-086 [CHANGED: the drawing alters or loses the live function] Metric chips (6)
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-01 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdDraft "Job posting" textarea ("Paste the job posting") / A box to paste a posting that the draft is tailored to
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-02 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdDraft "Or use an application" chips (Google / Globex / Stripe applications) / Pick a tracked application to fill company, role and posting
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-03 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdDraft "Tone" Warm / Direct / Formal / Three tone cards
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-04 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdDraft "Length" Short 120 / Standard 200 / Long 300 words / Length choice
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-05 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdDraft preview content ("two of the four I coached were promoted…", "Globex's focus on fast, reliable storefronts") / A letter tailored fro
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-13 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove "Shorter" suggestion / A suggestion that shortens the bullet
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-14 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove "Add a number" with invented figures ("cut API latency from 420 ms to 140 ms") / A rewritten bullet containing figures
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-15 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove "Stronger verb" single rewritten suggestion / One suggested verb, applied in one click
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-16 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove word count in the Strength line ("11 words") / Words in the bullet
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-17 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove Undo toast "Highlight updated in Acme Corp" / Undo after Apply
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-18 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] EdImprove / Personal board: "Improve" button on the Summary field / Improve on the summary

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| ELAE-041 | MISSING | EdDraft draws "Tone" Warm / Direct / Formal and "Length" Short / Standard / Long instead | Writing archetype & tone (3 cards) | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the three live archetype cards (name, badge, one-line description, check) where Tone is drawn. Tone and Length are NOT built (PARITY-RULE; section 2). |
| ELAE-042 | MISSING | Not drawn | "No résumé details to draw on" warning | Add the amber note above the preview in EdDraft. |
| ELAE-076 | CHANGED | EdImprove: popover "Improve this highlight" over a focused highlight (no trigger drawn); the summary-field "Improve" button is a drawn-only idea (section 2) | Entry: STAR Optimizer toolbar button | Keep the toolbar button (or one control per rich-text field and on every highlight) that opens the optimizer; draw the trigger. |
| ELAE-079 | CHANGED | EdImprove "Now" is a read-only quote | Editable statement box | Keep the editable statement box (Improve drawer / dialog), so verbs, metrics, templates and Auto-Fix have text to act on. |
| ELAE-080 | CHANGED | EdImprove "Strength" line: Verb ok / Number missing / 11 words (no score) | Quality score | Keep the Quality N/100 pill in the strength area. The word count is new (section 2). |
| ELAE-082 | MISSING | Not drawn | Weak phrases indicator + Auto-Fix | Add the weak-phrase indicator and Auto-Fix to the Improve surface. |
| ELAE-083 | MISSING | Not drawn | Tip line | Add under the strength line. |
| ELAE-084 | CHANGED | EdImprove "Stronger verb" (one suggestion, Apply) | Power verb chips | Keep the verb chips (category tabs + verbs), restyled; the one-suggestion row may sit above them. |
| ELAE-085 | MISSING | Not drawn | Verb-blocked tip | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the amber tip state. |
| ELAE-086 | CHANGED | EdImprove "Add a number" (one suggestion with invented figures) | Metric chips (6) | Keep the six placeholder chips. The drawn suggestion's made-up numbers are a new capability (section 2). |
| ELAE-087 | MISSING | Not drawn | Google X-Y-Z templates (7) + Restore | Add a Templates list with the Restore link to the Improve surface. |
| ELAE-088 | MISSING | Not drawn | Copy | Add a Copy button to the footer. |
| ELAE-144 | MISSING | EdImprove popover | Bullet Optimizer: defaults and scroll limits | Keep these in the Improve surface (a drawer or dialog with room for 60 verbs, 7 templates and 6 metric chips); the drawn 3-suggestion popover cannot hold them. |
| MOBI-068 | MISSING | Not drawn (desktop EditorImprove draws a popover) | Improve a bullet | Keep the sheet; see editor-content.md. |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### editor-content

**6. ADDED BY REVIEW 2 (file-by-file sweep and five user journeys, 2026-10-06; every row below was added by review 2) 6a. **

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-165 | **STAR Optimizer: which text it works on**: Opens on the selected text; else the bullet or line the caret is in (a list item split by a nested list is one statement); else, on an empty bullet or line, it fills that one; else the result is appended as a new bullet. If another tab or the cloud changes the field while the dialog is open, Apply finds the statement again by its text (nearest to where it was) rather than writing at the top. The result goes in as plain text over the statement. src/components/RichTextEditor.jsx:185-265,439-598 (dialog itself: editor-letter-ats-export.md ELAE-078..089) | EditorImprove "Improve" popover on a focused highlight; EdPersonal "Improve" on Summary | MOVED | The Improve entry (EDIT-081) must resolve its statement by these rules (caret line, selection, empty bullet, new bullet), on every rich-text field. |

#### editor-letter-ats-export

**1. PARITY TABLE 1b. Draft from résumé (Smart Cover Letter Generator)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-036 | **Dialog open / close**: Kit Dialog size lg, title "Smart Cover Letter Generator", description "Auto-tailor a compelling cover letter from your resume"; × / Cancel / Escape always close; a click beside the box closes only while nothing was typed over what it opened with (R4-DVIS-25). src/components/CoverLetterGeneratorModal.jsx:62-87 | EdDraft dialog "Draft from my résumé" with × and Cancel | RESTYLED | Keep the overlay rule (invisible). Renamed title and subtitle only. |
| ELAE-037 | **Each opening starts from the letter**: Company and Recipient are reset to the letter's own at EVERY opening; Role (placeholder = résumé title) and the chosen archetype are NOT reset at an opening: they start blank / Impact on the first opening and keep what was last typed / picked while the Cover letter tab stays mounted (leaving the tab unmounts the panel and resets them); a blank recipient greets "Dear Hiring Team,". CoverLetterGeneratorModal.jsx:9-31,112 (corrected by review: the auditor said Role starts blank at each opening) | EdDraft prefilled Company, Role (filled "Senior Frontend Engineer"), Recipient | RESTYLED | Keep Role blank-with-placeholder on the first opening and the keep-while-mounted rule for Role and archetype (the drawn prefill is an example). |
| ELAE-038 | **Target Company**: Text field with building icon, placeholder "e.g. Google, Stripe". CoverLetterGeneratorModal.jsx:92-103 | EdDraft "Company" | RESTYLED | n/a |
| ELAE-039 | **Target Role**: Text field, placeholder = résumé title or "e.g. Staff Software Engineer"; feeds the subject and "the X role". CoverLetterGeneratorModal.jsx:104-115 | EdDraft "Role" | RESTYLED | n/a |
| ELAE-040 | **Recipient Name**: Text field, placeholder "e.g. Hiring Manager". CoverLetterGeneratorModal.jsx:116-127 | EdDraft "Recipient" | RESTYLED | n/a |
| ELAE-041 | **Writing archetype & tone (3 cards)**: "Writing Archetype & Tone": Impact & Metrics-Driven (badge Tech, Engineering & Data), Strategic & Leadership (Management, PM & Executive), Adaptability & Growth (Career Switchers & High-Growth), each with a description and a check on the active one; default Impact. CoverLetterGeneratorModal.jsx:130-163, src/utils/coverLetterGenerator.js:15-33 | EdDraft draws "Tone" Warm / Direct / Formal and "Length" Short / Standard / Long instead | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the three live archetype cards (name, badge, one-line description, check) where Tone is drawn. Tone and Length are NOT built (PARITY-RULE; section 2). |
| ELAE-042 | **"No résumé details to draw on" warning**: Amber note (testid `generator-no-details`) when the letter's résumé has no experience, skills or title. CoverLetterGeneratorModal.jsx:46-53,165-169 | Not drawn | MISSING | Add the amber note above the preview in EdDraft. |
| ELAE-043 | **Live letter preview**: "Live Letter Preview" panel with "Subject: …", the whole generated body (sanitised rich text, paragraphs separated), scrolling in its own box from `sm`. CoverLetterGeneratorModal.jsx:171-188 | EdDraft "Preview" with "Subject: …" and 2 paragraphs | RESTYLED | n/a (the drawn two paragraphs are truncated for the board). |
| ELAE-044 | **Apply and the replace note**: Footer note "Replaces existing letter fields and body with the generated content." + "Apply to Cover Letter" (writes via ELAE-023, closes). CoverLetterGeneratorModal.jsx:78-86,57-60 | EdDraft "Replaces the letter text. Undo is offered after you apply." + "Apply to letter" | RESTYLED | Keep the meaning that the recipient, company, subject and closing are replaced too (the drawn note says only "letter text"). |
| ELAE-045 | **Cancel**: Ghost "Cancel". CoverLetterGeneratorModal.jsx:83 | EdDraft "Cancel" | RESTYLED | n/a |
| ELAE-046 | **The generated letter itself**: Three archetype templates, 5 paragraphs each; "the Staff Engineer role" / "the open role"; a/an by sound; most recent job clause; top 4 of up to 8 skills; "[Company Name]" fallback; subject "Application for X — Name"; closing "Sincerely,"; hidden fields and entries never cited; every value HTML-escaped. src/utils/coverLetterGenerator.js:125-197 | Not drawn (invisible) | SAME | Keep the generator unchanged. |
| ELAE-047 | **Phone dialog**: Fills the screen, body scrolls between title and action row, action row wraps (R4-DPH-37/38); fields 16 px on touch. CoverLetterGeneratorModal.jsx:64-70,89-91 | Not drawn (no phone board for the draft) | SAME | Keep (invisible); draw a phone sheet if the lead wants one. |

**1. PARITY TABLE 1d. Bullet Optimizer, verb chips (the "Improve" tool)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-076 **DO NOT BUILD AS DRAWN** | **Entry: STAR Optimizer toolbar button**: Button "STAR Optimizer" (sparkle, text hidden under sm, title "Bullet Optimizer & STAR Formula Helper") in EVERY rich-text field's toolbar (summary, descriptions, letter body); `onMouseDown preventDefault` keeps the caret. RichTextEditor.jsx:358-371 | EdImprove: popover "Improve this highlight" over a focused highlight (no trigger drawn); the summary-field "Improve" button is a drawn-only idea (section 2) | CHANGED | Keep the toolbar button (or one control per rich-text field and on every highlight) that opens the optimizer; draw the trigger. |
| ELAE-077 | **Opens on the sentence at the caret / selection**: Selection, else the list item / paragraph at the caret (`statementRange`; a list item split by a nested list is one statement, R4-SW-WT-02); empty caret opens blank and Apply goes into that empty line or a new bullet. RichTextEditor.jsx:191-198,439-484, tests/pdf/57-optimizer-statement | EdImprove "Now: <highlight>" | RESTYLED | Keep the same statement selection (invisible). |
| ELAE-078 | **Dialog and its guards**: Kit Dialog size lg "Bullet Optimizer & STAR Formula" / "Transform weak descriptions into Google X-Y-Z high-impact achievements"; × and Cancel always close; Escape and a click beside the box close only while the statement is still the one it opened with (R4-DUX-09, R5-OPT-01); on a phone it fills the screen. BulletOptimizerModal.jsx:105-139 | EdImprove: small popover with an arrow and × | RESTYLED | Keep the Escape / outside-click guard for typed text (invisible). |
| ELAE-079 **DO NOT BUILD AS DRAWN** | **Editable statement box**: Textarea "Achievement Statement" (3 rows, 16 px on touch) the user types in, plus every chip edits it. BulletOptimizerModal.jsx:142-158 | EdImprove "Now" is a read-only quote | CHANGED | Keep the editable statement box (Improve drawer / dialog), so verbs, metrics, templates and Auto-Fix have text to act on. |
| ELAE-080 **DO NOT BUILD AS DRAWN** | **Quality score**: Pill "Quality: N/100" coloured by band (>=80 green, >=60 blue, else amber). BulletOptimizerModal.jsx:99-103,145-148 | EdImprove "Strength" line: Verb ok / Number missing / 11 words (no score) | CHANGED | Keep the Quality N/100 pill in the strength area. The word count is new (section 2). |
| ELAE-081 | **Verb / Metric indicators**: Two tiles "Strong Action Verb" / "Verb Missing" and "Quantifiable Metric" / "Metric Missing" (green or amber). BulletOptimizerModal.jsx:175-183 | EdImprove "Verb ok", "Number missing" | RESTYLED | n/a |
| ELAE-082 | **Weak phrases indicator + Auto-Fix**: Third tile "No Weak Words" / "N Weak Phrases"; a red strip "Detected weak phrase: “…”. Replace with power verb?" with an Auto-Fix button (`autoFixWeakPhrases`). BulletOptimizerModal.jsx:184-203 | Not drawn | MISSING | Add the weak-phrase indicator and Auto-Fix to the Improve surface. |
| ELAE-083 | **Tip line**: "Tip: …" (first suggestion) when score < 80. BulletOptimizerModal.jsx:205-209 | Not drawn | MISSING | Add under the strength line. |
| ELAE-084 **DO NOT BUILD AS DRAWN** | **Power verb chips**: "Choose Strong Power Verb": 6 category buttons (Leadership, Technical, Performance, Cost, Innovation, Collaboration), 10 verbs each (60), a click puts the verb in place of a leading verb / weak phrase, else first. BulletOptimizerModal.jsx:211-250, bulletOptimizer.js:9-37,405 | EdImprove "Stronger verb" (one suggestion, Apply) | CHANGED | Keep the verb chips (category tabs + verbs), restyled; the one-suggestion row may sit above them. |
| ELAE-085 | **Verb-blocked tip**: When the statement opens with "Did not…", "Was…", "Never…", "Worked with…" the chip refuses and an amber tip asks for a rewrite (or names verbs that take "with"). BulletOptimizerModal.jsx:32-36,59-67,233-238 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the amber tip state. |
| ELAE-086 **DO NOT BUILD AS DRAWN** | **Metric chips (6)**: "Add Quantifiable Impact Placeholders": by 35%, saving $25K annually, reducing latency by 50ms, serving 100K+ users, accelerating delivery by 2 weeks, across 5 cross-functional teams; inserted before the closing full stop. BulletOptimizerModal.jsx:252-273, bulletOptimizer.js:628 | EdImprove "Add a number" (one suggestion with invented figures) | CHANGED | Keep the six placeholder chips. The drawn suggestion's made-up numbers are a new capability (section 2). |
| ELAE-087 | **Google X-Y-Z templates (7) + Restore**: Template cards (role · label, text) replace the statement; "Template applied: your statement was replaced." with "Restore my statement" that survives edits and further template picks (R4-DUX-22). BulletOptimizerModal.jsx:25-31,73-84,159-170,275-293, bulletOptimizer.js:289-329 | Not drawn | MISSING | Add a Templates list with the Restore link to the Improve surface. |
| ELAE-088 | **Copy**: "Copy" copies the statement; "Copied" / "Copy failed" 2 s with tooltip. BulletOptimizerModal.jsx:91-97,125-134 | Not drawn | MISSING | Add a Copy button to the footer. |
| ELAE-089 | **Apply to Resume**: Primary button, disabled when the text is empty; writes the text over the statement (or the empty line / a new bullet) and closes; Cancel discards. BulletOptimizerModal.jsx:86-89,135-136, RichTextEditor.jsx:206-260 | EdImprove: an "Apply" per suggestion | RESTYLED | Keep one Apply that writes the edited text; per-suggestion Apply is the same action on a preset (section 2 for the suggestions themselves). |

**5. ADDED BY REVIEW (independent reviewer, 2026-10-06) 5a. Rows added by review**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-144 | **Bullet Optimizer: defaults and scroll limits**: The verb tab starts on "Technical & Engineering" (tab labels are the category name up to "&": Leadership, Technical, Performance, Cost, Innovation, Collaboration); the verb strip (5 rem), the template list (8 rem) scroll in their own capped boxes; Apply is labelled "Apply to Resume" and is disabled for an empty or blank statement; Cancel and × discard; the dialog is a portal so a faded parent never fades it (R4-DVIS-23). BulletOptimizerModal.jsx:22,211-250,278,136 | EdImprove popover | MISSING | Keep these in the Improve surface (a drawer or dialog with room for 60 verbs, 7 templates and 6 metric chips); the drawn 3-suggestion popover cannot hold them. |
| ELAE-145 | **Optimizer Apply writes through the editor's own undo stack**: Apply inserts with `execCommand('insertText')` / `delete` into the focused rich-text box, so the browser's Ctrl+Z reverses an Apply inside that field (no toast); a value that changed while the dialog was open is re-found by its text, with none the result becomes a new bullet; an empty caret fills the empty bullet. RichTextEditor.jsx:206-265 | EdImprove draws an Undo toast "Highlight updated in Acme Corp" | SAME | Keep the in-field undo (invisible). The toast itself is NEW-17. |

#### mobile

**1. PARITY TABLE 1c. Editor on a phone (`/resume/:id`)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-068 | **Improve a bullet**: BulletOptimizerModal, a full-screen sheet on a phone, indicators stacked (BulletOptimizerModal.jsx:107-212) | Not drawn (desktop EditorImprove draws a popover) | MISSING | Keep the sheet; see editor-content.md. |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-01 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdDraft "Job posting" textarea ("Paste the job posting") | What the canvas draws: A box to paste a posting that the draft is tailored to | Live today: The generator reads only the résumé, company, role, recipient and archetype | Handling: PARK (named in PARITY-RULE: "pasted-posting controls not built")
- NEW-02 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdDraft "Or use an application" chips (Google / Globex / Stripe applications) | What the canvas draws: Pick a tracked application to fill company, role and posting | Live today: None; Draft knows nothing of the Applications list | Handling: PARK (new link between the letter and the job tracker)
- NEW-03 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdDraft "Tone" Warm / Direct / Formal | What the canvas draws: Three tone cards | Live today: Three archetypes (Impact / Leadership / Growth), a different axis | Handling: PARK; build the live archetype cards instead (ELAE-041)
- NEW-04 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdDraft "Length" Short 120 / Standard 200 / Long 300 words | What the canvas draws: Length choice | Live today: None; fixed 5-paragraph letters | Handling: PARK (named in PARITY-RULE)
- NEW-05 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdDraft preview content ("two of the four I coached were promoted…", "Globex's focus on fast, reliable storefronts") | What the canvas draws: A letter tailored from the posting and facts | Live today: Fixed generic templates using the résumé's title, company, role and skills | Handling: PARK (same family as NEW-01)
- NEW-13 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove "Shorter" suggestion | What the canvas draws: A suggestion that shortens the bullet | Live today: No shortening tool | Handling: PARK
- NEW-14 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove "Add a number" with invented figures ("cut API latency from 420 ms to 140 ms") | What the canvas draws: A rewritten bullet containing figures | Live today: Placeholder chips ("by 35%") the user edits; nothing invents numbers | Handling: PARK (inventing figures is a new capability and a truth risk)
- NEW-15 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove "Stronger verb" single rewritten suggestion | What the canvas draws: One suggested verb, applied in one click | Live today: 60 verb chips by category | Handling: Same function as the verb chips (ELAE-084); keep the chips, a "best verb" row is PARK
- NEW-16 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove word count in the Strength line ("11 words") | What the canvas draws: Words in the bullet | Live today: Not shown | Handling: PARK (small)
- NEW-17 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove Undo toast "Highlight updated in Acme Corp" | What the canvas draws: Undo after Apply | Live today: None for the optimizer (Cancel before Apply only) | Handling: PARK; the shared toast style exists (States) if the owner wants it
- NEW-18 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: EdImprove / Personal board: "Improve" button on the Summary field | What the canvas draws: Improve on the summary | Live today: The STAR Optimizer button is in every rich-text toolbar, summary included (RichTextEditor.jsx:358) | Handling: Same function under another name (kept as ELAE-076); the PARITY-RULE parked list names it new, but it exists live

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (3): src/components/CoverLetterGeneratorModal.jsx, src/components/BulletOptimizerModal.jsx, src/index.css. Labels scanned: 10 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 57; listed in this batch's "Existing tests to update": 16; NOT listed: 41.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL cypress/e2e/04-design.cy.js: label "Cancel"
- FAIL cypress/e2e/06-job-tracker.cy.js: label "Cancel"
- FAIL cypress/e2e/09-regressions-deletes.cy.js: label "Cancel"
- FAIL cypress/e2e/28-writing-helpers.cy.js: labels "Smart Cover Letter Generator", "e.g. Google, Stripe", "e.g. Hiring Manager" (+3)
- FAIL tests/pdf/44-cover-letter-generator-shapes.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx
- FAIL tests/pdf/57-optimizer-statement.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/index.css
- FAIL tests/pdf/77-ats-panel.test.mjs: imports src/components/BulletOptimizerModal.jsx
- FAIL tests/pdf/82-backlog-r4.test.mjs: label "Cancel"
- FAIL tests/pdf/82-issue-view-r4-03.test.mjs: label "Cancel"
- FAIL tests/pdf/82-issue-view-r4-06.test.mjs: label "Cancel"
- FAIL tests/pdf/83-letter-signature-photo.test.mjs: label "Apply to Cover Letter"
- FAIL tests/pdf/95-job-notes-tab.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/102-r4-dux-04-letter-apply-undo.test.mjs: labels "e.g. Google, Stripe", "Apply to Cover Letter"
- FAIL tests/pdf/102-r4-dux-06-job-form-discard.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-06-one-discard-question.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-10-unpublish-confirm.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dph-16-job-form-header-wraps.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dph-37-optimizer.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dph-38-optimizer.test.mjs: labels "Cancel", "Apply to Resume"
- FAIL tests/pdf/103-r4-dvis-01-job-form-page-header.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-02-job-form-kit-buttons.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-06-settings-kit-controls.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-07-optimizer.test.mjs: labels "Bullet Optimizer & STAR Formula", "Apply to Resume"
- FAIL tests/pdf/103-r4-dvis-35-narrow-design-panel.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-optimizer-helpers.mjs: imports src/components/BulletOptimizerModal.jsx
- FAIL tests/pdf/104-r5-opt-sw-wt-02-item-statement.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/104-r5-opt-sw-wt-02-no-empty-line.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/107-r5-hunt6-comment-draft-kept.test.mjs: label "Cancel"
- FAIL tests/pdf/r4cl-generator-letter-fields.test.mjs: labels "e.g. Google, Stripe", "e.g. Hiring Manager", "Cancel" (+1)
- FAIL tests/pdf/r5hunt2-letter-undo-other-resume.test.mjs: labels "e.g. Google, Stripe", "Apply to Cover Letter"
- FAIL tests/pdf/r5hunt7-optimizer-apply-after-outside-change.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/r5hunt7-optimizer-apply-anchor.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/r5hunt8-optimizer-empty-bullet.test.mjs: label "Apply to Resume"
- FAIL tests/pdf/r5hunt8-review-optimizer-empty-list.test.mjs: label "Apply to Resume"
- FAIL tests/playwright/bullet-optimizer.spec.mjs: label "Apply to Resume"
- FAIL tests/playwright/pdf-cover-letter.spec.mjs: label "Apply to Cover Letter"
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-overlays.unit.mjs: label "Cancel"

Hits already in the update list:

- tests/pdf/43-cover-letter-generator-escape.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx
- tests/pdf/61-cover-letter-generator-recipient.test.mjs: labels "e.g. Hiring Manager", "Apply to Cover Letter"
- tests/pdf/96-modal-outside-click.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx; imports src/components/BulletOptimizerModal.jsx; label "Smart Cover Letter Generator"
- tests/pdf/102-r4-dux-09-optimizer-backdrop-keeps-edits.test.mjs: imports src/components/BulletOptimizerModal.jsx; label "Cancel"
- tests/pdf/102-r4-dux-13-generator-no-details.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx
- tests/pdf/102-r4-dux-22-template-undo.test.mjs: imports src/components/BulletOptimizerModal.jsx; label "Restore my statement"
- tests/pdf/103-r4-dvis-23-optimizer-not-faded.test.mjs: label "Bullet Optimizer & STAR Formula"
- tests/pdf/104-r5-dlg-dph-36-generator-share-touch-text.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx
- tests/pdf/104-r5-dlg-generator-dialog.test.mjs: imports src/components/CoverLetterGeneratorModal.jsx; labels "Smart Cover Letter Generator", "e.g. Google, Stripe", "e.g. Hiring Manager" (+2)
- tests/pdf/104-r5-opt-01-escape-keeps-edits.test.mjs: imports src/components/BulletOptimizerModal.jsx; label "Cancel"
- tests/pdf/104-r5-opt-dux-22-restore-through-edits.test.mjs: imports src/components/BulletOptimizerModal.jsx; label "Restore my statement"
- tests/pdf/104-r5-opt-sw-wt-04-verb-chip-negative.test.mjs: imports src/components/BulletOptimizerModal.jsx
- tests/pdf/r4cl-optimizer-chips.test.mjs: imports src/components/BulletOptimizerModal.jsx
- tests/pdf/r5hunt11-verb-chip-worked-with.test.mjs: imports src/components/BulletOptimizerModal.jsx
- tests/pdf/r5hunt13-verb-chip-adverb-in-weak-phrase.test.mjs: imports src/components/BulletOptimizerModal.jsx
- tests/unit/touch-reveal.unit.mjs: imports src/components/BulletOptimizerModal.jsx; imports src/index.css

## Progress log
(append: time, what, run ids, head sha)
