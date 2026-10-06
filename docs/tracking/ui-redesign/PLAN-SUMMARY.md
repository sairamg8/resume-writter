# UI rebuild: the plan in one read

24 batches (about 70.5 agent-hours, ~26 work windows, about 5.4 days at 3 h on / 2 h off). UI only: every live function stays (PARITY-RULE.md). One batch at a time; the next starts only when the current one's gate is passed (code, bug hunt until dry, fail-first tests, full CI gate). Detail per batch: PLAN-DRAFT.md; machine-readable: plan-work/final.json.

Coverage check (mechanical, batches/coverage-findings.md): CLEAN: 1,223 live-function rows, each owned by exactly one batch; the 524 rows the canvas changes or does not draw all have an owner.

## Order of work

| # | hours | batch | what you will see | needs |
|---|---|---|---|---|
| B1 | 3 | Foundation: additive canvas tokens, stable test hooks, start-up headroom, lead … | Add the canvas look as ADDITIVE cv-* tokens and component classes and re-point the VALUES of the legacy kit tokens to the cv palette (CSS only, 0 start-up bytes), give every later restyle stable data-testid hooks and per-runner o… | - |
| B2 | 3 | Start-up shell: AppBar, phone tab bar, account and sync states, Terms/Privacy, … | One top bar and one phone bottom tab bar for the start-up pages, the account control and the seven sync states in the canvas style, restyled Terms/Privacy, the page loading and crash states; the Dashboard header only (the body wa… | B1 |
| B3 | 5.5 | Editor frame A: tabless bar, Resume / Cover letter switch, ATS chip, one right … | Replace the sidebar header and tab strip with the canvas frame while every editor function keeps working: a full-width bar (back, rename in place, save chip with four states, Resume / Cover letter switch, ATS chip without a score… | B1, B2 |
| B4 | 2.5 | Editor frame B: stage toolbar, preview states, alert banners, phone preview, do… | Finish the frame: the stage toolbar (layout toggle, paper label, zoom 50-150 in 25 steps, resize handle, Terms/Privacy footer), the preview states (Rendering placeholder, Updating chip, Preview failed with Retry, font fallback no… | B3 |
| B5a | 3 | Documents page, card menu, Cover Letters group and notices (start-up page set, … | Rebuild the Documents page in the canvas style with every live function: card more-menu (lazy, with an in-entry fallback), Cover Letters group, New cover letter, Career History, notices, demo originals, empty state and phone card… | B1, B2 |
| B5b | 3 | Import dialog, New page and role starters (start-up page set, part 2) | Rebuild the Import dialog (file picker kept in the entry, lazy chrome with fallbacks) and the New page with every live function: all 28 looks (19 templates + Sidebar single-column + 8 designs + saved designs), live category chips… | B5a |
| B6 | 3 | Editor content A: section cards, entry forms, rich text, Add Section | Restyle the content sidebar to the canvas cards while every live control stays: collapse/expand all, section rename/hide/duplicate/delete/reset (overflow menu), entry grip/eye/duplicate/delete, all 11 entry forms (Location, Curre… | B3 |
| B7 | 2.5 | Editor content B: Personal info card, Header look and photo, icon library, Sect… | Restyle the Personal info card with every live control (photo upload/status/eye/remove with Undo, shape, size, border, height, text position, tone; six contacts with eyes; link label and URL; per-field icon controls and the icon … | B6 |
| B8a | 3 | Design drawer: rail, ten sections, resets, undo (one DesignPanel) | Give the Design dock its canvas rail (Template, Color, Type, Spacing, Headings, More) over ONE mounted DesignPanel with an optional groups prop (default shows everything), every control of the ten live sections with per-group res… | B3 |
| B8b | 3 | Template gallery, saved designs, phone Design sheet | Restyle the gallery with ALL looks and apply-on-click Undo, the template pane's saved designs and Browse templates, and give the phone a Design chip rail with the More chip over the same DesignPanel groups prop. | B8a |
| B9a | 2.5 | Cover letter panel (letterhead, recipient, body, closing) | Restyle the cover-letter panel (Letterhead block with every control, recipient, rich-text body, closing and signature) keeping every live control; no new capability. Draft and Improve follow in B9b. | B3, B6 |
| B9b | 2.5 | Draft from resume dialog and Improve (Bullet Optimizer) | Restyle the Draft dialog with the three live archetypes and the Improve dialog with every live tool (60 verbs, six metric chips, seven X-Y-Z templates, Auto-Fix, Copy, Apply through the editor's undo stack); no new capability. | B9a |
| B10a | 2.5 | ATS drawer and phone ATS sheet | Fill the ATS dock with the full checker (score dial, counts, six categories, every item with its inline fix, What a parser reads, Match a job box, plain-text card) and give the phone its ATS sheet. | B3 |
| B10b | 3 | Export / Import menu, Share dialog, phone export sheet | Rebuild the Export split menu with every format and entry (labels kept as live) and the Share dialog with all its states, plus the phone export sheet carrying every entry (including the visible Word caveat). | B10a |
| B11 | 3 | Workspace shell: one bar for Applications and Projects, project switcher, searc… | Put the lazy workspace on the shared AppBar and phone tab bar, keep every shell function (search with Issues and Projects groups, global Create and c, shortcuts, sync dot, project switcher, sidebar kept restyled), add the canvas … | B2, B10b |
| B12a | 3 | Applications A: header, toolbar, Board, cards, phone board; J-30 root cause | Rebuild the Applications header, view switch, toolbar and the Board with all eight statuses and every card field, plus the more menu and the phone chips; root-cause the J-30 flake. | B11 |
| B12b | 2.5 | Applications B: List, notices, sort, phone List | Rebuild the List (all columns, sort menu, empty state), the notices strip (not saved, sync held, recovery, import result) and the phone List and its card actions. | B12a |
| B13a | 3 | Applications C: job address contract and the job drawer (shared Drawer primitiv… | Open a job in a right-hand drawer (bottom sheet on a phone) holding every live detail, status and task function, behind an address contract that keeps the board mounted: /jobs?job=ID, with the old /jobs/:id, /jobs/new and /jobs/:… | B12b |
| B13b | 2.5 | Applications D: Add/Edit job modal and Insights | Rebuild the Add/Edit form as a modal with every field and guard, and Insights with every live list and the career history card. | B13a |
| B14a | 3 | Projects 1a: landing, Your work, project header and tabs, Create project, phone… | Rebuild the Projects landing (Your work, recent, all projects), the shared project header and tabs and the Create project dialog, keeping every live function; the Board follows in B14b. | B11 |
| B14b | 3 | Projects 1b: Board, toolbar, swimlanes, cards, Create issue, phone board | Rebuild the Board with its toolbar, swimlanes, cards, column menus and composers, the Create issue dialog and the phone board, keeping every live function. | B14a |
| B15 | 3 | Projects 2a: issue drawer, List, Calendar, Timeline, Summary | Open an issue in the shared Drawer with every live field, checklist and activity, and restyle List, Calendar, Timeline and Summary keeping every function, with their phone cuts. | B13a, B14b |
| B16 | 3 | Projects 2b: Backlog and sprints, Settings, phone project views | Restyle the Backlog (Kanban page and Scrum sprints with Start and Complete dialogs, Create sprint, sprint menu, points bubbles, epic panel) and project Settings keeping every function, and finish the phone cuts of every project v… | B15 |
| B17 | 2.5 | Integration and release candidate: cross-surface sweep, parked-row verdicts, ow… | Close every deferred decision, sweep all surfaces at 1440, 1280, 1100, 1024, 768 and 390 px, give every DRAWN BUT NOT IN THE LIVE APP row a recorded verdict, re-read the start-up margin and perf budgets, update the knowledge docs… | B16 |

## How each batch runs

1. Brief generated from the batch's parity rows. 2. 2-4 build clusters, each owning separate files, each with its own tests. 3. Render check against the canvas board. 4. A second agent reviews each cluster against its rows. 5. Bug hunt, looping until a round finds nothing new. 6. CI: fail-first for the new tests, related tests, then ONE full gate. 7. Report + RUN-STATE + push to claude/wonderful-maxwell-vu8xqw (never master; deploying is your call).

## Decisions already taken in the plan

- Spine = FOUNDATION-FIRST (best on parity safety and feasibility), re-ordered so the editor frame comes right after the start-up shell (the owner sees the core product early and the biggest test churn is found early). HONEST SIZING: a batch over about 80 parity rows, or one with heavy test churn, is a scheduled pair of sub-batches that each end at a green ga…
- Parity rule first: UI only, every live function stays, new capabilities are PARKED. Ownership is by area file plus ID range; cite rows as '<file>: <ID>' (EDIT-/NEW- exist in editor-content.md and editor-design-templates.md; 'D-nn' is the DRAWN BUT NOT table of shell-docs, projects, mobile; 'Nn' is applications section 2; ELAE NEW-nn two digits). CATCH-ALL p…
- The parity file's Fix column is the build spec and the live app wins where board and app differ. tools/brief.mjs (written in B1) turns each batch's rows (ID, live behaviour, status, fix) into docs/tracking/ui-redesign/batches/B<n>.md; every CHANGED row is flagged DO NOT BUILD AS DRAWN and the brief opens with a 'layout deltas' table (CHANGED and MISSING row…
- Phone is built with its surface (each batch owns the desktop and phone rows of its screens). STANDING PHONE GUARD in every batch gate from B3 on: cypress/e2e/26-mobile-layout.cy.js plus tests/playwright/phone-reach.spec.mjs run in the single targeted dispatch. phone-reach runs with hasTouch and isMobile (hover: none) and reaches every control by tap only, n…
- Start-up path has about 0 kB spare (71-startup-chunks, cap 1,100 kB of minified JS; CSS and index.html are free). BEFORE any B1 code the lead dispatches tests=71-startup-chunks and perf: startup once (raw and gzip margins; tests/perf/budgets.mjs also holds startup.gzip 450 kB and startup.largest 500 kB) and the owner is asked NOW to confirm the fallback ord…
- Single-owner files, one batch at a time (sub-batches of one area are sequential too): Editor.jsx, EditorHeader.jsx, useEditorTab.js, EditorTabContent.jsx = B3 then B4 (B4 only EditorAlerts block, phone preview states); EditorPreviewPane.jsx and usePanelResize.js = B3 (SaveStatus extraction only) then B4; DesignPanel*.jsx (not DesignPanelPhone), DesignDock.j…

## Your calls (each has a default, so none blocks Batch 1)

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

## Drawn on the canvas but not in the live app: NOT built (parked for you)

- Draft from resume: pasted job posting, Or use an application, Tone, Length, tailored sample text (ELAE NEW-01..05)
- Improve: Shorter suggestion, Add a number with invented figures, best-verb row, word count, Undo toast after Apply (ELAE NEW-13..17); the Improve button on Summary is the existing STAR button, kept
- ATS: score number on the top-bar chip and on Documents cards, score prediction sentence, Show me jumps (EDIT NEW-002, ELAE NEW-09/10/11, shell D-01)
- Editor: 1 page / N pages count, pinch to zoom, zoom 76/86/90 values, Add link, entry counts and card summaries (display-only items the owner may accept)
- Design: per-element accent toggles, Use accent on headings, new accent palette defaults, Cancel / Use template two-step, Showing 8 of 28 line, category word on cards, live preview above the phone sheet
- Documents: ATS chips, Recently edited sort, Applications strip and next-interview tile, first-run three options, drop zone, 'stays in this browser' sentence, 'It becomes a new resume', 'Its cover letter goes too' (and the cascade, which would be untrue), cove…
- Applications: relative times, interview-this-week count, free-text Next step and interview time, job-side ATS match card, attached cover letter row, per-column plus, merged Interviewing/Closed chips, Edit career history button, stat-tile hints with names, foo…
- Projects: task/group/plan vocabulary, Timeline Weeks/Months, Due soon list, No due date rail, recent-project stats, checkbox on List rows, WIP hint sentence, Start next sprint, open/done counts in sprint headers, author name instead of You, Comments default t…
- Share and public: auto-update wording, Read-only copy header, Want your own? footer, storage-full new advice and Open Documents button
- Phone: pinch zoom, always-on ATS chip number, Today holds up to 3 tasks line
- Web font: Instrument Sans link (needs a Privacy text change; default keep system-ui)
- Letter and ATS wording: word counter and plain-text hint on the letter (ELAE NEW-06), ATS-safe claim chip on the PDF export item (ELAE NEW-19)
- Design phone: 'Applies to the whole resume' label (mobile D-09)
- Projects: Your work subtitle '4 tasks need you this week' (D-07), Plan tab hidden for Kanban projects (D-13), Summary activity wording (D-14)
- Documents and New: New page One column / Two columns / ATS-safe filter chips (shell-docs D-11, build only if the owner agrees), Documents save chip and 'Saved 1 min ago' line in the avatar menu (D-14), New page 'use this template' footer copy (D-17)

## Biggest risks

- Start-up path: about 0 kB spare, a red 71-startup-chunks fails the full gate; mitigated by the first-action measurement, B1 headroom first (stop-and-ask under 10 kB), ledgers and thresholds in B2 (>= 7 kB), B5a (>= 5 kB) and B5b (>= 3 kB), lazy-only elsewhere; the minified gain is unmeasured until B1 runs. The lazy in…
- Honest windows: 24 batches and about 26 windows (about 5 days wall time) when run one at a time; any batch that misses its gate spans the next window and delays the chain. The owner may allow a second track for the lazy-only Applications/Projects batches (B12a-B16, no shared single-owner file except index.css, which t…
- Branch drift: the work lives many days on claude/wonderful-maxwell-vu8xqw while bug clusters keep landing on master in the files being rewritten (Editor.jsx, EditorHeader.jsx, Dashboard.jsx, SectionEditor*, DesignPanel*, JobDetail). Mitigation: master sync at the start of every batch (merge, coverage re-run, new rows …
- Proof gaps: failfirst runs only node --test and reverts one commit; browser specs (geometry, phone reach, widths) are proven by node mirrors plus mutation pairs, and a failing-for-the-wrong-reason failfirst is caught by reading the failing test names.
- Dock typing cost and geometry: the Design/ATS dock is mounted beside the sidebar (today the tabs replace it), so DesignPanel and AtsCheckerPanel could render per keystroke; the deferred input, 180 dock-typing, the sidebar clamp and the stored-640 px geometry cases are the guards.
- Whole-source scanners: dead-code.unit (new files must be imported: Drawer ships with its consumer in B13a, primitives with first consumers), knowledge-docs.unit (docs/knowledge paths), cursor-pointer.unit (clickable div/span), touch-reveal.unit, 24-private-data: each batch report states it passed them
- PERF-4: a router hook or Link under a memo editor part, a fresh prop, or a context changing per key re-renders everything per keystroke; 165 and 173 are the proofs and must stay green in B3-B10b
- Parity walker signatures: renaming control text/title/aria-label/data-* row keys or the emoji in spacing preset labels changes registries; groups/view/rail props default to all; new walkers live outside tests/pdf/parity/
