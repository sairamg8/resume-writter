# UI rebuild: the plan (draft for the owner)

Source: `plan-work/final.json` (three planners, three judges, a synthesis, a coverage critic and two skeptics, then a revision). Rule: PARITY-RULE.md (UI only, every function stays). Cadence: RUN-STATE.md (3 hours on, 2 hours off, one batch at a time).

**24 batches, about 70.5 agent-hours, estimated 26 work windows** (at 5 hours per window cycle that is about 5.4 days of calendar time). Coverage: CLEAN: every audited live function (1,223 rows) is owned by exactly one batch; all 524 CHANGED/MISSING rows have an owner (batches/coverage-findings.md, coverage-check.md).

## Principles

- Spine = FOUNDATION-FIRST (best on parity safety and feasibility), re-ordered so the editor frame comes right after the start-up shell (the owner sees the core product early and the biggest test churn is found early). HONEST SIZING: a batch over about 80 parity rows, or one with heavy test churn, is a scheduled pair of sub-batches that each end at a green gate: B5a/B5b, B8a/B8b, B9a/B9b, B10a/B10b, B12a/B12b, B13a/B13b, B14a/B14b (B3/B4, B6/B7 and B15/B16 were already pairs); B3 is planned as TWO windows with a checkpoint. 24 batches, about 26 windows (a window is 3 h of work plus 2 h rest, so about 5 days wall time). The one-batch-at-a-time rule is the owner's; whether Applications/Projects…
- Parity rule first: UI only, every live function stays, new capabilities are PARKED. Ownership is by area file plus ID range; cite rows as '<file>: <ID>' (EDIT-/NEW- exist in editor-content.md and editor-design-templates.md; 'D-nn' is the DRAWN BUT NOT table of shell-docs, projects, mobile; 'Nn' is applications section 2; ELAE NEW-nn two digits). CATCH-ALL per area (the owning batch also takes any row added by review or later): editor-content -> B6, editor-design-templates -> B8a, editor-letter-ats-export -> B10a, shell-docs -> B5a, applications -> B13a, projects -> B15, mobile -> B17. Where an area is split across sub-batches the catch-all goes to the FIRST one; its lead may hand a catch-al…
- The parity file's Fix column is the build spec and the live app wins where board and app differ. tools/brief.mjs (written in B1) turns each batch's rows (ID, live behaviour, status, fix) into docs/tracking/ui-redesign/batches/B<n>.md; every CHANGED row is flagged DO NOT BUILD AS DRAWN and the brief opens with a 'layout deltas' table (CHANGED and MISSING rows: how the drawn layout bends to hold the live function, conservative option = live control kept one menu or drawer away; EDIT-089 is listed there as 'live rule kept, owner call'). A Fix that begins 'Draw ...' (137 rows) is a canvas instruction and is printed as 'Build from the live behaviour; no board, or the board differs: design from t…
- Phone is built with its surface (each batch owns the desktop and phone rows of its screens). STANDING PHONE GUARD in every batch gate from B3 on: cypress/e2e/26-mobile-layout.cy.js plus tests/playwright/phone-reach.spec.mjs run in the single targeted dispatch. phone-reach runs with hasTouch and isMobile (hover: none) and reaches every control by tap only, never hover(), because the default Desktop Chrome project keeps hover and would hide hover-only controls; one case is proven by a mutation commit. Breakpoints 768 px (useIsMobile) and Tailwind sm/md/lg; the 768-1100 px band has no board and gets one rule (the editor dock overlays the stage below 1100 px, and the sidebar width is clamped wh…
- Start-up path has about 0 kB spare (71-startup-chunks, cap 1,100 kB of minified JS; CSS and index.html are free). BEFORE any B1 code the lead dispatches tests=71-startup-chunks and perf: startup once (raw and gzip margins; tests/perf/budgets.mjs also holds startup.gzip 450 kB and startup.largest 500 kB) and the owner is asked NOW to confirm the fallback order (default: lazy parts, then lazy jsonResumeImport, then lazy Dashboard parts, cap raise last). B1 creates headroom FIRST (lazy NewLetterModal+Dialog closure, lazy CareerHistoryPanel; reserve offset: lazy jsonResumeImport with 122 updated). Only B2, B5a and B5b add start-up JS and each keeps a bytes ledger (71 read before and after, in t…
- Single-owner files, one batch at a time (sub-batches of one area are sequential too): Editor.jsx, EditorHeader.jsx, useEditorTab.js, EditorTabContent.jsx = B3 then B4 (B4 only EditorAlerts block, phone preview states); EditorPreviewPane.jsx and usePanelResize.js = B3 (SaveStatus extraction only) then B4; DesignPanel*.jsx (not DesignPanelPhone), DesignDock.jsx body and the parity registries = B8a; TemplateGallery.jsx, TemplateThumb.jsx, DesignPanelPhone.jsx = B8b; PersonalInfoEditor*.jsx, SectionEditorCustomizer.jsx, HeaderIconPickerModal, HeaderSpacingControls = B7 (B7 also owns the Section style wiring line in SectionEditor.jsx as a named hand-over from B6); SectionEditor*.jsx, RichTextEdi…
- Token policy: B1 adds additive cv-* tokens and cv-* component classes (ground, surface, sunken, stage, hairline, field, ink, body, muted, faint, brand family, good/warn/bad, radii, --shadow-pop, --font-cv with Instrument Sans first, then system-ui and the emoji fallbacks). --font-sans is Tailwind's own token (Kbd uses it, and the spacing preset labels contain emoji) and is NOT redefined until the owner approves the web font in B17. In a second B1 commit (CSS only, 0 bytes) the VALUES of the legacy kit tokens are re-pointed to the cv values with class names unchanged: a grep of tests/ and cypress/ found no test pinning those hex values, the kit class-pin tests (about 74) run in the related d…
- Tests: no test runs here; CI only. Per batch: failfirst for every src commit's new tests (dispatched right after the commit lands and before another commit touches the same files, because the failfirst job reverts one commit and falls back to the parent's files when the reverse diff does not apply; the lead reads the failing test NAMES in the failfirst log, not just the fail count, so a test that fails only because the reverted tree no longer imports is not accepted; a small ci.yml step that prints the first 'not ok' lines is an owner approval, default: read the log with get_job_logs). failfirst runs only node --test, so every Playwright or Cypress guard is proven two ways: a node-level mir…
- Protocol refinements (no step dropped): step 1 adds (a) brief generation, (b) for B1/B2/B5a/B5b a start-up read (dispatch tests: 71-startup-chunks alone, read the '# start-up path' line), and (c) MASTER SYNC: git fetch origin master and merge origin/master into the branch (merge, not rebase, the branch is pushed), re-run the coverage script against the merged parity files, add any new or changed master row to the owning batch's catch-all through batches/B<n>.md, and re-apply a master fix to a file a closed batch already rebuilt on the branch with its own test; master is never pushed to. Step 3 render check compares against the board and the deltas table, and against tokens where no board ex…
- Memo and render-count discipline (PERF-4): no router hook or Link inside a memoised editor part. The save chip is a self-contained memo leaf with a DECIDED data path: EditorSaveStatus takes three primitive props (persistError, saving, savedAt) straight from Editor as a sibling element and never through EditorHeader props; it renders only on those transitions (test 173 counts it as its own labelled part with a budget of at most 2 renders per keystroke burst, 0 for the header, doc switch, ATS chip, Export menu and account bar; a negative twin: passing saving through EditorHeader must fail 173). The dock (Design or ATS) is mounted beside the Resume sidebar, unlike today's tabs, so it reads the…
- Label and behaviour contracts: keep the live 'Export' strings (47 Cypress uses; no rename to Download unless the owner approves, then one constant in tests/pdf/ui-selectors.mjs and cypress/support/selectors.js); the Export trigger stays menu-only and the import item keeps its live 'new resume' meaning; nav labels follow the canvas (Documents, Applications, Projects) through shared label constants in tests only; the sidebar, its [ shortcut and cpwtcv_sidebar_collapsed are kept (restyled) until the owner explicitly says drop; the Keyboard shortcuts dialog stays reachable by pointer for signed-out, no-cloud and touch users through an auth-independent help control in the workspace bar (B11), th…
- Windows: a work window is 3 h then a 2 h rest, one batch at a time; each batch is sized for one window except B3 (two windows by design, one gate at the end). A batch that does not reach its gate spans the next window and nothing else starts. Named split points remain for B6, B11 and B14b if a window runs out. Nothing is pushed to master; each batch head is functionally complete but visually mixed, so deploy is the owner's call (after B17 by default, or after any batch's full gate if the owner wants earlier deploys and less drift from master).
- Accessibility is deferred: noted in the batch reports, never planned or fixed. 44 px sizes are built only where a canvas dimension or a MOBI row says so (and listed in a11y-notes); no new Escape, focus or keyboard behaviour is built where the live control has none (the avatar menu and the dock get none; a hand-rolled hook closes on outside click and takes Escape only where the live control already has it). Commits are authored sairamgudiputi <sairamgudiputi8@gmail.com>, no trailers, no mention of Claude or AI; work goes to claude/wonderful-maxwell-vu8xqw only. Test files are numbered from 178 (177 is the highest existing): B1 178, B2 179, B3 180, B4 181, B5a 182, B5b 183, B6 184, B7 185, B8…

## Canvas redraw?

NO: No redraw before or during the build. Of about 1,223 audited rows roughly 40 percent are MISSING because the canvas never drew a home (undrawn panes, 10 of 11 entry forms, menus, states) and 11 percent CHANGED; a redraw touches about 25 of 39 boards, costs two or more windows of agents, and waits on the owner's re-approval, while the build must keep the live control anyway. The Fix column plus the DO NOT BUILD AS DRAWN flags and the per-batch layout-deltas table are the correction; the board is the look reference. The 137 Fix cells that begin 'Draw ...' are canvas instructions the audit wrote while assuming a redraw: tools/brief.mjs prints each as 'Build from the live behaviour; no board, or the board differs: design from tokens' next to the live-behaviour cell, so a builder never waits for a drawing. EDIT-089 (letter stays on the stage while Design is open) is listed in B3's deltas as 'live rule kept (opening Design or ATS from the letter switches to Resume), owner call'. Safety nets: reviewer negative-twin tests per CHANGED row and the label sweep. Optional and NON-BLOCKING, only if the owner asks, after B17: one small workflow redraws the boards the build overruled (EditorAts, EditorLetter, EditorDraft, Jobs/JobsList/MobileJobs, ProjectBacklog, EditorTemplates, ProjectList) from screenshots of the built UI. If the owner overrules a parity default (for example accepts merged Interviewing/Closed lanes) that single decision is applied in the owning batch brief, no canvas edi…

## The batches at a glance

| id | hours | batch | depends on | clusters | boards |
|---|---|---|---|---|---|
| B1 | 3 | Foundation: additive canvas tokens, stable test hooks, start-up headroom, lead tooling | - | 4 | 4 |
| B2 | 3 | Start-up shell: AppBar, phone tab bar, account and sync states, Terms/Privacy, loading and crash pages | B1 | 3 | 5 |
| B3 | 5.5 | Editor frame A: tabless bar, Resume / Cover letter switch, ATS chip, one right dock, URL contract, test net | B1, B2 | 3 | 4 |
| B4 | 2.5 | Editor frame B: stage toolbar, preview states, alert banners, phone preview, dock overlay proof | B3 | 3 | 4 |
| B5a | 3 | Documents page, card menu, Cover Letters group and notices (start-up page set, part 1) | B1, B2 | 1 | 4 |
| B5b | 3 | Import dialog, New page and role starters (start-up page set, part 2) | B5a | 2 | 2 |
| B6 | 3 | Editor content A: section cards, entry forms, rich text, Add Section | B3 | 3 | 3 |
| B7 | 2.5 | Editor content B: Personal info card, Header look and photo, icon library, Section style popover | B6 | 3 | 3 |
| B8a | 3 | Design drawer: rail, ten sections, resets, undo (one DesignPanel) | B3 | 2 | 2 |
| B8b | 3 | Template gallery, saved designs, phone Design sheet | B8a | 3 | 3 |
| B9a | 2.5 | Cover letter panel (letterhead, recipient, body, closing) | B3, B6 | 2 | 3 |
| B9b | 2.5 | Draft from resume dialog and Improve (Bullet Optimizer) | B9a | 3 | 2 |
| B10a | 2.5 | ATS drawer and phone ATS sheet | B3 | 2 | 2 |
| B10b | 3 | Export / Import menu, Share dialog, phone export sheet | B10a | 3 | 4 |
| B11 | 3 | Workspace shell: one bar for Applications and Projects, project switcher, search, kit variants, Public page | B2, B10b | 4 | 4 |
| B12a | 3 | Applications A: header, toolbar, Board, cards, phone board; J-30 root cause | B11 | 2 | 3 |
| B12b | 2.5 | Applications B: List, notices, sort, phone List | B12a | 2 | 2 |
| B13a | 3 | Applications C: job address contract and the job drawer (shared Drawer primitive) | B12b | 1 | 2 |
| B13b | 2.5 | Applications D: Add/Edit job modal and Insights | B13a | 2 | 3 |
| B14a | 3 | Projects 1a: landing, Your work, project header and tabs, Create project, phone landing | B11 | 2 | 3 |
| B14b | 3 | Projects 1b: Board, toolbar, swimlanes, cards, Create issue, phone board | B14a | 3 | 2 |
| B15 | 3 | Projects 2a: issue drawer, List, Calendar, Timeline, Summary | B13a, B14b | 3 | 6 |
| B16 | 3 | Projects 2b: Backlog and sprints, Settings, phone project views | B15 | 3 | 3 |
| B17 | 2.5 | Integration and release candidate: cross-surface sweep, parked-row verdicts, owner-call closures, final gate | B16 | 3 | 1 |

## Each batch

### B1 (3 h): Foundation: additive canvas tokens, stable test hooks, start-up headroom, lead tooling

- **Goal:** Add the canvas look as ADDITIVE cv-* tokens and component classes and re-point the VALUES of the legacy kit tokens to the cv palette (CSS only, 0 start-up bytes), give every later restyle stable data-testid hooks and per-runner open helpers (including a touch-mode phone reachability spec), create start-up headroom before any start-up screen is touched, and write the brief and label tooling.
- **Why here:** Every later batch restyles through tokens and selects by testid; B2, B5a and B5b add bars and pages to the start-up path that has about 0 kB spare, so the room must exist first. Needs no owner answer (no font link).
- **Depends on:** nothing  |  **Boards:** Main, Editor, Jobs, BRIEF.md visual system (token reference only; no screen is rebuilt)
- **Parity rows owned:** 1 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **tokens**: @theme additive tokens: ground #F5F6F8, surface, sunken #EEF0F4, stage #E9ECF1, hairline #E2E5EB, field #D5DAE3, ink #151922, body #2A303C, muted #4F586A, faint #6B7385, brand #2B59FF (+ #1E45D6 text, soft fill, soft border), good/warn/bad with soft fills, all under new cv-* names; radius tokens (card 14, control 9, chip full), --shadow-pop (0 4px 8px rgba(20,30,50,.06), 0 18px 44px rgba(20,30,50,.20)), --font-cv (I… (files: src/index.css)
  - **test-spine**: No-visual-change hooks: data-testid section-card-<id>, section-title-input, entry-header, entry-title, resume-card, resume-card-rename, plus design-open, doc-switch-resume, doc-switch-letter, ats-open on TODAY's tab buttons (B3 swaps the markup, helpers keep working); keep the existing 32 ids and the preview attributes. Move resume-tab.mjs and test 165 from div.cursor-pointer.select-none / span.truncate / the .group… (files: src/components/SectionEditor.jsx, src/components/SectionEditorEntryItems.jsx, src/components/EditorResumeTab.jsx, src/components/ResumeCard.jsx, tests/pdf/resume-tab.mjs, …)
  - **headroom**: React.lazy + Suspense (null fallback) for NewLetterModal (takes the Dialog, useFocusTrap, placement, useScrollLock, usePresence, Portal closure off the start-up path if nothing else on it imports them) and for CareerHistoryPanel (+ careerHistory.js). Each lazy piece sits in its own ErrorBoundary with an in-entry fallback so a failed or offline chunk never removes a function: New cover letter falls back to a letter m… (files: src/pages/Dashboard.jsx)
  - **lead-tools**: brief.mjs: parity rows of a batch (the ranges in this plan, catch-all computed from the final files, sub-batch ids such as B5a accepted) to batches/B<n>.md with Fix column, DO NOT BUILD AS DRAWN flags and the layout-deltas table; a Fix that begins 'Draw' is printed as 'Build from the live behaviour; no board, or the board differs: design from tokens' beside the live-behaviour cell; a Fix of only Same./Keep./Draw. is… (files: docs/tracking/ui-redesign/tools/brief.mjs, docs/tracking/ui-redesign/tools/label-inventory.mjs, docs/tracking/ui-redesign/batches/B1.md)
- **New tests (4):**
  - tests/unit/ui-b1-design-tokens.unit.mjs (index.css defines every BRIEF token under cv-* with the canvas hex; --font-cv starts with Instrument Sans and ends with the emoji fallbacks; --font-sans is un…
  - tests/pdf/178-ui-b1-test-hooks.test.mjs (mounts EditorResumeTab and ResumeCard: every testid above present and unique)
  - tests/pdf/178-ui-b1-startup-headroom.test.mjs (startup-modules.mjs: Dashboard on the path; NewLetterModal, Dialog, CareerHistoryPanel, careerHistory.js off it; lazy boundaries open the modal and the …
  - tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs (a rejected import() for NewLetterModal and for CareerHistoryPanel: New cover letter still makes a letter, Career History shows the notice and Try again re…
- **Existing tests to update (5):**
  - tests/pdf/resume-tab.mjs and 165-perf4-editor-render-count (selectors to testids; same assertions)
  - cypress/support/selectors.js, cypress/support/commands.js, tests/playwright/pw-helpers.js (helpers; CARD to testid)
  - tests mounting NewLetterModal or CareerHistoryPanel through the Dashboard, to await the lazy boundary: 104-r5-dlg-new-letter-dialog, 96-modal-outside-click, 59-career-history, 103-r4-dvis-29-career-s…
  - tests/pdf/71-startup-chunks is read, not changed; tests/pdf/122 only if the reserve offset is used
  - kit class-pin tests dispatched for the value re-point and read, not changed (ui-kit, ui-overlays, ui-helpers, ui-shell units and the 103-r4-dph/dvis files that import ui files); cypress 21-a11y (open…
- **Start-up size plan:** Net NEGATIVE. FIRST ACTION BEFORE ANY CODE: dispatch tests=71-startup-chunks alone and perf: startup once; record the '# start-up path X kB of 1,100 kB' line and the gzip and largest-chunk margins; the question 'what is the fallback order if the gain is short' goes to the owner at the same time (default: reserve jsonResumeImport offset, then lazy Dashboard parts, cap raise last). LAST ACTION: same 71 dispatch on the final head. Target >= +15 kB headroom (NewLetterModal+Dialog closure about 35 kB source, CareerHistory about 12 kB source: source sizes, the minified gain is measured, not assumed…
- **Bug-hunt focus:**
  - functions that stopped working: New cover letter flow (three cases, once-per-visit guard), Career History open/navigate, file import after the lazy change
  - offline and slow network: lazy chunk not yet fetched or rejected (the fallbacks work, no reload, no lost draft); prefetch fires once
  - tests that pass for the wrong reason: testid helpers that match nothing; helpers still clicking the old tab; phone-reach passing because hover is still available
  - perf/render counts: tests 165 and 173 unchanged in numbers
  - visual: the legacy token re-point recolours every kit surface at once; Dashboard and editor kit parts screenshot-compared
  - narrow widths: 390 px Dashboard unchanged
- **Done when:**
  - RUN-STATE batch gate: failfirst proves the ui-b1 tests fail without their src commit (the failing test names read, not only the count); related tests green; ONE full gate green on the head; bug hunt last round empty; B1-report.md, RUN-STAT…
  - 71 spare before and after printed (raw and gzip); after >= before + 10 kB (exact figure stated); the ledger starts here
  - tools/brief.mjs generates B2.md..B17.md (sub-batch ids included) and its coverage mode reports every row of the 7 files owned exactly once
  - kit token NAMES, kit defaults, heights and radii unchanged (ui-kit, ui-overlays, ui-helpers, ui-shell unit tests untouched); the legacy token VALUES equal the cv values
  - phone-reach.spec.mjs (touch mode) exists, passes on the head and has its mutation proof
- **Parked (not built):** 
  - Instrument Sans web font link (owner call; Privacy text must change with it)
  - dark mode (none today, none drawn)
  - dark mode and the global kit variants are not part of the token commit (variants arrive in B11)
- **Risks:**
  - lazy Dashboard parts add async to 8 tests; each update must still assert the same behaviour
  - if Dialog is imported by another start-up module the gain shrinks: measure
  - unmeasured minified gain: the stop-and-ask rule is the guard
  - the legacy value re-point recolours kit surfaces everywhere at once (accepted: it makes every later render check honest)
  - B1 can spill into a second window; the headroom commit and its gate are the checkpoint
- **Owner calls here:** 
  - ask NOW, before B1 code: the start-up fallback order if the headroom gain is short (default above)
  - ask NOW: approve a small ci.yml step that prints the first failing test names in the failfirst job (default: the lead reads the log through get_job_logs)
  - ask NOW: master freeze or per-batch deploy (see the open owner calls)

### B2 (3 h): Start-up shell: AppBar, phone tab bar, account and sync states, Terms/Privacy, loading and crash pages

- **Goal:** One top bar and one phone bottom tab bar for the start-up pages, the account control and the seven sync states in the canvas style, restyled Terms/Privacy, the page loading and crash states; the Dashboard header only (the body waits for B5a).
- **Why here:** The bar and account are shared by Documents, New, the editor and the workspace; building them once on the start-up path under B1's headroom avoids a second shell. B3 mounts AuthBar unchanged in the editor bar, so restyling it now costs no editor test.
- **Depends on:** B1  |  **Boards:** Main (top bar), ShellMenus (avatar menu, signed-out prompt), States (sync chips), Legal, MobileHome (top bar, bottom tab bar)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **bars**: AppBar: CV mark + CPWT-CV link to /, nav Documents / Applications / Projects with the sunken-pill active state (active on /jobs/*, /boards/*, /work), slots for a search control and the account; BottomTabBar (phone, 72 px, three tabs). Both live in src/components (start-up code), import only react-router Link and named lucide icons, used by Dashboard now and by the workspace, New, Terms/Privacy later. The Dashboard h… (files: src/components/AppBar.jsx, src/components/BottomTabBar.jsx, src/pages/Dashboard.jsx (header block only), src/index.css (this batch's single editor))
  - **account**: Avatar menu kept hand-rolled (no kit Popover on the start-up path): name, e-mail, sync line, Sign out; a Keyboard shortcuts entry appears only when the page passes an onShortcuts prop (workspace only, passed by B11, because ? works only there, SHEL-017); signed-out Google button with the Signing in state, the failure popover with all seven wordings and the silent cases, loading placeholder, no-cloud build hides ever… (files: src/components/AuthBar.jsx, src/components/SyncHeldNotice.jsx, src/hooks/useOutsideClose.js)
  - **legal-and-states**: Terms and Privacy: one readable column (680 px) with the live text word for word, mailto when configured, last-updated, footer links both ways; routes unchanged. Page loading state and crash fallback with both buttons and the one-time reload; offline/old-tab behaviour unchanged (RouteFrame scroll code untouched). Rewrite in place so bytes do not grow. (files: src/pages/TermsPage.jsx, src/pages/PrivacyPage.jsx, src/components/ErrorBoundary.jsx, src/utils/lazyPage.js)
- **New tests (6):**
  - tests/pdf/179-ui-b2-app-bar.test.mjs (three nav links, active state per route incl /jobs/:id and /boards/:id/summary, brand link to /, no search slot on non-workspace routes)
  - tests/pdf/179-ui-b2-bottom-tab-bar.test.mjs (three tabs on a phone, navigation, hidden at md+)
  - tests/pdf/179-ui-b2-account-menu.test.mjs (menu entries; Keyboard shortcuts absent without onShortcuts; seven sign-in failure wordings; Signing in disabled state; all seven sync states with names; no…
  - tests/pdf/179-ui-b2-legal-pages.test.mjs (Terms 10 sections and Privacy text word for word; mailto; links on every page)
  - tests/pdf/179-ui-b2-crash-loading.test.mjs (loading state; crash fallback buttons and one-time reload)
  - … and 1 more (see plan-work/final.json)
- **Existing tests to update (5):**
  - AuthBar users: tests/pdf/89-sign-in-errors, 103-r4-dvis-27-sign-in-button, 75-sync-status-tap, 100-r4-sync-02-sync-dot-unreachable, 102-r4-dux-07-workspace-account, 103-r4-dvis-31-editor-account-name…
  - Dashboard header: 103-r4-dvis-14-dashboard-projects-brand, 103-r4-dvis-26-dashboard-header-stacks-until-lg, 96-dashboard
  - legal: tests/unit/legal-footer.unit.mjs, 79-site-owner, 95-sync-privacy-notices, 99-public-link, 89-app-routes, tests/unit/lazy-page.unit.mjs
  - cypress 00-smoke and 01-dashboard (Job Tracker / Projects buttons become nav links), 11-demo-account; tests/pdf/173 only reads the account props (unchanged)
  - cypress 12-regressions-security, 26-mobile-layout, 29-exports-imports and 21-a11y (they read the old Job Tracker nav text or the account bar; many test files contain that text, so the brief's grep li…
- **Start-up size plan:** Spends B1's headroom. Ledger by file in the report: AppBar about 1.5 kB, BottomTabBar about 1 kB, AuthBar menu and chips about +1.5 kB, legal pages rewritten in place with cv-* classes (about 0), icons about 0.4 kB each (reuse icons already on the path). Read 71 before and after (dispatch tests: 71-startup-chunks). Gate: the batch ends with >= 7 kB spare; if the margin would fall below that, apply the reserve offset (lazy jsonResumeImport) and otherwise STOP and ask the owner. useOutsideClose about 0.3 kB, counted in the ledger.
- **Bug-hunt focus:**
  - functions that stopped working: Sign in/out, failure messages, held-items names, demo accounts, Terms/Privacy reachable from every page, no duplicate history entry on Back from Terms
  - persistence: signed-out and no-cloud path; account change while a page is open
  - narrow widths: 390 px bars, bottom bar not covering page actions
  - perf/render counts: AuthBar not re-rendered per keystroke in the editor (173 case)
  - error and empty states: crash card after a failed chunk; offline load
  - keyboard: nothing new is built (live behaviours only; a11y deferred and noted)
- **Done when:**
  - RUN-STATE batch gate for the 58 rows; CHANGED SHEL-028, SHEL-092 and MOBI-010 each with a negative twin (seven sync states drawn; mailto kept; avatar menu on every phone page)
  - start-up ledger written; 71 passes with >= 7 kB spare, figure in the report
  - AppBar/BottomTabBar/AuthBar import no kit barrel or ui file
  - Terms/Privacy text identical to master except wrapper markup (diff attached)
  - standing phone guard green
- **Parked (not built):** 
  - Documents and Applications groups in the search palette and a search field on Documents/New/editor (D-02)
  - Back up and sync prompt card with Not now (shell-docs D-15)
  - Documents save chip (D-14 first half); the avatar-menu sync line is kept
  - Terms/Privacy entries in the avatar menu (live menu is name, e-mail, Sign out; the footer links stay)
- **Risks:**
  - with B5a and B5b the only batches that can break the cap: ledger and early read are the guard
  - nav rename breaks Cypress selectors on 'Job Tracker' text: grep and update, never loosen
  - AuthBar is memo-sensitive in the editor (PERF-4): props shape must not change
- **Owner calls here:** 
  - Nav wording Applications/Documents (default: follow the canvas; parity allows renames)
  - Search field omitted on Documents/New/editor (default: omit)

### B3 (5.5 h): Editor frame A: tabless bar, Resume | Cover letter switch, ATS chip, one right dock, URL contract, test net

- **Goal:** Replace the sidebar header and tab strip with the canvas frame while every editor function keeps working: a full-width bar (back, rename in place, save chip with four states, Resume | Cover letter switch, ATS chip without a score, Design button, Export menu unchanged inside, Share with its live visibility rule, sync dot and account), a content-only sidebar, ONE right dock (null | design | ats) hosting the existing DesignPanel or AtsCheckerPanel whole, the phone frame (switch under the header, 44 px ATS button, Edit | Preview | Design pill, overflow reaching Export, Share, Import, Rename and the account), the ?tab=resume|coverletter + ?dock=design|ats address contract, and the rewritten tab tests.
- **Why here:** The most test-breaking piece of the rebuild (tab bar pinned by 173, 32, dvis-12, dph-31; ?tab= in about 27 files; 15 Cypress and 4 Playwright specs), so its surprises must come early and every later editor batch mounts into this frame. Edits no start-up file. B1's testids and helpers mean the specs only change helper bodies.
- **Depends on:** B1, B2  |  **Boards:** Editor, EditorLetter, EditorAts (frame only; the drawer body is the live panel), MobileEdit (frame)
- **Parity rows owned:** 5 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **frame (single owner of Editor.jsx, EditorHeader.jsx, EditorTabContent.jsx, useEditorTab.js in B3-B4)**: First commit (no visual change): extract SaveStatus and add the testids that clusters tests-node and tests-e2e need (editor-bar, ats-chip, design-button, dock-design, dock-ats, editor-sidebar). Then: EditorHeader and EditorAlerts keep their exports (memo, callbacks only, no Link or router hook in any memo part; Back = callback that always navigate('/')); EditorModeBar becomes EditorDocSwitch plus the ATS chip and De… (files: src/pages/Editor.jsx, src/components/EditorHeader.jsx, src/components/EditorTabContent.jsx, src/hooks/useEditorTab.js, src/hooks/useEditorExports.js (the letterTab input only; no UI), …)
  - **tests-node**: Starts after frame's first commit. Rewrite 173 (872 lines) to the SAME intent on the new parts (a keystroke renders none of the bar leaves, the switch, the ATS chip, the Export menu, the account bar, the dock; real Editor under a MemoryRouter with a fresh auth/sync object each render; tab-picker identity, stale-notice and phone cases carry over) and PROVE it with a deliberate failfirst (an unstable prop and a Link a… (files: tests/pdf/173-editor-header-render-count.test.mjs, tests/pdf/32-editor-tab-scroll.test.mjs, tests/pdf/103-r4-dvis-12-editor-tabs-truncate.test.mjs, tests/pdf/103-r4-dph-31-pill-clears-tab-bottom.test.mjs, tests/pdf/89-editor-tab-link.test.mjs, …)
  - **tests-e2e**: Only helper bodies change (openDesign/openAts/switchTo/openExportMenu on the new testids) plus per-spec edits where a spec clicked a tab by text; 23-editor-panels 'survives a trip' is REWRITTEN to 'Personal info stays closed across switch and dock'; all 33 ?tab=coverletter users stay green with helper-only edits. (files: cypress/support/commands.js (helper bodies), tests/playwright/pw-helpers.js (helper bodies), cypress/e2e/02-editor.cy.js, cypress/e2e/04-design.cy.js, cypress/e2e/04-design-left-bar.cy.js, …)
- **New tests (9):**
  - tests/pdf/180-ui-b3-editor-bar.test.mjs (every bar function present once; callbacks only; Share visibility rule incl letter-kind, signed-out, no-cloud; ATS chip and Design button toggle the dock; sav…
  - tests/pdf/180-ui-b3-no-tabs.test.mjs (no Resume / Cover Letter / ATS tab strip; switch has exactly two buttons; negative twin of the old tabs)
  - tests/pdf/180-ui-b3-editor-url.test.mjs (?tab and ?dock mapping, legacy ?tab=design/ats rewritten with replace, unknown dropped, import notice state survives a switch and a dock open, Dashboard lette…
  - tests/pdf/180-ui-b3-editor-dock.test.mjs (one dock at a time; panel mounted only while open; one DesignPanel instance; 1-Page Fit stops on close; Undo toast dismissed on close; scroll reset; opened f…
  - tests/pdf/180-ui-b3-phone-frame.test.mjs (pill, tap-to-rename, account control, tab pick returns to Edit, export/share/import reachable)
  - … and 4 more (see plan-work/final.json)
- **Existing tests to update (4):**
  - 173 (REWRITE, same intent), 32-editor-tab-scroll, 103-r4-dvis-12-editor-tabs-truncate, 103-r4-dph-31-pill-clears-tab-bottom, 78-letter-export-menu (reads EditorHeader.jsx text), 89-editor-tab-link, 9…
  - 71-preview-hidden-builds, 71-preview-typing-debounce and 165 must stay green unchanged (the contract proof)
  - Cypress 02, 04-design, 04-design-left-bar, 05, 07, 13, 14, 22, 23, 25, 26, 27, 30; Playwright picker, parity-ui-controls (opener only), pdf-templates, pdf-typography-spacing, pdf-cover-letter (deep l…
  - 89-rename-fresh-name, r5hunt11-rename-other-resume (mount EditorHeader); cypress 21-a11y (opener helpers)
- **Start-up size plan:** Lazy-only: Editor chunk. EditorHeader imports AuthBar (already start-up) and ExportDropdown (lazy); no new module is imported by both the Dashboard and the editor; no start-up kit file touched. First action: dispatch perf: browser once (baseline) and tests=71-startup-chunks; record both. 71 read again in the targeted dispatch (unchanged expected).
- **Bug-hunt focus:**
  - perf/render counts: 165 and 173 numbers; dock open/close causes ONE repaint of visible pages and no PDF rebuild; the save chip does not wake the memoised header
  - functions that stopped working: rename rules (Enter, Escape, IME, trimmed, empty is no edit), Share visibility, Export from the letter view, deep links (?tab=coverletter 33 references), letter-linked jobs, Back keeps Do…
  - persistence: open states across switches (EDIT-138), autosave and cross-tab merge
  - narrow widths: 390 and 768 (pill, dock sheet)
  - keyboard: no new shortcuts and no new Escape or focus behaviour (a11y deferred, noted)
  - error and empty states: missing resume id, signed-out and no-cloud account bar
  - … and 1 more (see plan-work/final.json)
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED EDIT-019/026/141/171 each with a negative twin (sync dot states; phone export reachability; tab pick returns to Edit; letter-view opener rule); EDIT-089 shown in the layout-deltas table as '…
  - no tab strip remains; old links still land; Design and ATS reachable by chip, opener, deep link and phone pill
  - 173 rewritten, green and failfirst-proven; 165 and 71-preview-* green unchanged
  - every old entry reachable from the new frame in Cypress helpers (Design, ATS, Cover letter, Export, Import, Share, layout modes) on desktop and phone
  - standing phone guard green; perf baseline recorded
- **Parked (not built):** 
  - Score number on the ATS chip and on Documents cards (editor-content NEW-002, ELAE NEW-09, mobile D-03): the chip opens the ATS dock and shows no number
  - Design button in the letter toolbar as a letter-specific Design (NEW-021, ELAE NEW-29): it is the live opener; opened from the letter view it switches the document to Resume (EDIT-171)
  - Share drawn for every board (NEW-018): live visibility rule stays (signed-in, cloud, not a letter)
  - 'Saved' static line (D-04) and Back to documents label (D-23): live save states and 'Back to dashboard' stay
  - editor-content NEW-001 ('1 page' count in the caption: owned here, parked)
  - Escape and focus handling of the dock (a11y deferred)
- **Risks:**
  - biggest structural change and highest test churn (about 25 files): split point inside the batch is already the B3/B4 boundary; if the window ends land frame + URL + dock first and keep tests-e2e for the next window before B4
  - PERF-4: one router hook or Link in a memo part re-renders per key; 173 is the fail-first proof
  - the dock narrows the preview: the below-1100 overlay is proven in a real browser in B4, not only in the node fake DOM
  - PLANNED AS TWO WINDOWS with one checkpoint: window 1 = frame, URL, dock and the node tests (push, one targeted dispatch); window 2 = phone frame, e2e helper bodies and specs, then the full gate; nothing else starts in between
  - dock typing cost: today Design and ATS never mount while the user types in a section; the deferred input and 180 dock-typing are the guard
- **Owner calls here:** 
  - ATS chip: label only (default) versus a live score number (needs the analysis in the bar: perf risk)
  - Design/ATS opened from the letter view: live rule (default) versus a letter-specific Design
  - Share on the letter view: live (shares the resume; default) versus hide it

### B4 (2.5 h): Editor frame B: stage toolbar, preview states, alert banners, phone preview, dock overlay proof

- **Goal:** Finish the frame: the stage toolbar (layout toggle, paper label, zoom 50-150 in 25 steps, resize handle, Terms/Privacy footer), the preview states (Rendering placeholder, Updating chip, Preview failed with Retry, font fallback notice), the alert strips (import notice, export/import error, not saved with the live texts), and the phone Preview view, with a six-width browser geometry proof including the 768-1100 band.
- **Why here:** Needs B3's frame and dock; owns the preview contract (71-preview-*, 174 watchdog) and the only browser proof of the dock overlay rule, so it follows B3 immediately while the frame is fresh.
- **Depends on:** B3  |  **Boards:** Editor, EditorLetter, MobilePreview, States (banners)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **stage (single owner of EditorPreviewPane.jsx and index.css here)**: Stage toolbar: the layout toggle (the Design button lives in the B3 bar only and shows its pressed state there) (Editor only / Split view / Preview only; hidden stage stays mounted and builds nothing), paper label, zoom -/+ 50-150 step 25 remembered while the editor stays mounted (kept on a phone too, MOBI-074), 4 px resize handle with its title, range 240-640, key cpwtcv-panel-width, Home/End; footer with Terms/Pri… (files: src/components/EditorPreviewPane.jsx, src/components/LayoutToggle.jsx, src/hooks/usePanelResize.js, src/components/PdfPreview.jsx (state markup only, no logic), src/components/FontFallbackNotice.jsx, …)
  - **alerts-and-phone**: EditorAlerts stays memo with the same props: amber import notice with Dismiss (after EVERY import from the Export menu), red export/import error with Dismiss (PDF/Word advice, the three import-problem messages), red Not saved with the live full/blocked texts and the export-JSON advice; phone: toasts above the pill, Updating chip above the pill, Edit view bottom room (64 px), no handle and no layout toggle on a phone. (files: src/pages/Editor.jsx (phone preview view and alert wiring only), src/components/EditorHeader.jsx (the EditorAlerts block only))
  - **tests**: Update the stage and alert tests to the new markup keeping the guards; the Playwright spec measures with boundingBox and scrollWidth at 1440, 1280, 1100, 1024, 768 and 390 that bar, sidebar, stage and dock never overlap, no horizontal page scroll, the page is not under its 240 px floor, the dock overlays below 1100, dock open/close causes no preview rebuild (data-preview-status), and the pill, Updating chip and dock… (files: tests/pdf/71-preview-hidden-builds.test.mjs, tests/pdf/71-preview-typing-debounce.test.mjs, tests/pdf/174-preview-pdfjs-watchdog.test.mjs, tests/pdf/29-page-size-preview-caption.test.mjs, tests/pdf/92-font-fallback-notice.test.mjs, …)
- **New tests (4):**
  - tests/pdf/181-ui-b4-stage-toolbar.test.mjs (three layout modes, handle range and keys, zoom steps/ends/persistence incl phone, paper label, Terms/Privacy footer, hidden stage builds nothing)
  - tests/pdf/181-ui-b4-preview-states.test.mjs (placeholder, Updating chip, failed + Retry, both font-fallback wordings)
  - tests/pdf/181-ui-b4-editor-alerts.test.mjs (live texts of every strip, Dismiss, three import-problem messages, EditorAlerts renders zero times per keystroke)
  - tests/playwright/ui-b4-editor-layout.spec.mjs (geometry at six widths incl the 768-1100 overlay)
- **Existing tests to update (3):**
  - 71-preview-hidden-builds, 71-preview-typing-debounce, 174-preview-pdfjs-watchdog (must stay green unchanged)
  - 29-page-size-preview-caption, 92-font-fallback-notice (reads src as text), 103-r4-dph-40-updating-chip-above-pill, panel-resize units, 99-import-ui, 52-editor-route
  - cypress 26-mobile-layout, 02-editor; playwright parity-preview-download
- **Start-up size plan:** Lazy-only (Editor chunk, index.css). PdfPreview markup edit adds no import. 71 read in the targeted dispatch (unchanged).
- **Bug-hunt focus:**
  - perf/render counts: preview debounce and hidden-not-built contract; EditorAlerts renders zero per keystroke; run perf: browser and compare with B3's baseline
  - functions that stopped working: zoom and layout memory, handle keyboard, preview Retry, font notice, import notice survives a dock open
  - narrow widths: 1100 / 1024 / 768 / 390 with dock, pill and Updating chip
  - keyboard: Home/End on the handle
  - error and empty states: preview failed with a dock open, storage full, import problems
  - tests that pass for the wrong reason: geometry spec must fail if the dock is made a flex sibling below 1100
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED EDIT-005/025/150 and MOBI-074 (storage-full banner texts, zoom steps, preview sized from the live stage width, zoom buttons kept on a phone) each with a negative twin
  - geometry spec green at six widths and at the stored 640 px width, proven by a mutation pair; 71-preview-* and 174 green; perf comparison recorded
  - render check against Editor, EditorLetter, MobilePreview, States at 1440 and 390
  - standing phone guard green
- **Parked (not built):** 
  - '1 page' count in the caption (editor-design-templates NEW-011; editor-content NEW-001 is owned and parked by B3)
  - Zoom values 76/86/90 and a 90 percent default (NEW-008): live 25 percent steps win
  - Storage-full new wording and Open Documents link (NEW-009)
  - Paper layout/font/heading/accent options (NEW-014, drawing aid)
  - Pinch to zoom and N pages caption on phone (MOBI D-07, NEW-010); live preview pinned above the phone Design sheet
- **Risks:**
  - PdfPreview.jsx has strict timing tests; a markup change that moves data-preview-status or data-preview-pages breaks readers and Playwright perf specs
  - the dock leaves the page narrow at 1100-1280 px; the overlay rule has no drawn board
- **Owner calls here:** none


### B5a (3 h): Documents page, card menu, Cover Letters group and notices (start-up page set, part 1)

- **Goal:** Rebuild the Documents page in the canvas style with every live function: card more-menu (lazy, with an in-entry fallback), Cover Letters group, New cover letter, Career History, notices, demo originals, empty state and phone cards; the Import dialog and the New page follow in B5b.
- **Why here:** With bars and account done (B2) and headroom (B1), the first screen every user sees is rebuilt under a measured ledger; it follows the editor frame so the owner has seen the core product first. The New page is split off so each half fits one window.
- **Depends on:** B1, B2  |  **Boards:** Main, Empty, MobileHome, States (confirm delete, storage banner)
- **Parity rows owned:** 6 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **documents**: Page header with the primary New resume and quiet secondary actions (B2's temporary row moves here); card grid with real thumbnail, name over two lines (ending kept), template and age meta line; the card more menu: Edit, Rename inline, Copy (once-per-visit guard), Delete (native confirm with the live text, original variant, last-original disabled with its hint), Keep as my original / Stop keeping (demo accounts); vi… (files: src/pages/Dashboard.jsx, src/components/ResumeCard.jsx, src/components/ResumeThumbnail.jsx, src/components/RecoveryNotice.jsx, src/components/CareerHistoryPanel.jsx, …)
- **New tests (5):**
  - tests/pdf/182-ui-b5a-documents-cards.test.mjs (card menu functions with their guards and Undo/confirm, two-line names, template+age meta, order, phone no-hover reachability, deleting a resume calls u…
  - tests/pdf/182-ui-b5a-letters-group.test.mjs (Cover Letters group, New cover letter three cases and once guard, letter card actions, deleting a resume keeps letters)
  - tests/pdf/182-ui-b5a-notices.test.mjs (storage full/blocked texts, recovery, held, originals waiting)
  - tests/pdf/182-ui-b5a-lazy-fallbacks.test.mjs (a rejected import() for CardMenu, NewLetterModal and CareerHistoryPanel: Edit, Copy, Delete, New cover letter and Career History all still work; no reloa…
  - tests/pdf/182-ui-b5a-startup-ledger.test.mjs (CardMenu, NewLetterModal, CareerHistoryPanel off the start-up path; prefetch fires once)
- **Existing tests to update (3):**
  - Dashboard/ResumeCard users: 96-dashboard, 83-dashboard-thumbnails, 80-dashboard-import-read-error, 104-r5-dash-card-name-two-lines, 162-redos-resume-card-name, 104-r5-hunt6-dash-back-keeps-scroll, 10…
  - tests/pdf/122 only if the reserve offset is used (evidence in the commit)
  - cypress 01-dashboard, 11-demo-account, 11-demo-account-keep, 29-exports-imports, 00-smoke (CARD testid from B1), 21-a11y
- **Start-up size plan:** The second batch that adds start-up JS (B2 was the first). Ledger by file in the report; read 71 first, then after each cluster push. Rules: card, grid and header rewritten IN PLACE with cv-* classes; the card menu is a lazy chunk with prefetch, boundary and in-entry fallback (its bytes are counted); Career History and NewLetterModal already lazy (B1); native confirm() stays (no ConfirmDialog on the path); icons by name only; no edit to constants/templates.js, templatePresets.js, starterTemplates.js. END STATE: spare >= 5 kB so B5b has room. If a push would take the margin under 5 kB, trim or…
- **Bug-hunt focus:**
  - functions that stopped working: rename/copy/delete/keep-original, new cover letter flow, import every file type, demo originals, career history link
  - persistence: storage full/blocked banners, recovery, sign-in/out changes what is listed (SHEL-113), Back keeps scroll
  - perf/render counts: Dashboard re-render per store change, thumbnail painting and cache (SHEL-129/130)
  - error and empty states: every import error, empty Documents, a lazy chunk failing offline
  - tests that pass for the wrong reason: card tests matching a menu that is not rendered
  - narrow widths: 390 px cards, long names, bottom bar overlap, import on a phone
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED SHEL-041/048/052, ELAE-133, MOBI-027/028 each with a negative twin (a letter stays its own record; card order, name endings, storage banner)
  - start-up ledger and 71 spare >= 5 kB, figure in the report; no un-ledgered growth
  - SHEL-047 pinned (public copy unpublished with a deleted resume; letters excluded); every lazy piece of this batch has a failfirst fallback test
  - demo-account and no-cloud paths verified in Cypress 11-demo-account*
  - standing phone guard green
- **Parked (not built):** 
  - ATS score chip on cards (D-01, editor-content NEW-019, mobile D-02)
  - Recently edited sort (D-03; creation order SHEL-048 stays)
  - Applications strip and next-interview tile on Documents (D-04)
  - first-run three-option page and a typed 28 looks (D-05)
  - everything-stays-in-browser sentence (D-06)
  - Its cover letter goes too and the cascade (D-09, ELAE NEW-30), cover letter chip on cards (D-18, ELAE NEW-31)
  - … and 1 more (see plan-work/final.json)
- **Risks:**
  - largest start-up risk of the plan; Dashboard has 17 mounting tests and ResumeCard 10
  - template cards are shared with the editor gallery (B8b): keep TemplateThumb props stable
  - chunk-failure fallbacks are the offline guarantee: do not ship a lazy piece without its fallback test
- **Owner calls here:** 
  - Cover letters: keep the live separate group of letter cards (default) versus attach inside the resume
  - Card order: creation order (default) versus Recently edited (parked)
  - Career History on Documents in addition to Insights (default: both, lazy)

### B5b (3 h): Import dialog, New page and role starters (start-up page set, part 2)

- **Goal:** Rebuild the Import dialog (file picker kept in the entry, lazy chrome with fallbacks) and the New page with every live function: all 28 looks (19 templates + Sidebar single-column + 8 designs + saved designs), live category chips, role starters, Your details from select, Start blank, Import a file link, phone layout.
- **Why here:** Second half of the start-up page set; it needs B5a's ledger margin and Documents entry points, and it reuses TemplateThumb props that B8b later restyles without changing.
- **Depends on:** B5a  |  **Boards:** ImportModal, New
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **import**: Import keeps the file input and the native picker click path in the entry (ImportMenu.jsx), so choosing a file works offline exactly as today; the lazy ImportDialog (idle + hover/focus prefetch, own ErrorBoundary, no reload guard) carries the chrome: accepted types hint from DOCUMENT_HINT (PDF, Word, Markdown, text, JSON backup, JSON Resume), Reading state with the busy guard, error strip with Dismiss and every refu… (files: src/components/ImportMenu.jsx)
  - **new-page**: Back arrow with back-or-home semantics, title and lead, looks drawn with the user's resume and the Your details from select, live category chips, ALL looks selectable (19 templates + Sidebar single-column card + 8 designs + saved designs: scroll, filter, group, never fewer), look card content (ATS badge, description), a pick makes the resume exactly once, Start blank, role starters (all five) with the dynamic look l… (files: src/pages/NewResume.jsx, src/components/StarterTemplateModal.jsx, src/index.css (this batch's single editor))
- **New tests (2):**
  - tests/pdf/183-ui-b5b-import-dialog.test.mjs (states, error reasons, 20 MB, demo original, busy guard; a rejected dialog chunk still opens the picker and shows errors in the import-error strip; Import…
  - tests/pdf/183-ui-b5b-new-page.test.mjs (every look selectable incl saved designs, categories, starters, once-guard, back semantics)
- **Existing tests to update (3):**
  - 91-starter-modal, 93-picker-new-resume, 93-picker-pictures, 103-r4-dph-39-starter-badge-wraps-whole, r4dsn-new-resume-look-colours
  - 80-dashboard-import-read-error, 104-r5-hunt6-dash-import-after-sign-out, 104-r5-hunt6-dash-editor-import-after-sign-out, imp-import-busy, 99-import-ui
  - cypress 30-starters-and-design, 29-exports-imports, 11-demo-account
- **Start-up size plan:** Last batch that adds start-up JS. NewResume and StarterTemplateModal are rewritten IN PLACE with cv-* classes (no new import, icons by name only); the import dialog is a lazy chunk with prefetch, boundary and fallback (its bytes are counted), the file input stays in the entry; read 71 before and after (dispatch tests: 71-startup-chunks) and print the ledger. END STATE: spare >= 3 kB; if short apply the reserve offsets in order, then STOP and ask the owner.
- **Bug-hunt focus:**
  - functions that stopped working: import every file type, demo originals, import after sign-out, a pick makes exactly one resume (once-guard), starters, Your details from, Start blank, Import a file link
  - offline: a failed ImportDialog chunk still opens the picker
  - narrow widths: 390 px New page, looks grid scroll
  - perf/render counts: the New page renders every look thumbnail once
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED SHEL-069/073/074/076 and MOBI-031 each with a negative twin (back-or-home, only the live category chips, all looks selectable, a pick makes the resume once, the import menu on a phone)
  - start-up ledger and 71 spare >= 3 kB, figure in the report
  - standing phone guard green
- **Parked (not built):** 
  - drop zone (D-07, ELAE NEW-28) and the 'It becomes a new resume' wording (D-08)
  - New page One/Two column/ATS-safe filter chips (D-11) and the use-this-template footer bar copy (D-17)
- **Risks:**
  - TemplateThumb.jsx is NOT edited here (B8b owns it); props stay stable
  - looks grid renders about 30 thumbnails: scroll and filter must not remount them
- **Owner calls here:** 
  - Extra New-page filter chips (default: only the live category chips)

### B6 (3 h): Editor content A: section cards, entry forms, rich text, Add Section

- **Goal:** Restyle the content sidebar to the canvas cards while every live control stays: collapse/expand all, section rename/hide/duplicate/delete/reset (overflow menu), entry grip/eye/duplicate/delete, all 11 entry forms (Location, Current, month/year selects with text fallback, per-field eyes, skill levels, languages), the Add Section picker with all types, and the rich text toolbar with the STAR Optimizer button.
- **Why here:** The frame exists; the content sidebar is the most test-pinned surface (112 files through resume-tab.mjs, hooks from B1; 165 render counts), so it gets its own batch right after the frame.
- **Depends on:** B3  |  **Boards:** Editor (sidebar), EditorSection, MobileEdit (cards)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **sections-and-entries**: Section card: grip (keyboard sensor options stay a module constant), click-to-edit title (aria Section title kept), eye with a visible hidden state, Section style button, more menu (Duplicate, Delete with the confirm, Reset style with Undo), collapse chevron; quiet Collapse all / Expand all with its Personal-info side effect; entry rows with grip, eye, duplicate, delete (always visible on touch, untouched entry skip… (files: src/components/SectionEditor.jsx, src/components/SectionEditorEntryItems.jsx, src/components/SectionEditorLeafItems.jsx, src/components/SectionEditorShared.jsx, src/components/EditorResumeTab.jsx, …)
  - **rich-text**: Toolbar that appears with the focused field (Bold, Italic, Underline, lists, link with its validation and alert wording, alignment, STAR Optimizer button, icon-only below 640 px); every button acts on pointer-down with the caret kept (does not take focus); paste/drop caps, link rules and IME rules unchanged; native prompt/alert/confirm kept (EDIT-147). Contract (value, onChange, STAR button) unchanged: the component… (files: src/components/RichTextEditor.jsx)
  - **tests**: Restate the class-pin tests on the new markup (same defect guarded) and update helper-dependent specs; new tests below. (files: tests/pdf/96-section-structure.test.mjs, tests/pdf/97-object-member-editor.test.mjs, tests/pdf/97-object-member-types.test.mjs, tests/pdf/103-r4-dph-23-language-row-buttons.test.mjs, tests/pdf/103-r4-dph-24-section-menu-unclipped.test.mjs, …)
- **New tests (5):**
  - tests/pdf/184-ui-b6-section-card.test.mjs (collapse/expand all, rename, hide with state, duplicate, delete with confirm, reset style Undo id, keyboard reorder, dropped-off-list unchanged)
  - tests/pdf/184-ui-b6-entry-actions.test.mjs (grip, eye, duplicate, delete, untouched skips confirm, always visible without hover, Add entry opens itself)
  - tests/pdf/184-ui-b6-entry-forms.test.mjs (all 11 section types: field set equals a hard-coded list, per-field eye, month/year selects, current flag, location, skill levels, language row)
  - tests/pdf/184-ui-b6-add-section.test.mjs (every SECTION_GROUPS type offered; unknown stored section types still render)
  - tests/pdf/184-ui-b6-rich-toolbar.test.mjs (every toolbar control, link validation, focus not taken, caps, STAR button present on every rich-text field)
- **Existing tests to update (4):**
  - tests/pdf/165-perf4-editor-render-count (must stay green) and tests/pdf/resume-tab.mjs consumers (112 files; change only the helper)
  - 103-r4-dph-26/28/29, 104-r5-panels-*, 31-contact-fields, 16-saved-data-photos, 80-upload-budget-sections, 88-entry-keyboard-reorder, 88-duplicate, 99-remove-untouched-entry, 88-new-section-open, 99-n…
  - tests/pdf/parity/* (18 walker tests) untouched and green; Cypress 02, 08, 10, 25, 28; Playwright parity-ui-controls, bullet-optimizer
  - cypress 21-a11y (entry and section controls moved)
- **Start-up size plan:** Lazy-only (Editor chunk). RichTextEditor is also used by lazy job and project pages. No new module shared with the Dashboard (utils/richText.js is already on the path and gains no code). 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - perf/render counts: 165 (bullet, summary and email keystrokes render only their own part); dnd sensor options stay module constants
  - functions that stopped working: every section type's fields, reorder by keyboard and touch, Add section, hide/show, link rules, STAR button
  - persistence: open states kept across switches and docks, same-value edits are not edits
  - narrow widths: 390 px entry forms (16 px fields), sidebar 240 px minimum
  - keyboard: drag keyboard sensor, Enter/Escape in rename, IME guards
  - tests that pass for the wrong reason: entry-form count tests must be hard-coded and fail when one field is dropped from one type
- **Done when:**
  - RUN-STATE batch gate for the owned rows; 165 and the 112 resume-tab files green; walker matrix unchanged (00-registry, 01-offered, 40-structure green)
  - CHANGED rows EDIT-042/044/062/065/144 and MOBI-065/172/173 each have a negative-twin test; phone card header offers grip/eye/more (EDIT-144)
  - standing phone guard green
- **Parked (not built):** 
  - Entry count beside a section title and one-line card summaries (NEW-003, MOBI D-12; display-only, owner may accept)
  - Wording renames Role/From/To/Highlights/Roomy/Columns/Dots/Entry title (NEW-013, NEW-017: live labels stay, they are walker and test contracts)
  - Entry rows drawn without hide/duplicate/delete/grip (NEW-015): all kept
- **Risks:**
  - 10 of 11 entry forms have no board: use the Experience card as the pattern and review against the live fields, not a picture
  - label changes break walker signatures and 112 tests: none allowed without a registry update in the same commit
  - a restyle of the card header breaks 112 files at once if the B1 hooks were skipped
- **Owner calls here:** 
  - Label renames from the canvas (default: keep live labels)
  - Display-only additions: entry count and one-line summaries (default: parked)

### B7 (2.5 h): Editor content B: Personal info card, Header look and photo, icon library, Section style popover

- **Goal:** Restyle the Personal info card with every live control (photo upload/status/eye/remove with Undo, shape, size, border, height, text position, tone; six contacts with eyes; link label and URL; per-field icon controls and the icon library modal; Header look with alignment, contacts, name/title layout, border, icon set and size, spacing; summary as rich text) and give Section style its popover around the unchanged SectionCustomizer with every option.
- **Why here:** PersonalInfoEditor is mounted bare by the parity walker (about 40 files) and is memoised under 165; it needs B6's rich text and the shared header-look vocabulary; one owner for these files keeps them consistent.
- **Depends on:** B6  |  **Boards:** EditorPersonal, EditorSection (popover), MobileEdit
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **personal-info**: Optional view prop (default 'all') so mounting without it shows everything (walker); memo and props contract unchanged ({resume:{id}, getResume, personal, updatePersonal, toggleFieldVisibility, settings, updateSetting, clearSettings, template, coverLetter}). Card: round photo upload with status chip and print warnings, Remove with Undo, eye; fields with eyes; link label and URL second line; Header look disclosure ho… (files: src/components/PersonalInfoEditor.jsx, src/components/PersonalInfoEditorHeader.jsx, src/components/PersonalInfoEditorPhoto.jsx, src/components/HeaderIconPickerModal.jsx, src/components/HeaderSpacingControls.jsx, …)
  - **section-style**: SectionCustomizer stays a self-contained named export (walker mounts it bare; optional advanced prop defaults to everything); the new lazy wrapper hosts it in a kit Popover (phone: bottom sheet) with a Done button equal to the live Hide options toggle, outside click closes without losing values, and shows every row: Alignment, Spacing/Rows, Grids 1-4 for Skills, Title layout incl Side by side, Order (Experience), Sk… (files: src/components/SectionEditorCustomizer.jsx, src/components/SectionEditor.jsx (the Section style button wiring only: hand-over from B6, which is closed))
  - **tests**: Restate class pins on the new markup; update the opener of Section options (now a popover); new tests below. (files: tests/pdf/parity/registry-header.mjs (only if a label changed; default untouched), tests/pdf/parity/registry-sections.mjs (only if a label changed), cypress/e2e/16-headers.cy.js, cypress/e2e/17-section-options.cy.js, cypress/e2e/24-image-uploads.cy.js, …)
- **New tests (4):**
  - tests/pdf/185-ui-b7-personal-info.test.mjs (view prop default shows all; union of controls in the disclosures equals the hard-coded walk count from tests/pdf/parity/walk-cache.mjs; icon library modal)
  - tests/pdf/185-ui-b7-photo-block.test.mjs (upload limits, status chip, print warnings, Remove photo Undo, 16 px touch text)
  - tests/pdf/185-ui-b7-header-look.test.mjs (alignment, contact style/layout, name layout, border, icon set/size, spacing steppers, template-dependent controls)
  - tests/pdf/185-ui-b7-section-style-popover.test.mjs (union of popover controls equals SectionCustomizer; Done, Escape, outside click keeps values; phone sheet; Reset style Undo)
- **Existing tests to update (5):**
  - About 40 PersonalInfoEditor mounts (80-panel-stored-values, 103-r4-dph-29-personal-info, 103-r4-dvis-30-personal-info, r5hunt10-hidden-fields-list) stay green by prop contract; 165 (the card stays me…
  - Read-source files: 31-contact-fields, 27-header-spacing, tests/unit/photo-options.unit.mjs, 93-name-heading-font, tests/unit/r4dux-27-photo-remove-undo.unit.mjs
  - Photo and icon: 80-photo-url, 16-saved-data-photos, 105-r5-hunt2-late-upload, 09-contact-icons, 39-contact-icons-webp, 91-icon-picker-modal, 104-r5-dlg-icon-picker-dialog, 102-r4-dux-29-icon-upload-n…
  - tests/pdf/parity (00-registry, 01-offered, 20-header, 21-header-gaps, 22-photo-visibility, 16-icons, 30-sections, 31-section-overrides, 40-structure) green untouched; cypress 05/14/16/17/24; playwrig…
  - cypress 21-a11y (header and section-options openers)
- **Start-up size plan:** Lazy-only (Editor chunk); the popover is a lazy wrapper. HeaderSpacingControls and photoOptions are not imported by the Dashboard. 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - functions that stopped working: hidden-field eyes still remove the field from the printed header and the letter; photo shape/size/position/tone write the same keys; custom icon upload and removal; every SectionCustomize…
  - perf/render counts: PersonalInfoEditor renders zero times for a keystroke in a section (165); popover open does not render other sections
  - persistence: photo cache, oversize shrink, Personal info open state across switches
  - narrow widths: 360 px card, steppers wrapping, popover as sheet at 390
  - keyboard: eye toggles, stepper arrows, icon picker focus, popover Escape
  - error and empty states: no photo, oversized photo, unsupported file
  - … and 1 more (see plan-work/final.json)
- **Done when:**
  - RUN-STATE batch gate for the owned rows; the whole parity walker and registry green with the panels mounted bare
  - CHANGED rows EDIT-104 and EDIT-118 each with a negative twin; the RESTYLED row EDIT-169 (the template's own values shown for unset controls) is pinned by a test; walker signatures unchanged or the registry updated in the same commit
  - standing phone guard green
- **Parked (not built):** 
  - Add link for extra custom links (NEW-004)
  - Improve button on Summary: NOT new, it is the existing STAR Optimizer toolbar button (NEW-005)
  - Done button and Experience-only scope chip on the popover (NEW-006): the live Hide options toggle is the Done; one-line card summary (NEW-016, D-21; display-only)
- **Risks:**
  - 'More header options' and the popover rows are drawn closed or not at all: layout is invented from the live controls
  - walker signature collisions if a label changes
  - memo identity of PersonalInfoEditor (165)
- **Owner calls here:** none


### B8a (3 h): Design drawer: rail, ten sections, resets, undo (one DesignPanel)

- **Goal:** Give the Design dock its canvas rail (Template, Color, Type, Spacing, Headings, More) over ONE mounted DesignPanel with an optional groups prop (default shows everything), every control of the ten live sections with per-group resets and Undo; the gallery and the phone sheet follow in B8b.
- **Why here:** The dock exists (B3) with the full panel inside and the design props already wired; this batch regroups it. It owns DesignPanel*.jsx, DesignDock and the parity registries alone (the walker, 63 mounting files and picker specs bind it).
- **Depends on:** B3  |  **Boards:** Editor (drawer open), EditorPersonal (drawer open)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **drawer**: Optional groups prop on DesignPanel (default undefined = all; a pure filter in the return, no new state), ONE instance across group changes (Undo toasts and a running 1-Page Fit survive a pane change; they stop only on unmount). DesignDock: rail 64 px + pane 356 px: Template (current look, Browse with the same count, saved designs with Save my design name field/40 chars/clash messages, two-step delete, sidebar layou… (files: src/components/DesignPanel.jsx, src/components/DesignPanelColors.jsx, src/components/DesignPanelDates.jsx, src/components/DesignPanelHeadings.jsx, src/components/DesignPanelLayout.jsx, …)
  - **tests**: Specs call openDesign() plus a selectGroup(name) helper; control assertions keep aria-label and data-testid; parity-ui-controls keeps throwing on a div.fixed.inset-0.z-50 layer; class pins restated. (files: tests/playwright/pdf-typography-spacing.spec.mjs, tests/playwright/pdf-colors.spec.mjs, tests/playwright/parity-ui-controls.spec.mjs, cypress/e2e/04-design.cy.js, cypress/e2e/04-design-left-bar.cy.js, …)
- **New tests (2):**
  - tests/pdf/186-ui-b8a-design-dock.test.mjs (union of controls across the six groups equals the all-groups walk count; one DesignPanel instance across group changes; toasts and 1-Page Fit survive a pan…
  - tests/pdf/186-ui-b8a-design-reachability.test.mjs (opener found by role+name; each design control found inside dock-design by testid)
- **Existing tests to update (2):**
  - tests/pdf/parity/* (18 files via walk-cache): green with no prop passed; the 63 DesignPanel users stay; class pins 103-r4-dph-33, 93-name-heading-font, 27-header-spacing, tests/unit/page-margins.unit…
  - Cypress 04-design, 04-design-left-bar, 13, 25, 21-a11y; Playwright pdf-typography-spacing, pdf-colors, parity-ui-controls
- **Start-up size plan:** Lazy-only (Editor chunk). TemplateThumb and pickerCards are shared with the lazy New page; nothing imported by Dashboard; constants/templates.js, templatePresets.js, utils/starterTemplates.js (start-up) are read-only. 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - functions that stopped working: 1-Page Fit single flight and disabled state, Undo ids, Add Google Font guards and offline check, number typed-box rules, resets and what Reset keeps, saved designs surviving deleting a re…
  - perf/render counts: dock open with a keystroke in the content (DesignPanel re-renders only while open); no width transition
  - persistence: panel open state and template section memory (EDIT-153), custom fonts key, cross-tab merge
  - error and empty states: empty filter, name clash, offline font check
  - tests that pass for the wrong reason: union count taken from the new groups instead of the pinned walk; toast-survival test must fail when two DesignPanels are mounted
  - narrow widths: 240 px dock minimum
- **Done when:**
  - RUN-STATE batch gate for the owned rows incl CHANGED EDIT-044/046/048 (editor-design-templates) each with a negative twin
  - walker matrix and 00-registry/01-offered green without edits (or registry edits justified in the report); one DesignPanel instance across group changes, proven
  - render check at 1440 for the drawer, control count by pane in the report
  - standing phone guard green
- **Parked (not built):** 
  - Per-element accent toggles and Use accent on headings (NEW-001/002)
  - New accent palette defaults (#2B59FF) and text-colour chip set (NEW-003/004): keep the live eight presets, four text presets and custom pickers
  - Drawer footer 'Changes save as you go' (NEW-010) and the rail group names as new words (NEW-012): the live section names stay
- **Risks:**
  - the Template, Type, Spacing, Headings and More panes are undrawn: design from the Color pane and tokens
  - emoji in the spacing preset labels conflicts with the canvas rule: keep (walker signature) and flag
  - regrouping must not unmount DesignPanel; parity-ui-controls throws on a div.fixed.inset-0.z-50 layer
- **Owner calls here:** none


### B8b (3 h): Template gallery, saved designs, phone Design sheet

- **Goal:** Restyle the gallery with ALL looks and apply-on-click Undo, the template pane's saved designs and Browse templates, and give the phone a Design chip rail with the More chip over the same DesignPanel groups prop.
- **Why here:** Needs B8a's rail and groups prop; it owns TemplateGallery and TemplateThumb (shared with the New page through stable props) and the phone sheet.
- **Depends on:** B8a  |  **Boards:** EditorTemplates, MobileDesign, Paper (render check of the thumbnails)
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **gallery**: Gallery frame, live category and filter chips, ALL looks selectable (19 templates + Sidebar single-column + 8 designs + saved designs; scroll, filter, group), current-look marker, apply on click with the Undo notice (8 s) and a single Done, empty-filter message, My designs (save/delete/clash), title count includes saved designs, stays mounted with the picture cache, cover-letter letterhead thumbnail, one-line descri… (files: src/components/TemplateGallery.jsx, src/components/TemplateThumb.jsx, src/hooks/usePickCard.js, src/index.css (this batch's single editor))
  - **phone-design**: Phone Design sheet as a chip rail Template, Color, Type, Spacing, Headings, More (all ten sections reachable), 16 px fields, per-section Reset with Undo, Save my design / My designs / Reset all with the inline confirm, the Word caveat and 1-Page Fit sentence shown as visible text on touch, room under the sheet for the pill. Uses the same DesignPanel groups prop; no second copy of any control. MOBI-160 verifying owne… (files: )
  - **tests**: picker.spec keeps role-and-name queries and gallery-* / design-design_* ids; class pins restated; the phone Word caveat and 1-Page Fit sentence are visible text on touch. (files: tests/playwright/picker.spec.mjs, tests/playwright/pdf-templates.spec.mjs, cypress/e2e/30-starters-and-design.cy.js, tests/pdf/93-picker-cards.test.mjs, tests/pdf/83-templates-ui-leftovers.test.mjs)
- **New tests (2):**
  - tests/pdf/187-ui-b8b-gallery.test.mjs (all looks incl saved designs selectable; filters; apply-on-click with Undo and Done; Cancel / Use template do not exist; count title; save/delete/name clash)
  - tests/pdf/187-ui-b8b-phone-design.test.mjs (rail includes More, every section reachable, Reset with confirm, hover-only hints visible)
- **Existing tests to update (2):**
  - class pins 93-picker-cards (reads source), 83-templates-ui-leftovers, tests/unit/picker-ui.unit.mjs, r4dsn-gallery-count.unit.mjs, r4dsn-gallery-category.unit.mjs; the 63 DesignPanel users stay green
  - Cypress 30, 07 (one case); Playwright picker (role names), pdf-templates
- **Start-up size plan:** Same as B8a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.
- **Bug-hunt focus:**
  - functions that stopped working: apply-on-click with Undo and Done, saved designs save/delete/name clash, all looks selectable incl saved designs
  - persistence: template section memory (EDIT-153), picture cache kept
  - narrow widths: 390 px sheet, gallery 2-up
  - tests that pass for the wrong reason: toast-survival test must fail when two DesignPanels are mounted
- **Done when:**
  - RUN-STATE batch gate for the owned rows incl CHANGED EDIT-017/025/028/030 and MOBI-083 each with a negative twin
  - render check at 1440 and 390 for the gallery and the phone sheet (and the Paper board for thumbnails)
  - every hover-only hint listed in MOBI-160 has visible text on touch, with the building batch named in the report
  - standing phone guard green
- **Parked (not built):** 
  - Cancel / Use template two-step (NEW-005; live apply-on-click with Undo and Done)
  - Showing 8 of 28 sentence, category word on cards (NEW-006/007)
  - live preview above the phone Design sheet (NEW-013, mobile D-08)
  - Use accent on headings switch on the phone (mobile D-10, MOBI-085)
  - 'Applies to the whole resume' label (mobile D-09)
  - NEW-008/009: the 'Current' badge text and the gallery subtitle are wording only; the live current-look marker stays
- **Risks:**
  - gallery stays mounted with the picture cache: a restyle must not remount it
  - TemplateThumb props are shared with the New page: stable
- **Owner calls here:** none


### B9a (2.5 h): Cover letter panel (letterhead, recipient, body, closing)

- **Goal:** Restyle the cover-letter panel (Letterhead block with every control, recipient, rich-text body, closing and signature) keeping every live control; no new capability. Draft and Improve follow in B9b.
- **Why here:** The switch and preview already show the letter (B3/B4) and the rich text toolbar exists (B6).
- **Depends on:** B3, B6  |  **Boards:** EditorLetter, MobileEdit (letter view), Letter (printed-page render check)
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **letter-panel**: Optional groups prop (default all). Letterhead block (collapsible, opens with every control): photo target with status line (every wording), Remove own, eye, photo text position, Fields Position (3 layouts) with the side gap, contact style Icon/Bullet/Bar, contact layout Single/Justify/2 Grid, six visible-contact eyes, the template note; Who it is for: Date with Today, recipient name/title/company, subject; body = r… (files: src/components/CoverLetterPanel.jsx, src/components/CoverLetterPanelShared.jsx, src/index.css (this batch's single editor))
  - **tests**: A parity walker over CoverLetterPanel (the audit found none walks the letter today): every control found is asserted to write the same key as before. It lives in tests/pdf/walk-extra/, outside tests/pdf/parity/: read the discovery code of 00-registry and 01-offered first and state in the report that the matrix is untouched. (files: tests/pdf/walk-extra/letter-panels.mjs, cypress/e2e/05-cover-letter.cy.js, cypress/e2e/14-contacts.cy.js, cypress/e2e/22-regressions-letters.cy.js, tests/playwright/pdf-cover-letter.spec.mjs)
- **New tests (2):**
  - tests/pdf/188-ui-b9a-letter-panel.test.mjs (letterhead controls, photo status wordings, date+Today, signature space/designation, rich body, groups default all)
  - tests/pdf/188-ui-b9a-letter-walker.test.mjs
- **Existing tests to update (3):**
  - CoverLetterPanel users: 31-contact-fields, 102-r4-dux-04-letter-apply-undo, 83-letter-signature-photo, 12-cover-letter, 44-cover-letter-generator-shapes, 21-cover-letter-looks-panel, 22-cover-letter-…
  - the letter body is rich text: the 99-rich-text-* tests stay green
  - cypress 21-a11y
- **Start-up size plan:** Lazy-only (Editor chunk). Nothing imported by the Dashboard; NewLetterModal (B1 lazy) untouched.
- **Bug-hunt focus:**
  - functions that stopped working: letter photo/position/contact controls reach the PDF, Auto-Generate Undo, export follows the open document
  - persistence: letter data keys, letter-linked jobs open on the letter, ?tab=coverletter
  - narrow widths: 390 px letter panel, 16 px fields
  - error and empty states: photo budget messages
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED ELAE-020 and ELAE-137 each with a negative twin (the body is rich text with the STAR button; label and placeholder kept)
  - letter walker added and green for the panel
  - standing phone guard green
- **Parked (not built):** 
  - word counter and plain text hint (NEW-06), 1 page caption (NEW-07)
  - Letterhead one-line summary (NEW-08): display only
- **Risks:**
  - letter photo and letterhead controls are undrawn: design from the Personal info photo pattern (B7)
- **Owner calls here:** none


### B9b (2.5 h): Draft from resume dialog and Improve (Bullet Optimizer)

- **Goal:** Restyle the Draft dialog with the three live archetypes and the Improve dialog with every live tool (60 verbs, six metric chips, seven X-Y-Z templates, Auto-Fix, Copy, Apply through the editor's undo stack); no new capability.
- **Why here:** Shares the generator and optimizer files and tests; follows the letter panel (B9a) so the Auto-Generate entry and the rich text body already exist.
- **Depends on:** B9a  |  **Boards:** EditorDraft, EditorImprove
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **draft-dialog**: Same dialog restyled: target company/role, recipient, the THREE live archetype cards (Impact and Metrics-Driven, Strategic and Leadership, Adaptability and Growth), amber no-details warning, live preview, Apply with the replace note and the Undo notice, Cancel, Escape and outside-click rules, phone full-screen. NO tone, length, posting or application controls. index.css is edited by the improve-dialog cluster only i… (files: src/components/CoverLetterGeneratorModal.jsx)
  - **improve-dialog**: Improve surface (dialog or drawer with room for 60 verbs): opens on the sentence at the caret/selection, editable statement box, Quality N/100 with the verb and metric indicators, weak-phrase indicator with Auto-Fix, tip lines, verb-blocked tip, power verb chips by category (60), six metric placeholder chips, seven Google X-Y-Z templates with Restore, Copy, Apply to Resume through the editor's own undo stack, Cancel… (files: src/components/BulletOptimizerModal.jsx, src/index.css (this batch's single editor))
  - **tests**: Extend the letter walker to the generator and the optimizer (same walk-extra location). (files: tests/pdf/walk-extra/letter-panels.mjs, cypress/e2e/28-writing-helpers.cy.js, tests/playwright/bullet-optimizer.spec.mjs, tests/pdf/103-r4-optimizer-helpers.mjs)
- **New tests (2):**
  - tests/pdf/189-ui-b9b-draft-dialog.test.mjs (three archetype cards, warning, apply+Undo, cancel; negative twin: no tone/length/posting/application controls)
  - tests/pdf/189-ui-b9b-improve.test.mjs (60 verbs, 6 metrics, 7 templates+Restore, Auto-Fix, Copy, Apply through undo; negative twin: no invented figures, no Shorter)
- **Existing tests to update (3):**
  - generator: 61-cover-letter-generator-recipient, 43-cover-letter-generator-escape, 104-r5-dlg-generator-dialog, 102-r4-dux-13-generator-no-details, 96-modal-outside-click, 104-r5-dlg-dph-36-generator-…
  - optimizer: r4cl-optimizer-chips, 102-r4-dux-09-optimizer-backdrop-keeps-edits, 103-r4-dvis-23-optimizer-not-faded, 104-r5-opt-01-escape-keeps-edits, 104-r5-opt-dux-22-restore-through-edits, 102-r4-du…
  - known flake 102-r4-dout-09-letter-title-weight on shard 2/6: rerun the failed shard once, never weaken
- **Start-up size plan:** Same as B9a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.
- **Bug-hunt focus:**
  - functions that stopped working: optimizer Apply writes back into the right field through the undo stack; generator Apply and its Undo notice
  - narrow widths: 390 px Draft and Improve full screen, 16 px fields
  - keyboard: Escape in generator/optimizer keeps edits; IME guards
  - tests that pass for the wrong reason: archetype test passing with three cards but wrong text
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED ELAE-076/079/080/084/086 each with a negative twin
  - no tone/length/posting/application control in the DOM (negative twin); no invented figures
  - standing phone guard green
- **Parked (not built):** 
  - Draft: pasted job posting, Or use an application chips, Tone cards, Length (NEW-01..05)
  - Improve: Shorter suggestion, Add a number with invented figures, best-verb row, word count in the strength line, Undo toast after Apply (NEW-13..17); the Improve button on Summary is the existing STA…
- **Risks:**
  - optimizer shares RichTextEditor with Job notes (B13a): keep its props stable
- **Owner calls here:** 
  - Confirm the PARK list for Draft and Improve (default: parked; live archetypes and chips are built)

### B10a (2.5 h): ATS drawer and phone ATS sheet

- **Goal:** Fill the ATS dock with the full checker (score dial, counts, six categories, every item with its inline fix, What a parser reads, Match a job box, plain-text card) and give the phone its ATS sheet.
- **Why here:** The dock exists (B3); the ATS panel is mounted only while open and keyed by resume id. Export and Share follow in B10b.
- **Depends on:** B3  |  **Boards:** EditorAts, MobileEdit
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **ats-drawer**: Dock content: score dial with grade and the four live colour bands (>=90 green, >=75 blue, >=60 amber, else red), progress bar, counts Passed / Suggestions / Critical, the six category breakdowns (headings, points, collapse), every check item with its inline fix (Put Job Title First, Standardize All Section Headings with Undo ids ats-fix-*, three layout fixes), What a parser reads disclosure (toggle, Copy, error wit… (files: src/components/AtsCheckerPanel.jsx, src/components/AtsParserView.jsx, src/components/AtsDock.jsx, src/index.css (this batch's single editor))
  - **tests**: Walker over AtsCheckerPanel controls (extended in B10b); lives in tests/pdf/walk-extra/ (outside the parity matrix folder: discovery code read first); spec updates for the opener and labels. (files: tests/pdf/walk-extra/ats-export-panels.mjs, cypress/e2e/27-ats-checker.cy.js)
- **New tests (2):**
  - tests/pdf/190-ui-b10a-ats-drawer.test.mjs (bands, counts incl critical, six categories, every fix with Undo, parser disclosure states, Match a job cap notices, unmount keeps the posting in session st…
  - tests/pdf/190-ui-b10a-phone-ats-sheet.test.mjs (ATS sheet reachable and complete on a phone)
- **Existing tests to update (2):**
  - AtsCheckerPanel users (17): 102-r4-dux-12-ats-fix-undo, 102-r4-dux-03-ats-classic-undo, 56-ats-layout-fix-buttons, 58-ats-standardize-headings, 77-ats-panel, 98-ats-parser-view, 98-ats-job-fields, 16…
  - Cypress 27, 21-a11y
- **Start-up size plan:** Lazy-only (Editor chunk). AtsDock imports AtsCheckerPanel lazily and only while open; nothing is imported by the Dashboard. 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - functions that stopped working: ATS fixes with Undo, parser view Retry, Match a job box caps, score recomputed from the printed resume
  - perf/render counts: AtsCheckerPanel re-renders per key only while open; analyze memoised
  - persistence: posting kept per resume across unmount
  - narrow widths: 390 px ATS sheet
  - tests that pass for the wrong reason: fix tests that check the button but not the document change
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED ELAE-051/053/072 each with a negative twin (live colour bands, Critical count, six categories)
  - ATS panel mounted only while open and keyed by resume id; walker green
  - standing phone guard green
- **Parked (not built):** 
  - score prediction sentence, Show me jumps, rewritten check wordings beyond live meaning (NEW-10/11/12)
  - dial and ATS chip number (NEW-32) and the stage caption toggle wording (NEW-33)
- **Risks:**
  - ATS drawer must stay mounted only while open and keyed by resume id
- **Owner calls here:** none


### B10b (3 h): Export / Import menu, Share dialog, phone export sheet

- **Goal:** Rebuild the Export split menu with every format and entry (labels kept as live) and the Share dialog with all its states, plus the phone export sheet carrying every entry (including the visible Word caveat).
- **Why here:** Shares useEditorExports and the export tests; closes the editor's remaining surfaces.
- **Depends on:** B10a  |  **Boards:** EditorDownload, EditorShare, ImportModal (editor entry), MobilePreview
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **export-menu**: Split button and menu with every item: PDF, Word, ATS text, Markdown, JSON Resume, Backup JSON, letter-tab variants (Letter PDF, Word, Cover Letter Text .txt with the live wording), Import a file (JSON, PDF, Word, text) with the hint line, Import as my original (demo accounts only), Share a public link (live visibility rule), Copy plain text as a second entry to the ATS text; the live 'Export' label strings stay (on… (files: src/components/ExportDropdown.jsx, src/hooks/useEditorExports.js, src/index.css (this batch's single editor))
  - **share-dialog**: All live states: loading, read error, not published (explanation, what would be public, Publish), published (switch semantics kept as Publish/Unpublish, link field, Copy with label, Open, time, what is public with the private-fields sentence), stale with the manual Update the public copy, unpublish two-step confirm, busy and error line; result lands only on its own resume; dialog keeps X/Escape/outside click; says t… (files: src/components/ShareLinkModal.jsx)
  - **tests**: Extend the walker to ExportDropdown and ShareLinkModal controls; the import-problem message tests are generated from a grep of the setExportError and onImportError literals in the source, not from the parity rows. (files: tests/pdf/walk-extra/ats-export-panels.mjs, cypress/e2e/03-export.cy.js, cypress/e2e/29-exports-imports.cy.js, cypress/e2e/05-cover-letter.cy.js (export part), tests/playwright/parity-preview-download.spec.mjs, …)
- **New tests (3):**
  - tests/pdf/191-ui-b10b-export-menu.test.mjs (every format and letter variant, Import a file, demo Import as my original, Share visibility, busy/error, file names)
  - tests/pdf/191-ui-b10b-share-dialog.test.mjs (loading, read-error, not-published, published, stale+update, two-step unpublish, busy/error, other-resume result)
  - tests/pdf/191-ui-b10b-phone-export-sheet.test.mjs (export sheet reachable and complete, Word caveat visible without hover)
- **Existing tests to update (3):**
  - export: 53-export-error-handling, 78-letter-export-menu, 102-r4-dux-17-import-new-resume-notice, 103-r4-dvis-22-export-menu-on-screen, 83-templates-ui-leftovers, 99-public-link, 99-import-ui, imp-imp…
  - share: 104-r5-dlg-share-link-dialog, 102-r4-dux-10-unpublish-confirm, 100-r4-sync-05-copied-label, 100-r4-sync-04-too-large-message, 105-r5-hunt4-share-result-other-resume, 96-modal-outside-click, 18…
  - Cypress 03, 29, 11-demo-account*, 12-regressions-security; Playwright pdf-*, parity-preview-download
- **Start-up size plan:** Lazy-only. ExportDropdown and useEditorExports stay editor-only (a hook imported by Dashboard would be hoisted; ImportDialog from B5b must not import them); utils/publicLink.js and jsonResumeExport.js stay dynamic. 71, 71-startup-public-link-lazy and 122 read in the targeted dispatch.
- **Bug-hunt focus:**
  - functions that stopped working: every export format produces its file after a keystroke, import from the editor opens the notice, share publish/update/unpublish races
  - persistence: share state per resume
  - narrow widths: 390 px sheets, menu on screen (103-r4-dvis-22)
  - error and empty states: share read error, export errors
  - tests that pass for the wrong reason: format tests that only check a menu label, not the downloaded blob
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED ELAE-119 and ELAE-121 each with a negative twin
  - every Export entry of today pinned including Import as my original (PARITY-RULE names it); format tests check the downloaded blob, not only the label
  - walker green; standing phone guard green
- **Parked (not built):** 
  - ATS-safe chip claim and item descriptions (NEW-19/20)
  - auto-update claim for the public link (NEW-24: updating stays manual)
  - Done button on Share is allowed (same function as X)
  - big Download PDF button and Share icon on the phone Preview (mobile D-05/D-06): the live sheet entries stay
- **Risks:**
  - export labels are shared by 47 Cypress uses: keep exact entry labels
  - Share on the letter view shares the resume (owner call in B3)
- **Owner calls here:** 
  - Wording of the public-link states (default: live wording, manual update)
  - Export versus Download wording (default: keep Export)

### B11 (3 h): Workspace shell: one bar for Applications and Projects, project switcher, search, kit variants, Public page

- **Goal:** Put the lazy workspace on the shared AppBar and phone tab bar, keep every shell function (search with Issues and Projects groups, global Create and c, shortcuts, sync dot, project switcher, sidebar kept restyled), add the canvas look as kit variants (no default changes), and restyle the public page.
- **Why here:** Applications and Projects both sit in this layout; doing it once means B12a-B16 only fill pages. Everything is lazy (0 start-up bytes). The legacy token values were re-pointed in B1, so only variants arrive here.
- **Depends on:** B2, B10b  |  **Boards:** ShellMenus (search palette), Jobs and Projects (top bar only), MobileJobs and MobileProject (bars), Public
- **Parity rows owned:** 5 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **bar-and-layout**: TopBar becomes AppBar plus slots (search, global Create and the c key, sync chip for jobs/projects, passes onShortcuts to AuthBar); the Projects item opens the project switcher menu (starred first, recent up to 8, View all projects, Your work, Create project); phone: AppBar + BottomTabBar, drawer removed, the same Projects menu reachable from the bar so Your work, the project list and Create project stay one tap awa… (files: src/components/shell/TopBar.jsx, src/components/shell/WorkspaceLayout.jsx, src/components/shell/PageHeader.jsx, src/components/shell/Sidebar.jsx, src/components/shell/SidebarContent.jsx, …)
  - **search-hotkeys**: Starts after bar-and-layout has landed and owns QuickSearch.jsx (extracted unchanged by that cluster's first commit; made lazy here); Projects group (live ranking: key typed in full, projects, key prefix, title words), the no-match line, arrow/Enter/Escape, phone search (icon in the bar opens a full-width box, 16 px text, X to close); / c ? [ guards unchanged (not while typing or under a dialog); shortcuts dialog fr… (files: src/components/shell/QuickSearch.jsx, src/utils/workspaceSearch.js, src/hooks/useHotkeys.js, src/components/ui/ShortcutsDialog.jsx, src/components/shell/CollectionSyncDot.jsx)
  - **kit-and-tokens**: ADD variants and props, change no default: Button quiet/primary at canvas shape (9 px radius, 36 px, 44 px touch only where a canvas dimension says so), NavTabs and tabClass pill variant (adopted in B12a/B14a), Popover/Menu with --shadow-pop, Toast and ConfirmDialog card shape, Chip tones. Start-up kit files (Dialog, Tooltip, IconButton, Kbd, compose, placement, useFloating, useFocusTrap, usePresence, useScrollLock,… (files: src/components/ui/Button.jsx, src/components/ui/Popover.jsx, src/components/ui/Menu.jsx, src/components/ui/MenuList.jsx, src/components/ui/NavTabs.jsx, …)
  - **public-page**: Slim bar with the brand link to /, the read-only paper (live PDF render), Download PDF with the preparing and failure states, the four message states (loading, not published, error, no cloud), rendering/failed-with-Retry states, phone reading (page scaled to width), the footer sentence; data rules and no-stale-content on link change unchanged. (files: src/pages/PublicResume.jsx)
- **New tests (6):**
  - tests/pdf/192-ui-b11-workspace-shell.test.mjs (nav active states, Projects menu content and entries, global Create and c, Your work reachable, sidebar kept with [ and its key, sync chip, shortcuts en…
  - tests/pdf/192-ui-b11-quick-search.test.mjs (Projects group, no-match line, ranking, phone search open/close, key guards)
  - tests/pdf/192-ui-b11-phone-bar.test.mjs (bottom tab bar on workspace pages; Your work, project list and Create project reachable on a phone)
  - tests/pdf/192-ui-b11-public-page.test.mjs (states, preparing/failure, phone, brand link)
  - tests/unit/ui-kit.unit.mjs and ui-overlays.unit.mjs gain cases for each new variant (defaults asserted unchanged)
  - … and 1 more (see plan-work/final.json)
- **Existing tests to update (5):**
  - tests/unit/ui-shell.unit.mjs, tests/pdf/102-r4-dux-07-workspace-account, 102-r4-dux-06-one-discard-question, 105-r5-hunt3-create-in-viewed-project, 104-r5-out-dout-04-sidebar-project-keep, 104-r5-out…
  - search: 103-r4-dph-04-phone-search, 103-r4-dph-11-topbar-search, 103-r4-dvis-15-topbar-search-kit, tests/unit/r5-job-03-quick-search-fits.unit.mjs, r4-lo-25-quick-search-shrunk-list.unit.mjs, 103-r4-…
  - tests/unit/collection-sync-status.unit.mjs, 99-public-link, r5hunt7-public-page-link-change, 71-startup-public-link-lazy (stays), the 74 kit class-pin tests (103-r4-dph/dvis families that import ui f…
  - cypress 06-job-tracker and 00-smoke (nav labels), 26-mobile-layout, 21-a11y (watch only)
  - cypress 21-a11y (workspace pages; watch only)
- **Start-up size plan:** Lazy-only: shell/*, ui/* variants and PublicResume are outside the start-up path. AppBar and BottomTabBar are imported, not edited. AppRoutes.jsx (start-up) touched only if a route changes and then net-zero. Run 71-startup-chunks in the targeted dispatch and record the unchanged figure.
- **Bug-hunt focus:**
  - functions that stopped working: c, /, ?, [ shortcuts and guards; search results open the issue or project; Create from every workspace page
  - keyboard: palette arrows, Enter, Escape
  - narrow widths: 390 px bar with search open; bottom bar versus page actions
  - persistence: window scroll memory per history entry (RouteFrame untouched), sidebar key
  - error and empty states: no-match line; public page four states; board storage notices still shown on workspace pages
  - tests that pass for the wrong reason: nav-label tests matching both old and new text; class-pin tests after the new variants
- **Done when:**
  - RUN-STATE batch gate for the owned rows; every shortcut and the Projects menu entries pinned by name; CHANGED SHEL-011, SHEL-084 (negative twin: the palette keeps the issues group and opens the issue) and PROJ-207 each with a negative twin…
  - kit unit tests show no default changed; 71 spare unchanged from B5b
  - phone: Your work, project list, Create project reachable (MOBI-004..006) before B14a starts
  - standing phone guard green
  - QuickSearch extracted in a first commit and owned by one cluster at a time; the shortcuts dialog is reachable by pointer without sign-in
- **Parked (not built):** 
  - Applications/Documents groups in the palette (job results; D-02, N14)
  - Want your own? Make a resume footer on the public page (D-13, ELAE NEW-27)
  - Read-only copy header label beyond the live footer sentence (NEW-26)
  - palette Open action label is styling only (D-19)
- **Risks:**
  - sidebar decision unanswered: ships kept-and-restyled, never drop a function silently
  - kit variants must not move the class-pin tests; any default edit is a defect
  - clusters run in order: bar-and-layout (QuickSearch extraction first), then search-hotkeys, then kit-and-tokens and public-page; split point B11a/B11b after the first two if a window runs out
- **Owner calls here:** 
  - Sidebar and [ shortcut: drop (canvas draws none) or keep (default: keep restyled, no function lost; retire in B17 only on an explicit yes)
  - Project switcher placement (default: the Projects nav item menu)

### B12a (3 h): Applications A: header, toolbar, Board, cards, phone board; J-30 root cause

- **Goal:** Rebuild the Applications header, view switch, toolbar and the Board with all eight statuses and every card field, plus the more menu and the phone chips; root-cause the J-30 flake.
- **Why here:** The shell is done (B11); Applications is lazy-only and independent of the editor. The board comes before the list and the drawer because the drawer opens from it, and J-30 is fixed as early as possible because it can hit any gate.
- **Depends on:** B11  |  **Boards:** Jobs, MobileJobs, States (empty Applications)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **board-and-header**: Header Applications with the plain count, view switch Board | List | Insights (pill variant; Summary stays reachable), Add job (still opens the existing form route until B13a), more menu holding Import JSON, Export JSON, Export CSV and Clear all jobs (danger, confirm and Undo); toolbar search, status quick filters with counts (second tap clears), result count and Clear, totals strip (Cypress 06 reads Total/Interview… (files: src/pages/JobTracker.jsx, src/components/job/KanbanView.jsx, src/components/job/StatusBadge.jsx, src/components/job/jobTone.js, src/components/tracker/Lozenge.jsx, …)
  - **tests**: Update the Job Tracker tests keeping the guards; J-30 (search, status filter and list sort kept after opening a job and Back, shard 2/6): read the failing shard log, reproduce the useSessionState write-ordering race deterministically in the new test (red without the fix), fix the cause; never skip or retry-away. Add a test that ?view=summary, ?view=list and ?view=kanban still select the matching view. (files: tests/pdf/81-job-tracker-session.test.mjs, tests/pdf/81-job-tracker-page.test.mjs, tests/pdf/81-job-tracker-ui.test.mjs, cypress/e2e/06-job-tracker.cy.js, cypress/e2e/20-regressions-job-shape.cy.js, …)
- **New tests (6):**
  - tests/pdf/193-ui-b12a-board.test.mjs (eight distinct columns, drop hint, filtered-empty with Clear, move menu with all 8 and Undo, delete confirm and Undo)
  - tests/pdf/193-ui-b12a-card.test.mjs (every card field incl posting link, contact, location/salary, tasks bar, absolute applied day, deadline pill rules)
  - tests/pdf/193-ui-b12a-toolbar-menu.test.mjs (search/status memory, result count, import JSON, export JSON/CSV, Clear all with Undo, notices)
  - tests/pdf/193-ui-b12a-phone-board.test.mjs (stage chips for all eight statuses incl Phone Screen, Interview and Closed, card actions sheet, Add job)
  - tests/pdf/193-ui-b12a-j30-session-state.test.mjs (deterministic J-30 reproduction)
  - … and 1 more (see plan-work/final.json)
- **Existing tests to update (2):**
  - 81-job-tracker-session (J-30), 81-job-tracker-page, 81-job-tracker-ui, 102-r4-dux-18-board-empty, 102-r4-dux-02-clear-all-undo, 105-r5-hunt7-status-move-undo, 103-r4-dvis-04-kit-tabs, 103-r4-dph-02-s…
  - Cypress 06-job-tracker (Add job header button, view toggle titles), 20-regressions-job-shape, 21-a11y
- **Start-up size plan:** Lazy-only (jobs pages are lazy chunks). utils used by the Dashboard (jobStats) are not edited. 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - perf/render counts: 3,000-job list does not redraw every card per keystroke (118, memoised cards, day prop); sensors module constants (172)
  - functions that stopped working: every status reachable by drag, keyboard and menu; import merge rules; clear all with Undo
  - persistence: search/status/sort session keys, list sort key, cloud sync indicator
  - narrow widths: 390 px chips and cards, table scroll
  - error and empty states: no jobs, nothing matches, storage full, unreadable list recovery
  - tests that pass for the wrong reason: J-30 style tests that wait on a timer
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED APPL-017/028/029/031/123/124 and MOBI-091/092/094/096/097 each with a negative twin (Phone Screen and Interview distinct, Closed sub-statuses distinct)
  - J-30 root-caused with a failfirst-proven test; flake not re-appearing in the batch's full gate
  - standing phone guard green
- **Parked (not built):** 
  - relative times on cards and Activity (N4: absolute dates stay)
  - interview this week count (N5)
  - per-column + add (N17)
  - merged Interviewing/Closed chips (D-17: every status stays reachable)
- **Risks:**
  - the canvas merges statuses; the live eight must stay visible (owner call)
  - J-30 is a session-state race: reproduce it deterministically before touching the hook
- **Owner calls here:** 
  - Status grouping: live eight columns (default) versus canvas five lanes with sub-statuses
  - Relative dates on cards (default parked)

### B12b (2.5 h): Applications B: List, notices, sort, phone List

- **Goal:** Rebuild the List (all columns, sort menu, empty state), the notices strip (not saved, sync held, recovery, import result) and the phone List and its card actions.
- **Why here:** The board and toolbar exist (B12a); the list shares JobTracker.jsx and the row open path.
- **Depends on:** B12a  |  **Boards:** JobsList, MobileJobs
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **list-and-notices**: List table with Company+posting, Role, real Status chip, Location, Salary, Applied, Deadline (same red/amber rules), Contact, Tasks, Resume ('Resume deleted'), row open and row menu with Delete; Sort menu offering all eight columns plus Latest activity, both directions and default, saved; list empty state; notices strip: not-saved (its own texts and export advice), sync held, recovery, import result. Phone: stage ch… (files: src/components/job/ListView.jsx, src/components/job/Pipeline.jsx, src/components/job/JobsNotSavedAlert.jsx, src/components/job/ImportNotice.jsx, src/index.css (this batch's single editor))
  - **tests**: Update the notices and list specs keeping the guards. (files: cypress/e2e/20-regressions-job-store.cy.js, cypress/e2e/20-regressions-job-unsaved.cy.js)
- **New tests (2):**
  - tests/pdf/194-ui-b12b-list.test.mjs (columns incl Location/Salary/Contact, real status names, sort menu eight columns plus latest, both directions, saved, empty state)
  - tests/pdf/194-ui-b12b-phone-list.test.mjs (phone List: the table scrolls or shows cards, Location, Salary and Contact stay one tap away, card actions sheet, notices on a phone)
- **Existing tests to update (2):**
  - 105-r5-hunt7-list-resume-deleted, 95-sync-privacy-notices, tests/unit/job-csv.unit.mjs
  - Cypress 20-regressions-job-store, 20-regressions-job-unsaved
- **Start-up size plan:** Same as B12a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.
- **Bug-hunt focus:**
  - perf/render counts: 3,000-job list does not redraw every card per keystroke (118, memoised cards, day prop); sensors module constants (172)
  - functions that stopped working: every status reachable by drag, keyboard and menu; import merge rules; clear all with Undo
  - persistence: search/status/sort session keys, list sort key, cloud sync indicator
  - narrow widths: 390 px chips and cards, table scroll
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED APPL-013/040/045/049 and MOBI-107 each with a negative twin (all eight sortable columns plus latest, real status names, Location/Salary/Contact one tap away on a phone)
  - standing phone guard green
- **Parked (not built):** 
  - footer sorted by latest activity and Open the board link (N8)
  - canvas Filter and Sort buttons as new controls (N12): the live search, chips and column sort stay
- **Risks:**
  - list columns plus phone List: the horizontal scroll rule must keep Location/Salary/Contact one tap away
- **Owner calls here:** none


### B13a (3 h): Applications C: job address contract and the job drawer (shared Drawer primitive)

- **Goal:** Open a job in a right-hand drawer (bottom sheet on a phone) holding every live detail, status and task function, behind an address contract that keeps the board mounted: /jobs?job=ID, with the old /jobs/:id, /jobs/new and /jobs/:id/edit redirecting; the existing form shows in a plain overlay until B13b restyles it.
- **Why here:** Needs the board and list as openers (B12a, B12b). It introduces the overlay Drawer (first consumer: the job drawer, so dead-code.unit stays green); B15 reuses it unchanged for the issue drawer. Verified in the source: /jobs, /jobs/new, /jobs/:id/edit and /jobs/:id are four sibling routes, and RouteFrame, WorkspaceLayout (ErrorBoundary key) and useScrollMemory all key on pathname, so a path-based drawer would remount the board and reset its scroll; a query parameter avoids touching any of them.
- **Depends on:** B12b  |  **Boards:** Jobs (drawer open), MobileJobs (detail)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **drawer**: FIRST COMMIT (own bytes ledger, net zero or negative): AppRoutes.jsx turns the three job routes into tiny redirects (Navigate replace: /jobs/:id -> /jobs?job=ID, /jobs/new -> /jobs?job=new, /jobs/:id/edit -> /jobs?job=ID&edit=1) and JobDetail and JobForm are loaded by JobTracker's own lazy chunk, so the pathname stays /jobs and RouteFrame, WorkspaceLayout and useScrollMemory (all keyed on pathname) are NOT edited; r… (files: src/AppRoutes.jsx (job address redirects only, first commit), src/components/ui/Drawer.jsx, src/pages/JobDetail.jsx, src/components/job/OverviewTab.jsx, src/components/job/TasksTab.jsx, …)
- **New tests (3):**
  - tests/pdf/195-ui-b13a-job-drawer.test.mjs (status menu all 8, stepper steps clickable incl Phone Screen, closing/restart/resume actions, history, tasks seven functions, notes autosave and rich toolba…
  - tests/unit/ui-b13a-drawer.unit.mjs (Drawer: Escape, outside click, scroll lock, closes on route change)
  - tests/pdf/195-ui-b13a-job-address.test.mjs (the three old addresses redirect with replace; Back from the drawer returns to /jobs; JobTracker stays mounted while the drawer opens and closes, main scro…
- **Existing tests to update (2):**
  - JobDetail users (11): 105-r5-hunt7-status-move-undo, 105-r5-hunt5-job-import-dates, 103-r4-dvis-04-kit-tabs, 105-r5-hunt3-job-task-undo-after-tab-switch, 95-job-notes-tab, 100-r4-job-01-details-resum…
  - 89-app-routes, tests/unit/ui-shell.unit.mjs, 71-startup-chunks (read and updated with evidence if needed); Cypress 06-job-tracker, 20-regressions-job-* (job not found must not appear), 21-a11y
- **Start-up size plan:** AppRoutes.jsx is a start-up file: the first commit is net zero or negative with a byte ledger (the three lazy imports move out of it); 71-startup-chunks is read before and after and dispatched. Everything else is lazy-only: ui/Drawer.jsx is a new lazy kit file imported only by lazy pages (it must not pull Dialog parts onto the start-up path; Dialog is lazy since B1). JobDetail/JobForm stay lazy.
- **Bug-hunt focus:**
  - functions that stopped working: every field editable in place, status moves with Undo toast wordings, delete from the drawer closes it and Undo restores in place, history entries, tasks Undo after tab switch
  - error and empty states: not found, empty tasks, no deadlines
  - tests that pass for the wrong reason: drawer tests asserting the drawer exists but not that each row writes
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED APPL-061/062/063/068/070/074/078/087/089 each with a negative twin
  - old job addresses redirect; the board stays mounted with scroll, search, status and sort kept (also covers J-30 by construction); Drawer unit test green; Drawer reusable by B15 without change
  - AppRoutes bytes ledger and 71 figure in the report
  - standing phone guard green
- **Parked (not built):** 
  - job-side ATS match card (N1) and attached cover letter row (N2)
  - free-text Next step and interview time (N3: build only Deadline and Follow-up lists)
  - Move to Interviewing label (N16: live next-status wording)
- **Risks:**
  - most undrawn rows (tasks, notes, details) are MISSING: follow the live Overview/Tasks/Notes tabs regrouped as drawer sections
  - RouteFrame, WorkspaceLayout and useScrollMemory must not be edited: proven by the existing Back-keeps-scroll tests
  - deep link and Back: one history entry per open
- **Owner calls here:** 
  - The address of a job becomes /jobs?job=ID with the old /jobs/:id kept as a redirect (default: yes)
  - Drawer replaces the /jobs/:id page entirely (default: yes, deep link and Back kept)

### B13b (2.5 h): Applications D: Add/Edit job modal and Insights

- **Goal:** Rebuild the Add/Edit form as a modal with every field and guard, and Insights with every live list and the career history card.
- **Why here:** Needs the address contract and the drawer (B13a); the form already renders in an overlay there.
- **Depends on:** B13a  |  **Boards:** JobAdd, JobsInsights, MobileJobs (detail)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **job-modal**: Add job as a modal over the board: Company, Role, Posting link, Status (opens at Applied), Applied date (status follows date rule), Resume used, More details group with every other live field (location, salary, work mode, source, deadline, follow-up, contact, interview stage with custom stages and clear, notes rich text); Enter saves; save rule company OR role (message says a company or a role is enough); leave guar… (files: src/pages/JobForm.jsx, src/components/job/InterviewStageSelector.jsx, src/components/job/Field.jsx, src/index.css (this batch's single editor))
  - **insights**: Insights: stat strip (active, interviewing, offers, response rate with the live fixed hints), pipeline funnel, status donut with legend and empty state, Deadlines list (status badge, DatePill, empty text) and Follow-ups due (due-only rule, +N more, empty text), Career History card (lazy CareerHistoryPanel, same numbers and rules), rows open the job drawer; Insights never filtered by the board's search or status. Pho… (files: src/components/job/JobSummary.jsx, src/components/tracker/Charts.jsx, src/utils/careerHistory.js (read only))
- **New tests (2):**
  - tests/pdf/196-ui-b13b-job-modal.test.mjs (every field, stage picker and custom stages, company-or-role rule and message, discard guard once, draft restore, edit mode, deleted in another tab, after-sa…
  - tests/pdf/196-ui-b13b-insights.test.mjs (tiles, funnel, donut, Deadlines, Follow-ups +N more, career card, never filtered, rows open the drawer)
- **Existing tests to update (2):**
  - JobForm users (16): 100-r4-job-02-follow-up-fields, 102-r4-dux-06-one-discard-question, 81-job-resume-pickers, 103-r4-dvis-01-job-form-page-header, r5hunt6-signout-job-form, r5hunt6-signout-other-tab…
  - 59-career-history, 103-r4-dvis-32-career-panel-workspace-look, 103-r4-dph-02-summary-grid-columns, 105-r5-hunt1-summary-follow-ups-sorted; 71-startup-chunks stays; Cypress 06-job-tracker, 20-regressi…
- **Start-up size plan:** Lazy-only. JobForm stays a lazy page chunk; 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - persistence: draft restore, hidden data fields, cross-tab merge, sign-out while the form is open, deep link reload of /jobs/:id
  - keyboard: Enter saves, Escape closes the drawer but never mid-edit loss (discard asked once)
  - error and empty states: not found, empty tasks, no deadlines
  - tests that pass for the wrong reason: drawer tests asserting the drawer exists but not that each row writes
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED APPL-092/098/099/105/112/117/118 each with a negative twin
  - N9/N10 same-function items verified; Insights never filtered by the board's search or status
  - standing phone guard green
- **Parked (not built):** 
  - stat tile hints with names and times (N6)
  - Edit career history button (N7, D-21)
  - N9 and N10 are the same functions: kept (Applied default, More details layout)
- **Risks:**
  - the leave guard must ask once even though the modal sits over a mounted board
  - Insights rows open the drawer: the contract with B13a is the ?job=ID address
- **Owner calls here:** 
  - After saving return to the drawer (default: yes per fix)

### B14a (3 h): Projects 1a: landing, Your work, project header and tabs, Create project, phone landing

- **Goal:** Rebuild the Projects landing (Your work, recent, all projects), the shared project header and tabs and the Create project dialog, keeping every live function; the Board follows in B14b.
- **Why here:** Projects stays (parity); lazy-only and independent of the editor, so it follows the editor and Applications. Landing and header first because the Board and the issue drawer open from them.
- **Depends on:** B11  |  **Boards:** Projects, MobileProject, States (empty Projects)
- **Parity rows owned:** 3 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **landing-header**: Landing: Your work (Overdue, Due today, Due this week, In progress sections shown only when non-empty; Worked on tab with the 15 latest; row with type icon, status and updated time; Mark done as a real control with the Undo toast, recurrence cleanup, hidden without a done column; the two empty lines), Recent projects (up to 4, starred first; Backlog quick link and Kanban/Scrum label; Open issues N), All projects tab… (files: src/pages/Boards.jsx, src/pages/YourWork.jsx, src/components/board/CreateProjectDialog.jsx, src/components/board/ProjectTabs.jsx, src/components/board/BoardStorageNotice.jsx, …)
  - **tests**: Update the landing, Your work and header tests keeping every guard; 172-board-sensors-stable stays green untouched. (files: tests/pdf/103-r4-dph-08-projects-table-phone.test.mjs, tests/pdf/82-your-work-page.test.mjs, tests/pdf/102-r4-dux-19-mark-done-undo.test.mjs, tests/pdf/106-r5-hunt7-create-project-double-submit.test.mjs, tests/pdf/82-board-pages.test.mjs)
- **New tests (3):**
  - tests/pdf/197-ui-b14a-projects-landing.test.mjs (Your work buckets incl Overdue and In progress, Worked on, Mark done control with Undo, recent four, all-projects Lead column, no-match line, create d…
  - tests/pdf/197-ui-b14a-project-header.test.mjs (breadcrumb link, rename, star, menu, Backlog tab for Kanban, not-found)
  - tests/pdf/197-ui-b14a-phone-landing.test.mjs (landing cards, Your work and Create project reachable on a phone)
- **Existing tests to update (2):**
  - 82-board-pages, 103-r4-dph-08, 95-sync-privacy-notices, 104-r5-brd-helpers.mjs consumers, touch-reveal.unit.mjs
  - 172-board-sensors-stable must stay green
- **Start-up size plan:** Lazy-only (boards pages and board components are lazy chunks). 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - persistence: boards storage keys, demo project, cross-tab merge, updatedAt stamping, cloud sync
  - narrow widths: 390 px landing and board, bottom bar versus floating create
  - error and empty states: no projects, no work, project not found, unreadable boards recovery
  - tests that pass for the wrong reason: tests that find cards by title text but not their menu
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED PROJ-022/025/026/027/044/212 and MOBI-127 each with a negative twin (Backlog tab for Kanban; type icon on Your work rows)
  - phone landing keeps Your work and Create project reachable (MOBI-004..006 verified from B11)
  - standing phone guard green
- **Parked (not built):** 
  - issue/epic/backlog renamed task/group/plan and Kind (D-01: live words stay)
  - recent-project stats Done/Due soon/Edited (D-05)
  - Your work subtitle 4 tasks need you this week (D-07)
  - key chip is allowed display-only (D-02)
- **Risks:**
  - AppRoutes unchanged: the landing merges Your work and the list on /boards and /work (both routes kept)
  - the canvas drops the type icon: restored per fix
- **Owner calls here:** 
  - Vocabulary: issue/epic/backlog (default live) versus task/group/plan (canvas)
  - Kanban Backlog tab kept (default: yes, live)

### B14b (3 h): Projects 1b: Board, toolbar, swimlanes, cards, Create issue, phone board

- **Goal:** Rebuild the Board with its toolbar, swimlanes, cards, column menus and composers, the Create issue dialog and the phone board, keeping every live function.
- **Why here:** Needs the project header and IssueTypeIcon (B14a); the issue drawer and the other views (B15, B16) open from the board.
- **Depends on:** B14a  |  **Boards:** ProjectBoard, MobileProject
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **board**: Toolbar: search, Filter popover with the four filters and a count, quick filters Overdue and Due this week, Clear filters, Group by with swimlanes (fold, count, sticky column row), info line (active sprint, end date, goal; hidden-done notice), no-match line; columns with WIP chip n/limit, column menu (rename, WIP, delete rules), add column; card face: title, epic lozenge, up to 2 labels and +N, type icon (Task/Bug/S… (files: src/pages/Board.jsx, src/components/board/BoardToolbar.jsx, src/components/board/BoardColumn.jsx, src/components/board/IssueCard.jsx, src/components/board/InlineCreate.jsx, …)
  - **create-issue**: Create issue dialog/sheet with every field (Project select that keeps typed fields, Type, Status, Summary 255, and the live others), defaults from the opener (viewed project, clicked column, calendar day), reachable from the bar Create, c, column foot, calendar day plus; discard-typed guard; uses IssueTypeIcon from B14a. (files: src/components/board/CreateIssueDialog.jsx)
  - **tests**: Updates the Board/CreateIssue tests; 172-board-sensors-stable, board-scroll-snap.unit and board-drop*.unit stay green untouched. (files: tests/pdf/103-r4-dph-06-board-toolbar-filters.test.mjs, tests/pdf/82-board-ime-enter.test.mjs, tests/pdf/102-r4-dux-01-create-issue-project-switch.test.mjs, tests/pdf/102-r4-dux-05-discard-typed-create.test.mjs, tests/pdf/105-r5-hunt3-create-in-viewed-project.test.mjs, …)
- **New tests (3):**
  - tests/pdf/198-ui-b14b-board.test.mjs (Filter four filters, Overdue/Due this week/Clear, swimlanes, info line, WIP, composer with type picker, card face incl points and +N and type icon, card menu Mov…
  - tests/pdf/198-ui-b14b-create-issue.test.mjs (all fields, opener defaults, project switch keeps fields, discard guard)
  - tests/pdf/198-ui-b14b-phone-board.test.mjs (Filters panel, column switcher beyond four, Move to, create sheet)
- **Existing tests to update (3):**
  - Board users (18) incl 82-board-pages, 82-board-ime-enter, 103-r4-dph-06, tests/unit/board-scroll-snap.unit.mjs
  - 172-board-sensors-stable must stay green
  - Cypress: no Projects spec exists; Playwright none
- **Start-up size plan:** Same as B14a: lazy-only (lazy chunks), no start-up file touched; 71-startup-chunks is read in the targeted dispatch and its figure recorded.
- **Bug-hunt focus:**
  - functions that stopped working: drag between columns and swimlanes, WIP, filters per view memory (PROJ-218), Mark done, create from every opener, deep links ?issue=
  - persistence: boards storage keys, demo project, cross-tab merge, updatedAt stamping, cloud sync
  - perf/render counts: sensors constants (172), card memo
  - tests that pass for the wrong reason: tests that find cards by title text but not their menu
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED PROJ-064/068/080/117/229 and MOBI-130 each with a negative twin (type icon visible on every card)
  - 172-board-sensors-stable green untouched
  - standing phone guard green
- **Parked (not built):** none

- **Risks:**
  - the canvas drops points, Overdue, the card menu: all restored per fix; the brief lists them
  - drag sensors stay module constants
- **Owner calls here:** none


### B15 (3 h): Projects 2a: issue drawer, List, Calendar, Timeline, Summary

- **Goal:** Open an issue in the shared Drawer with every live field, checklist and activity, and restyle List, Calendar, Timeline and Summary keeping every function, with their phone cuts.
- **Why here:** Needs the board as opener (B14b) and the Drawer from B13a; the read-only views and the issue drawer share the issue model and IssueTypeIcon. Split from the Backlog/Settings half so each batch fits a window.
- **Depends on:** B13a, B14b  |  **Boards:** ProjectIssue, ProjectList, ProjectCalendar, ProjectTimeline, ProjectSummary, MobileProject
- **Parity rows owned:** 4 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **issue-drawer**: Issue in the B13a Drawer unchanged (deep link ?issue=KEY kept; trail with project link that closes the view when opened over that project and parent epic link): title, status chip as a menu of the project's columns, checklist, description, compact properties (priority, due, labels) plus More details with every live field (type, parent epic not on epics, sprint on Scrum, story points, start date, repeats), created/up… (files: src/components/board/IssueDialog.jsx, src/components/board/IssueDetails.jsx, src/components/board/IssueFields.jsx, src/components/board/IssueActivity.jsx, src/components/board/IssueChecklist.jsx, …)
  - **views**: List: Type, Key, Summary, Status (menu), Priority, Labels, Parent, Due, Points, Updated, header sort asc/desc/rank, count 'N of M', toolbar search + Epic/Type(incl Epic)/Label/Priority + Overdue/Due this week/Clear, foot composer, empty lines; Calendar: month grid (Monday first) with at most three chips and +N more, Today, search and filters, the day plus creating an issue due that day, the No due date count; Timeli… (files: src/pages/ProjectList.jsx, src/pages/ProjectCalendar.jsx, src/pages/ProjectTimeline.jsx, src/pages/ProjectSummary.jsx)
  - **tests**: Updates view and issue tests to the new markup keeping every guard. (files: tests/pdf/issue-view-page.mjs, tests/pdf/82-issue-view-r4-02.test.mjs, tests/pdf/82-issue-view-r4-03.test.mjs, tests/pdf/82-issue-view-r4-05.test.mjs, tests/pdf/82-issue-view-r4-06.test.mjs, …)
- **New tests (3):**
  - tests/pdf/199-ui-b15-issue-drawer.test.mjs (properties and More details fields, status menu of all columns, checklist, All/Comments/History incl empty lines, resolved stamp, epic child list, trail li…
  - tests/pdf/199-ui-b15-views.test.mjs (List columns, header sort, status menu, filters incl Overdue/Due this week/Clear; Calendar three chips and +N more, day plus, filters; Timeline epic fold, status …
  - tests/pdf/199-ui-b15-phone-views.test.mjs (list, calendar, timeline, summary and issue sheet reachable; status change one tap away)
- **Existing tests to update (2):**
  - 82-board-pages, 103-r4-dph-09/05/18/01, 103-r4-dvis-20-timeline-row-hover, 105-r5-hunt3-list-backlog-hidden-create, 107-r5-hunt6-type-filter-epic, r5hunt8-points-invalid-text, r5hunt8-rev-unreadable-…
  - 172-board-sensors-stable must stay green untouched
- **Start-up size plan:** Lazy-only. All project pages stay in the 71 page regex; the Drawer is reused unchanged from B13a (no new kit module). 71 read in the targeted dispatch.
- **Bug-hunt focus:**
  - functions that stopped working: status changes from every row, calendar day create, timeline bar spans, issue field writes, comment edit/delete, m shortcut only on the top dialog
  - persistence: per-view filters, deep links ?issue=, description and comment drafts kept
  - narrow widths: 390 px each view, drawer as sheet, tables that scroll
  - error and empty states: every empty line, issue not found, epic with no children
  - perf/render counts: dragging and typing do not re-render the board behind the drawer
  - tests that pass for the wrong reason: tests that open the drawer but check only the title
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED PROJ-091/108/109/120/123/125/127/134/138/139/144/225 each with a negative twin
  - type icon on every List row, Calendar chip and Timeline row (PROJ-229 verified with B14b's card icon)
  - standing phone guard green
- **Parked (not built):** 
  - Timeline Weeks/Months (D-03)
  - Due soon list on Summary (D-04: live shows the count; keep the count)
  - checkbox square on List rows (D-06)
  - No due date rail (D-08)
  - Summary activity wording (D-14)
  - author name Alex Johnson, Comments default tab without All (D-15, D-16: live You and All tab stay)
- **Risks:**
  - the canvas simplifies the issue view and drops several fields: the build keeps all of them
  - the canvas calendar shows one chip a day: the 3-a-day limit and +N more must be kept (unproven in the canvas)
- **Owner calls here:** 
  - Weeks/Months scale (default: parked)

### B16 (3 h): Projects 2b: Backlog and sprints, Settings, phone project views

- **Goal:** Restyle the Backlog (Kanban page and Scrum sprints with Start and Complete dialogs, Create sprint, sprint menu, points bubbles, epic panel) and project Settings keeping every function, and finish the phone cuts of every project view.
- **Why here:** Sprint rules and the settings column rules are behaviour-heavy; they get their own window after the read-only views, so any restyle that touches a rule is a visible defect rather than a rushed one.
- **Depends on:** B15  |  **Boards:** ProjectBacklog, ProjectSettings, MobileProject
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **backlog-settings**: Backlog: Kanban page (one Backlog section with every open issue, Use sprints banner), Scrum sections with points bubbles per status, row type icon and points, status menu, epic lozenge, drag by the whole row (visible handle optional), row menu Move to, sprint start dialog (name, dates, goal, blocking rules and disabled reasons), complete sprint dialog (done/open counts, move open issues), create sprint, sprint menu … (files: src/pages/Backlog.jsx, src/components/board/BacklogParts.jsx, src/pages/BoardSettings.jsx, src/index.css (this batch's single editor))
  - **phone-views**: Phone cuts of Backlog row (epic lozenge and status menu one tap away), Settings, and the sweep that every project view and the issue sheet is reachable on a phone (list hides Type/Labels/Parent/Points/Updated columns but status stays one tap away); class pins restated. (files: tests/pdf/103-r4-dph-10-row-composer-stacks.test.mjs, tests/pdf/103-r4-dph-11-add-column.test.mjs, tests/pdf/103-r4-dph-11-board-fields.test.mjs, tests/pdf/103-r4-dph-11-settings-fields.test.mjs)
  - **tests**: Updates backlog and settings tests to the new markup keeping every guard. (files: tests/pdf/82-backlog-page.test.mjs, tests/pdf/82-backlog-r4.test.mjs, tests/pdf/103-r4-backlog-page.mjs, tests/pdf/82-settings-page.test.mjs, tests/pdf/103-r4-board-settings-helpers.mjs, …)
- **New tests (3):**
  - tests/pdf/200-ui-b16-backlog.test.mjs (Kanban backlog, section composer, points bubbles, sprint start/complete dialogs and rules, sprint menu Undo, toasts, epic panel, ?complete dropped)
  - tests/pdf/200-ui-b16-settings.test.mjs (columns rules incl last column, advanced, labels, delete project with Undo, limits)
  - tests/pdf/200-ui-b16-phone-project-views.test.mjs (every view reachable on a phone, status change one tap away)
- **Existing tests to update (2):**
  - 82-backlog-page, 82-backlog-r4, 82-settings-page, 82-board-columns-r4, 102-r4-dux-21-sprint-column-errors, 104-r5-brd-sw-b-01-column-delete-undo, 107-r5-hunt6-column-category-undo, r5hunt8-settings-w…
  - 172-board-sensors-stable must stay green untouched
- **Start-up size plan:** Lazy-only. All project pages stay in the 71 page regex. Final 71 read recorded; B17 re-reads.
- **Bug-hunt focus:**
  - functions that stopped working: sprint lifecycle (start, complete, delete with Undo), epic child progress, settings column delete rules, label rename/recolour
  - persistence: folded sections, sort, boards keys, deep links ?complete=
  - narrow widths: 390 px each view, tables that scroll
  - error and empty states: every empty line, project not found
  - perf/render counts: Backlog/Board sensor constants, big lists
  - tests that pass for the wrong reason: sprint tests that call the handler without checking the validation
- **Done when:**
  - RUN-STATE batch gate for the owned rows; CHANGED PROJ-162/170/172/174/220 and MOBI-197 each with a negative twin
  - type icon on every Backlog row (PROJ-229); Drawer reused unchanged
  - standing phone guard green
- **Parked (not built):** 
  - Timeline Weeks/Months and the Groups switch drawn as a toggle (D-21: the live Epic panel toggle button stays)
  - WIP hint sentence and '2 of 3' header (D-09; mobile D-15)
  - Start next sprint and open/done counts in sprint headers (D-10, D-11)
  - Plan tab hidden for Kanban (D-13)
  - task vocabulary on the phone (mobile D-16)
  - boardTransfer.js export/import projects has no caller: not exposed (owner decides)
- **Risks:**
  - any change to the sprint rules is a behaviour change, not a restyle
  - undrawn Settings panes: build from the live page
- **Owner calls here:** 
  - boardTransfer.js UI exposure (default: none)

### B17 (2.5 h): Integration and release candidate: cross-surface sweep, parked-row verdicts, owner-call closures, final gate

- **Goal:** Close every deferred decision, sweep all surfaces at 1440, 1280, 1100, 1024, 768 and 390 px, give every DRAWN BUT NOT IN THE LIVE APP row a recorded verdict, re-read the start-up margin and perf budgets, update the knowledge docs, and produce a release-candidate head with one full gate and a hand-off packet for the owner.
- **Why here:** Per-batch gates prove each surface; this proves the whole app together and applies late owner answers (sidebar, font, cap) in one small batch.
- **Depends on:** B16  |  **Boards:** all 39 for a final visual pass; no redraw
- **Parity rows owned:** 2 range/section entries (full list in plan-work/final.json)
- **Clusters (separate file ownership):**
  - **owner-closures**: Apply what the owner answered: retire the sidebar, its [ shortcut and cpwtcv_sidebar_collapsed only on an explicit yes (else keep and document); Instrument Sans link in index.html with display swap and preconnect (or self-hosted) only if approved, updating the Privacy text in the same commit, otherwise keep the system-ui fallback; vocabulary or label renames if approved (each with the label sweep); a cap raise ONLY … (files: index.html, src/components/shell/Sidebar.jsx, src/components/shell/SidebarContent.jsx, src/components/shell/WorkspaceLayout.jsx, src/index.css (this batch's single editor))
  - **sweep-and-docs**: Walk each DRAWN BUT NOT table row of all seven files (every D-xx, NEW-xx, Nn) against the built UI and write the verdict (absent as parked, or present as the same function and pinned by a named row); update docs/knowledge for every moved, new or deleted src path (knowledge-docs.unit); remove temporary thin wrappers; row ledger of all rows (ID, batch, test); label diff from the pre-rebuild commit to the head, every r… (files: docs/knowledge, docs/tracking/ui-redesign/batches/B17-report.md, docs/tracking/ui-redesign/batches/B17-owner-packet.md, docs/tracking/HANDOFF.md, docs/tracking/ui-redesign/RUN-STATE.md)
  - **cross-surface-tests**: One Playwright spec visiting Documents, New, editor (resume, letter, Design dock, ATS dock), Applications (board, list, drawer, insights), Projects (landing, board, issue drawer, list, summary) at the six widths: no horizontal page scroll, key controls inside the viewport, dock overlay below 1100, bottom tab bar not covering page actions; screenshots saved as artifacts for the owner's visual approval; the 768-1099 b… (files: tests/playwright/ui-b17-widths.spec.mjs)
- **New tests (4):**
  - tests/playwright/ui-b17-widths.spec.mjs
  - tests/pdf/201-ui-b17-notices.test.mjs (SHEL-114: the four not-saved banners, one per context, keep their own texts: editor and Documents mention removing large photos and exporting JSON, jobs mention…
  - tests/unit/ui-b17-no-sidebar.unit.mjs (only if the owner drops the sidebar: no Sidebar import reachable, [ is a no-op)
  - tests/pdf/201-<finding>.test.mjs for each fixed sweep finding, failfirst-proven
- **Existing tests to update (2):**
  - tests/pdf/71-startup-chunks.test.mjs and tests/perf/budgets.mjs only with the owner's approval of a cap change
  - tests/unit/knowledge-docs.unit.mjs consumers (docs paths)
- **Start-up size plan:** Read the final 71 margin on the head and record the whole ledger B1..B17 (headroom created in B1, spent in B2, B5a and B5b, final figure); must be >= 3 kB; dispatch perf: all once (typing path changed in B3-B7) and compare with B3's baseline and B4's figure (not part of the gate).
- **Bug-hunt focus:**
  - all six lenses across surfaces: functions that stopped working (the row ledger against a Playwright walk of one journey per area), perf/render counts (165, 173, 172, 118 together), persistence (every storage key listed …
  - the 768-1100 px band of the editor and the workspace
  - label sweep over the whole diff against master: every title/aria-label/placeholder change maps to a parity row
- **Done when:**
  - RUN-STATE batch gate; ONE full gate on the exact head with all jobs green, run id recorded; perf run recorded
  - all plan rows have a ledger entry (SAME/MOVED/RESTYLED, test name) and no CHANGED/MISSING row is left unbuilt except the PARKED list; every DRAWN BUT NOT row has a verdict
  - owner hand-off: parked list, open calls, screenshots; no push to master; deploy is the owner's call
  - CHANGED SHEL-114 (the four not-saved banners keep each context's own text and export advice) with a negative twin: 201-ui-b17-notices
  - master synced one last time (merge, coverage re-run, new rows owned); a mutation check of three random new tests per batch recorded; every browser guard has its mutation pair run ids in the batch reports
- **Parked (not built):** 
  - the complete PARKED list, handed to the owner as one table with the evidence of what stayed live
- **Risks:**
  - answers that arrive late (sidebar, font, cap) can force touching B2/B11 files: applied here by named cluster only
  - a regression found late in an early batch's area: fix forward here with a failfirst test; never reopen a closed batch's gate
- **Owner calls here:** 
  - Deploy: after B17 only (default) or earlier with a mixed look
  - Font loading
  - Sidebar removal
  - Cap raise only if the ledger demands it

## Owner calls (each has a default, so none blocks Batch 1)

- Sidebar and its [ shortcut: drop (canvas) or keep restyled (default; kept through B16, retired in B17 only on an explicit yes); asked before B11 but never blocking
- Web font: Google Fonts link, self-hosted, or keep system-ui (default keep; if approved applied in B17 with the Privacy text updated)
- Start-up cap: raise or make the Dashboard lazy only if B1/B2/B5a/B5b thresholds cannot be met (last resort; stop-and-ask rule)
- Search field on Documents/New/editor: omit (default) or approve a new Documents search
- Nav and label wording: Applications/Documents (default follow canvas); issue/epic/backlog versus task/group/plan (default live); Export versus Download (default keep Export); editor field renames From/To/Highlights/Role (default live)
- Cover letters on Documents: separate group (live, default) versus inside the resume
- ATS chip number and Documents card score (default parked; needs the analysis computed on every editor render)
- Design/ATS from the letter view and Share on the letter view (default live: act on the resume)
- Applications statuses: eight live columns (default) versus five canvas lanes
- Job drawer replaces the /jobs/:id page (default yes, deep link and Back kept)
- Display-only additions (entry counts, N pages, Done/Due soon stats): one yes or no
- Deploy cadence: only after B17 (default) or earlier with a mixed look
- boardTransfer.js: expose a projects JSON export/import (default no)
- ASK NOW (before B1): start-up headroom fallback order if the gain is short (default: reserve jsonResumeImport, then lazy Dashboard parts, cap raise last)
- Master drift: freeze master edits to the rewritten files, or deploy each batch after its full gate (CLAUDE.md allows it), or keep the default (merge master into the branch at the start of every batch, deploy after B17)
- One batch at a time (default) versus a second workflow running the lazy-only Applications/Projects batches B12a-B16 beside the editor batches (that track would use its own CSS file and leave index.css alone)
- A small ci.yml change so the failfirst job prints the failing test names (default: the lead reads the log with get_job_logs)
- Address of a job: /jobs?job=ID with the old /jobs/:id, /jobs/new and /jobs/:id/edit kept as redirects (default yes; the alternative nested route would remount the board because RouteFrame, WorkspaceLayout and useScrollMemory key on pathname)

## Parked for the owner (drawn on the canvas, not in the live app: NOT built)

- Draft from resume: pasted job posting, Or use an application, Tone, Length, tailored sample text (ELAE NEW-01..05)
- Improve: Shorter suggestion, Add a number with invented figures, best-verb row, word count, Undo toast after Apply (ELAE NEW-13..17); the Improve button on Summary is the existing STAR button, kept
- ATS: score number on the top-bar chip and on Documents cards, score prediction sentence, Show me jumps (EDIT NEW-002, ELAE NEW-09/10/11, shell D-01)
- Editor: 1 page / N pages count, pinch to zoom, zoom 76/86/90 values, Add link, entry counts and card summaries (display-only items the owner may accept)
- Design: per-element accent toggles, Use accent on headings, new accent palette defaults, Cancel / Use template two-step, Showing 8 of 28 line, category word on cards, live preview above the phone sheet
- Documents: ATS chips, Recently edited sort, Applications strip and next-interview tile, first-run three options, drop zone, 'stays in this browser' sentence, 'It becomes a new resume', 'Its cover letter goes too' (and the cascade, which would be untrue), cover letter chip as attachment, Back up and sync prompt card, search field on Documents/New/editor and Applications/Documents groups in the palette
- Applications: relative times, interview-this-week count, free-text Next step and interview time, job-side ATS match card, attached cover letter row, per-column plus, merged Interviewing/Closed chips, Edit career history button, stat-tile hints with names, footer line
- Projects: task/group/plan vocabulary, Timeline Weeks/Months, Due soon list, No due date rail, recent-project stats, checkbox on List rows, WIP hint sentence, Start next sprint, open/done counts in sprint headers, author name instead of You, Comments default tab without All, boardTransfer.js UI
- Share and public: auto-update wording, Read-only copy header, Want your own? footer, storage-full new advice and Open Documents button
- Phone: pinch zoom, always-on ATS chip number, Today holds up to 3 tasks line
- Web font: Instrument Sans link (needs a Privacy text change; default keep system-ui)
- Letter and ATS wording: word counter and plain-text hint on the letter (ELAE NEW-06), ATS-safe claim chip on the PDF export item (ELAE NEW-19)
- Design phone: 'Applies to the whole resume' label (mobile D-09)
- Projects: Your work subtitle '4 tasks need you this week' (D-07), Plan tab hidden for Kanban projects (D-13), Summary activity wording (D-14)
- Documents and New: New page One column / Two columns / ATS-safe filter chips (shell-docs D-11, build only if the owner agrees), Documents save chip and 'Saved 1 min ago' line in the avatar menu (D-14), New page 'use this template' footer copy (D-17)

## Shared risks

- Start-up path: about 0 kB spare, a red 71-startup-chunks fails the full gate; mitigated by the first-action measurement, B1 headroom first (stop-and-ask under 10 kB), ledgers and thresholds in B2 (>= 7 kB), B5a (>= 5 kB) and B5b (>= 3 kB), lazy-only elsewhere; the minified gain is unmeasured until B1 runs. The lazy in-page pieces carry in-entry fallbacks so offline use loses nothing.
- Honest windows: 24 batches and about 26 windows (about 5 days wall time) when run one at a time; any batch that misses its gate spans the next window and delays the chain. The owner may allow a second track for the lazy-only Applications/Projects batches (B12a-B16, no shared single-owner file except index.css, which that track would not touch) beside the editor batches; default: sequential.
- Branch drift: the work lives many days on claude/wonderful-maxwell-vu8xqw while bug clusters keep landing on master in the files being rewritten (Editor.jsx, EditorHeader.jsx, Dashboard.jsx, SectionEditor*, DesignPanel*, JobDetail). Mitigation: master sync at the start of every batch (merge, coverage re-run, new rows into the catch-all, re-apply a master fix to a rebuilt file with its test); owner may freeze master edits to those files or allow per-batch deploys.
- Proof gaps: failfirst runs only node --test and reverts one commit; browser specs (geometry, phone reach, widths) are proven by node mirrors plus mutation pairs, and a failing-for-the-wrong-reason failfirst is caught by reading the failing test names.
- Dock typing cost and geometry: the Design/ATS dock is mounted beside the sidebar (today the tabs replace it), so DesignPanel and AtsCheckerPanel could render per keystroke; the deferred input, 180 dock-typing, the sidebar clamp and the stored-640 px geometry cases are the guards.
- Whole-source scanners: dead-code.unit (new files must be imported: Drawer ships with its consumer in B13a, primitives with first consumers), knowledge-docs.unit (docs/knowledge paths), cursor-pointer.unit (clickable div/span), touch-reveal.unit, 24-private-data: each batch report states it passed them
- PERF-4: a router hook or Link under a memo editor part, a fresh prop, or a context changing per key re-renders everything per keystroke; 165 and 173 are the proofs and must stay green in B3-B10b
- Parity walker signatures: renaming control text/title/aria-label/data-* row keys or the emoji in spacing preset labels changes registries; groups/view/rail props default to all; new walkers live outside tests/pdf/parity/
- Test churn: about 93 mounting files, 56 dph/dvis class pins, 15 Cypress and 4 Playwright specs plus 21-a11y.cy.js and the 'Job Tracker' text users; Playwright re-runs are expensive: put changed specs in the single targeted dispatch and re-run only red ones
- Mixed look between batches and no deploy: the head is complete but half old, half new until B17 (the legacy token values flip once in B1, so kit surfaces are already on the new palette); owner must accept this or deploy earlier knowingly
- Offline and lazy chunk failures introduced by B1 and B5a (Dashboard parts, Import dialog, card menu fetched on demand): idle and hover prefetch, boundaries and in-entry fallbacks are mandatory and tested by failfirst fallback tests
- Known flakes: J-30 (any batch's gate; B12a owns the root cause), tests/pdf/102-r4-dout-09 on shard 2/6, nine files reaching the live font CDN, 164-huge-paste-linear wall clock: rerun the failed shard once, record both attempts, never weaken
- Canvas versus live conflicts: boards drop or merge functions (statuses, columns, type icons, menus, letters list); the DO NOT BUILD AS DRAWN flags, the layout-deltas table and negative-twin tests are the control
- Undrawn surfaces (about 40 percent of rows) mean the builder designs from tokens: render-check against the nearest board for look, against the live app for function
- Single-owner collisions when a batch spans two windows: the next batch must not start; index.css is edited by one named cluster per batch only; sub-batches of one area share files sequentially, never in parallel

## Skeptic and critic points the revision rejected, and why

- Skeptic: a nested route with an Outlet for the job drawer: rejected, RouteFrame, WorkspaceLayout and useScrollMemory key on pathname and would still remount the board; the ?job=ID query contract (old addresses redirect) keeps them untouched
- Skeptic: add Escape handling to the AuthBar menu and the dock: rejected, the live controls have none and accessibility is deferred; the shared hook closes on outside click and takes Escape only where the live control has it
- Skeptic: a separate preflight batch for the 71 and perf read: not made a batch, it is the first action of B1 (before any code) with the owner question asked at the same time
- Skeptic: B3 split into two gated batches: kept as one batch planned over two windows, because the Cypress helpers must be green at every full gate and the phone and desktop frame share Editor.jsx
- Skeptic: changing ci.yml failfirst to print names: not assumed; it is an owner approval, the default is reading the log, and the mutation pairs cover browser specs
- Skeptic: per-batch deploy and a second parallel track: not enacted, both are owner calls (the one-batch rule and no-master rule are the owner's); the plan records the conditions
- Skeptic: B11 not split: kept as one batch with a named split point (B11a/B11b after the first two clusters) because only the token flip moved out of it
- Critic: canvas redraw for the 137 'Draw' Fix cells: still rejected, the brief tool rewrites them as build-from-live instructions
