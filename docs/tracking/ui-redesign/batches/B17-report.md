# B17 report: release candidate for the UI rebuild on `revamp-ui`

Full gate: GREEN, run 37797966992 on `f43f020` (ci.yml, no inputs, first attempt, 15 of 15 jobs: lint, build, suite 6/6, Playwright 3/3, Cypress 4/4; start-up path 1,073.0 kB of 1,100 kB, 27.0 kB to spare). `f43f020` is on master (fast-forward `00c7283..f43f020`, 2026-10-08 15:27Z); master before it is kept as the branches `master-backup` and `backup/master-2026-10-08-00c7283`. Since the first B17 gate: master (Job Map) merged in, two bug-hunt rounds (21 fixes, each with a CI fail-first proof), a release review and a test-parity audit (46 removed test titles reconciled, none lost), and the screenshots looked at by eye.

UI only; every live function, label and test id stays (PARITY-RULE). Accessibility is deferred. Nothing here is pushed to master; deploy is the owner's call.

## 1. What each batch delivered
| Batch | Delivered |
|---|---|
| B1 | Foundation: additive `cv-*` tokens, radii, shadow and font stack in `src/index.css`; legacy kit colours re-pointed to the canvas values; test-id hooks; New Cover picker and Career History load on demand (start-up headroom); brand pressed step. |
| B2 | Start-up shell: shared `AppBar` (brand, Documents / Applications / Projects), `BottomTabBar` (phone, 72 px), `useOutsideClose`, account and sync states, Terms/Privacy, loading and crash screens. |
| B3 | Editor frame: tabless bar, Resume / Cover Letter switch, ATS chip opening the dock, one right dock, URL contract, phone frame; ATS and Design docks read the latest résumé. |
| B4 | Editor panel resize with dock clamp from 1100 px, dock as flex sibling below 1100 px, stage, alert cards, updating chip. |
| B5a | Documents page: four-up card grid with the New Resume tile, lazy card menu, notices, Career History; New page and import dialog pieces. |
| B5b | Import dialog (`ImportDialog.jsx`, lazy) and the New page on tokens. |
| B6 | Editor content: section card, entry card, field styles, rich text toolbar, entry-form leaf rows. |
| B7 | Personal Info card, photo, header sections, icon library, spacing steppers, section customizer; step 2: lazy Section style popover (inline customizer as fallback). |
| B8 | Design drawer and template gallery on tokens. |
| B9 / B10 | Cover letter panel, draft and new-letter dialogs, ATS drawer, optimizer, export menu and share dialog on tokens. |
| B11 | Workspace shell: AppBar in the top bar with switcher, Create, search (grouped Issues / Projects), shortcuts, account; phone tab bar; sidebar, drawer, PageHeader on tokens. |
| B12 / B13 | Applications (Job Tracker) pages and components, tracker, public resume on tokens. |
| B14 to B16 | Boards, Backlog, Board settings, Your work, Summary, List, Calendar, Timeline on tokens. |
| B17 | This report; knowledge docs for the shell and tokens; a width sweep and the full gate are the lead's. Late fixes on the head: sidebar scrim and avatar tokens, editor document switch width, Switch project on one line, board-drop test clock, optimizer pin, Cypress brand check. |

Gates read so far: full gate green on `d4ca9c4` (run 37727240905, 19 of 19); `8cb6b70` green (37727327245). Later shell commits (88197e9c, 38f04cb1, 125a3641, b4e4a3c5, 67058dfe) are covered by the B17 full gate below, not by an earlier run.

## 2. Parked items: recommended verdicts (owner decides)
| Item | Source | Verdict | Reason |
|---|---|---|---|
| Separate "Your work" / "Job Tracker" link row in the top bar | B11 | keep as is | AppBar tabs replace it; Your work is in the switcher and sidebar. |
| Project switcher popover with search, starred groups, recent avatars | B11 | build (later) | Useful once there are many projects; new capability, not a regression. |
| Per-type grouped search, "see all results", recent searches | B11 | drop | Grouped headings already shipped; footers add a new results page. |
| Create as a split menu (issue / project / job) | B11 | keep as is | Create button works per page; a split menu is new behaviour. |
| Issue drawer "More details" disclosure | B12 | drop | Live drawer shows all fields; hiding them costs a click. |
| Weeks / Months switch on Timeline | B12 | drop | New capability, outside the product goal. |
| Single Filter button with count on board toolbar | B12 | keep as is | Separate controls are tested and clear. |
| Simplified Summary (stat strip, donut, More charts) | B12 | drop | Live Summary keeps all charts. |
| Job Add modal with "More details" | B12 | build | Long form is the heaviest in the app; tests need care. |
| Insights simplification, merged "Next steps" | B12 | drop | Replaces working content with new logic. |
| Search field (Documents bar), "Back up and sync" card | B2 | drop | New capabilities, not in the live app. |
| Documents save chip; Terms/Privacy in avatar menu, "On this page" list | B2 | keep as is | Legal pages are reachable; extras add little. |
| ATS score on chip and Documents cards | B3, B5a | drop | Would run the scan on every keystroke. |
| Letter-specific Design; Share on every board | B3 | drop | New features. |
| Static "Saved" line, "Back to documents" | B3 | keep as is | Save chip and breadcrumbs already cover it. |
| "1 page" caption, zoom 76 / 86 / 90, 90 % default | B3, B4 | keep as is | Live "Résumé · A4" and 25 % steps are pinned. |
| Pinch to zoom, phone page count | B4 | build (low) | Nice on phones; touch gesture needs its own test. |
| Storage-full wording with "Open Documents" | B4, B5a | keep as is | Each context keeps its own export advice (SHEL-114). |
| Paper layout / font / heading / accent options in editor | B4 | drop | Design drawer already has them. |
| Recently edited sort, Applications strip, three-option first-run page, "stays in this browser" sentence, cover letter chip, "Its cover letter goes too" | B5a | drop | New content or copy; revisit one at a time. |
| Entry counts and one-line card summaries; wording renames | B5b to B10 | keep as is | Live labels are walker and test contracts. |
| Instrument Sans web font | README, index.css | keep as is | System fallback stays; loading it changes the Privacy text. |
| Sidebar removal | B17 brief | keep as is | Owner has not said yes. |
| Template names and filter chips on canvas | README | drop | Placeholders, not the app's names. |
| Improve button on Summary, Public footer "Want your own?" | README | drop | New capabilities. |
| JobsList without Location, Salary, Contact columns | README | drop | Live columns stay. |
| Projects as a simplified product (3 views, "task" not "issue") | README | keep as is | Outside the stated goal; keep, owner may simplify or remove later. |
| Tone / Length / pasted posting in the draft generator | README | build (low) | Larger feature; own batch if wanted. |

## 3. Known limits still open
- L2: dead overlay helpers (`overlay` prop, `dockBesideFrom`, the Editor's `useMediaQuery`) at real widths.
- Hard-coded status hex colours remain in board, job and tracker components (status chips and columns).
- Focus ring is still indigo, not the brand blue (accessibility deferred).
- Button hover on the danger variant uses opacity, not a darker token.
- Also open from earlier batches: L1 stored 640 px panel leaves the stage 124 to 220 px at 768 to 964 px; L3 Updating chip under the toast stack; L4 rem and px breakpoints mixed; kit and shell still use the older token names (same values).
- No screenshot comparison against the canvas boards for B5b onward; the canvas files were not in the worktree.

## 4. What changed under the owner's feet
- The top bar's link row ("Your work", "Job Tracker") is replaced by the AppBar tabs: Documents, Applications, Projects.
- "Your work" moved into the project switcher menu (and the sidebar).
- Search results are grouped under "Issues" and "Projects" headings.
- On phones a bottom tab bar appears and the page gets 72 px of bottom padding.
- One popover opens at a time for Section style; the Language and Interest delete buttons are named "Delete entry".
- Cards, drawers, dialogs and pages use the new colours, radii and the single pop shadow.
