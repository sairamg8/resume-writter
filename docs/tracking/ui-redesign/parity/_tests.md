# Test blast radius of the UI-only rebuild (scout, 2026-10-06)

Written for the lead who plans the React rebuild. Read-only scan of `tests/`, `cypress/`, `src/`; nothing was run (tests run only on CI).
Parity rule: nothing here is OBSOLETE unless its subject is a UI part the tabless editor (README decision 6) removes; those are
marked REWRITE (keep the intent, change the subject), never "delete".

## 1. The suite in numbers

| Suite | Files | Drive UI? | Notes |
|---|---|---|---|
| `tests/pdf/*.test.mjs` | 680 (18 in `parity/`) | 327 import a `src/components` or `src/pages` module by path | the rest render PDFs / Word / stores: UI-independent |
| `tests/unit/*.unit.mjs` | 385 | 26 import a component or page | 7 more read `src/*.jsx` as text (section 8) |
| node helpers that mount for other tests | 8 | `resume-tab.mjs`, `103-r4-backlog-page.mjs`, `103-r4-board-settings-helpers.mjs`, `103-r4-optimizer-helpers.mjs`, `104-r5-brd-helpers.mjs`, `issue-view-page.mjs`, `preview-stub.mjs`, `100-r4-job-helpers.mjs` | 47 more test files reach UI only through them |
| Playwright `tests/playwright/*.spec.mjs` | 11 specs (+ `pw-helpers.js`, `parity-helpers.js`) | all drive the built app | 6 reach the editor tabs / Design panel |
| Cypress `cypress/e2e/*.cy.js` | 33 specs (+ `support/commands.js`, `selectors.js`) | all | 105 `visitEditor` calls in 23 specs |
| `tests/perf/*` | 5 files | `measure.mjs` drives the real editor in Chromium | not part of the CI gate |

Union that mounts or drives UI in node: about 400 of 1,065 node files (38%). The other ~665 stay green untouched by construction.
All counts below come from a script over the files (selector style, class-token assertions, tab/header references); a "tab" hit can be a
false positive (e.g. `unit/ui-kit.unit.mjs` says `tablist` for the kit's Tabs), so treat NEEDS UPDATE as "check first" for the 19 tab rows.

### How the node tests mount (all on `tests/pdf/fake-dom.mjs` + `harness.mjs`, no jsdom, no testing-library)
- No role+name queries at all. They walk `elements(container)` and select by: tag + `textContent`, `title`, `aria-label`, `placeholder`, `data-testid`
  (only 32 exist in `src/`), React props (`reactProps(el).onClick(...)` called directly), and Tailwind class tokens (`getAttribute('class')`, `split(/\s+/)`).
- Visible contract strings the node and Cypress tests share (a rename changes every row): title `Design & Customize` (19 references), `Back to dashboard` (7),
  `Section options` (6), `Rename resume` (4), `Split view` / `Editor only` / `Preview only` / `Drag to resize panel`, `Hide on resume` / `Hide summary from resume`,
  `Show|Hide <Field> on the cover letter`, `Delete entry`, `Delete application`, `Click to add to Skills`, `Download .txt`, aria-label `Section title`, `Header border thickness (pt)`, `Start Date year`.

## 2. Totals per area (node tests that import a UI module; 353 files + 47 helper-only)

STAYS = no class pin and no tab/header reference, still true if the leaf keeps its props and its labels.
WATCH = 1-2 class-token asserts. CLASS = 3+ Tailwind-token asserts or reads the `.jsx` text: breaks on any restyle of that element.
TAB = names `EditorTabContent`, `EditorModeBar`, `EditorHeader`, `activeTab`, `tablist`.

| Area | Files | STAYS | WATCH | NEEDS UPDATE: class | NEEDS UPDATE: tab/header | OBSOLETE | Phone-overlay (in these) |
|---|---|---|---|---|---|---|---|
| Editor shell + content | 105 | 73 | 7 | 12 | 13 | 0 (3 REWRITE) | 11 (8 update) |
| Design + templates | 56 | 43 | 3 | 10 | 0 | 0 | 5 (4) |
| Letter + ATS + export | 43 | 32 | 1 | 8 | 2 | 0 | 4 (4) |
| Shell + documents + import + public | 49 | 27 | 8 | 11 | 3 | 0 | 8 (4) |
| Applications (jobs) | 59 | 32 | 4 | 22 | 1 | 0 | 13 (9) |
| Projects (boards) | 41 | 28 | 2 | 11 | 0 | 0 | 9 (8) |
| Total | 353 | 235 | 25 | 74 | 19 | 0 | 50 (37) |

Reading it: a whole-app restyle puts about 93 of 353 mounting files (26%) in NEEDS UPDATE; the 25 WATCH rows go red only if that exact element is restyled.
By family: the `103-r4-dph-*` (36 files) and `103-r4-dvis-*` (29) defect pins are 56 of 65 in NEEDS UPDATE, plus `104-r5-dlg-*` 5 of 6 and `104-r5-panels-*`:
they exist to pin one class set (`min-w-0`, `flex-wrap`, `max-md:pb-16`, `truncate`, touch `text-base`), so a new design that is correct by other classes still fails them.
Update means: re-state the same user-visible defect guard on the new markup (see section 9), not weaken it.

### Per-area detail (what mounts, what it selects by, what moves)

| Area | Mounted by tests (files importing it) | Selects by | Redesign effect |
|---|---|---|---|
| Editor content | `EditorResumeTab` (via `resume-tab.mjs`: 112 files use it, 21 import it direct), `PersonalInfoEditor` 11 (+`...Header` 12, `...Photo` 8), `SectionEditor*` 10/11/13/8, `RichTextEditor` 16, `PdfPreview` 6, `EditorPreviewPane` 6 | button by text/`title`/`aria-label` (resume-tab `button()` accepts any of the three), `input[aria-label="Section title"]` -> `.parentNode.parentNode` = card, entry header = `div.cursor-pointer.select-none`, entry name = `span.truncate`, props `item`, `updatePersonal` | STAYS if `EditorResumeTab` keeps props `{resume, store, personalOpen, setPersonalOpen, allExpanded, forceOpenKey, toggleAllSections, addSectionOpen, setAddSectionOpen}` and those three structural hooks. Restyling the card header or section-title box breaks 112 files at once: keep the hooks or change only `resume-tab.mjs` |
| Editor shell | `Editor` 4, `EditorHeader` 9, `EditorTabContent` 3, `AuthBar` 5 | `EditorModeBar` tab buttons by label (`Resume`, `Cover Letter`, `ATS Check`), `?tab=coverletter` navigation, `button[title=Rename resume]`, `data-testid=sync-status` | the tabs go: `173`, `32-editor-tab-scroll`, `103-dvis-12`, `103-dph-31` are red until rewritten |
| Design + templates | `DesignPanel` 37 files, `DesignPanelShared` 8, `...Headings` 7, `...Typography` 4, `TemplateGallery` 3, `StarterTemplateModal` 2, `HeaderIconPickerModal` 3, `HeaderSpacingControls` 2 | labels, `aria-label="... (px)"` spacing inputs, `data-testid` `template-<id>`, `gallery-<id>`, `design-design_*`, `layout-*`, `header-spacing`, `starter-*` | STAYS for 43; 10 pin classes or read source (`93-picker-cards`, `page-margins.unit`, `spacing-numbers.unit`) |
| Letter / ATS / export | `CoverLetterPanel` 14, `AtsCheckerPanel` 17, `CoverLetterGeneratorModal` 6, `NewLetterModal` 2, `ExportDropdown` 6, `BulletOptimizerModal` 12 | labels, `Export PDF` / `Export Cover Letter PDF`, `button[title=Download .txt]`, `title=Click to add to Skills`, Undo toast | the ATS check becomes a right drawer: panel tests STAY (panel mounted directly); `ExportDropdown` tests (`53`, `78`, `102-dux-17`) read `activeTab`/`EditorHeader` |
| Shell + documents + import + public | `Dashboard` 17, `ResumeCard` 10, `TopBar` 6, `WorkspaceLayout` 3, `NewResume` 5, `PublicResume` 2, `PrivacyPage` 4, `TermsPage` 2, `ui/Toast` 17, `ui/index` 14 | `.group.bg-white.rounded-2xl` card (Cypress), titles, `Sign in`, search input by role/placeholder | Dashboard/TopBar are the most visibly redrawn; 11 class pins |
| Applications | `pages/JobForm` 16, `JobDetail` 10, `JobTracker` 10, `OverviewTab` 9, `TasksTab` 7, `Pipeline` 6, `ListView`/`KanbanView`/`JobSummary` 5 | text, `title=Delete application`, class tokens in 22 files | 22 class pins, mostly `103-r4-dvis-*` form-kit pins |
| Projects | `pages/Board` 18, `BoardSettings` 8, `Backlog` 6, `ProjectList`/`ProjectCalendar` 4, `ProjectTimeline` 3, `Boards` 3, `CreateIssueDialog` 4 | `aria-roledescription="draggable"`, `Status of HOME-1: To Do`, `Epic: Garden makeover`, class tokens in 11 files | 11 class pins; dnd tests (`board-drop*.unit`, `172-board-sensors-stable`) are logic: STAY |

## 3. Cypress (33 specs): the flows that change

Shared hooks (`cypress/support/`): `openExportMenu` = `cy.contains('button','Export')` and `exportFile` clicks an entry by its exact label: 47 uses in 14 specs.
`visitEditor` (105 uses, 23 specs) waits for `Export` visible. `preview` = `#resume-preview` (63 uses, 23 specs); `previewPages` = `div.bg-white.shadow-2xl`
(5 uses, 2 specs). `selectors.js`: `CARD` `.group.bg-white.rounded-2xl` and `CARD_RENAME` (64 uses, 10 specs), `ENTRY_HEADER` (3 specs), `IMPORT_INPUT`, `SYNC_STATUS`.
Fix those 6 constants and the 4 commands in one file each and most Dashboard/export specs follow.

| Spec | Flow | Selectors that change | Class |
|---|---|---|---|
| 00-smoke, 03-export, 08, 09, 10, 12, 19, 20-shape, 20-unsaved, 11-demo x2, 06-job-tracker, 28 (bullet optimiser button by `title`) | dashboard, export per template, store, deletes, jobs | `CARD`, `Export` button, preview ids | STAYS (via `selectors.js` / `commands.js` if the card and Export names move) |
| 01-dashboard | cards, create, rename, delete, 4 Cover Letter card refs | `CARD`, `Cover Letter` text on a card | NEEDS UPDATE (dashboard redraw) |
| 02-editor | content edits; `Cover Letter` (l.128), `Design & Customize` (l.131, 134); `Personal Info` span, `Hide on resume` | tab click, Design button | NEEDS UPDATE |
| 04-design, 04-design-left-bar | 24 + 2 design cases; 27 `Design` refs, `data-testid=template-*`, `aria-label` thickness inputs | Design opener, panel scroll box | NEEDS UPDATE (opener only; controls keep `aria-label`) |
| 05-cover-letter | 13 cases; clicks `Design & Customize` then `Cover Letter` | both tabs | NEEDS UPDATE |
| 07-regressions-store | one case opens Design (l.178), asserts `data-testid=template-<id>` has `border-blue-500` | opener + a class | NEEDS UPDATE (1 case) |
| 13-regressions-fonts, 25-date-format, 30-starters-and-design | `button[title="Design & Customize"]` first | opener | NEEDS UPDATE (opener) |
| 14-contacts | 15 cases; `Cover Letter`/`Resume` tabs 8 times, `Show|Hide Phone on the cover letter` titles | tabs | NEEDS UPDATE |
| 16-headers, 17-section-options | Header Customization, `Section options` -> `Section Options` panel; export checks | where Header look and Section options open | NEEDS UPDATE if those move to a drawer (README lists both) |
| 22-regressions-letters | `Cover Letter` tab l.36 | tab | NEEDS UPDATE |
| 23-editor-panels | `title=Drag to resize panel`, tab trip (Design -> letter, l.59-101), `Split view` / `Editor only` | handle, tabs, layout toggle | NEEDS UPDATE (the "survives a trip" case is REWRITE: Personal Info stays closed across the new view switches) |
| 26-mobile-layout | 375x812: `Back to dashboard` outerWidth, tab box scroll, Design and `ATS Check` on a phone | tab box class, tabs, layout titles | NEEDS UPDATE (phone) |
| 27-ats-checker | `ATS Check` tab (16 refs, 4 cases), `Click to add to Skills`, `Download .txt` | tab -> drawer | NEEDS UPDATE |
| 21-a11y | Rename, `Section options`, list view toggle (deferred domain) | titles | WATCH |
| 24-image-uploads, 29-exports-imports, 16 | `data-testid` photo notes, `Export` menu, CSV button title | export labels | STAYS if export labels kept |

Totals: 33 specs: 15 NEEDS UPDATE (the README's 11 + 02, 07, 22 and 01), 3 WATCH, 15 STAYS through the two support files. 0 OBSOLETE.
Selector mix across Cypress: 84 `[title=...]`, 61 `[role=...]`, 22 `[aria-label]`, 15 `data-testid`, 63 `cy.contains` on visible text; only 3 raw class selectors in specs (the rest of the class use is in `selectors.js`).

## 4. Playwright (11 specs)

| Spec | What | Selectors | Class |
|---|---|---|---|
| `pw-helpers.openDesignPanel` | `button[title="Design & Customize"]`, then `text=Template` | opener + first heading | NEEDS UPDATE (one function fixes 5 files) |
| `parity-ui-controls` (2 tests) | clicks every design control in the browser, tags with `data-pw-ctl`; opens `button:has-text("Header Customization")`, `button:has(p:text-is("Photo"))`, `button[title="Section options"]`, `Customize layout`; `data-testid` `layout-details|width|columns`; throws if `div.fixed.inset-0.z-50` appears | text, class `fixed inset-0 z-50` | NEEDS UPDATE (riskiest Playwright spec) |
| `pdf-templates` (14), `pdf-typography-spacing` (4) | Design opener; `text=Academic brings its own type and spacing` | note text | NEEDS UPDATE |
| `picker` (6) | role+name: `Template`, `Cover Letter`, `Two columns`, `Compact`, `All`, `Save my design`, `Delete design Violet`; `data-testid` `gallery-*`, `design-design_*`; `role=status` Undo | role+name | NEEDS UPDATE (the `Template` button and `Cover Letter` tab); the gallery rows STAY |
| `bullet-optimizer`, `pdf-cover-letter` (`visitEditor` with `tab: 'coverletter'`, `Apply to Cover Letter`), `pdf-colors`, `pdf-header-contacts`, `pdf-headings-sections`, `pdf-worker`, `parity-preview-download` | export + read PDF | `getByRole('button',{name:'Export PDF'})`, URL tab param | STAYS if the `?tab=coverletter` deep link and Export names are kept |
| `perf-gate-b` | `[data-preview-status]`, `data-preview-pages`, `[data-placeholder^="Brief professional summary"]` | preview hooks | STAYS if those attributes survive |

Totals: 11 specs: 4 NEEDS UPDATE (`parity-ui-controls`, `pdf-templates`, `pdf-typography-spacing`, `picker`), 7 STAYS. The 4-5 "Design" users all go through `pw-helpers`.
Deep link: `?tab=coverletter` appears 33 times and `?tab=design` 5 times across 27 files (Cypress, Playwright `visitEditor`, node tests `89-editor-tab-link`, `99-cover-letters`, `81-job-resume-pickers`, `105-r5-hunt2`): either keep the URL contract (the cheapest way) or update about 27 files.

## 5. The parity walker (`tests/pdf/parity/`, 18 tests + 9 helpers)

What it needs to keep walking every control (`walker.mjs`, `panels.mjs`):
1. `DesignPanel` (default export), `PersonalInfoEditor` (default), `SectionCustomizer` (named, from `SectionEditorCustomizer.jsx`), mounted directly with these props:
   Design `{resume, updateSetting, setTemplate(value, preset), resetSettings}`; Personal `{personal, settings, template, coverLetter, updatePersonal, toggleFieldVisibility, updateSetting, clearSettings}`; Section `{section, template, settings, updateSectionSettings, ...}`.
2. A control is any `BUTTON` / `INPUT` / `SELECT` with a React `onClick` / `onChange` prop (it calls the prop; it never clicks the DOM) and not `disabled`.
3. It finds panels folded away by clicking buttons that write nothing and add elements ("open everything"), then re-walks one step deep. A new `group`/`view` prop must default to everything open, or controls vanish from the matrix and `00-registry` / `01-offered` fail.
4. Signature = `TAG|type|name|data-*` where name = text (first 40 chars), else `aria-label`, `title`, `aria-labelledby`; `data-*` of the 3 nearest ancestors (`data-gap` tells two "Name to title" rows apart). Renaming a control is safe; two controls ending with the same name and no distinguishing `data-*` collapse into one.
5. A reset is recognised by `/reset|↺/i` on the name: a renamed "Reset" button (say "Start over") is then counted as a normal control and fails the matrix.
6. `type="file"` is skipped; `type="color"` gets a probe; number inputs need `min`/`max` attributes (clamp probes -9999 / 99999).
7. A dialog is walked because the kit `Dialog` portals into `document.body`; `patchFakeDom` supplies focus and selectors for the focus trap. A custom drawer that uses its own portal must be reachable in the same way.
8. It does not select by class, role or layout, so a pure restyle is invisible to it.
Class: STAYS, conditional on points 1, 3, 5. Risk: medium (any `props` rename of the three panels breaks `walk-cache.mjs` for all 18 tests).
`parity-ui-controls.spec.mjs` is the browser twin and has the harder constraints (section 4).

## 6. Perf, render-count and start-up tests

| Test | What it pins | What a rebuild must keep | Class / risk |
|---|---|---|---|
| `tests/pdf/165-perf4-editor-render-count` (282 lines) | mounts the real `EditorResumeTab` over the real `useAppStore` (fake DOM, React devtools hook counts fibers per commit); labels by prop shape: `props.item.id` = entry, fiber `key` = section id, `typeof props.updatePersonal === 'function'` = `personal`; opens entries by `div.cursor-pointer.select-none` (must be exactly 6) | `EditorResumeTab` props; `PersonalInfoEditor` memo with `updatePersonal`; section/entry keys; the entry-header class pair; `useStableActions` | STAYS if kept; HIGH risk: one redesign of the section card or an unmemoised wrapper (new context, new inline prop) fails "no other job and no other section renders" |
| `tests/pdf/173-editor-header-render-count` (872 lines) | mounts the real `Editor` page under a `MemoryRouter` with `App.jsx`'s new-object-every-render wiring; finds `EditorHeader`, `EditorAlerts`, `EditorModeBar`, `EditorTabContent`, `EditorPreviewPane` by import identity; asserts a keystroke renders none of header / alerts / mode bar / Export menu / account bar; `tabButton(label)`, `?tab=coverletter`, `title=Rename resume`, `data-testid=sync-status`; no router hook or `<Link>` allowed under the memoised header (LESSON in HANDOFF) | NEEDS UPDATE (REWRITE): the mode bar (tab bar) disappears; keep the intent: "the new top bar, the Resume/Cover letter switch, the ATS chip and the account menu render zero times per keystroke". The exports `EditorHeader`/`EditorAlerts`/`EditorPreviewPane` names are what it finds: keep them or edit the test's `probe.parts` |
| `tests/pdf/71-startup-chunks` (118 lines) | builds with Vite; start-up path (entry + static imports) under 500 kB per chunk and 1,100 kB total ("0.2 kB to spare on master" per README); no lazy library (react-pdf, docx, pdf.js, firebase, ...) in start-up; the pages regex `Editor|NewResume|JobTracker|JobDetail|JobForm|Boards|Board|Backlog|BoardSettings|YourWork|ProjectSummary|ProjectList|ProjectCalendar|ProjectTimeline|PublicResume` must be lazy chunks (at least 5) | all new code inside lazy Editor/page chunks; any touch of `src/components/ui/*` or shell files adds start-up bytes; a NEW page file not in that regex (e.g. a `Drawer` page) is not policed, a renamed one silently leaves the list | STAYS only by discipline; VERY HIGH risk (margin is 0.2 kB; the shell redraw (TopBar, Sidebar, workspace layout) is on the start-up path) |
| `71-preview-hidden-builds`, `71-preview-typing-debounce`, `71-startup-public-link-lazy`, `122-startup-json-resume-export-lazy` | preview build scheduling; module-level lazy checks via `startup-modules.mjs` (static import walk from `src/main.jsx`) | no static import of public-link / JSON Resume export code in the shell | STAYS; `71-preview-hidden-builds` mounts `EditorPreviewPane` (TAB flag) |
| `tests/pdf/115-r2-142-perf5-*`, `172-board-sensors-stable`, `175-plain-field-linear`, `174-preview-pdfjs-watchdog` | counts, stable props, work counts | per component, not per layout | STAYS |
| `tests/perf/` (`measure.mjs`, 5 files; CI `perf` input only) | Chromium on built `./dist`: `#/resume/<id>`, `[contenteditable="true"]` filtered by summary text, `#resume-preview` text, expands every `div.cursor-pointer.select-none` | those 3 hooks | STAYS if kept; budgets: `browser.keystrokeToPreview` max 3000 ms (target 600), `browser.firstPreview` max 20000 ms |

## 7. The ten riskiest (in order)

| # | Item | Why | Class |
|---|---|---|---|
| 1 | `tests/pdf/resume-tab.mjs` + 112 files that use it (and `165`) | one helper: `EditorResumeTab` prop contract, `aria-label="Section title"` parent.parent card, `span.truncate` entry names, `div.cursor-pointer.select-none` | STAYS only if the hooks survive; else one helper edit |
| 2 | `tests/pdf/173-editor-header-render-count` (872 lines) | mounts the whole Editor, finds 5 parts by import, depends on the tab bar and the `?tab=` URL | REWRITE |
| 3 | `tests/pdf/71-startup-chunks` | 0.2 kB of start-up headroom; the shell redraw lands on the start-up path | STAYS by discipline |
| 4 | Cypress `support/commands.js` + `selectors.js` | `Export` button + exact entry labels (47 uses), `visitEditor` (105), `CARD` class (64) | one-file update |
| 5 | `button[title="Design & Customize"]` (19 refs): 11 Cypress specs, `pw-helpers.openDesignPanel`, 4 more Playwright specs | the Design tab opener is replaced by the new design entry | NEEDS UPDATE |
| 6 | Resume / Cover Letter / ATS Check tab clicks: 7 Cypress specs (17 uses), `picker`, 4 node tests (`32-editor-tab-scroll`, `103-dvis-12`, `103-dph-31`, `173`), 27 files using `?tab=` | tabs removed; `?tab=coverletter` 33 times | REWRITE / keep URL |
| 7 | the 56 class-pin files of the `103-r4-dph|dvis-*` families | each pins a class set of one old element | NEEDS UPDATE, restate the defect |
| 8 | Parity walker (`panels.mjs`, `walker.mjs`, 18 tests) and `parity-ui-controls.spec` | prop contracts of 3 panels; `Reset` naming; default-open view prop; `div.fixed.inset-0.z-50` dialog check; `Header Customization` / `Customize layout` text | STAYS if section 5 points hold |
| 9 | Cypress `26-mobile-layout` and `23-editor-panels`, node `103-dph-31` | the tab box (`overflow-y-auto overflow-x-hidden`, `max-md:pb-16`), panel resize handle title, layout toggle titles | NEEDS UPDATE |
| 10 | Whole-source scanners: `tests/unit/cursor-pointer.unit` (every `onClick` on a div/span needs `cursor-pointer` or a role), `dead-code.unit` (every `src` module reachable from `main.jsx`), `knowledge-docs.unit` (every `src/` path in `docs/knowledge/*.md` must exist), `touch-reveal.unit`, `24-private-data` | they scan ALL of `src/`: new or renamed files must obey them, no failure from a restyle alone | NEW RULES to build with |

## 8. Tests that read `src/*.jsx` as text (break on a refactor, not on behaviour)

`102-r4-dux-06-job-form-discard`, `78-letter-export-menu` (reads `EditorHeader.jsx`), `92-font-fallback-notice`, `93-picker-cards`,
`unit/page-margins`, `unit/spacing-numbers`, `unit/r5-hunt10-review-current-hidden-end`; also `unit/photo-options`, `unit/touch-reveal`,
`unit/board-scroll-snap`, `31-contact-fields`, `27-header-spacing`, `56-ats-layout-fix-buttons`, `81-job-tracker-ui`, `93-name-heading-font`, `14-ids`.
They are the most fragile kind: they fail for moved code even when the UI is identical. Class: NEEDS UPDATE if the file or text moves.

## 9. How to write tests so the next redesign does not break them

1. Stable hooks. Add a `data-testid` to every region and every control family a test needs, named by function not look: `editor-sidebar`, `editor-switch-resume|letter`,
   `ats-chip`, `ats-drawer`, `design-drawer`, `export-menu`, `account-menu`, `section-card-<id>`, `entry-header`, `entry-title`, `section-title-input`.
   `resume-tab.mjs` and `165` should move from `div.cursor-pointer.select-none` and `span.truncate` to `[data-testid=entry-header]` / `entry-title` first (a no-visual change that unlocks every later restyle).
   Keep the existing 32 test ids and the preview attributes (`#resume-preview`, `data-preview-status`, `data-preview-pages`, `[contenteditable]`, `data-placeholder`).
2. Query by role + accessible name where a real role exists (`button` + name, `dialog`, `status`, `menuitem`): `picker.spec.mjs` already does this and is the model; the node
   fake DOM has no role engine, so add a 10-line `byRole(container, role, name)` to `fake-dom.mjs` that matches tag/`role` plus `textContent|aria-label|title` (resume-tab's `button()` already does the second half).
3. Never assert Tailwind classes to prove a layout. Assert behaviour (does not overflow, still reachable) in Playwright with `boundingBox()` / `scrollWidth <= clientWidth` at 375 and 1440
   (the node fake DOM has no layout; the `dph`/`dvis` pins were a stand-in for that). Where a class pin is the only option, pin the invariant in one shared const (e.g. `export const TOUCH_TEXT = 'text-base'`) imported by the component and the test.
4. Selectors in one place: `cypress/support/selectors.js` and a new `tests/pdf/ui-selectors.mjs` (title strings, test ids, the tab/switch names); specs import them.
   Labels the tests share (`Design & Customize`, `Export`, `Section options`) get one const in `src/constants/uiLabels.js` used by both the component and the tests, so a rename is one edit and no test goes stale.
5. Open things through a helper (`openDesign()`, `openAts()`, `switchTo('letter')`) defined once per runner: Cypress command, Playwright `pw-helpers`, node `resume-tab.mjs`. The tabless editor then changes three helpers, not 40 specs.
6. Keep leaf panels testable alone (the BUILD CONSTRAINT already says so) and add one layout-free "reachability" test per drawer or menu: opener found by role+name, control found inside the region by test id.

### What makes a test fail without the fix for a pure UI move (CI `failfirst` undoes the commit's `src/` change, the test must fail, then pass)
A move has no new behaviour, so the test must pin the new place, not the old one, so it fails before:
- Reachability in the new region: open via the new opener (role+name), then assert the control is inside `[data-testid=<new region>]`. Before the commit the region does not exist: the lookup throws.
- Negative twin: assert the old path is gone (`Cover Letter` tab button not in the DOM; `?tab=coverletter` still lands on the letter view). Before the commit the old tab is still there: the assertion fails.
- Same write, new place: click the moved control, assert the store action receives the same (key, value) as before (the walker's `registry` already records these: add the control's registry id). This keeps the parity row honest (MOVED, not CHANGED).
- Count of controls: for a regrouped panel, assert the union of controls across the new groups equals the old list (a hard-coded number from `walks()` in `tests/pdf/parity/walk-cache.mjs`), so nothing is dropped.
- Render counts (`165`, `173`) are the other kind that fails without the fix: a new top bar that takes an unstable prop renders per keystroke; the existing count tests are the fail-first proof for it.

## 10. What I could not determine
- Exactly which of the 19 TAB-flagged node files are false positives: the flag matches the names `EditorHeader`/`EditorTabContent`/`activeTab` anywhere; each needs a human read (17 of the 19 mount `EditorHeader` or `EditorTabContent` directly, so they break only if those components are split or lose a prop).
- Whether the 25 WATCH rows and 235 STAYS rows hold: they select by visible text and titles; the new design renames some labels (parity allows renames), and no scan can know which. The shared label strings in section 1 are the list to compare with the canvas.
- Phone-overlay counts use file name `dph|phone|mobile|touch|narrow` and `useIsMobile` / `375`: a lower bound.
- Cypress/Playwright class: judged from the selectors and flows I read (04, 05, 14, 23, 26, 27, 30, picker, parity-ui-controls, pw-helpers); 16, 17, 21, 24, 28, 29 were judged from grep counts, not full reads.
- Whether `Editor.jsx` keeps `?tab=` as the way to open the letter / design (a product call); it decides whether about 27 files change.
- Test runtime or sharding effects of new tests (CI sharding is by file; not measured).
