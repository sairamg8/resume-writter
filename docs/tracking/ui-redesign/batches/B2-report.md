# B2 report: Start-up shell (top bar, phone tab bar, account and sync states, Terms/Privacy, loading and crash)

Branch `claude/wonderful-maxwell-vu8xqw`. Base `436457e` (B1 done). Code head `d4f7dc8` (src identical on the head `26f4d0b`). 58 parity rows owned (SHEL-001..004, 010, 017, 020..032, 089..103, 111/112, 116, 118, 123/124, 132/133, 137, 141; MOBI-002, 010..014, 018, 150, 157; D-01, D-14..16; editor-content NEW-012). The three CHANGED rows (build the live function, not the drawing): SHEL-028 all seven sync states with held items named (179-ui-b2-account-menu); SHEL-092 the contact line keeps the mailto when an address is configured (the existing 79-site-owner) and the plain sentence otherwise (179-ui-b2-legal-pages); MOBI-010 the avatar opens the same menu (name, e-mail, sync line, Sign out) wherever the account shows: Dashboard and the legal pages through the real routes (179-ui-b2-account-menu, 179-ui-b2-legal-routes). The editor and workspace keep their own account mounts (B3, B11).

## What changed (src: 15 commits, 11 files)
| commit | change | proof test |
|---|---|---|
| 78b0341 | `AppBar` (new): brand link to /, Documents / Applications / Projects nav with the sunken-pill current state, search and account slots | 179-ui-b2-app-bar |
| a2ebc0f | `useOutsideClose` (new hook behind the avatar menu) | 179-ui-b2-outside-close |
| e3bc7e2 | `BottomTabBar` (new): the phone's three tabs, 72 px, hidden from md | 179-ui-b2-bottom-tab-bar |
| dbf6566 | Dashboard header becomes the shared AppBar; the page actions (Import, New Cover, New Resume) sit in a row under it; Job Tracker and Projects become nav links; tab bar below the page | 103-r4-dvis-14, 103-r4-dvis-26 (+ Cypress 01-dashboard, 26-mobile-layout) |
| fc2d71f | `AuthBar` in the canvas look: avatar and first name, the menu (name, e-mail, the sync line in the sync icon's own words, Sign out; Keyboard shortcuts only when `onShortcuts` is passed), signed-out Google button with its Signing in state, the failure popover with all seven wordings, the loading placeholder, no-cloud hides everything, the seven sync states with held items named | 179-ui-b2-account-menu, 103-r4-dvis-27 |
| e8ad941 | held-items notice in `.cv-notice-warn` | 179-ui-b2-held-notice |
| 2c74e8d | the current nav pill really shows heavier (a utility class had overridden the pill weight) | 179-ui-b2-app-bar |
| dd662e4 | Terms and Privacy: shared app bar with Sign in, phone tab bar, one 680 px column; the live text word for word | 179-ui-b2-legal-pages |
| 514ed26 | page loading state and crash fallback in the canvas look (both buttons, the one-time reload untouched) | 179-ui-b2-crash-loading |
| a0291fe | hunt H2-10: the phone top bar shows the CPWT-CV name (the canvas draws it; it was hidden below sm) | 179-ui-b2-app-bar |
| a44bbef | hunt H1-2: Terms and Privacy show the signed-in first name like the Dashboard bar (`hideName` is the editor's narrow panel only) | 179-ui-b2-legal-pages |
| 6699815 | hunt H1-3: the avatar menu is 224 px in the editor's narrow split panel (`hideName`) so the panel cannot clip it | 179-ui-b2-account-menu |

| 9163072 | hunt H1-1: the avatar menu and the sync words close on a press anywhere outside, even on a page element that stops pointerdown (capture phase, as `ui/useDismiss`) | 179-ui-b2-outside-close |
| 2183a80 | hunt H2-4: the avatar button drops its right padding when the name is not shown (the editor's narrow header keeps room for the résumé name) | 179-ui-b2-account-menu |
Tests: 7 new files (app-bar, bottom-tab-bar, outside-close, account-menu, held-notice, legal-pages, crash-loading) and 1 more (legal-routes); updated for the new markup with the same intent: 103-r4-dvis-14/26/27, Cypress 01-dashboard and 26-mobile-layout, `ime-enter-guard`; `phone-reach` lists the three tab-bar testids.

## Fail-first proofs (read from the job logs)
| commit | fails without | passes with | run |
|---|---|---|---|
| 78b0341 | 19 | yes | 37486076140 |
| a2ebc0f | 3 | yes | 37486076140 |
| e3bc7e2 | 4 | yes | 37486076140 |
| dbf6566 | 4 | yes | 37486076140 |
| fc2d71f | 25 | yes | 37486076140 |
| 2c74e8d | 1 | yes | 37486076140 |
| 514ed26 | 2 | yes | 37486076140 |
| e8ad941 | 2 | yes | 37486764375 |
| dd662e4 | 8 | yes | 37486764375 |
| a0291fe | 1 | yes | 37489039266 |
| a44bbef | 2 | yes | 37489039266 |
| 6699815 | 1 | yes | 37489039266 |
| 9163072 | 1 | yes | 37490937152 |
| 2183a80 | 1 | yes | 37490937152 |
The first proof run (37486076140) read RED on four new tests with the fix applied (held-notice loaded its modules in a second `before` hook; legal-pages rendered at `/`, so Documents was current): both test-side, fixed in 69deee3 and re-proved. Reviewers had already fixed three other test bugs and one src defect (2c74e8d) before CI.
Tests-only additions proven by a throwaway mutation (commit `e8a847d`, reverted in `a18116e`; run 37489064270): routes dropping `auth`/`sync` for Terms and Privacy turned red the four legal-routes cases; a footer without the tab-bar clearance turned red the legal-pages clearance case on both pages; nothing else went red.
A second mutation (`463d49c`, reverted in `26f4d0b`; run 37490963270): the legal routes dropping `sync` turned red the legal-routes sync case on /terms and /privacy (the rest of that file stayed green); the correct code passed 103/103 (run 37490937152).

## Start-up ledger (tests/pdf/71-startup-chunks, cap 1,100 kB)
| point | run | start-up path | spare |
|---|---|---|---|
| B1 final | 37481412359 | 1082.7 kB | 17.3 kB |
| B2 built (e100aa9) | 37486076140 | 1083.8 kB | 16.2 kB |
| B2 after hunt fixes (eb83254) | 37489039266 | 1083.8 kB | 16.2 kB |
B2 cost +1.1 kB in all (plan: about 4.5 kB): AppBar and BottomTabBar are small, the Dashboard header got shorter, the legal pages were rewritten in place with cv-* classes. The 7 kB reserve is intact (16.2 kB spare).

## Other CI reads
- Related tests (run 37486076140, 60 files): 340 pass, 4 test-side reds (fixed). Re-proof: 15/15 (37486764375), 155/155 (37489039266).
- Playwright `phone-reach`: 14 passed (37486764375). Cypress 9 specs (00-smoke, 01-dashboard, 11-demo-account, 26-mobile-layout, 12-regressions-security, 29-exports-imports, 21-a11y, 07, 08): 75 tests passed.
- Lessons: the Cypress dispatch input needs paths (`cypress/e2e/<spec>.cy.js`; bare names found no spec); a `before(setup)` plus a second `before` that loads modules left `loadModule` with no server.

## Bug hunt (3 rounds)
- Round 1 (`wf_c0de6f2a-874`, 30 agents): 12 reported, 5 confirmed (all minor), all fixed or pinned: hideName on the legal pages, the 288 px menu clipped in a narrow editor panel, routes-to-legal-pages untested, the phone brand name, the footer clearance untested.
- Round 2 (`wf_15d58d4a-aaf`, 16 agents): 6 reported, 3 confirmed (minor), all fixed: the outside-press listener in the capture phase, the sync hand-off to the legal pages untested, the avatar button's padding in the narrow header.
- Round 3 (`wf_43e17048-e19`, a final sweep of every changed src file): 0 reported: the hunt is DRY.
- Not confirmed (split or refuted): a press outside the menu also reaching what is under it; the Dashboard's compact vs full sign-in swap not pinned by 103-r4-dvis-26; the tab bar's stacking level over dialogs untested.

## What still differs from the canvas (honest list)
- **Search**: no search field (the canvas draws "Search everything"; it is a new capability: parked, D-02).
- **Documents page body**: the Dashboard body is untouched until B5a (heading "My Resumes", old cards, Cover Letters group, Career History column); only its header is the new shared bar, and its actions sit in a row under the bar rather than inside the page header; the phone shows the same.
- **Avatar menu**: the sync line uses the live words ("Sync is off — changes are saved in this browser", "Synced 9:41 AM") rather than the canvas's "Cloud sync on, saved 1 min ago"; Keyboard shortcuts is built (only when a page passes `onShortcuts`) but no page passes it yet (the workspace does in B11; `?` works only there today).
- **Signed-out card** "Back up and sync your work / Not now": parked (D-15); the Google sign-in is the icon button (compact) or the full button from lg.
- **Terms and Privacy**: one readable 680 px column with the live text; the "Terms | Privacy" switch and the sticky "On this page" list are not built (optional navigation, D-16); the footer links both ways. The canvas draws the Terms content only; the live Privacy text is mounted unchanged.
- **Phone**: the tab bar and top bar match; the avatar and sync dot show only where there is a cloud (no cloud in the preview build, so the screenshots show none).
- **Nav pill padding** is B1's 6 x 12 px (the canvas 8 x 14): to review with the owner's eyes.

## Known limits / not proven
- A click or tap outside the open avatar menu also reaches what is under it (split verdict; as before the restyle).
- The sync chip's long held-item sentence is a tooltip; nothing new.
- Cypress `01-dashboard` and `26-mobile-layout` run in Chromium only; no real phone.
- Tablet widths 768-1100 px were not screenshotted this batch.
- Accessibility deferred (nothing added, nothing removed).

## Parked (untouched)
Search field; Back up and sync card; Documents save chip; Terms/Privacy entries in the avatar menu; the Terms/Privacy switch and "On this page" list.

## Owner calls taken (defaults)
Nav wording Applications / Documents (as the canvas); search omitted; Keyboard shortcuts entry only when a page passes `onShortcuts`.

## Full gate (GREEN)
Run 37491778368 on `26f4d0b` (src identical to `d4f7dc8`; two earlier gates on older heads were cancelled for it). Read from the logs: 15 jobs all green (lint, build, suite 1-6, Playwright 1-3, Cypress 1-4). Suite shards 2514, 2009, 1484, 2012, 1820, 2094 tests (11,933 in all; 0 fail; the skipped ones are the suite's own); Playwright 46 + 55 + 25 passed (+ 1 skipped); Cypress 70 + 90 + 71 + 50 = 281 passed; `start-up path 1083.8 kB of the 1,100 kB cap: 16.2 kB to spare`.
Performance baseline for B3 (run 37491897100, `perf: all`, same code): 17 of 17 budgets met: PDF build Classic 61 ms, large résumé 270 ms; keystroke to painted pages 338 ms; start-up script 1,084 kB / gzip 340 kB (cap 450) / largest chunk 457 kB (cap 500); open the editor to the first pages 1,137 ms; browser last key to the pages 440 ms (443 ms with every entry open); longest main-thread task while typing 0 ms.
