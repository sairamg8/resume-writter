# B8a (3 h): Design drawer: rail, ten sections, resets, undo (one DesignPanel)

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Give the Design dock its canvas rail (Template, Color, Type, Spacing, Headings, More) over ONE mounted DesignPanel with an optional groups prop (default shows everything), every control of the ten live sections with per-group resets and Undo; the gallery and the phone sheet follow in B8b.

## Why here
The dock exists (B3) with the full panel inside and the design props already wired; this batch regroups it. It owns DesignPanel*.jsx, DesignDock and the parity registries alone (the walker, 63 mounting files and picker specs bind it).

## Depends on
B3

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- Editor (drawer open)
- EditorPersonal (drawer open)

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-content: EDIT-153
- editor-design-templates: EDIT-001..EDIT-002, EDIT-004..EDIT-005, EDIT-012..EDIT-015, EDIT-040..EDIT-088, EDIT-090, EDIT-095..EDIT-103, NEW-001..NEW-004, NEW-010, NEW-012
- editor-design-templates: CATCH-ALL every other row of editor-design-templates.md, including any row added by review, belongs to B8a

## PARKED: do NOT build
- Per-element accent toggles and Use accent on headings (NEW-001/002)
- New accent palette defaults (#2B59FF) and text-colour chip set (NEW-003/004): keep the live eight presets, four text presets and custom pickers
- Drawer footer 'Changes save as you go' (NEW-010) and the rail group names as new words (NEW-012): the live section names stay

## Clusters (separate file ownership)

### Cluster: drawer
Files owned: src/components/DesignPanel.jsx, src/components/DesignPanelColors.jsx, src/components/DesignPanelDates.jsx, src/components/DesignPanelHeadings.jsx, src/components/DesignPanelLayout.jsx, src/components/DesignPanelLinks.jsx, src/components/DesignPanelLists.jsx, src/components/DesignPanelPageNumbers.jsx, src/components/DesignPanelShared.jsx, src/components/DesignPanelTemplate.jsx, src/components/DesignPanelTypography.jsx, src/components/DesignDock.jsx, src/index.css (this batch's single editor), tests/pdf/parity/registry.mjs, tests/pdf/parity/registry-design.mjs, tests/pdf/parity/matrix.mjs, tests/pdf/parity/panels.mjs
New files: src/components/DesignRail.jsx

Optional groups prop on DesignPanel (default undefined = all; a pure filter in the return, no new state), ONE instance across group changes (Undo toasts and a running 1-Page Fit survive a pane change; they stop only on unmount). DesignDock: rail 64 px + pane 356 px: Template (current look, Browse with the same count, saved designs with Save my design name field/40 chars/clash messages, two-step delete, sidebar layout and columns, notes), Color (eight accent presets and custom with hex readout, four text colours, name/title colours with resets, header text, sidebar background, borders), Type (13 fonts, custom fonts, Add a Google Font with guards and the offline check, name/heading fonts, size presets, seven scale rows, notes), Spacing (1-Page Fit single flight, Balanced/Spacious with Undo, line height, page size, margins, gaps), Headings (case, icons, border, style cards), More (contact icon pack and size, dates, lists, links, page numbers), per-group reset arrows with Undo, Reset design two-step confirm stating what it keeps; opens at its top; never rename a control text, title, aria-label, data-* row key or the emoji in the spacing preset labels (walker signature). Narrow-panel rules kept. The four parity registry files are edited only when a label changes (default untouched).

### Cluster: tests
Files owned: tests/playwright/pdf-typography-spacing.spec.mjs, tests/playwright/pdf-colors.spec.mjs, tests/playwright/parity-ui-controls.spec.mjs, cypress/e2e/04-design.cy.js, cypress/e2e/04-design-left-bar.cy.js, cypress/e2e/13-regressions-fonts.cy.js, cypress/e2e/25-date-format.cy.js, tests/pdf/103-r4-dph-33-design-fields-touch-text.test.mjs, tests/pdf/104-r5-panels-colors-narrow.test.mjs, tests/pdf/103-r4-dvis-35-narrow-design-panel.test.mjs
New files: none

Specs call openDesign() plus a selectGroup(name) helper; control assertions keep aria-label and data-testid; parity-ui-controls keeps throwing on a div.fixed.inset-0.z-50 layer; class pins restated.

## New tests
- tests/pdf/186-ui-b8a-design-dock.test.mjs (union of controls across the six groups equals the all-groups walk count; one DesignPanel instance across group changes; toasts and 1-Page Fit survive a pane change and stop on close)
- tests/pdf/186-ui-b8a-design-reachability.test.mjs (opener found by role+name; each design control found inside dock-design by testid)

## Existing tests to update
- tests/pdf/parity/* (18 files via walk-cache): green with no prop passed; the 63 DesignPanel users stay; class pins 103-r4-dph-33, 93-name-heading-font, 27-header-spacing, tests/unit/page-margins.unit.mjs, spacing-numbers.unit.mjs, picker-ui.unit.mjs, r4dsn-gallery-count.unit.mjs, r4dsn-gallery-category.unit.mjs
- Cypress 04-design, 04-design-left-bar, 13, 25, 21-a11y; Playwright pdf-typography-spacing, pdf-colors, parity-ui-controls

## Start-up size plan
Lazy-only (Editor chunk). TemplateThumb and pickerCards are shared with the lazy New page; nothing imported by Dashboard; constants/templates.js, templatePresets.js, utils/starterTemplates.js (start-up) are read-only. 71 read in the targeted dispatch.

## Bug-hunt focus
- functions that stopped working: 1-Page Fit single flight and disabled state, Undo ids, Add Google Font guards and offline check, number typed-box rules, resets and what Reset keeps, saved designs surviving deleting a resume
- perf/render counts: dock open with a keystroke in the content (DesignPanel re-renders only while open); no width transition
- persistence: panel open state and template section memory (EDIT-153), custom fonts key, cross-tab merge
- error and empty states: empty filter, name clash, offline font check
- tests that pass for the wrong reason: union count taken from the new groups instead of the pinned walk; toast-survival test must fail when two DesignPanels are mounted
- narrow widths: 240 px dock minimum

## Done when
- RUN-STATE batch gate for the owned rows incl CHANGED EDIT-044/046/048 (editor-design-templates) each with a negative twin
- walker matrix and 00-registry/01-offered green without edits (or registry edits justified in the report); one DesignPanel instance across group changes, proven
- render check at 1440 for the drawer, control count by pane in the report
- standing phone guard green

## Risks
- the Template, Type, Spacing, Headings and More panes are undrawn: design from the Color pane and tokens
- emoji in the spacing preset labels conflicts with the canvas rule: keep (walker signature) and flag
- regrouping must not unmount DesignPanel; parity-ui-controls throws on a div.fixed.inset-0.z-50 layer

## Owner calls here
- none

## Parity rows of this batch

74 row IDs (68 live-function rows: SAME 14, MOVED 3, RESTYLED 4, CHANGED 3, MISSING 44; 6 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

This batch is the catch-all of: editor-design-templates. Rows reaching it only through the rule: 0 (none today: every row is listed by ID, and any row added by review or later lands here).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-044 [CHANGED: the drawing alters or loses the live function] Accent colour presets
- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-046 [CHANGED: the drawing alters or loses the live function] Text colour presets + custom
- DO NOT BUILD AS DRAWN: editor-design-templates:EDIT-048 [CHANGED: the drawing alters or loses the live function] Name colour and Job title colour
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-001 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Accent is used on: Job title / Section headings and rules / Dates and links / Name (four toggles) / ED, ET, EP drawer Color pane. Live has n
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-002 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Use accent on headings (one toggle) / MD Color sheet. Not in the live app (heading colour follows the template and Heading style).
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-003 (drawn item) [cited in this batch's PARKED list] Text colour chips Black / Soft black / Gray / ED Color pane. Live has four presets plus a custom input.
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-004 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Accent palette #2B59FF, #0F766E, #7C3AED, #B3261E, #C2410C, #1E3A8A, #111827 and a default accent #2B59FF on every Paper / ED, ET, EP, MD. L
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-010 (drawn item) [cited in this batch's PARKED list] Drawer footer "Changes save as you go" and "Applies to the whole resume" subtitle / ED, EP. Live autosaves and shows the status under the pa
- DO NOT BUILD AS DRAWN: editor-design-templates:NEW-012 (drawn item) [cited in this batch's PARKED list] Rail group names Color / Type / Spacing / Headings / More and the 6-group rail / ED, EP, ET. Regrouping of the same sections.

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| EDIT-040 (editor-design-templates) | MISSING | Not drawn (Sidebar appears only as layout=side on Paper mocks). | Sidebar Layout: Two columns / Single - ATS-safe | Keep the control in the Template pane when Sidebar is the template; the gallery's Sidebar Single column card also sets it. |
| EDIT-041 (editor-design-templates) | MISSING | Not drawn. | Sidebar column choices: Columns, Details, side width | Keep all three controls with the same range and the explanatory line, under Template, only on Sidebar two-column. |
| EDIT-042 (editor-design-templates) | MISSING | Not drawn (ET subtitle says content is kept). | Template notes (Academic, Compact, switch note, letterhead) | Keep the notes in the Template pane; they state what a switch keeps and changes. |
| EDIT-044 (editor-design-templates) | CHANGED | ED / ET / EP Color pane: 7 round swatches (#2B59FF, #0F766E, #7C3AED, #B3261E, #C2410C, #1E3A8A, #111827) + a dashed + circle. | Accent colour presets | Different palette: a stored #2563eb (or any live preset) would match no drawn swatch. Keep the live eight (restyled as circles); the drawn hexes can be added. |
| EDIT-046 (editor-design-templates) | CHANGED | Pane "Text": three chips Black / Soft black / Gray (Black selected); no custom. | Text colour presets + custom | Keep the four presets and the custom colour input (three drawn chips are not enough). |
| EDIT-047 (editor-design-templates) | MISSING | Not drawn. | Header text colour (banded templates) | Keep it in Color, shown only on those templates. |
| EDIT-048 (editor-design-templates) | CHANGED | Pane "Accent is used on": toggles Job title and Name (Name off). | Name colour and Job title colour | Toggles do not replace two free colour pickers. Keep both pickers and their reset; toggles are new (section 2). |
| EDIT-049 (editor-design-templates) | MISSING | Not drawn. | Sidebar background | Keep in Color, shown on Sidebar two-column. |
| EDIT-050 (editor-design-templates) | MISSING | Only the global "Reset design" is drawn. | Colors section reset arrow | Keep a per-group reset with the Undo toast on each pane (Color, Type, Spacing, Headings, More's groups). |
| EDIT-051 (editor-design-templates) | MISSING | Not drawn (probable home: More). | Contact icon pack | Keep the five packs, previews and hint. Home: More; pane content not drawn. |
| EDIT-052 (editor-design-templates) | MISSING | Not drawn. | Contact icon size (px) | Keep both entry points or one that writes iconSize (the hint says Typography too). |
| EDIT-053 (editor-design-templates) | MISSING | Not drawn. | Contact icons reset arrow | As the other per-group resets. |
| EDIT-054 (editor-design-templates) | MISSING | Type rail item exists; pane not drawn. (Paper mocks only draw sans / serif.) | Font family grid | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Type pane with all 13 fonts. Home: Type; pane content not drawn. |
| EDIT-055 (editor-design-templates) | MISSING | Not drawn. | Your custom fonts chips (select / remove) | Keep chips and remove. |
| EDIT-056 (editor-design-templates) | MISSING | Not drawn. | Add a Google Font | Keep field, states, both messages and the storage key. |
| EDIT-057 (editor-design-templates) | MISSING | Not drawn. | Name font and Heading font | Keep both selects. |
| EDIT-058 (editor-design-templates) | MISSING | Not drawn. | Font size Small / Normal / Large | Keep the three presets and the re-clamp. |
| EDIT-059 (editor-design-templates) | MISSING | Not drawn. | Typography scale rows | Keep all seven rows, ranges and typed-box rules (useTypedNumber). |
| EDIT-060 (editor-design-templates) | MISSING | Not drawn. | Word font stand-ins note and Sidebar type note | Keep both notes. |
| EDIT-061 (editor-design-templates) | MISSING | Not drawn. | Typography reset arrow | As the other per-group resets. |
| EDIT-062 (editor-design-templates) | MISSING | Spacing rail item exists; pane not drawn. | 1-Page Fit | Keep the whole flow. Home: Spacing; pane content not drawn. |
| EDIT-063 (editor-design-templates) | MISSING | Not drawn. | Balanced and Spacious presets | Keep both and their Undo. |
| EDIT-064 (editor-design-templates) | MISSING | Not drawn. | Fit notice | Keep all three messages. |
| EDIT-065 (editor-design-templates) | MISSING | Not drawn. | Line height | Stepper 1.0-3.0 step 0.1 shown to two decimals, typed value accepts a comma, snaps off-step values (1.65 + -> 1.7). DesignPanel.jsx:362, DesignPanelShared.jsx:44-89, constants/spacingNumbers.js:16. |
| EDIT-066 (editor-design-templates) | MISSING | Only the label "A4" in the stage toolbar; no control. | Page size A4 / US Letter | Keep the control in Spacing (or More) and let the stage label follow it. |
| EDIT-067 (editor-design-templates) | MISSING | Not drawn. | Margins and gaps | Keep four rows. |
| EDIT-068 (editor-design-templates) | MISSING | Not drawn. | Spacing reset arrow | As the other per-group resets. |
| EDIT-069 (editor-design-templates) | MISSING | Headings rail item; pane not drawn. | Section title case | Keep. Home: Headings; pane content not drawn. |
| EDIT-070 (editor-design-templates) | MISSING | Not drawn. | Section icons On / Off | sectionIcons; a small icon before each title (PDF and preview only). DesignPanelHeadings.jsx:105-120. |
| EDIT-071 (editor-design-templates) | MISSING | Not drawn. | Border thickness | Keep with the notes. |
| EDIT-072 (editor-design-templates) | MISSING | Not drawn (ED's "Section headings and rules" toggle is the nearest, and is new). | Border colour | Keep the picker and reset. |
| EDIT-073 (editor-design-templates) | MISSING | Not drawn. | Heading style cards | Keep all six with their samples. |
| EDIT-074 (editor-design-templates) | MISSING | Not drawn. | Headings notes and reset arrow | Sidebar note, left-bar note, Boxed / Plain notes; reset resets headingStyle, sectionTitleCase, border width and colour, sectionIcons; toast with Undo. DesignPanelHeadings.jsx:79-85,142-152, DesignPanel.jsx:34,379. |
| EDIT-075 (editor-design-templates) | MISSING | Not drawn (probable home: More). | Date format | Keep select and text. Home: More; pane content not drawn. |
| EDIT-076 (editor-design-templates) | MISSING | Not drawn. | Lists: bullet style | Segment "Bullet / Dash / Circle / None" (bulletStyle). DesignPanelLists.jsx:5-29. |
| EDIT-077 (editor-design-templates) | MISSING | Not drawn. | Links: style | Segment Plain / Underline / Accent (linkStyle). DesignPanelLinks.jsx:5-28. |
| EDIT-078 (editor-design-templates) | MISSING | Not drawn. | Page numbers | Segment Off / "Page 1 of 2" (pageNumbers); resume only; margin grows to 10 mm. DesignPanelPageNumbers.jsx:9-23. |
| EDIT-079 (editor-design-templates) | MISSING | Not drawn. | Dates, Lists, Links, Page numbers reset arrows | As the other per-group resets. |
| EDIT-080 (editor-design-templates) | MISSING | Not drawn. | Per-section reset: toast with Undo | Keep every part (the Undo is the safety net of a one-click reset). |
| EDIT-082 (editor-design-templates) | MISSING | Not drawn (States draws a confirm dialog pattern). | Reset confirm (Yes, Reset / Cancel) | Keep the two-step confirm (inline or the States confirm dialog) and the sentence about what is kept. |
| EDIT-084 (editor-design-templates) | MISSING | ED / ES: Skills section is a collapsed row (count 3); its card is not drawn open; the section style popover (ES) has no Skills style or Bars. | Per-skill level | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Skills card with the per-skill level list (and the section style's Skills style Inline / Stacked / Bullet / Tags / Bars, SectionEditorCustomizer.jsx:64-118, which gives levels their meaning). |
| EDIT-085 (editor-design-templates) | MISSING | Not drawn (States has an Offline chip only). | Offline custom-font check | Keep the inline message in the Type pane. |
| EDIT-095 (editor-design-templates) | MISSING | Not drawn. | 1-Page Fit single flight and toast sharing | Keep exactly: disabled while fitting, one Undo at a time, no Undo after an interrupted fit. |
| EDIT-096 (editor-design-templates) | MISSING | Not drawn (Spacing pane not drawn). | Smart Page Fit Presets group | Keep the group, its three buttons and their hints (the hint is the only place the 9 pt floor is stated). |
| EDIT-097 (editor-design-templates) | MISSING | Not drawn. | Font size preset with no match | Keep: the segment shows no selection for a custom base, and Base remains editable below it. |
| EDIT-098 (editor-design-templates) | MISSING | Not drawn. | Add a Google Font: guards | Keep every guard (EDIT-056 lists the messages). |
| EDIT-099 (editor-design-templates) | MISSING | ED / ET / EP / MD: swatches drawn without names. | Colour preset names | Keep a name on every swatch (tooltip) and on every reset arrow; a swatch with no name tells nobody what it is. |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### editor-content

**5. ADDED BY REVIEW (independent review, 2026-10-06; every row below was added by review) 5a. Phone editor, account and c**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-153 | **Design drawer keeps its own open state**: The Design panel's Template open / collapsed state and the template gallery's open state live in the Editor (A12 / A2), so a trip to another tab keeps them; saved designs are read from every résumé. src/pages/Editor.jsx:45-52 | n/a | SAME | Keep across closing and reopening the drawer (extends EDIT-138; contents are the design-templates file's). |

#### editor-design-templates

**1. PARITY TABLE (one row per live function)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-001 | **Open / close Design**: Palette icon button (title "Design & Customize") in the editor mode bar toggles the Design tab; a second click returns to Resume. EditorHeader.jsx:140-147, Editor.jsx:159-174. | ED / ET / EP / ES / EL / EAts / EDraft: button "Design" (palette icon, text label) at the right of the stage toolbar above the paper; blue and pressed where the drawer is open (ED, EP, ET). The drawer itself is drawn only on ED, EP, ET. No close button on the drawer: the Design button is the toggle. | MOVED | Keep toggle semantics (second click closes) and one stable control (tests find button[title="Design & Customize"]). |
| EDIT-002 | **Design as a tab versus a docked drawer**: Design replaces the left panel content (tabs resume / design / coverletter / ats are exclusive, EditorTabContent), so the content form is hidden while designing; the page preview stays right. Editor.jsx:144-187. | ED: drawer docked right of the page (rail 64 px + pane, 356 px), content sidebar stays on the left; "one dock at a time" with the ATS drawer (README decision 6). | MOVED | None. Build: the drawer must also open for the cover-letter document (EL draws the Design button but NO drawer) because the look drives the letterhead; live shows the RESUME preview while Design is open even when entered from the letter (EditorPreviewPane.jsx:57-76, activeTab is design), the new stage keeps the open document. |
| EDIT-004 | **Template section open/closed memory (A12)**: Editor keeps whether Design > Template is collapsed so a trip to another tab keeps it. Editor.jsx:45-47,170-171; DesignPanelShared.jsx:116-120. | ED: accordions are gone; a six-group rail shows one group at a time. | RESTYLED | Remember the last rail group instead of per-section collapse (optional). |
| EDIT-005 | **Ten collapsible sections**: Template and Contact icons open by default; Colors, Typography, Spacing, Section Headings, Dates, Lists, Links, Page numbers closed; each header has a chevron and (except Template) a reset arrow. DesignPanel.jsx:206-387, DesignPanelShared.jsx:116-144. | ED: rail of six groups: Template, Color, Type, Spacing, Headings, More (only the Color pane is drawn). | MOVED | Home map for the build: Template; Color = Colors; Type = Typography; Spacing = Spacing + Page size; Headings = Section Headings; More = Contact icons, Dates, Lists, Links, Page numbers (inferred, see UNKNOWNS). |
| EDIT-012 | **Autosave of every Design change**: updateSetting / setTemplate / resetSettings / clearSettings write the open resume through patchActive (stamps updatedAt), saved to localStorage and cloud sync, coalesced. useResumeStore.js:471-515. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-013 | **Cross-tab merge of settings**: Another tab's save of the store is taken in (storage event, withOtherTabsSave); a résumé changed in both tabs is merged field by field (mergeResume, 3-way against the last-known copy): a settings key changed in one tab only is kept as changed, the same key in both goes to the later writer, a copy stamped over 10 s older than the base is ignored. useResumeStore.js:79-103,303-320, utils/mergeResume.js:139-148. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-014 | **Cloud sync of look settings and saved-design deletions**: settings (including myDesigns, templatePreset) sync with the resume; a deleted saved design leaves a { deleted: true } marker so every device drops it. useResumeDesignActions.js:55-71, templatePresets.js:198-211, test 18-cloud-sync-design-deletions. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-015 | **Saved designs stay out of the public link**: publicSnapshot drops myDesigns and templatePreset from a shared copy. utils/publicLink.js:53. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-040 | **Sidebar Layout: Two columns / Single - ATS-safe**: Only when the template is Sidebar: segment control (sidebarSingleColumn) and the explanation; switching re-checks Name and Job title colours (updateSetting). DesignPanel.jsx:229-246, useResumeStore.js:471-487. | Not drawn (Sidebar appears only as layout=side on Paper mocks). | MISSING | Keep the control in the Template pane when Sidebar is the template; the gallery's Sidebar Single column card also sets it. |
| EDIT-041 | **Sidebar column choices: Columns, Details, side width**: Columns Side column / Mixed; Details Left / Right / Top (not in Mixed); width 24-45 % stepper (Side column or Left column); help text. data-testid layout-columns, layout-details, layout-width. DesignPanelLayout.jsx:15-47, constants/layoutOptions.js:29-61. | Not drawn. | MISSING | Keep all three controls with the same range and the explanatory line, under Template, only on Sidebar two-column. |
| EDIT-042 | **Template notes (Academic, Compact, switch note, letterhead)**: Academic note, Compact note, templateSwitchNote ("Switching template keeps your content ..."), and the letterhead thumb with "The cover letter's header takes the template's look too." DesignPanel.jsx:247-258, DesignPanelTemplate.jsx:108-115, templates.js:130-138. | Not drawn (ET subtitle says content is kept). | MISSING | Keep the notes in the Template pane; they state what a switch keeps and changes. |
| EDIT-043 | **Template switch side effects**: withTemplate: the new template's heading style and title case (and Academic / Compact type and spacing), section Grids follow the template where unset, Name and Job title colours that would not read go back to default. Re-picking the same card does nothing. templateSwitch.js:19-43, useResumeStore.js:512-514. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-044 **DO NOT BUILD AS DRAWN** | **Accent colour presets**: Eight swatches: Blue #2563eb, Indigo #4f46e5, Violet #7c3aed, Rose #e11d48, Orange #ea580c, Teal #0d9488, Slate #475569, Black #0f172a; selected = dark border + scale; writes accentColor. DesignPanelColors.jsx:8-17,66-77. | ED / ET / EP Color pane: 7 round swatches (#2B59FF, #0F766E, #7C3AED, #B3261E, #C2410C, #1E3A8A, #111827) + a dashed + circle. | CHANGED | Different palette: a stored #2563eb (or any live preset) would match no drawn swatch. Keep the live eight (restyled as circles); the drawn hexes can be added. |
| EDIT-045 | **Custom accent colour + hex readout**: Colour input (coalesced: first step at once, then 200 ms after the last, 500 ms max; flush on blur or close) and the printed hex; swatch shows the colour the PDF prints (template default accent). DesignPanelShared.jsx:146-171, DesignPanelColors.jsx:41-44,79-83. | Dashed circle with + labelled "Custom color" (no hex readout drawn). | RESTYLED | Keep the native picker, the coalescing and a hex readout. |
| EDIT-046 **DO NOT BUILD AS DRAWN** | **Text colour presets + custom**: Four swatches (Near Black #1a1a1a, Dark Gray #374151, Slate #334155, Ink #1e293b), a Custom input and hex; selected shows the colour the PDF prints (template default). DesignPanelColors.jsx:19-24,86-104. | Pane "Text": three chips Black / Soft black / Gray (Black selected); no custom. | CHANGED | Keep the four presets and the custom colour input (three drawn chips are not enough). |
| EDIT-047 | **Header text colour (banded templates)**: Only where the header sits on a band (Modern, Banner, Sidebar column): colour input, hex, reset to white, explanatory note. DesignPanelColors.jsx:106-121. | Not drawn. | MISSING | Keep it in Color, shown only on those templates. |
| EDIT-048 **DO NOT BUILD AS DRAWN** | **Name colour and Job title colour**: Two rows: swatch picker, value ("Template default" or hex), reset arrow; reads the printed colour (white on Modern's banner). DesignPanelColors.jsx:123-144, test r4dsn-colour-swatches. | Pane "Accent is used on": toggles Job title and Name (Name off). | CHANGED | Toggles do not replace two free colour pickers. Keep both pickers and their reset; toggles are new (section 2). |
| EDIT-049 | **Sidebar background**: Only for the Sidebar column: 8 presets (Navy ... Crimson), custom input, hex, reset to #1e293b. DesignPanelColors.jsx:146-169. | Not drawn. | MISSING | Keep in Color, shown on Sidebar two-column. |
| EDIT-050 | **Colors section reset arrow**: Reset arrow resets accentColor, textColor, sidebarBg, headerTextColor, nameColor, jobTitleColor to the template's defaults; toast "Colors reset" with Undo (8 s). DesignPanel.jsx:31,171-193,261, DesignPanelShared.jsx:131-139. | Only the global "Reset design" is drawn. | MISSING | Keep a per-group reset with the Undo toast on each pane (Color, Type, Spacing, Headings, More's groups). |
| EDIT-051 | **Contact icon pack**: Five packs (Filled, Classic, Modern, Minimal, Bold) as cards with a preview row of the contact fields and "Selected"; hint text by template; picking writes iconSet and, where the style hides icons, contactStyle=icon. DesignPanel.jsx:263-302, utils/contactIcons.jsx:15-21, templates.js:258-272. | Not drawn (probable home: More). | MISSING | Keep the five packs, previews and hint. Home: More; pane content not drawn. |
| EDIT-052 | **Contact icon size (px)**: - / + stepper (9-20 px, default 11) in Contact icons, and the same iconSize in Typography > Contact Icons (SizeRow). DesignPanel.jsx:303-320, DesignPanelTypography.jsx:244. | Not drawn. | MISSING | Keep both entry points or one that writes iconSize (the hint says Typography too). |
| EDIT-053 | **Contact icons reset arrow**: Resets iconSet and iconSize only (not contactStyle, R2-090); toast with Undo. DesignPanel.jsx:36,263. | Not drawn. | MISSING | As the other per-group resets. |
| EDIT-054 | **Font family grid**: 13 fonts (Noto Sans, Inter, Open Sans, Fira Sans, IBM Plex Sans, Asap, Roboto, Lato, Source Sans 3, Georgia, Source Serif 4, PT Serif, Literata) each in its own face (preview from the PDF's font files); selected writes font, clears customFont, the Add-font box and any font error; unset shows Noto Sans; Georgia's tooltip says it prints with Gelasio; preview faces load lazily from the Fontsource files. DesignPanelTypography.jsx:118-153, utils/fonts.js:9-24,32-41. | Type rail item exists; pane not drawn. (Paper mocks only draw sans / serif.) | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Type pane with all 13 fonts. Home: Type; pane content not drawn. |
| EDIT-055 | **Your custom fonts chips (select / remove)**: Chips from this browser's list plus the resume's own custom font; click selects (customFont set, font cleared); x removes it and clears it from Font Family, Name Font and Heading Font. DesignPanelTypography.jsx:155-180. | Not drawn. | MISSING | Keep chips and remove. |
| EDIT-056 | **Add a Google Font**: Text field (placeholder "e.g. Nunito, Raleway, Poppins"), Enter or Add; button reads "Checking..." while checkFont asks Fontsource; ok -> chip + selected + remembered in localStorage cpwtcv_custom_fonts; error "was not found on Google Fonts" or the offline message (name kept); a slow check never overwrites a newer pick; a check finished after the panel closed still saves the chip. DesignPanelTypography.jsx:76-106,181-204, utils/fonts.js:46-69. | Not drawn. | MISSING | Keep field, states, both messages and the storage key. |
| EDIT-057 | **Name font and Heading font**: Two selects: "Same as text", the 13 fonts, custom fonts (and an unknown stored value). nameFont, headingFont. DesignPanelTypography.jsx:19-37,212-215. | Not drawn. | MISSING | Keep both selects. |
| EDIT-058 | **Font size Small / Normal / Large**: Segment: 10 / 11 / 12 pt base; setBase re-clamps the stored size deltas to their ranges. DesignPanelTypography.jsx:11-12,118-132,217-224. | Not drawn. | MISSING | Keep the three presets and the re-clamp. |
| EDIT-059 | **Typography scale rows**: Seven - / typed / + rows: Base 8-16 pt, Full Name (base-36), Section Title 6-24, Title Spacing -4..6 %, Entry Header 6-24, Job Title 6-24 (unset follows Entry Header), Contact Icons 9-20 px; typed value commits on Enter or blur, Esc cancels. DesignPanelTypography.jsx:226-247, DesignPanelShared.jsx:15-42, constants/designNumbers.js:53-79. | Not drawn. | MISSING | Keep all seven rows, ranges and typed-box rules (useTypedNumber). |
| EDIT-060 | **Word font stand-ins note and Sidebar type note**: "Word does not embed fonts: where they are not installed, X shows as Y ..." and the Sidebar side-column note. DesignPanelTypography.jsx:205-209,249-256. | Not drawn. | MISSING | Keep both notes. |
| EDIT-061 | **Typography reset arrow**: Resets font, sizes, deltas, customFont, iconSize, letter spacing, nameFont, headingFont; toast with Undo. DesignPanel.jsx:32,323. | Not drawn. | MISSING | As the other per-group resets. |
| EDIT-062 | **1-Page Fit**: Applies the tight preset at once, then prints the resume at each step of the ladder (down to 9 pt text) until it fits one page; button shows "Fitting...", tooltip names the min pt; stops silently if the resume or settings change; amber notice if still over or text shrank; toast "Spacing: 1-Page Fit" ("Margins, gaps, line height and text sizes replaced.") with Undo, but only when no edit stopped the run. First step is 10 / 14 mm margins, 10 / 5 px gaps, line 1.35, never looser than a number the résumé already has tighter; ladder steps 8/12, 6/10, 5/8 then base text down to 9 pt. DesignPanel.jsx:95-144,328-341, utils/pageFit.js:11-49. | Spacing rail item exists; pane not drawn. | MISSING | Keep the whole flow. Home: Spacing; pane content not drawn. |
| EDIT-063 | **Balanced and Spacious presets**: Each overwrites the five spacing numbers (14/18/16/8/1.5 and 20/22/22/12/1.65); toast with Undo; clears the fit notice. DesignPanel.jsx:42-45,151-162,342-357. | Not drawn. | MISSING | Keep both and their Undo. |
| EDIT-064 | **Fit notice**: Amber line under the presets; clears once settings change (only after the page has shown the fit's settings). Texts: "Fits on 1 page — text size 11 → 10 pt." (only when the base shrank), "Still N pages at the tightest spacing[ and X pt text (was Y pt)] — shorten the content to fit one page.", and on a measuring failure "Could not measure the pages: the tight spacing is applied, check the preview.". DesignPanel.jsx:119,136-144,359, utils/pageFit.js:62-70. | Not drawn. | MISSING | Keep all three messages. |
| EDIT-065 | **Line height**: Stepper 1.0-3.0 step 0.1 shown to two decimals, typed value accepts a comma, snaps off-step values (1.65 + -> 1.7). DesignPanel.jsx:362, DesignPanelShared.jsx:44-89, constants/spacingNumbers.js:16. | Not drawn. | MISSING | (live behaviour is the spec) Stepper 1.0-3.0 step 0.1 shown to two decimals, typed value accepts a comma, snaps off-step values (1.65 + -> 1.7). DesignPanel.jsx:362, DesignPanelShared.jsx:44-89, constants/spacingNumbers.js:16. |
| EDIT-066 | **Page size A4 / US Letter**: Segment "A4 - 210 x 297 mm" / "US Letter - 8.5 x 11 in" (pageSize; none = A4); PDF, preview and both Word files follow; kept by Reset and by Undo. DesignPanel.jsx:51-52,364-370, constants/pageSize.js. | Only the label "A4" in the stage toolbar; no control. | MISSING | Keep the control in Spacing (or More) and let the stage label follow it. |
| EDIT-067 | **Margins and gaps**: Top / Bottom and Left / Right margin 0-40 mm, Between Sections 0-60 px, Between Items 0-40 px; typed or - / +. DesignPanel.jsx:371-375. | Not drawn. | MISSING | Keep four rows. |
| EDIT-068 | **Spacing reset arrow**: Resets lineHeightValue, marginV, marginH, sectionGap, itemGap; toast with Undo. DesignPanel.jsx:33,325. | Not drawn. | MISSING | As the other per-group resets. |
| EDIT-069 | **Section title case**: ABC / Abc buttons (sectionTitleCase; unset shows the template's). DesignPanelHeadings.jsx:86-101. | Headings rail item; pane not drawn. | MISSING | Keep. Home: Headings; pane content not drawn. |
| EDIT-070 | **Section icons On / Off**: sectionIcons; a small icon before each title (PDF and preview only). DesignPanelHeadings.jsx:105-120. | Not drawn. | MISSING | (live behaviour is the spec) sectionIcons; a small icon before each title (PDF and preview only). DesignPanelHeadings.jsx:105-120. |
| EDIT-071 | **Border thickness**: - / typed / + in pt (1-8, Left bar shows 3-10); disabled with a note for Boxed and Plain. DesignPanelHeadings.jsx:25-44,122-152. | Not drawn. | MISSING | Keep with the notes. |
| EDIT-072 | **Border colour**: Colour input (disabled for Plain), value or "template" / "accent", reset arrow. DesignPanelHeadings.jsx:154-176. | Not drawn (ED's "Section headings and rules" toggle is the nearest, and is new). | MISSING | Keep the picker and reset. |
| EDIT-073 | **Heading style cards**: Six cards with a live mini-sample: Ruled, Left bar, Line after, Underline, Boxed, Plain (headingStyle; unset shows the template's). DesignPanelHeadings.jsx:10-17,178-196. | Not drawn. | MISSING | Keep all six with their samples. |
| EDIT-074 | **Headings notes and reset arrow**: Sidebar note, left-bar note, Boxed / Plain notes; reset resets headingStyle, sectionTitleCase, border width and colour, sectionIcons; toast with Undo. DesignPanelHeadings.jsx:79-85,142-152, DesignPanel.jsx:34,379. | Not drawn. | MISSING | (live behaviour is the spec) Sidebar note, left-bar note, Boxed / Plain notes; reset resets headingStyle, sectionTitleCase, border width and colour, sectionIcons; toast with Undo. DesignPanelHeadings.jsx:79-85,142-152, DesignPanel.jsx:34,379. |
| EDIT-075 | **Date format**: Select: As entered plus the formats, each shown on "Jan 2024"; "Every date on the resume, and the cover letter's date ...". DesignPanelDates.jsx:19-38, utils/dates.js:113. | Not drawn (probable home: More). | MISSING | Keep select and text. Home: More; pane content not drawn. |
| EDIT-076 | **Lists: bullet style**: Segment "Bullet / Dash / Circle / None" (bulletStyle). DesignPanelLists.jsx:5-29. | Not drawn. | MISSING | (live behaviour is the spec) Segment "Bullet / Dash / Circle / None" (bulletStyle). DesignPanelLists.jsx:5-29. |
| EDIT-077 | **Links: style**: Segment Plain / Underline / Accent (linkStyle). DesignPanelLinks.jsx:5-28. | Not drawn. | MISSING | (live behaviour is the spec) Segment Plain / Underline / Accent (linkStyle). DesignPanelLinks.jsx:5-28. |
| EDIT-078 | **Page numbers**: Segment Off / "Page 1 of 2" (pageNumbers); resume only; margin grows to 10 mm. DesignPanelPageNumbers.jsx:9-23. | Not drawn. | MISSING | (live behaviour is the spec) Segment Off / "Page 1 of 2" (pageNumbers); resume only; margin grows to 10 mm. DesignPanelPageNumbers.jsx:9-23. |
| EDIT-079 | **Dates, Lists, Links, Page numbers reset arrows**: Each resets dateFormat / bulletStyle / linkStyle / pageNumbers; toast with Undo. DesignPanel.jsx:37-40,381-387. | Not drawn. | MISSING | As the other per-group resets. |
| EDIT-080 | **Per-section reset: toast with Undo**: sectionReset(template, keys, settings): only keys that move; toast "<Section> reset" 8 s; Undo writes back only those keys (unset ones deleted via clearSettings); no toast when nothing moved; dismissed when the resume changes or the panel closes. DesignPanel.jsx:84,171-193, utils/defaultData.js:141-148, tests unit/r4-dux-14. | Not drawn. | MISSING | Keep every part (the Undo is the safety net of a one-click reset). |
| EDIT-081 | **Reset design button**: "Reset" button in an amber box titled "Reset Design Settings": "Resets font, colors, spacing, and layout settings to this template's ATS-safe defaults." DesignPanel.jsx:392-411. | ED / ET / EP drawer footer: text button "Reset design" (amber text), left of "Changes save as you go". | RESTYLED | None for the button. |
| EDIT-082 | **Reset confirm (Yes, Reset / Cancel)**: Click Reset -> text becomes "This will reset all design settings to this template's ATS-safe defaults. Resume content and uploaded contact icons are kept." with red "Yes, Reset" and "Cancel"; buttons wrap under the text in a narrow panel. Reset design has NO Undo notice (unlike the per-section resets): the confirm is its only guard. DesignPanel.jsx:70,397-409. | Not drawn (States draws a confirm dialog pattern). | MISSING | Keep the two-step confirm (inline or the States confirm dialog) and the sentence about what is kept. |
| EDIT-083 | **What Reset keeps**: resetSettings -> settingsAfterReset: template defaults, but keeps uploaded contact icons, Sidebar single column, the design the resume is on, page size and saved designs. utils/defaultData.js:120-136, useResumeStore.js:499-501. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-084 | **Per-skill level**: In a Skills group card, each skill named in the text gets a select "Level of X": Not set, Beginner, Basic, Intermediate, Advanced, Expert (1-5); stored in the group's skillLevels; drawn as a bar by the Bars style, as glyphs in Word, words in JSON Resume; Not set removes the key (and prints the 80 % bar every bar was); heading "Skill levels (drawn by the Bars style)"; dimmed when the skills field is hidden. A JSON Resume import reads synonyms and percentages into the five levels. SectionEditorLeafItems.jsx:7-52, constants/skillLevels.js:28-65. Also tracked in editor-content EDIT-068. | ED / ES: Skills section is a collapsed row (count 3); its card is not drawn open; the section style popover (ES) has no Skills style or Bars. | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the Skills card with the per-skill level list (and the section style's Skills style Inline / Stacked / Bullet / Tags / Bars, SectionEditorCustomizer.jsx:64-118, which gives levels their meaning). |
| EDIT-085 | **Offline custom-font check**: Offline or CDN down: "Could not check <font>: you seem to be offline, or Google Fonts is not answering ...", name kept; preview fonts fall back to system. DesignPanelTypography.jsx:93-99, utils/fontsource.js:71-81. | Not drawn (States has an Offline chip only). | MISSING | Keep the inline message in the Type pane. |
| EDIT-086 | **Signed-out and demo accounts**: No Design behaviour differs: look is local data until sign-in, then syncs with the resume. Sharing is gated elsewhere. Checked by review: utils/demoSeed.js and demoRestore.js touch no settings key; a demo restore swaps whole résumés (originals), so it returns their looks with them. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | - |
| EDIT-087 | **Number field rules in Design**: SizeRow / NumberRow / border box: write on Enter or blur only when different, Esc cancels, clamp to range, snap to step, decimal comma. DesignPanelShared.jsx:15-89, hooks/useTypedNumber.js:21-51. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | Keep in every new stepper. |
| EDIT-088 | **Narrow-panel layout rules**: Rows wrap, inputs shrink (min-w-0), Reset buttons go under the text below about 320 px (R4-DVIS-34/35); panel can be dragged to 240 px. | Drawer width is fixed on ED. | RESTYLED | Keep no-clipping at the drawer's narrowest width; tests 103-r4-dvis-35 and 104-r5-panels-colors-narrow will move with the drawer. |

**1B. ADDED BY REVIEW (rows the audit missed; same columns, IDs continue)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| EDIT-090 | **Design opens at its top**: A tab change puts the panel's scroll back to 0 (Design opens at Template, the Résumé at Collapse All); an edit keeps the scroll. EditorTabContent.jsx:11-17, tests 32-editor-tab-scroll. Added by review. | Not a screen (behaviour); each drawer pane starts at its top on the boards. | SAME | Keep: opening the drawer or switching rail group scrolls the pane to its top; an edit never does. |
| EDIT-095 | **1-Page Fit single flight and toast sharing**: The button is disabled and reads "Fitting…" while measuring; a second click is ignored (fitRun); 1-Page Fit, Balanced and Spacious all use the toast id spacing-preset, so the latest replaces the last and only its Undo survives; the 1-Page Fit Undo is not offered when an edit stopped the run; the fit measures the real PDF render and writes nothing if the résumé or template changed meanwhile. DesignPanel.jsx:73-134,151-162. Added by review. | Not drawn. | MISSING | Keep exactly: disabled while fitting, one Undo at a time, no Undo after an interrupted fit. |
| EDIT-096 | **Smart Page Fit Presets group**: The three presets sit in a blue box titled "Smart Page Fit Presets" with a sparkle icon; tooltips: 1-Page Fit "Fit more onto 1 page by tightening margins, gaps and line heights — and, if that is not enough, reducing the text size (down to 9 pt)", Balanced "Standard ATS-optimized balanced spacing", Spacious "Generous spacing for 2-page or senior resumes". DesignPanel.jsx:328-358. Added by review. | Not drawn (Spacing pane not drawn). | MISSING | Keep the group, its three buttons and their hints (the hint is the only place the 9 pt floor is stated). |
| EDIT-097 | **Font size preset with no match**: Small / Normal / Large (10 / 11 / 12 pt) highlights none when Base is another number (8, 9, 13 to 16, typed in Typography Scale). DesignPanelTypography.jsx:121,217-224. Added by review. | Not drawn. | MISSING | Keep: the segment shows no selection for a custom base, and Base remains editable below it. |
| EDIT-098 | **Add a Google Font: guards**: Add ignores an empty or blank box; Enter is ignored while a check runs and during IME composition; the field is aria-invalid with the error shown in a red alert and cleared on the next keystroke; the box clears on success only; choosing a built-in font also clears the box and the error; if the résumé or font changed during a slow check the new choice stands and the font is only remembered as a chip. DesignPanelTypography.jsx:71-106,142,181-204. Added by review. | Not drawn. | MISSING | Keep every guard (EDIT-056 lists the messages). |
| EDIT-099 | **Colour preset names**: Accent presets are titled Blue, Indigo, Violet, Rose, Orange, Teal, Slate, Black; text presets Near Black, Dark Gray, Slate, Ink; Sidebar Background Navy, Indigo, Dark, Ocean, Charcoal, Forest, Purple, Crimson (title attribute on each swatch); the Name / Job title swatches are titled "Name color" / "Job title color"; the reset arrows are titled "Reset to template default", "Reset to white", "Reset to accent color" or "Reset to the template's color". DesignPanelColors.jsx:8-35,72-73,92,117,139,153,165. Added by review. | ED / ET / EP / MD: swatches drawn without names. | MISSING | Keep a name on every swatch (tooltip) and on every reset arrow; a swatch with no name tells nobody what it is. |
| EDIT-100 | **What a saved design holds**: Save my design stores designLook(settings): every plain setting (string, boolean, finite number, null) except customContactIcons (the user's own images), pageSize, templatePreset and myDesigns; picking it copies the look onto the résumé after the same checks a résumé gets on load (numbers in range, colours as #rrggbb, font choices as text, layout choices and width) so an imported file cannot put a bad value on the page. templatePresets.js:98-107,155-160, useResumeDesignActions.js:30-53. Added by review. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | Keep the exclusions (a design must not carry the paper or the uploaded icons). |
| EDIT-101 | **Saved designs survive deleting a résumé**: Deleting a résumé that alone holds saved designs hands them to the most recently edited other résumé (a letter when none), a version on so the sync carries it; the picker never loses a design because its résumé went. hooks/useResumeSyncActions.js:58-80, templatePresets.js:218 (designsOnlyIn). Added by review. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | Keep when the Documents delete flow is rebuilt (tests 104-r5-hunt6-dash-delete-keeps-designs). |
| EDIT-102 | **Layout and skill levels in JSON Resume**: The Sidebar's Columns / Details / width travel in JSON Resume meta.columnLayout (only when not the default two / left / 38 %) and come back on import, clamped to 24-45 %; skill levels are exported as the five words and read back from words, synonyms, 1-5 and percentages. constants/layoutOptions.js:85-112, constants/skillLevels.js:44-65. Added by review. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | Keep when the export menu is rebuilt (editor-letter-ats-export owns the menu). |
| EDIT-103 | **Preview and PDF warm-up on a look change**: When the template, font, custom font, Name font or Heading font changes the editor pre-loads the PDF worker's fonts and template chunk (best effort) so Export PDF is instant. Editor.jsx:100-112. Added by review. | Not a screen (data or behaviour); the canvas does not touch it, the build must keep it. | SAME | Keep the same dependency list with the drawer. |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-001 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Accent is used on: Job title / Section headings and rules / Dates and links / Name (four toggles) | What live has instead: ED, ET, EP drawer Color pane. Live has no per-element accent switch: Name colour and Job title colour are free pickers, the heading rule colour is Border colour, links are Links > Accent. | Recommended handling: PARK. Do not build the toggles (they are a new capability and drop the free pickers, see the Name colour row). The same functions stay as live controls. Review note: the toggles map onto live defaults, which settles what they would mean: Job title ON = jobTitleColor unset (live prints it in the accent, templateSettings.js:31), Name OFF = nameColor unset (live prints it in the text colour, :30), Section headings and rules = sectionBorderColor unset (accent) and Dates and links = Links > Accent. The drawn default for Dates and links is ON, but live is Plain until the user picks Accent (DEFAULT_LINK_STYLE, linkStyle.js:8), so a drawn default must not change what a new résumé prints.
- NEW-002 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Use accent on headings (one toggle) | What live has instead: MD Color sheet. Not in the live app (heading colour follows the template and Heading style). | Recommended handling: PARK.
- NEW-003 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Text colour chips Black / Soft black / Gray | What live has instead: ED Color pane. Live has four presets plus a custom input. | Recommended handling: Not a new function but a new default set: keep the live four plus custom (row on Text colour).
- NEW-004 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Accent palette #2B59FF, #0F766E, #7C3AED, #B3261E, #C2410C, #1E3A8A, #111827 and a default accent #2B59FF on every Paper | What live has instead: ED, ET, EP, MD. Live default accent is the template's own (ATS default #374151) and the presets are #2563eb ... #0f172a. | Recommended handling: PARK as defaults. Build must not change the accent a new resume gets (a new résumé stores #374151 accent and #111111 text, defaultData.js:22-23; an unset Classic accent prints #2563eb, templateSettings.js:21).
- NEW-010 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Drawer footer "Changes save as you go" and "Applies to the whole resume" subtitle | What live has instead: ED, EP. Live autosaves and shows the status under the page; the Design look also drives the cover letter's letterhead. | Recommended handling: Copy only. "Whole resume" is incomplete (the cover letter takes the look too) but is not a behaviour.
- NEW-012 [editor-design-templates] **DO NOT BUILD AS DRAWN**: Drawn control or behaviour: Rail group names Color / Type / Spacing / Headings / More and the 6-group rail | What live has instead: ED, EP, ET. Regrouping of the same sections. | Recommended handling: Same functions under other names (kept; see the Ten collapsible sections row).

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (14): src/components/DesignPanel.jsx, src/components/DesignPanelColors.jsx, src/components/DesignPanelDates.jsx, src/components/DesignPanelHeadings.jsx, src/components/DesignPanelLayout.jsx, src/components/DesignPanelLinks.jsx, src/components/DesignPanelLists.jsx, src/components/DesignPanelPageNumbers.jsx, src/components/DesignPanelShared.jsx, src/components/DesignPanelTemplate.jsx, src/components/DesignPanelTypography.jsx, src/components/DesignDock.jsx, src/index.css, src/components/DesignRail.jsx. Labels scanned: 30 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 97; listed in this batch's "Existing tests to update": 11; NOT listed: 86.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL cypress/e2e/01-dashboard.cy.js: label "Delete"
- FAIL cypress/e2e/02-editor.cy.js: label "Template"
- FAIL cypress/e2e/06-job-tracker.cy.js: labels "Cancel", "Delete"
- FAIL cypress/e2e/07-regressions-store.cy.js: label "Delete"
- FAIL cypress/e2e/09-regressions-deletes.cy.js: labels "Cancel", "Delete"
- FAIL cypress/e2e/20-regressions-job-store.cy.js: label "Delete"
- FAIL cypress/e2e/23-editor-panels.cy.js: label "Template"
- FAIL cypress/e2e/26-mobile-layout.cy.js: label "Template"
- FAIL cypress/support/demoAccount.js: label "Delete"
- FAIL tests/pdf/10-section-headings.test.mjs: imports src/components/DesignPanel.jsx; imports src/components/DesignPanelHeadings.jsx; label "Section border thickness (pt)"
- FAIL tests/pdf/15-design-defaults.test.mjs: imports src/components/DesignPanelHeadings.jsx
- FAIL tests/pdf/16-saved-data-spacing.test.mjs: imports src/components/DesignPanel.jsx; imports src/components/DesignPanelShared.jsx; label "Spacing"
- FAIL tests/pdf/31-contact-fields.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/69-picker-ats-badge.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/index.css
- FAIL tests/pdf/73-typed-number-fields.test.mjs: imports src/components/DesignPanelShared.jsx
- FAIL tests/pdf/74-academic-letter.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/76-compact-letter.test.mjs: imports src/components/DesignPanel.jsx; imports src/components/DesignPanelHeadings.jsx
- FAIL tests/pdf/82-backlog-r4.test.mjs: label "Cancel"
- FAIL tests/pdf/82-issue-view-r4-03.test.mjs: label "Cancel"
- FAIL tests/pdf/82-issue-view-r4-05.test.mjs: label "Delete"
- FAIL tests/pdf/82-issue-view-r4-06.test.mjs: labels "Cancel", "Delete"
- FAIL tests/pdf/86-heading-border-colour.test.mjs: imports src/components/DesignPanelHeadings.jsx; imports src/components/DesignPanelShared.jsx
- FAIL tests/pdf/86-icon-reset-keeps-contact-style.test.mjs: imports src/components/DesignPanel.jsx; label "Contact icons"
- FAIL tests/pdf/86-icon-size-steps.test.mjs: imports src/components/DesignPanelShared.jsx; imports src/components/DesignPanelTypography.jsx
- FAIL tests/pdf/86-line-height-shown.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/86-sidebar-single-design-notes.test.mjs: imports src/components/DesignPanel.jsx; labels "Section Headings", "Typography"
- FAIL tests/pdf/86-template-reclick.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/91-design-presets.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/91-design-resets.test.mjs: imports src/components/DesignPanel.jsx; labels "Contact icons", "Spacing", "Section Headings" (+2)
- FAIL tests/pdf/91-design-typography.test.mjs: imports src/components/DesignPanel.jsx; labels "Typography", "Remove font", "e.g. Nunito, Raleway, Poppins"
- FAIL tests/pdf/91-page-fit.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/91-page-size-control.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/93-picker-cards.test.mjs: imports src/components/DesignPanel.jsx; label "Template"
- FAIL tests/pdf/93-picker-my-designs.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/93-picker-pictures.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/93-template-picker-copy.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/93-template-presets.test.mjs: imports src/components/DesignPanel.jsx
- FAIL tests/pdf/93-word-font-fallback.test.mjs: imports src/components/DesignPanelTypography.jsx; label "Typography"
- FAIL tests/pdf/94-look-section-icons.test.mjs: imports src/components/DesignPanelHeadings.jsx
- FAIL tests/pdf/96-dashboard.test.mjs: label "Delete"
- FAIL tests/pdf/97-colour-drag.test.mjs: imports src/components/DesignPanelColors.jsx; imports src/components/DesignPanelHeadings.jsx; labels "Custom accent color", "Custom text color", "Custom sidebar background" (+1)
- FAIL tests/pdf/99-cover-letters.test.mjs: label "Delete"
- FAIL tests/pdf/99-public-link.test.mjs: label "Delete"
- FAIL tests/pdf/101-r4-lo-19-section-border-box.test.mjs: imports src/components/DesignPanelHeadings.jsx; label "Section border thickness (pt)"
- FAIL tests/pdf/102-r4-dux-06-job-form-discard.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-06-one-discard-question.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-09-optimizer-backdrop-keeps-edits.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-10-unpublish-confirm.test.mjs: label "Cancel"
- FAIL tests/pdf/102-r4-dux-15-fit-size-notice.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/102-r4-dux-25-spacing-presets.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/102-r4-dux-30-design-name-replaces.test.mjs: imports src/components/DesignPanelTemplate.jsx; label "Save my design"
- FAIL tests/pdf/103-r4-dph-16-job-form-header-wraps.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dph-37-optimizer.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dph-38-optimizer.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-01-job-form-page-header.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-02-job-form-kit-buttons.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-06-settings-kit-controls.test.mjs: label "Cancel"
- FAIL tests/pdf/103-r4-dvis-30-section-options.test.mjs: label "Spacing"
- FAIL tests/pdf/103-r4-dvis-34-colors-template-default.test.mjs: imports src/components/DesignPanel.jsx; labels "Colors", "Template default"
- FAIL tests/pdf/103-r4-dvis-35-narrow-design-panel.test.mjs: imports src/components/DesignPanel.jsx; labels "Yes, Reset", "Cancel", "Typography"
- FAIL tests/pdf/104-r5-brd-sw-b-03-kanban-row-menu.test.mjs: label "Delete"
- FAIL tests/pdf/104-r5-dlg-generator-dialog.test.mjs: label "Cancel"
- FAIL tests/pdf/104-r5-opt-01-escape-keeps-edits.test.mjs: label "Cancel"
- FAIL tests/pdf/104-r5-panels-colors-narrow.test.mjs: imports src/components/DesignPanel.jsx; labels "Colors", "Template default", "Reset to template default"
- FAIL tests/pdf/105-r5-hunt5-typography-own-custom-font.test.mjs: imports src/components/DesignPanelTypography.jsx; label "Typography"
- FAIL tests/pdf/106-r5-hunt6-line-height-float-saved.test.mjs: imports src/components/DesignPanelShared.jsx
- FAIL tests/pdf/106-r5-hunt6-line-height-float.test.mjs: imports src/components/DesignPanelShared.jsx
- FAIL tests/pdf/107-r5-hunt6-comment-draft-kept.test.mjs: label "Cancel"
- FAIL tests/pdf/108-r5-hunt7-line-height-comma.test.mjs: imports src/components/DesignPanelShared.jsx
- FAIL tests/pdf/150-r2-147-col-layout-panel.test.mjs: imports src/components/DesignPanel.jsx; labels "Section Headings", "Typography"
- FAIL tests/pdf/r4cl-generator-letter-fields.test.mjs: label "Cancel"
- FAIL tests/pdf/r4dsn-colour-swatches.test.mjs: imports src/components/DesignPanelColors.jsx; labels "Custom accent color", "Template default"
- FAIL tests/pdf/r4dsn-custom-font-check.test.mjs: imports src/components/DesignPanel.jsx; labels "Typography", "e.g. Nunito, Raleway, Poppins"
- FAIL tests/pdf/r5hunt1-fit-keeps-tight-spacing.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/r5hunt2-fit-failed-size-notice.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/r5hunt6-fit-undo.test.mjs: imports src/components/DesignPanel.jsx; label "Spacing"
- FAIL tests/pdf/r5hunt9-line-height-half-step.test.mjs: imports src/components/DesignPanelShared.jsx
- FAIL tests/playwright/picker.spec.mjs: labels "Template", "Design name", "Delete" (+1)
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/r4-dux-14-section-reset-undo.unit.mjs: imports src/components/DesignPanel.jsx; label "Colors"
- FAIL tests/unit/touch-reveal.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-kit.unit.mjs: label "Delete"
- FAIL tests/unit/ui-overlays.unit.mjs: labels "Cancel", "Delete"

Hits already in the update list:

- cypress/e2e/04-design-left-bar.cy.js: labels "Section border thickness (pt)", "Section border color", "Section Headings"
- cypress/e2e/04-design.cy.js: labels "Spacing", "Yes, Reset", "Cancel" (+6)
- cypress/e2e/21-a11y.cy.js: labels "Spacing", "Colors", "Section Headings" (+1)
- tests/pdf/93-name-heading-font.test.mjs: imports src/components/DesignPanelTypography.jsx; label "Typography"
- tests/pdf/103-r4-dph-33-design-fields-touch-text.test.mjs: imports src/components/DesignPanel.jsx; labels "Spacing", "Colors", "Section border thickness (pt)" (+5)
- tests/pdf/parity/walker.mjs: imports src/components/DesignPanel.jsx
- tests/playwright/pdf-typography-spacing.spec.mjs: label "Spacing"
- tests/unit/page-margins.unit.mjs: imports src/components/DesignPanel.jsx
- tests/unit/picker-ui.unit.mjs: imports src/components/DesignPanel.jsx
- tests/unit/r4dsn-gallery-count.unit.mjs: imports src/components/DesignPanel.jsx
- tests/unit/spacing-numbers.unit.mjs: imports src/components/DesignPanel.jsx

## Progress log
(append: time, what, run ids, head sha)
