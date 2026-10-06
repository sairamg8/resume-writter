# B8b (3 h): Template gallery, saved designs, phone Design sheet

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Restyle the gallery with ALL looks and apply-on-click Undo, the template pane's saved designs and Browse templates, and give the phone a Design chip rail with the More chip over the same DesignPanel groups prop.

## Why here
Needs B8a's rail and groups prop; it owns TemplateGallery and TemplateThumb (shared with the New page through stable props) and the phone sheet.

## Depends on
B8a

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- EditorTemplates
- MobileDesign
- Paper (render check of the thumbnails)

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-design-templates: EDIT-016..EDIT-039, EDIT-091..EDIT-092, EDIT-094, NEW-005..NEW-009, NEW-013
- mobile: MOBI-081..MOBI-087, MOBI-160, MOBI-185..MOBI-188, D-08..D-11

## PARKED: do NOT build
- Cancel / Use template two-step (NEW-005; live apply-on-click with Undo and Done)
- Showing 8 of 28 sentence, category word on cards (NEW-006/007)
- live preview above the phone Design sheet (NEW-013, mobile D-08)
- Use accent on headings switch on the phone (mobile D-10, MOBI-085)
- 'Applies to the whole resume' label (mobile D-09)
- NEW-008/009: the 'Current' badge text and the gallery subtitle are wording only; the live current-look marker stays

## Clusters (separate file ownership)

### Cluster: gallery
Files owned: src/components/TemplateGallery.jsx, src/components/TemplateThumb.jsx, src/hooks/usePickCard.js, src/index.css (this batch's single editor)
New files: none

Gallery frame, live category and filter chips, ALL looks selectable (19 templates + Sidebar single-column + 8 designs + saved designs; scroll, filter, group), current-look marker, apply on click with the Undo notice (8 s) and a single Done, empty-filter message, My designs (save/delete/clash), title count includes saved designs, stays mounted with the picture cache, cover-letter letterhead thumbnail, one-line description and ATS badge on every safe look; phone gallery sheet, two cards per row, Done always in view. TemplateThumb props stay stable for NewResume/StarterTemplateModal (B5b).

### Cluster: phone-design
Files owned: 
New files: src/components/DesignPanelPhone.jsx

Phone Design sheet as a chip rail Template, Color, Type, Spacing, Headings, More (all ten sections reachable), 16 px fields, per-section Reset with Undo, Save my design / My designs / Reset all with the inline confirm, the Word caveat and 1-Page Fit sentence shown as visible text on touch, room under the sheet for the pill. Uses the same DesignPanel groups prop; no second copy of any control. MOBI-160 verifying owner: this batch checks that every hover-only hint has visible text on touch (Word caveat built by B10b, entry-reorder hint by B6, Design & Customize and Rename/Back labels by B3, Design hints here).

### Cluster: tests
Files owned: tests/playwright/picker.spec.mjs, tests/playwright/pdf-templates.spec.mjs, cypress/e2e/30-starters-and-design.cy.js, tests/pdf/93-picker-cards.test.mjs, tests/pdf/83-templates-ui-leftovers.test.mjs
New files: none

picker.spec keeps role-and-name queries and gallery-* / design-design_* ids; class pins restated; the phone Word caveat and 1-Page Fit sentence are visible text on touch.

## New tests
- tests/pdf/187-ui-b8b-gallery.test.mjs (all looks incl saved designs selectable; filters; apply-on-click with Undo and Done; Cancel / Use template do not exist; count title; save/delete/name clash)
- tests/pdf/187-ui-b8b-phone-design.test.mjs (rail includes More, every section reachable, Reset with confirm, hover-only hints visible)

## Existing tests to update
- class pins 93-picker-cards (reads source), 83-templates-ui-leftovers, tests/unit/picker-ui.unit.mjs, r4dsn-gallery-count.unit.mjs, r4dsn-gallery-category.unit.mjs; the 63 DesignPanel users stay green
- Cypress 30, 07 (one case); Playwright picker (role names), pdf-templates

## Start-up size plan
Same as B8a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.

## Bug-hunt focus
- functions that stopped working: apply-on-click with Undo and Done, saved designs save/delete/name clash, all looks selectable incl saved designs
- persistence: template section memory (EDIT-153), picture cache kept
- narrow widths: 390 px sheet, gallery 2-up
- tests that pass for the wrong reason: toast-survival test must fail when two DesignPanels are mounted

## Done when
- RUN-STATE batch gate for the owned rows incl CHANGED EDIT-017/025/028/030 and MOBI-083 each with a negative twin
- render check at 1440 and 390 for the gallery and the phone sheet (and the Paper board for thumbnails)
- every hover-only hint listed in MOBI-160 has visible text on touch, with the building batch named in the report
- standing phone guard green

## Risks
- gallery stays mounted with the picture cache: a restyle must not remount it
- TemplateThumb props are shared with the New page: stable

## Owner calls here
- none

## Parity rows of this batch

49 row IDs (39 live-function rows: SAME 5, MOVED 3, RESTYLED 7, CHANGED 5, MISSING 19; 10 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

none (this batch is not the catch-all of any parity file).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-017 [CHANGED: the drawing alters or loses the live function] Mobile Design rail has no "More" group
- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-025 [CHANGED: the drawing alters or loses the live function] Gallery card: picture, letterhead, name, badge, line
- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-028 [CHANGED: the drawing alters or loses the live function] Pick a card: apply at once
- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-030 [CHANGED: the drawing alters or loses the live function] Gallery footer button
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-005 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Gallery two-step: Cancel / Use template / ET footer. Live applies on click with Undo and closes with Done.
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-006 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Gallery status line: "Showing 8 of 28 templates, scroll for the rest. Harbor is your current look." / ET footer. Live has no such line; its 
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-007 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Category word on each gallery card (Professional, Simple, ...) / ET cards. Live shows the category only as a chip row, never on a card.
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-008 (drawn item) [cited in this batch's PARKED list] Badge "Current" and a check on the current card / ET. Live shows "Selected" and a blue border.
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-009 (drawn item) [cited in this batch's PARKED list] Gallery subtitle "Your content stays exactly as it is. Only the look changes, and Undo puts it back." / ET. New wording of existing behaviou
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-013 (drawn item) [cited in this batch's PARKED list] Mobile: live mini preview above the Design sheet / MD. Live phone shows Design as a full-width tab with the Preview on a separate tab.
- DO NOT BUILD AS DRAWN: mobile:MOBI-083 [CHANGED: the drawing alters or loses the live function] Template picker and gallery
- DO NOT BUILD AS DRAWN: mobile:MOBI-085 [cited in this batch's PARKED list] "Use accent on headings" toggle
- DO NOT BUILD AS DRAWN: mobile:D-08 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Live preview pinned above the Design panel / MD
- DO NOT BUILD AS DRAWN: mobile:D-09 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Applies to the whole résumé" label / MD
- DO NOT BUILD AS DRAWN: mobile:D-10 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Use accent on headings" switch / MD

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| EDIT-017 (editor-design-templates) | CHANGED | MD chip rail: five chips, no More. | Mobile Design rail has no "More" group | Add the More chip to the phone rail (or place those five groups in another chip). Function must stay reachable. |
| EDIT-019 (editor-design-templates) | MISSING | Not drawn (ET is desktop only; MD Template chip content not drawn). | Mobile template gallery (full-screen sheet, 2 cards per row, Done in view) | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): / build the phone gallery as a sheet, 2 columns, with a closing control always visible. |
| EDIT-020 (editor-design-templates) | MISSING | ET draws the gallery open over the editor; the control that opens it (in the Template pane) is not drawn. | Browse templates button (count) | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template pane with a visible entry to the gallery that shows the same count; no way to open the gallery means no pictures and no filters. |
| EDIT-024 (editor-design-templates) | MISSING | Not drawn. | Empty filter result | Keep the message. |
| EDIT-025 (editor-design-templates) | CHANGED | ET: card = Paper picture, name, badge ATS-safe (Harbor only), category word, Current badge with a check; no letterhead, no description line. | Gallery card: picture, letterhead, name, badge, line | Keep the cover-letter letterhead thumbnail and the one-line description on each card, and the ATS badge on every safe look (Ledger, Nordic ... are Classic/Minimal engines, rated safe). |
| EDIT-028 (editor-design-templates) | CHANGED | ET: cards are toggles; footer "Cancel" and "Use template" apply later. | Pick a card: apply at once | PARITY-RULE: apply-on-click with Undo stays. Build: no Use-template step; the card click applies; the footer button is "Done". |
| EDIT-029 (editor-design-templates) | MISSING | Not drawn for a template; States draws the Undo toast pattern (dark, Undo, dismiss) for tasks. ET text promises Undo. | Template switch notice with Undo | Use the States toast for the switch notice (same title, description, 8 s, Undo, hover or focus pauses the countdown, same id replaces the last one, at most four stacked). The toast stack (z-90) sits above the open gallery (z-50): the Undo must stay reachable while the gallery is open, as picks do not close it. |
| EDIT-030 (editor-design-templates) | CHANGED | ET: "Cancel" and "Use template". | Gallery footer button | Replace by one "Done" (or the X) since picks are already applied. |
| EDIT-032 (editor-design-templates) | MISSING | Template rail item exists; its pane is not drawn. | Template list in the pane (cards with thumb) | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template pane (current look first, then the list or the gallery entry). Home: Template; pane content not drawn. |
| EDIT-035 (editor-design-templates) | MISSING | ET: no delete control on saved-design cards. | Delete a saved design (two-step) | Add delete (with the confirm) on saved designs, in the gallery's My designs row and the Template pane. |
| EDIT-036 (editor-design-templates) | MISSING | Not drawn (ET shows saved designs but no way to make one). | Save my design | Add Save my design to the Template pane or the gallery's My designs row, with the name field and Save / Cancel. |
| EDIT-037 (editor-design-templates) | MISSING | Not drawn. | Saved-design name clash | Keep both messages (data-testid design-name-taken). |
| EDIT-038 (editor-design-templates) | MISSING | Not drawn (ET's My designs row has two designs). | Saved designs empty state | Keep the empty text. |
| EDIT-092 (editor-design-templates) | MISSING | MD: Template / Color / Type / Spacing / Headings chips and the Color pane only; no Reset design, no "Changes save as you go", no per-pane footer. | Phone: Reset design and save line | Add the footer (Reset design with the confirm, save line) to the phone sheet; EDIT-081 / 082 cover the desktop drawer only. |
| MOBI-082 | MISSING | No chip for them | Design sections with no chip | Add chips (or one "More") so all ten sections are reachable; the chip rail already scrolls. |
| MOBI-083 | CHANGED | MD: chip "Template" only; no body | Template picker and gallery | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template body (cards + Browse) and keep apply-on-tap with Undo; the 8 drawn on EditorTemplates are a layout question (PARITY-RULE). |
| MOBI-085 | MISSING | MD: switch, on | "Use accent on headings" toggle | Not a live function: see D-10. |
| MOBI-086 | MISSING | Not drawn | Per-section Reset with Undo toast | Keep Reset in each phone section. |
| MOBI-087 | MISSING | Not drawn | Save my design / My designs / Reset all | Keep (see editor-design-templates.md). |
| MOBI-160 | MISSING | Icons drawn with an aria-label only | Hints that are hover-only today | Put the Word caveat and the 1-Page Fit sentence as visible helper lines in the phone sheets; label the Design entry in words. Tooltip is already a no-op on touch (row 017) and nothing replaces these. [added by review] |
| MOBI-185 | MISSING | MD chip "Spacing", no body | Spacing body | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it; page size is a Design setting only, never a card field (see unknown 5). [added by review] |
| MOBI-186 | MISSING | MD chip "Template", no body | Template body extras | Row 083 names cards and Browse; these extras stay. [added by review] |
| MOBI-187 | MISSING | No chip | Contact icons body | Row 082 names the section; this is its content. [added by review] |
| MOBI-188 | MISSING | Not drawn | Reset Design Settings | Row 087 says "Reset all"; the inline confirm and its wording stay. [added by review] |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### editor-design-templates

**1. PARITY TABLE (one row per live function)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-016 | **Mobile: reach Design**: Phone uses the same Design tab (palette button) in the editor tab strip, full width, plus the floating Edit / Preview pill. Editor.jsx:200-241, EditorHeader.jsx:140. | MD: floating pill Edit / Preview / Design; Design opens a bottom sheet (rounded top) with a small live page above it, title "Design", "Applies to the whole resume", chip rail Template, Color, Type, Spacing, Headings. | MOVED | None. |
| EDIT-017 **DO NOT BUILD AS DRAWN** | **Mobile Design rail has no "More" group**: Contact icons, Dates, Lists, Links, Page numbers are reachable on the phone today (same panel). | MD chip rail: five chips, no More. | CHANGED | Add the More chip to the phone rail (or place those five groups in another chip). Function must stay reachable. |
| EDIT-018 | **Mobile fields at 16 px**: Every Design field is 16 px on touch (pointer-coarse:text-base) so iOS does not zoom. DesignPanelShared.jsx:13-15, test 103-r4-dph-33. | MD fields are not drawn except swatches; 44 px targets. | SAME | Keep 16 px text in every field of the new panes. |
| EDIT-019 | **Mobile template gallery (full-screen sheet, 2 cards per row, Done in view)**: Dialog size xl with sheet: below md it is a full-screen sheet sliding up; grid-cols-2; Done always visible (min-h-11). TemplateGallery.jsx:29-37,51. | Not drawn (ET is desktop only; MD Template chip content not drawn). | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): / build the phone gallery as a sheet, 2 columns, with a closing control always visible. |
| EDIT-020 | **Browse templates button (count)**: Button "Browse templates (N) - pictures and filters" at the top of Design > Template; N = every card including saved designs (R4-DSN-07). DesignPanel.jsx:208-217. | ET draws the gallery open over the editor; the control that opens it (in the Template pane) is not drawn. | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template pane with a visible entry to the gallery that shows the same count; no way to open the gallery means no pictures and no filters. |
| EDIT-021 | **Gallery dialog frame**: Dialog size xl, title "Templates (N)", description ("Each shows page 1 of a sample resume in its look, with its cover letter's header. Picking one applies it now; Undo puts your look back."); Esc, overlay click or X close it; focus trapped and returned to the opener, the page behind does not scroll, the panel is inert while it animates out. TemplateGallery.jsx:29-37, ui/Dialog.jsx:32-96. | ET: dialog "Choose a template" with subtitle ("Your content stays exactly as it is. Only the look changes, and Undo puts it back.") and X. | RESTYLED | Keep Esc and overlay close and the live count in the title or footer. |
| EDIT-022 | **Gallery category chips**: All plus a chip per category that has a card (Simple, Professional, Modern, Creative, Compact, My designs last; an unknown category gets its own chip); clicking the active one returns to All; a category whose cards are gone resets to All (R4-DSN-06). TemplateGallery.jsx:16-24,39-44, templatePicker.js:12-20,111-120. | ET: chip row All, Simple, Professional, Modern, Creative, Compact, My designs (All pressed). The drawn card captions disagree with the data in one place: Ledger (engine Classic, category simple) is captioned Professional. | RESTYLED | Build from data (categoriesOf), not the drawn list; My designs chip only when a saved design exists; a card's category follows its engine (a design has none of its own), so Ledger sits under Simple. |
| EDIT-023 | **Gallery filter chips (what the page prints)**: ATS-safe, One column, Two columns, Colour header, Serif; multi-select, all must pass; aria pressed. TemplateGallery.jsx:17,45-49, templatePicker.js:22-28,104-107. | ET: "Show only" row with the same five chips. | RESTYLED | None. |
| EDIT-024 | **Empty filter result**: "No template has all of these. Turn a filter off to see more." TemplateGallery.jsx:50. | Not drawn. | MISSING | Keep the message. |
| EDIT-025 **DO NOT BUILD AS DRAWN** | **Gallery card: picture, letterhead, name, badge, line**: Card = real page 1 painted by the app's renderer (lazy, once on screen; mock page first), the cover-letter letterhead in the corner (F1), name, green ATS badge on safe looks, 2-line description, "Selected" on the current one; grid 2 / 3 / 4 columns. TemplateGallery.jsx:52-77, TemplateThumb.jsx:40-65. | ET: card = Paper picture, name, badge ATS-safe (Harbor only), category word, Current badge with a check; no letterhead, no description line. | CHANGED | Keep the cover-letter letterhead thumbnail and the one-line description on each card, and the ATS badge on every safe look (Ledger, Nordic ... are Classic/Minimal engines, rated safe). |
| EDIT-026 | **All 28 looks selectable**: Cards = 19 templates + the Sidebar single-column card + 8 designs = 28, plus the user's saved designs. templatePicker.js:55-96, templates.js:141, templateTable.js:44-166. | ET draws 8 cards (Harbor, Ledger, Nordic, Crimson, Midnight, Sunrise, Grove, Inkwell) and "Showing 8 of 28 templates, scroll for the rest". | MOVED | All 28 (and saved designs) must be in the scrolling grid. The 8 drawn are the live DESIGNS (TEMPLATE_PRESETS), not placeholders; the 20 plain cards (Classic, Modern, Minimal, Executive, Sidebar, Sidebar Single column, Timeline, Banner, Academic, Compact, Gridline, Registry, Bookend, Lectern, Chronicle, Keystone, Banded, Keel, Linen, Broadsheet) are not drawn. |
| EDIT-027 | **Current look marker**: Card with border-blue-500 and "Selected"; cardSelected = engine + design + Sidebar Layout; re-picking it is no switch. templatePicker.js:98-101, usePickCard.js:15-24. | ET: Harbor with a check and badge "Current", aria-pressed true. | RESTYLED | None. |
| EDIT-028 **DO NOT BUILD AS DRAWN** | **Pick a card: apply at once**: Click applies at once: setTemplate(engine, preset) or applyDesign(saved), plus the card's Layout variant settings; the current card is a no-op. usePickCard.js:26-39. | ET: cards are toggles; footer "Cancel" and "Use template" apply later. | CHANGED | PARITY-RULE: apply-on-click with Undo stays. Build: no Use-template step; the card click applies; the footer button is "Done". |
| EDIT-029 | **Template switch notice with Undo**: Toast id template-switch: "Template: <name>" / "Your content is kept.", 8 s, action Undo = restoreDesign(snapshot of template, settings, each section's settings; keeps contact icons, page size, saved designs). usePickCard.js:30-39, templateSwitch.js:49-84, ui/Toast.jsx. | Not drawn for a template; States draws the Undo toast pattern (dark, Undo, dismiss) for tasks. ET text promises Undo. | MISSING | Use the States toast for the switch notice (same title, description, 8 s, Undo, hover or focus pauses the countdown, same id replaces the last one, at most four stacked). The toast stack (z-90) sits above the open gallery (z-50): the Undo must stay reachable while the gallery is open, as picks do not close it. |
| EDIT-030 **DO NOT BUILD AS DRAWN** | **Gallery footer button**: Primary "Done" (data-testid gallery-done), min 44 px, closes. TemplateGallery.jsx:36. | ET: "Cancel" and "Use template". | CHANGED | Replace by one "Done" (or the X) since picks are already applied. |
| EDIT-031 | **Gallery stays mounted, picture cache**: Gallery is always mounted; cards paint pages only while open; painted pictures are cached under a key of their own (PAGE_IMAGES_KEY) by look, never synced. Editor.jsx:242, TemplateThumb.jsx:47-51, utils/pageImageStore.js:114-124. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-032 | **Template list in the pane (cards with thumb)**: Every non-design card as a row: 40 px thumbnail, name, ATS badge, one-line description; selected row blue. data-testid template-<id> and template-sidebar-single. DesignPanel.jsx:198-219, DesignPanelTemplate.jsx:14-35. | Template rail item exists; its pane is not drawn. | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template pane (current look first, then the list or the gallery entry). Home: Template; pane content not drawn. |
| EDIT-033 | **Designs sub-list (8 named looks)**: "Designs - a named look over a template" heading, the 8 design rows, and the note "A design brings its font, colours and heading style too ...". DesignPanel.jsx:220-224. | Designs appear only as the gallery's cards; heading and note not drawn. | MOVED | Keep a Designs group (or tag) and the note. |
| EDIT-034 | **Your designs (saved designs) list**: Saved-design cards under "Your designs", each with a trash icon; listed from every resume (savedDesigns), sorted by name; shown when saving is available or any exist. DesignPanel.jsx:225-227, DesignPanelTemplate.jsx:44-70, templatePresets.js:201-211. | ET: "My designs" row (2 cards: "Alex, two columns", "Long form, serif", caption "Saved design") under the grid; also the My designs chip. | RESTYLED | Keep one row per saved design with the engine in the caption (live: "Your design - Classic"). |
| EDIT-035 | **Delete a saved design (two-step)**: Trash icon -> inline "Delete" / "Keep"; deleteDesign removes it from every resume; a resume on it keeps its look as plain settings; leaves a deletion marker for sync. DesignPanelTemplate.jsx:61-70, useResumeDesignActions.js:60-71. | ET: no delete control on saved-design cards. | MISSING | Add delete (with the confirm) on saved designs, in the gallery's My designs row and the Template pane. |
| EDIT-036 | **Save my design**: Dashed button "Save my design" -> field (autofocus, placeholder "Name this design", max 40) with Save / Cancel; Enter saves, Esc cancels (IME safe); saves designLook(settings) on the current engine and puts the resume on it (templatePreset). DesignPanelTemplate.jsx:74-93, useResumeDesignActions.js:30-53. | Not drawn (ET shows saved designs but no way to make one). | MISSING | Add Save my design to the Template pane or the gallery's My designs row, with the name field and Save / Cancel. |
| EDIT-037 | **Saved-design name clash**: A name already used (any case, trimmed) says "You already have a design named X - saving replaces it on every resume that uses it"; on another template it is refused ("... on <Template> - choose another name"); Save disabled. DesignPanelTemplate.jsx:48-52,94-100, test 102-r4-dux-30. | Not drawn. | MISSING | Keep both messages (data-testid design-name-taken). |
| EDIT-038 | **Saved designs empty state**: "None yet. Save the look you have made - font, colours, headings, spacing - to use it on any resume." DesignPanelTemplate.jsx:73. | Not drawn (ET's My designs row has two designs). | MISSING | Keep the empty text. |
| EDIT-039 | **Saved design persistence**: Stored in settings.myDesigns on each resume that holds it; picking copies it onto the resume; look checked on read (checkedLook). templatePresets.js:83-100,168-211. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |

**1B. ADDED BY REVIEW (rows the audit missed; same columns, IDs continue)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-091 | **Phone: room under Design for the floating pill**: Every tab's box has 64 px of bottom padding below md so the last field scrolls clear of the Edit / Preview pill (R4-DPH-31). EditorTabContent.jsx:19-25. Added by review. | MD: the pill floats at the foot of the sheet over its content; the sheet body is overflow hidden. | SAME | The Design sheet scrolls and keeps about 64 px under its last control so the pill never covers a field. |
| EDIT-092 | **Phone: Reset design and save line**: Reset design (with its confirm) is at the foot of the same Design panel on a phone (DesignPanel.jsx:392-411). Added by review. | MD: Template / Color / Type / Spacing / Headings chips and the Color pane only; no Reset design, no "Changes save as you go", no per-pane footer. | MISSING | Add the footer (Reset design with the confirm, save line) to the phone sheet; EDIT-081 / 082 cover the desktop drawer only. |
| EDIT-094 | **Gallery keeps its filters and stays open on a pick**: The gallery stays mounted, so the chosen category and filter chips are remembered when it is closed and reopened in the same editor visit; a pick never closes it (each pick raises its own Undo, replacing the last); only Done, X, Esc or the overlay close it. TemplateGallery.jsx:14-26,36-37, Editor.jsx:242. Added by review. | ET: footer Cancel / Use template; no state is drawn for reopen. | SAME | Keep the memory and the pick-without-closing; with apply-on-click the picker never needs a second step. |

#### mobile

**1. PARITY TABLE 1d. Design on a phone**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-081 | **Design panel sections**: One scroll of accordions, each with Reset: Template, Colors, Contact icons, Typography, Spacing, Section Headings, Dates, Lists, Links, Page numbers (DesignPanel.jsx:206-387); fields 16 px on touch (DesignPanelShared.jsx:13) | MD: chip row Template / Color / Type / Spacing / Headings, one body at a time (only Color drawn) | RESTYLED | Colors, Typography, Spacing, Headings map to chips. |
| MOBI-082 | **Design sections with no chip**: Contact icons, Dates, Lists, Links, Page numbers (DesignPanel.jsx:263,381-387) | No chip for them | MISSING | Add chips (or one "More") so all ten sections are reachable; the chip rail already scrolls. |
| MOBI-083 **DO NOT BUILD AS DRAWN** | **Template picker and gallery**: Template card list (open / collapsed state kept), "Browse templates" opens the gallery: on a phone a full-screen sheet, 2 cards per row, Done always in view, a pick applies at once with Undo, filter chips, "My designs" (TemplateGallery.jsx:8-20, DesignPanel.jsx:206-259, tests/playwright/picker.spec.mjs:59-82) | MD: chip "Template" only; no body | CHANGED | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Template body (cards + Browse) and keep apply-on-tap with Undo; the 8 drawn on EditorTemplates are a layout question (PARITY-RULE). |
| MOBI-084 | **Accent colour**: 8 presets (Blue, Indigo, Violet, Rose, Orange, Teal, Slate, Black), custom colour input, text-colour and sidebar-background presets, per-key colours (DesignPanelColors.jsx:8-160) | MD: 7 swatches + dashed "+" custom, selected ring | RESTYLED | Presets differ (drawn: #2B59FF, #0F766E, #7C3AED, #B3261E, #C2410C, #1E3A8A, #111827): build the live 8; keep text and sidebar colours. |
| MOBI-085 **DO NOT BUILD AS DRAWN** | **"Use accent on headings" toggle**: No setting by that name (headings carry their own style / border colour: DesignPanelHeadings.jsx:68-160) | MD: switch, on | MISSING | Not a live function: see D-10. |
| MOBI-086 | **Per-section Reset with Undo toast**: Each section's Reset restores its keys and offers Undo (DesignPanel.jsx:171-190) | Not drawn | MISSING | Keep Reset in each phone section. |
| MOBI-087 | **Save my design / My designs / Reset all**: Save design, delete design, reset and clear settings (DesignPanel props at Editor.jsx:161-172) | Not drawn | MISSING | Keep (see editor-design-templates.md). |

**6. ADDED BY REVIEW (independent pass, 2026-10-06; every row below was added by review) 6a. Shell and global behaviours m**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-160 | **Hints that are hover-only today**: These explanations sit in `title=` and never show on a phone: the Word export caveat (what the .docx leaves out, ExportDropdown.jsx:84-100), "1-Page Fit" (tightens margins, then text down to MIN_FIT_BASE_PT) and the Balanced / Spacious presets (DesignPanel.jsx:335-356), "Hide field from resume", "Drag, or press Space then the arrow keys, to reorder", "Design & Customize" (the palette button has a title and no text, EditorHeader.jsx:142), "Rename resume" and "Back to dashboard" (title only) | Icons drawn with an aria-label only | MISSING | Put the Word caveat and the 1-Page Fit sentence as visible helper lines in the phone sheets; label the Design entry in words. Tooltip is already a no-op on touch (row 017) and nothing replaces these. [added by review] |

**6. ADDED BY REVIEW (independent pass, 2026-10-06; every row below was added by review) 6d. Design on a phone: bodies the**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-185 | **Spacing body**: "Smart Page Fit Presets": 1-Page Fit (disabled and "Fitting…" while it runs, then a notice), Balanced, Spacious (toast "Spacing: <label>" with Undo); Line Height; Page size A4 / Letter (`settings.pageSize`, read by the preview, the PDF and both Word files); Top / Bottom and Left / Right margin (mm); Between Sections and Between Items (px) (DesignPanel.jsx:42-60,95-135,325-365) | MD chip "Spacing", no body | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it; page size is a Design setting only, never a card field (see unknown 5). [added by review] |
| MOBI-186 | **Template body extras**: Browse templates button "(n) · pictures and filters"; template cards, then "Designs · a named look over a template", then the user's saved designs; the Sidebar template's Layout segment (Two columns / Single · ATS-safe) and its column choices; notes for Academic and Compact; the letterhead note (DesignPanel.jsx:206-290) | MD chip "Template", no body | MISSING | Row 083 names cards and Browse; these extras stay. [added by review] |
| MOBI-187 | **Contact icons body**: Icon pack cards with a live row of the icons and a "Selected" tag, Icon size minus / plus (px), a hint line, uploads in the header-icon picker (DesignPanel.jsx:264-312, HeaderIconPickerModal.jsx) | No chip | MISSING | Row 082 names the section; this is its content. [added by review] |
| MOBI-188 | **Reset Design Settings**: A yellow card at the foot with an inline confirm (Yes / Reset / Cancel wrap under the text) that resets font, colours, spacing and layout to the template's defaults; content kept (DesignPanel.jsx:390-410) | Not drawn | MISSING | Row 087 says "Reset all"; the inline confirm and its wording stay. [added by review] |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-005 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Gallery two-step: Cancel / Use template | What live has instead: ET footer. Live applies on click with Undo and closes with Done. | Recommended handling: PARK (PARITY-RULE: apply-on-click with Undo stays).
- NEW-006 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Gallery status line: "Showing 8 of 28 templates, scroll for the rest. Harbor is your current look." | What live has instead: ET footer. Live has no such line; its count is the title "Templates (N)" where N includes saved designs (28 + saved). | Recommended handling: PARK the sentence; keep the live count (R4-DSN-07). Harmless as copy if the number is the live one.
- NEW-007 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Category word on each gallery card (Professional, Simple, ...) | What live has instead: ET cards. Live shows the category only as a chip row, never on a card. | Recommended handling: PARK (presentation of existing data; owner may accept).
- NEW-008 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Badge "Current" and a check on the current card | What live has instead: ET. Live shows "Selected" and a blue border. | Recommended handling: Same function under another name (kept as the current-look marker, RESTYLED).
- NEW-009 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Gallery subtitle "Your content stays exactly as it is. Only the look changes, and Undo puts it back." | What live has instead: ET. New wording of existing behaviour (live: "Picking one applies it now; Undo puts your look back."). | Recommended handling: Copy only; true only if apply-on-click with Undo is kept.
- NEW-013 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Mobile: live mini preview above the Design sheet | What live has instead: MD. Live phone shows Design as a full-width tab with the Preview on a separate tab. | Recommended handling: Same function (Preview) shown beside Design; not a new capability. Accept as layout.
- D-08 [mobile] **DO NOT BUILD AS DRAWN**: Drawn control / behaviour: Live preview pinned above the Design panel | Where: MD | Live today: Phone preview is hidden and unbuilt on every Edit-side tab, Design included | Recommended handling: PARK (changes the "unbuilt until Preview" invariant, tests 71-preview-hidden-builds and cypress 26); owner decides.
- D-09 [mobile] **DO NOT BUILD AS DRAWN**: Drawn control / behaviour: "Applies to the whole résumé" label | Where: MD | Live today: none (settings can also be per section) | Recommended handling: PARK (wording).
- D-10 [mobile] **DO NOT BUILD AS DRAWN**: Drawn control / behaviour: "Use accent on headings" switch | Where: MD | Live today: no such setting | Recommended handling: PARK.
- D-11 [mobile]: Drawn control / behaviour: Chip rail Template / Color / Type / Spacing / Headings | Where: MD | Live today: Accordions in one scroll | Recommended handling: Same functions as a presentation, as long as rows 081 to 083 are met.

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (5): src/components/TemplateGallery.jsx, src/components/TemplateThumb.jsx, src/hooks/usePickCard.js, src/index.css, src/components/DesignPanelPhone.jsx. Labels scanned: 0 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 10; listed in this batch's "Existing tests to update": 3; NOT listed: 7.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/index.css
- FAIL tests/pdf/r4dsn-new-resume-look-colours.test.mjs: imports src/components/TemplateThumb.jsx
- FAIL tests/pdf/r5hunt7-starter-look-keeps-paper-icons.test.mjs: imports src/components/TemplateThumb.jsx
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/touch-reveal.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css

Hits already in the update list:

- tests/unit/picker-ui.unit.mjs: imports src/components/TemplateGallery.jsx
- tests/unit/r4dsn-gallery-category.unit.mjs: imports src/components/TemplateGallery.jsx
- tests/unit/r4dsn-gallery-count.unit.mjs: imports src/components/TemplateGallery.jsx

## Progress log
(append: time, what, run ids, head sha)
