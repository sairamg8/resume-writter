# B5a (3 h): Documents page, card menu, Cover Letters group and notices (start-up page set, part 1)

Generated from plan-work/final.json and the 7 parity files by tools/brief.mjs. Rules that apply to every batch: PARITY-RULE.md, RUN-STATE.md (cadence, batch gate, wrap-up), CLAUDE.md, parity/_constraints.md, parity/_tests.md, parity/_ci.md. The parity rows below are the contract: a row is done when it is SAME / MOVED / RESTYLED in the built UI and a test proves it.

## Goal
Rebuild the Documents page in the canvas style with every live function: card more-menu (lazy, with an in-entry fallback), Cover Letters group, New cover letter, Career History, notices, demo originals, empty state and phone cards; the Import dialog and the New page follow in B5b.

## Why here
With bars and account done (B2) and headroom (B1), the first screen every user sees is rebuilt under a measured ledger; it follows the editor frame so the owner has seen the core product first. The New page is split off so each half fits one window.

## Depends on
B1, B2

## Boards to read (Artifact tool, canvas SjfCTE1dSTgt1UY63uoFiM; data only)
- Main
- Empty
- MobileHome
- States (confirm delete, storage banner)

## Parity rows owned (area file: IDs; the rows themselves are printed below)
- editor-content: NEW-019
- editor-letter-ats-export: ELAE-034..ELAE-035, ELAE-131..ELAE-133, NEW-30..NEW-31
- mobile: MOBI-020..MOBI-030, MOBI-033..MOBI-039, MOBI-165, MOBI-167, D-02
- projects: PROJ-209
- shell-docs: SHEL-033..SHEL-058, SHEL-113, SHEL-115, SHEL-120..SHEL-121, SHEL-127..SHEL-131, SHEL-139, SHEL-142, D-01, D-03..D-06, D-09..D-10, D-18
- shell-docs: CATCH-ALL every other row of shell-docs.md, including any row added by review, belongs to B5a

## PARKED: do NOT build
- ATS score chip on cards (D-01, editor-content NEW-019, mobile D-02)
- Recently edited sort (D-03; creation order SHEL-048 stays)
- Applications strip and next-interview tile on Documents (D-04)
- first-run three-option page and a typed 28 looks (D-05)
- everything-stays-in-browser sentence (D-06)
- Its cover letter goes too and the cascade (D-09, ELAE NEW-30), cover letter chip on cards (D-18, ELAE NEW-31)
- storage-full sign-in advice and Open Documents button (D-10)

## Clusters (separate file ownership)

### Cluster: documents
Files owned: src/pages/Dashboard.jsx, src/components/ResumeCard.jsx, src/components/ResumeThumbnail.jsx, src/components/RecoveryNotice.jsx, src/components/CareerHistoryPanel.jsx, src/components/NewLetterModal.jsx, src/index.css (this batch's single editor)
New files: src/components/CardMenu.jsx (lazy, loaded on first open; hover/focus prefetch; the kit Menu never joins the entry)

Page header with the primary New resume and quiet secondary actions (B2's temporary row moves here); card grid with real thumbnail, name over two lines (ending kept), template and age meta line; the card more menu: Edit, Rename inline, Copy (once-per-visit guard), Delete (native confirm with the live text, original variant, last-original disabled with its hint), Keep as my original / Stop keeping (demo accounts); visible on touch; Cover Letters group with letter cards (Edit, Copy, Delete), New cover letter with the three cases and the picker; live single-Create empty state; notice strip: storage full/blocked (live texts, export advice), recovery notice with downloads, held items, originals waiting; Career History kept (lazy; also on Insights in B13b); footer Terms/Privacy; Back keeps scroll; one new document per visit; phone grid with a way to rename, copy and delete without hover. OFFLINE RULE: CardMenu is a lazy chunk with an in-entry fallback (ResumeCard keeps plain Edit, Copy and Delete buttons if the chunk fails), Rename stays inline in the entry, NewLetterModal and CareerHistoryPanel keep B1's boundaries and fallbacks; Delete keeps the call that unpublishes the public copy of a deleted non-letter resume (SHEL-047: signed in, letters excluded, an error only logged).

## New tests
- tests/pdf/182-ui-b5a-documents-cards.test.mjs (card menu functions with their guards and Undo/confirm, two-line names, template+age meta, order, phone no-hover reachability, deleting a resume calls unpublish for a resume and not for a letter)
- tests/pdf/182-ui-b5a-letters-group.test.mjs (Cover Letters group, New cover letter three cases and once guard, letter card actions, deleting a resume keeps letters)
- tests/pdf/182-ui-b5a-notices.test.mjs (storage full/blocked texts, recovery, held, originals waiting)
- tests/pdf/182-ui-b5a-lazy-fallbacks.test.mjs (a rejected import() for CardMenu, NewLetterModal and CareerHistoryPanel: Edit, Copy, Delete, New cover letter and Career History all still work; no reload; failfirst)
- tests/pdf/182-ui-b5a-startup-ledger.test.mjs (CardMenu, NewLetterModal, CareerHistoryPanel off the start-up path; prefetch fires once)

## Existing tests to update
- Dashboard/ResumeCard users: 96-dashboard, 83-dashboard-thumbnails, 80-dashboard-import-read-error, 104-r5-dash-card-name-two-lines, 162-redos-resume-card-name, 104-r5-hunt6-dash-back-keeps-scroll, 104-r5-hunt6-dash-career-after-letter, 104-r5-hunt6-dash-delete-keeps-designs, 104-r5-hunt6-dash-editor-import-after-sign-out, 104-r5-hunt6-dash-import-after-sign-out, 105-r5-hunt1-dash-double-click, 103-r4-dvis-26/28, 103-r4-dvis-13-new-resume-source-select, imp-import-busy, 104-r5-dlg-new-letter-dialog, 103-r4-dph-26-rename-box-touch-text, 89-rename-fresh-name, r5hunt6-card-picture-degraded, 104-r5-r2148-public-copy-follows-deletion, 99-public-link
- tests/pdf/122 only if the reserve offset is used (evidence in the commit)
- cypress 01-dashboard, 11-demo-account, 11-demo-account-keep, 29-exports-imports, 00-smoke (CARD testid from B1), 21-a11y

## Start-up size plan
The second batch that adds start-up JS (B2 was the first). Ledger by file in the report; read 71 first, then after each cluster push. Rules: card, grid and header rewritten IN PLACE with cv-* classes; the card menu is a lazy chunk with prefetch, boundary and in-entry fallback (its bytes are counted); Career History and NewLetterModal already lazy (B1); native confirm() stays (no ConfirmDialog on the path); icons by name only; no edit to constants/templates.js, templatePresets.js, starterTemplates.js. END STATE: spare >= 5 kB so B5b has room. If a push would take the margin under 5 kB, trim or revert it; if still short apply the reserve offsets in order (lazy jsonResumeImport trio with a 122 update), then STOP and ask the owner (lazy Dashboard or cap raise).

## Bug-hunt focus
- functions that stopped working: rename/copy/delete/keep-original, new cover letter flow, import every file type, demo originals, career history link
- persistence: storage full/blocked banners, recovery, sign-in/out changes what is listed (SHEL-113), Back keeps scroll
- perf/render counts: Dashboard re-render per store change, thumbnail painting and cache (SHEL-129/130)
- error and empty states: every import error, empty Documents, a lazy chunk failing offline
- tests that pass for the wrong reason: card tests matching a menu that is not rendered
- narrow widths: 390 px cards, long names, bottom bar overlap, import on a phone

## Done when
- RUN-STATE batch gate for the owned rows; CHANGED SHEL-041/048/052, ELAE-133, MOBI-027/028 each with a negative twin (a letter stays its own record; card order, name endings, storage banner)
- start-up ledger and 71 spare >= 5 kB, figure in the report; no un-ledgered growth
- SHEL-047 pinned (public copy unpublished with a deleted resume; letters excluded); every lazy piece of this batch has a failfirst fallback test
- demo-account and no-cloud paths verified in Cypress 11-demo-account*
- standing phone guard green

## Risks
- largest start-up risk of the plan; Dashboard has 17 mounting tests and ResumeCard 10
- template cards are shared with the editor gallery (B8b): keep TemplateThumb props stable
- chunk-failure fallbacks are the offline guarantee: do not ship a lazy piece without its fallback test

## Owner calls here
- Cover letters: keep the live separate group of letter cards (default) versus attach inside the resume
- Card order: creation order (default) versus Recently edited (parked)
- Career History on Documents in addition to Insights (default: both, lazy)

## Parity rows of this batch

75 row IDs (63 live-function rows: SAME 11, MOVED 4, RESTYLED 13, CHANGED 6, MISSING 29; 12 drawn-but-not-in-the-live-app items). The live app wins where a board and the app differ.

### Catch-all rows (no batch lists them by ID; they reach this batch through the file's catch-all rule, computed from the final parity files)

This batch is the catch-all of: shell-docs. Rows reaching it only through the rule: 0 (none today: every row is listed by ID, and any row added by review or later lands here).

### DO NOT BUILD AS DRAWN

Rows where the drawing must not be copied: a CHANGED row (the board drops or alters the live function; build the live function), a row cited in the PARKED list above, or a drawn-but-not-live item with handling PARK. Keep every function; build only the layout.

- DO NOT BUILD AS DRAWN: editor-content:NEW-019 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] An ATS score on the Documents cards ("ATS 82", "ATS 76", "ATS 68"). / Main, ImportModal, MobileHome
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:ELAE-133 [CHANGED: the drawing alters or loses the live function] A letter is its own record: delete, copy, sync
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-30 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] States "Confirm delete": "Its cover letter goes too." / A résumé's delete also removes its cover letter
- DO NOT BUILD AS DRAWN: editor-letter-ats-export:NEW-31 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Main / ImpModal / MobileHome: "Cover letter" chip on a résumé card and "1 cover letter" in the page subtitle / Letters shown as an attachmen
- DO NOT BUILD AS DRAWN: mobile:MOBI-027 [CHANGED: the drawing alters or loses the live function] Card meta line
- DO NOT BUILD AS DRAWN: mobile:MOBI-028 [CHANGED: the drawing alters or loses the live function] Long names and "(Copy)" endings
- DO NOT BUILD AS DRAWN: mobile:D-02 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "ATS 82" and "Letter" chips on document cards / MH
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-041 [CHANGED: the drawing alters or loses the live function] Card name
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-048 [CHANGED: the drawing alters or loses the live function; cited in this batch's PARKED list] Card order
- DO NOT BUILD AS DRAWN: shell-docs:SHEL-052 [CHANGED: the drawing alters or loses the live function] Storage full / blocked banner
- DO NOT BUILD AS DRAWN: shell-docs:D-01 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] ATS score chip on each résumé card ("ATS 82", green/amber) / Main
- DO NOT BUILD AS DRAWN: shell-docs:D-03 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Recently edited" sort control / Main
- DO NOT BUILD AS DRAWN: shell-docs:D-04 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Applications" stage-count strip and "next interview" tile with "Open board" / Main
- DO NOT BUILD AS DRAWN: shell-docs:D-05 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Empty page offers "Start from a template: Pick one of 28 looks", "Import a file", "Start blank" side by side / Empty
- DO NOT BUILD AS DRAWN: shell-docs:D-06 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Everything stays in this browser until you sign in." (Empty, Legal) / Empty, Legal
- DO NOT BUILD AS DRAWN: shell-docs:D-09 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] "Its cover letter goes too." in the delete dialog / States
- DO NOT BUILD AS DRAWN: shell-docs:D-10 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Storage-full banner advice "sign in to keep your work in your account" and button "Open Documents" / States
- DO NOT BUILD AS DRAWN: shell-docs:D-18 (drawn item) [drawn but not in the live app: handling PARK; cited in this batch's PARKED list] Résumé card "Cover letter" chip; subtitle counting cover letters / Main

### Layout deltas (CHANGED and MISSING rows: how the drawn layout bends to hold the live function)

Conservative option when in doubt: the live control stays, one menu or drawer away.

| ID | Status | Drawn layout | Live function that stays | How the layout bends |
|---|---|---|---|---|
| ELAE-034 | MISSING | Main: résumé cards carry a "Cover letter" chip only; no letter list, no New cover letter | Letter as its own record / Cover Letters list | Documents area to keep a Cover Letters list / filter and a "New cover letter" entry (see ELAE-035). |
| ELAE-035 | MISSING | Not drawn | New Cover Letter picker | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it in the Documents area (Main or New): a small picker dialog with the same sources and Blank option. |
| ELAE-132 | MISSING | Main / ImpModal / MobileHome: "3 résumés · 1 cover letter" count and a "Cover letter" chip on one résumé card; no letter cards, no New cover letter entry | "New Cover" header button and the Cover Letters group | Same fix as ELAE-034, naming the three entries: a header or New-menu "New cover letter", the Cover Letters group (or a Letters filter) with its cards, and the dashed tile. |
| ELAE-133 | CHANGED | States board: confirm dialog "Delete Graduate résumé? This cannot be undone. Its cover letter goes too." | A letter is its own record: delete, copy, sync | Do not build "Its cover letter goes too" (see NEW-30); a letter stays a separate record that survives its résumé. |
| MOBI-024 | MISSING | Not drawn on MH; not drawn on ME's title either | Rename on the card | Give the card a way to rename (long-press or a card menu) and the editor title a tap-to-rename (row 047). |
| MOBI-025 | MISSING | Not drawn | Copy (duplicate) | Add a card menu (Copy). Keep the once-per-visit guard. |
| MOBI-026 | MISSING | Not drawn | Delete a résumé | Add Delete to the card menu with the same confirm texts, the disabled last-original state and the unpublish. |
| MOBI-027 | CHANGED | MH: "2 hours ago" / "Yesterday" / "9 days ago" only | Card meta line | The template name is dropped; show it (a chip or in the meta line). |
| MOBI-028 | CHANGED | MH: one line, ellipsis, nowrap | Long names and "(Copy)" endings | Allow two lines and keep the ending visible; a touch screen has no hover title. |
| MOBI-029 | MISSING | Not drawn | Demo-account originals | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): on the card menu / meta line for demo accounts only. |
| MOBI-034 | MISSING | Not drawn (subtitle mentions "1 cover letter") | New cover letter | Add "New cover letter" to MH (tile or the New page) and keep the source picker sheet. |
| MOBI-035 | MISSING | MH draws three résumé cards and no letter card or group | Cover letters group | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the letters group (or a Letter filter) so the "1 cover letter" counted in the subtitle can be opened. |
| MOBI-036 | MISSING | Empty.dc is desktop; no phone empty state | Empty Documents | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the phone first-run (shell-docs owns the desktop one). |
| MOBI-037 | MISSING | Not on MH; the desktop JobsInsights has a "Career history" card | Career History panel | Keep it reachable on a phone (Applications > Insights, row 106). |
| MOBI-038 | MISSING | Not drawn | Storage notices | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the three notices under the top bar. |
| MOBI-039 | MISSING | Not drawn | Footer | See MOBI-014. |
| MOBI-165 | MISSING | Not on MH; desktop JobsInsights has a card | Career History panel contents | Row 037 only says "reachable"; the panel's own functions (`showJobTrackerLink` true on Documents, false on Insights) must be drawn on a phone. [added by review] |
| MOBI-167 | MISSING | MH: no group, no tile | "Cover Letters" group is always there | Rows 034 and 035; this notes the tile appears at zero letters too. [added by review] |
| SHEL-033 | MISSING | Not drawn | Demo accounts | See SHEL-049..051, SHEL-062. |
| SHEL-037 | MISSING | No New cover letter control on Main | New Cover (letter) button | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): "New cover letter" (header or tile menu); keep the three cases and the once-guard. |
| SHEL-038 | MISSING | Not drawn | New Cover Letter picker | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the picker dialog. Added by review 2 (read from NewLetterModal.jsx:243-272): a row with no name or title reads "No name yet"; the age sits in the row's third line, lower-case, "Last edited" on the first row and "Edited" on the others; the arrow on each row; "Blank letter" row carries the line "No name or contacts yet: fill them in under Personal Info."; a pick made while the dialog animates out is ignored (a double click makes one letter); the sources are the non-letter résumés, most recently edited first, a record with no time last (utils/letters.js:156-159). |
| SHEL-039 | MISSING | Not drawn. Counts say "1 cover letter" and a résumé card has a "Cover letter" chip, but no letter card exists | Cover Letters group | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the group (or a Cover letters filter) with letter cards: Edit, Copy, Delete, Rename. |
| SHEL-041 | CHANGED | One line, nowrap, ellipsis | Card name | A copy and its original look alike when the ending is cut. Allow two lines and keep the ending visible (tests 104-r5-dash-card-name-two-lines, 162-redos-resume-card-name). |
| SHEL-042 | MISSING | "Edited 2 hours ago"; no template name | Card template and age | Add the template name beside the age. |
| SHEL-044 | MISSING | Only a "..." More icon on each card (an svg with aria-label "More", not a button); its menu is not drawn. On phone (MobileHome.dc.html) the cards have NO More icon at all: name, "2 hours ago", chips only | Card Rename | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the More menu with Rename (inline), keeping every rule, and a phone way to it (long-press or a visible More). Today's Rename pencil is always visible on touch (`no-hover:opacity-100`). |
| SHEL-045 | MISSING | Not drawn (More menu not drawn) | Card Copy | Put Copy in the More menu. |
| SHEL-046 | MISSING | Entry not drawn (More menu). Dialog drawn in States | Card Delete | Put Delete in the More menu (and on phone); the States dialog replaces the browser confirm. "Its cover letter goes too" is new wording (D-09). Review notes: a cover LETTER's Delete asks the same question and takes down no public copy (`!isLetter(r)`, Dashboard.jsx:112); the public takedown also needs a signed-in uid; the demo variant of the question is SHEL-051. |
| SHEL-048 | CHANGED | A "Recently edited" button (no menu drawn) | Card order | Today's order is creation order. Keep it unless the owner accepts a sort (D-03). |
| SHEL-049 | MISSING | Not drawn | Keep as my original (demo) | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): in the card (More menu or footer line), demo accounts only. |
| SHEL-050 | MISSING | Not drawn | Last original: Delete disabled | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the disabled state and the hint. |
| SHEL-051 | MISSING | Not drawn | Original delete prompt; originals-waiting notice | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the confirm variant and the amber strip. |
| SHEL-052 | CHANGED | States "Storage full": red banner "Browser storage is full / Your last change could not be saved in this browser. Delete a document you no longer need, or sign in to keep your work in your account." + "Open Documents" | Storage full / blocked banner | Blocked variant not drawn; advice differs (live: remove large photos, export JSON; drawn: delete a document, sign in). Keep both reasons and the export-JSON advice. Sign-in advice and the button are new (D-10). Review 2: what the banner points at, how it clears and what gives way first when storage fills are SHEL-131. |
| SHEL-053 | MISSING | Not drawn | Recovery notice | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): a red strip with the download buttons. |
| SHEL-055 | MISSING | No footer on Main, New, Empty or Import; Legal is not linked from any board | Footer legal links | Keep a footer (or avatar-menu entries) linking Terms and Privacy from Documents. |
| SHEL-121 | MISSING | Chip on a résumé card; count in the subtitle; no letter cards | Letters in the card flow | Same fix as SHEL-039: letters need their own cards or filter on Documents. |

### Rows (ID | live function and behaviour | board placement | status | Fix)


#### editor-letter-ats-export

**1. PARITY TABLE 1a. Cover letter sidebar and preview**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-034 | **Letter as its own record / Cover Letters list**: A letter is a record `kind: 'letter'`, listed under "Cover Letters" on the Dashboard with its own "New Cover Letter" and Edit (opens on the letter tab); Share is hidden for it. src/utils/letters.js:1-46, src/pages/Dashboard.jsx:68,312,326, src/pages/Editor.jsx:114 | Main: résumé cards carry a "Cover letter" chip only; no letter list, no New cover letter | MISSING | Documents area to keep a Cover Letters list / filter and a "New cover letter" entry (see ELAE-035). |
| ELAE-035 | **New Cover Letter picker**: Dialog "New Cover Letter": one button per résumé (name, who, "Last edited / Edited <time>", most recent focused) or "Blank letter"; Escape / close / outside click makes nothing; a second click while closing is ignored (R2-135, R4-DVIS-07, R5-DLG-03/04). The dialog's subtitle is "Start from a résumé: its name, job title, contacts and photo head the letter."; a résumé with no name reads "No name yet"; the Blank letter tile says "No name or contacts yet: fill them in under Personal Info." It is opened only when there is MORE than one résumé (see ELAE-131) (added by review). src/components/NewLetterModal.jsx:1-66 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): it in the Documents area (Main or New): a small picker dialog with the same sources and Blank option. |

**5. ADDED BY REVIEW (independent reviewer, 2026-10-06) 5a. Rows added by review**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| ELAE-131 | **New cover letter: how many résumés decide the flow**: `startLetter`: with exactly one non-letter record the letter is made at once from it (no picker); with none, a blank letter is made at once; only with MORE than one is NewLetterModal opened. One new letter or copy per visit (`made` ref, reset on return to `/`), so a double click makes one. `letterFrom` copies the source's Personal Info (name, title, contacts, photo, hidden fields), template and Design, sections (what the generator writes from) and its own letterhead / sign-off choices (clPhoto, showPhoto, headerStyle / Layout / hiddenFields, closing, signature); date, recipient, company, subject and body start empty; the record is named "Cover Letter", `kind: 'letter'`, never marked an original; it becomes the open record and opens on `?tab=coverletter`. src/pages/Dashboard.jsx:64-98, src/utils/letters.js:36-46, src/hooks/useResumeStore.js:383-392 | Not drawn | SAME | Keep (invisible). The picker of ELAE-035 is shown only for more than one résumé. |
| ELAE-132 | **"New Cover" header button and the Cover Letters group**: Dashboard header button "New Cover" (mail icon, beside New Resume); a "Cover Letters" group (shown whenever any résumé or letter exists) with the count "N letter(s)", a card per letter (Edit opens `?tab=coverletter`, Copy, rename, delete) and a dashed "New Cover Letter" tile. Dashboard.jsx:64-68,100-123,218-222,308-330 | Main / ImpModal / MobileHome: "3 résumés · 1 cover letter" count and a "Cover letter" chip on one résumé card; no letter cards, no New cover letter entry | MISSING | Same fix as ELAE-034, naming the three entries: a header or New-menu "New cover letter", the Cover Letters group (or a Letters filter) with its cards, and the dashed tile. |
| ELAE-133 **DO NOT BUILD AS DRAWN** | **A letter is its own record: delete, copy, sync**: Deleting a résumé does not delete letters made from it (a letter is a copy, `kind: 'letter'`); delete asks the native `confirm('Delete "<name>"? This cannot be undone.')` (demo-account originals get the longer "kept as your original" text); deleting a résumé (not a letter) also takes its public link down; a letter is never shared. Dashboard.jsx:25-30,105-121 | States board: confirm dialog "Delete Graduate résumé? This cannot be undone. Its cover letter goes too." | CHANGED | Do not build "Its cover letter goes too" (see NEW-30); a letter stays a separate record that survives its résumé. |

#### mobile

**1. PARITY TABLE 1b. Documents on a phone (Dashboard `/`)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-020 | **Title and count**: "My Resumes" and "N resume(s)", letters counted apart (Dashboard.jsx:270-275,311-316) | MH: "Documents" + "3 résumés · 1 cover letter" | RESTYLED | n/a (renamed; letters counted in the same line). |
| MOBI-021 | **Card grid on a phone**: `grid-cols-1` below sm, 2 from sm, 3 from xl (Dashboard.jsx:294; cypress 26-mobile-layout.cy.js:128-140 pins one card per row, 80 % wide) | MH: 2 cards per row at 390 | RESTYLED | Update that Cypress test to two columns (evidence: MH). No function changes. |
| MOBI-022 | **Card thumbnail: real page 1**: The résumé's own page-1 picture, painted once on screen and cached (`usePicture`, pageImage, ResumeCard.jsx:99-128), tinted by the accent | MH: Paper drawing scaled to 118 px | RESTYLED | Keep the lazy cached real picture and the letter's page for a letter. |
| MOBI-023 | **Open a résumé**: Tap the thumbnail or "Edit" (ResumeCard.jsx:115,200); route `/resume/:id`; a letter opens on `?tab=coverletter` (Dashboard.jsx:68,318) | Whole card is a link to ME | RESTYLED | Keep the letter opening on its letter tab. |
| MOBI-024 | **Rename on the card**: Pencil (always visible on touch); inline field 16 px; Enter saves, Escape cancels, blur saves, IME-safe; "Résumé name" (ResumeCard.jsx:132-174, useRename) | Not drawn on MH; not drawn on ME's title either | MISSING | Give the card a way to rename (long-press or a card menu) and the editor title a tap-to-rename (row 047). |
| MOBI-025 | **Copy (duplicate)**: "Copy" button; one new copy per visit so a double tap makes one; name gets " (Copy)" (ResumeCard.jsx:206, Dashboard.jsx:70-86,106) | Not drawn | MISSING | Add a card menu (Copy). Keep the once-per-visit guard. |
| MOBI-026 | **Delete a résumé**: "Delete" with `confirm()`: `Delete "<name>"? This cannot be undone.`; demo-account originals get the longer text; the last original's Delete is disabled with a hint (ResumeCard.jsx:213-221, Dashboard.jsx:22-30,107-115); also unpublishes its public link | Not drawn | MISSING | Add Delete to the card menu with the same confirm texts, the disabled last-original state and the unpublish. |
| MOBI-027 **DO NOT BUILD AS DRAWN** | **Card meta line**: `<template name> · <updated N ago>` (ResumeCard.jsx:177-179, templateLabel, timeAgo) | MH: "2 hours ago" / "Yesterday" / "9 days ago" only | CHANGED | The template name is dropped; show it (a chip or in the meta line). |
| MOBI-028 **DO NOT BUILD AS DRAWN** | **Long names and "(Copy)" endings**: Two-line clamp; a copy's ending (" (Copy)", " (conflict copy)", runs shown as "(Copy ×4)") never cut; full name in the title (ResumeCard.jsx:19-85,156-165, R4-DVIS-28) | MH: one line, ellipsis, nowrap | CHANGED | Allow two lines and keep the ending visible; a touch screen has no hover title. |
| MOBI-029 | **Demo-account originals**: "Original" badge, "Stop keeping", "Keep as my original" (ResumeCard.jsx:180-194), last-original hint | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): on the card menu / meta line for demo accounts only. |
| MOBI-030 | **New résumé**: Header primary button "New Resume" and a dashed tile, both to `/new` (Dashboard.jsx:223-228,296-304) | MH: dashed tile "New résumé / Template, file, or blank" to New.dc | RESTYLED | Header button is not drawn; the tile is the entry. |
| MOBI-033 | **Job Tracker and Projects buttons**: Dashboard header buttons (Dashboard.jsx:204-216) | Tab bar tabs | MOVED | n/a. |
| MOBI-034 | **New cover letter**: "New Cover" button and a dashed "New Cover Letter" tile; with several résumés a picker (NewLetterModal) chooses the source, with one it uses it, with none a blank letter; one letter per visit (Dashboard.jsx:88-98,217-222,319-327) | Not drawn (subtitle mentions "1 cover letter") | MISSING | Add "New cover letter" to MH (tile or the New page) and keep the source picker sheet. |
| MOBI-035 | **Cover letters group**: Heading "Cover Letters", count, cards in the same ResumeCard (Dashboard.jsx:309-330) | MH draws three résumé cards and no letter card or group | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the letters group (or a Letter filter) so the "1 cover letter" counted in the subtitle can be opened. |
| MOBI-036 | **Empty Documents**: "No resumes yet / Create your first resume to get started" + "Create Resume" (Dashboard.jsx:277-290) | Empty.dc is desktop; no phone empty state | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the phone first-run (shell-docs owns the desktop one). |
| MOBI-037 | **Career History panel**: Below the grid on a phone (stacked; `lg:` sticky column), with "Job Tracker →" (Dashboard.jsx:336-351, CareerHistoryPanel) | Not on MH; the desktop JobsInsights has a "Career history" card | MISSING | Keep it reachable on a phone (Applications > Insights, row 106). |
| MOBI-038 | **Storage notices**: Not-saved red alert, recovery notice with Dismiss, "originals come back" notice (Dashboard.jsx:235-261, notSavedMessage, RecoveryNotice) | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the three notices under the top bar. |
| MOBI-039 | **Footer**: "© 2026 CPWT-CV" + Terms & Conditions + Privacy Policy (Dashboard.jsx:356-364) | Not drawn | MISSING | See MOBI-014. |

**6. ADDED BY REVIEW (independent pass, 2026-10-06; every row below was added by review) 6b. Documents and import details **

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| MOBI-165 | **Career History panel contents**: Profile header (initial, name, title, "N total · M companies"), a timeline of the open résumé's visible experience entries with each length, a NOW badge and dates in that résumé's date format, "No experience entries yet"; follows the open résumé, or `letterSources()[0]` while a letter is open; heading "Career History" with "Job Tracker →" and a footer "Open Job Tracker →" on the Dashboard only (CareerHistoryPanel.jsx:30-140, Dashboard.jsx:336-351) | Not on MH; desktop JobsInsights has a card | MISSING | Row 037 only says "reachable"; the panel's own functions (`showJobTrackerLink` true on Documents, false on Insights) must be drawn on a phone. [added by review] |
| MOBI-167 | **"Cover Letters" group is always there**: With at least one résumé the group shows "Cover Letters", "N letters" and the dashed "New Cover Letter" tile even at zero letters (Dashboard.jsx:309-330) | MH: no group, no tile | MISSING | Rows 034 and 035; this notes the tile appears at zero letters too. [added by review] |

#### projects

**1. PARITY TABLE I. Invisible behaviour, persistence, shell links**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| PROJ-209 | **Dashboard button "Projects"**: Dashboard.jsx:210-216 | Documents top nav tab "Projects" | MOVED | none |

#### shell-docs

**1. PARITY TABLE 1b. Account, sign-in, cloud sync**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-033 | **Demo accounts**: `isDemoAccount(user, DEMO_ACCOUNTS)` turns on the originals UI (SHEL-049..051, SHEL-062). Dashboard.jsx:41, utils/demoAccounts.js, utils/demoSeed.js | Not drawn | MISSING | See SHEL-049..051, SHEL-062. |

**1. PARITY TABLE 1c. Documents page (Dashboard `/`)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-034 | **Page title and counts**: H1 "My Resumes" + "N resume(s)" (letters excluded); Cover Letters group has "N letter(s)". Dashboard.jsx:64-66,270-275,312-316 | H1 "Documents", "3 résumés · 1 cover letter" | RESTYLED | n/a. |
| SHEL-035 | **New Resume button**: Header button navigates `/new`. Dashboard.jsx:62,223-228 | Primary "New résumé" (header) | RESTYLED | n/a. |
| SHEL-036 | **New-résumé dashed tile**: Last tile of the grid, "New Resume". Dashboard.jsx:296-304 | First tile of the grid: "New résumé / Start from a template, import a file, or begin blank." | MOVED | n/a. |
| SHEL-037 | **New Cover (letter) button**: Header "New Cover": several résumés open the picker, one makes a letter from it, none a blank letter; one per visit; opens `/resume/<id>?tab=coverletter`. Dashboard.jsx:64-98,217-222 | No New cover letter control on Main | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): "New cover letter" (header or tile menu); keep the three cases and the once-guard. |
| SHEL-038 | **New Cover Letter picker**: Dialog "New Cover Letter — Start from a résumé: its name, job title, contacts and photo head the letter": a row per résumé (name, "who · title", "Last edited/Edited <ago>"), most recent first and focused, plus "Blank letter"; Escape/X/outside click closes and makes nothing. components/NewLetterModal.jsx:17-66 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the picker dialog. Added by review 2 (read from NewLetterModal.jsx:243-272): a row with no name or title reads "No name yet"; the age sits in the row's third line, lower-case, "Last edited" on the first row and "Edited" on the others; the arrow on each row; "Blank letter" row carries the line "No name or contacts yet: fill them in under Personal Info."; a pick made while the dialog animates out is ignored (a double click makes one letter); the sources are the non-letter résumés, most recently edited first, a record with no time last (utils/letters.js:156-159). |
| SHEL-039 | **Cover Letters group**: Section "Cover Letters": letter cards (same card), each opening on `?tab=coverletter`, plus a dashed "New Cover Letter" tile; shown when there is any résumé or letter. Dashboard.jsx:308-330 | Not drawn. Counts say "1 cover letter" and a résumé card has a "Cover letter" chip, but no letter card exists | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the group (or a Cover letters filter) with letter cards: Edit, Copy, Delete, Rename. |
| SHEL-040 | **Card thumbnail**: Real page 1 painted when on screen (`pageImage`, width 160; letters get their letter page), cached by printHash (localStorage `cpwtcv_page_images`), drawn thumbnail until then; accent-tinted backdrop; click opens. components/ResumeCard.jsx:98-128, utils/pageImageStore.js | 172x243 paper (Paper board) on grey; the whole card is a link | RESTYLED | Keep the real page picture and its cache; Paper is a stand-in. |
| SHEL-041 **DO NOT BUILD AS DRAWN** | **Card name**: Up to 2 lines; a "(Copy)" / "(conflict copy)" ending never cut, a run of 3+ reads "(Copy ×4)"; full name in title. ResumeCard.jsx:17-85,156-165 | One line, nowrap, ellipsis | CHANGED | A copy and its original look alike when the ending is cut. Allow two lines and keep the ending visible (tests 104-r5-dash-card-name-two-lines, 162-redos-resume-card-name). |
| SHEL-042 | **Card template and age**: "<Template label> · <timeAgo>" (unknown template id shows Classic). ResumeCard.jsx:176-179 | "Edited 2 hours ago"; no template name | MISSING | Add the template name beside the age. |
| SHEL-043 | **Card Edit**: Button "Edit" and a thumbnail click open `/resume/<id>` (letters: `?tab=coverletter`). ResumeCard.jsx:116,199-203, Dashboard.jsx:68,295 | Whole card is a link | RESTYLED | n/a. |
| SHEL-044 | **Card Rename**: Pencil ("Rename", shown on hover, always on touch) opens an input (autofocus, aria "Résumé name", 16 px on touch); Enter / Save name check / blur commit, Escape cancels, IME-safe, trimmed, blank or same name is no edit, box closes if another résumé replaces it. ResumeCard.jsx:132-174, hooks/useRename.js:23-58, useResumeStore.js:440 | Only a "..." More icon on each card (an svg with aria-label "More", not a button); its menu is not drawn. On phone (MobileHome.dc.html) the cards have NO More icon at all: name, "2 hours ago", chips only | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the More menu with Rename (inline), keeping every rule, and a phone way to it (long-press or a visible More). Today's Rename pencil is always visible on touch (`no-hover:opacity-100`). |
| SHEL-045 | **Card Copy**: "Copy" makes "<name> (Copy)", appended, deep copy, never an original, becomes current and opens; one per visit. ResumeCard.jsx:206-211, Dashboard.jsx:106, useResumeStore.js:421-429 | Not drawn (More menu not drawn) | MISSING | Put Copy in the More menu. |
| SHEL-046 | **Card Delete**: "Delete" asks first (browser confirm naming the résumé: `Delete "X"? This cannot be undone.`), then removes it, records the deletion (id, version) for sync, takes down its public copy. Dashboard.jsx:107-115 | Entry not drawn (More menu). Dialog drawn in States | MISSING | Put Delete in the More menu (and on phone); the States dialog replaces the browser confirm. "Its cover letter goes too" is new wording (D-09). Review notes: a cover LETTER's Delete asks the same question and takes down no public copy (`!isLetter(r)`, Dashboard.jsx:112); the public takedown also needs a signed-in uid; the demo variant of the question is SHEL-051. |
| SHEL-047 | **Public copy goes with a deleted résumé**: `publicLinks.unpublishResume(uid, id)` after a delete (errors logged); the cloud engine also takes down copies of résumés deleted elsewhere (index `users/{uid}/meta/publicCopies`). Dashboard.jsx:112-114, utils/publicLink.js:184,312, utils/cloudSyncEngine.js:135 | Invisible | SAME | Keep (tests 148-r2-148-public-copies-index, 104-r5-r2148-public-copy-follows-deletion). |
| SHEL-048 **DO NOT BUILD AS DRAWN** | **Card order**: The store's order: new, copied and imported résumés are appended. Dashboard.jsx:65,295 | A "Recently edited" button (no menu drawn) | CHANGED | Today's order is creation order. Keep it unless the owner accepts a sort (D-03). |
| SHEL-049 | **Keep as my original (demo)**: Demo accounts only: card shows "Keep as my original", or a badge "Original" with "Stop keeping"; hover "Your originals come back whenever none of them is left". ResumeCard.jsx:14,180-193, Dashboard.jsx:117 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): in the card (More menu or footer line), demo accounts only. |
| SHEL-050 | **Last original: Delete disabled**: `comesStraightBack`: Delete disabled with title and described-by, line "Your last original always comes back. To delete it, choose "Stop keeping" first." ResumeCard.jsx:15,194,213-221 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the disabled state and the hint. |
| SHEL-051 | **Original delete prompt; originals-waiting notice**: Delete of an original: `Delete "X"? It is kept as your original, so it comes back once none of your originals is left. To delete it for good, choose "Stop keeping" first.` Amber role=status strip "Your originals come back as soon as your account can be reached again." Dashboard.jsx:25-30,255-261 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): the confirm variant and the amber strip. |
| SHEL-052 **DO NOT BUILD AS DRAWN** | **Storage full / blocked banner**: Red role=alert strip in the header: "Changes are not being saved: browser storage is full. Remove large photos or export your resumes as JSON." or "...this browser is blocking site storage. Export your resumes as JSON." Dashboard.jsx:235-241, utils/storageBackup.js:44-62 | States "Storage full": red banner "Browser storage is full / Your last change could not be saved in this browser. Delete a document you no longer need, or sign in to keep your work in your account." + "Open Documents" | CHANGED | Blocked variant not drawn; advice differs (live: remove large photos, export JSON; drawn: delete a document, sign in). Keep both reasons and the export-JSON advice. Sign-in advice and the button are new (D-10). Review 2: what the banner points at, how it clears and what gives way first when storage fills are SHEL-131. |
| SHEL-053 | **Recovery notice**: Red alert "Your saved résumés could not be read in full, so what could not be read was left out." + where the original copy is kept; buttons "Download the copy", "Download earlier copy N", "Dismiss"; says when a copy was pruned. components/RecoveryNotice.jsx:14-65, Dashboard.jsx:242-246 | Not drawn | MISSING | Build from the live behaviour; no board, or the board differs: design from tokens. Audit hint (canvas wording, layout idea only): a red strip with the download buttons. |
| SHEL-054 | **Career History panel**: Right column (sticky from lg, height-capped, timeline scrolls): initial avatar, name or "Your Name", title, "total · N companies", timeline of the active résumé's visible experience entries (company, role, duration, dates as the PDF prints, NOW), "No experience entries yet", footer "Open Job Tracker →", header link "Job Tracker →". Active = open résumé, else the latest non-letter. components/CareerHistoryPanel.jsx:32-127, Dashboard.jsx:333-351 | Off Documents: JobsInsights "Career history" card (avatar, name, title, "3 yrs 9 mos total · 1 company", one entry with NOW) and button "Edit career history" linking to Documents | MOVED | Review found the panel ALREADY lives on the Job Tracker's Summary view today (pages/JobTracker.jsx:178-182, `variant="workspace"`, no Job Tracker link, heading "Career history", right column from xl), so the drawn JobsInsights card is the same function, and removing it from Documents loses nothing but the Dashboard copy and its two "Job Tracker →" links (covered by the nav, SHEL-003). Still required: list every entry with dates and NOW, active-résumé choice (open résumé, else latest non-letter), "No experience entries yet". "Edit career history" (link to Documents) is new wording with no live equivalent (D-21). |
| SHEL-055 | **Footer legal links**: "© 2026 CPWT-CV. All rights reserved." + buttons "Terms & Conditions" (`/terms`), "Privacy Policy" (`/privacy`). Dashboard.jsx:356-364 | No footer on Main, New, Empty or Import; Legal is not linked from any board | MISSING | Keep a footer (or avatar-menu entries) linking Terms and Privacy from Documents. |
| SHEL-056 | **Documents empty state**: No résumés (letters may exist): box "No resumes yet / Create your first resume to get started" + "Create Resume"; the letters group still shows. Dashboard.jsx:277-290,309 | Empty board: "Make your first résumé" with three cards (Start from a template, Import a file, Start blank) and "Everything stays in this browser until you sign in." | RESTYLED | Empty must still show letters when only letters exist. Extra options and the line: D-05, D-06. |
| SHEL-057 | **Back keeps scroll**: Back from the editor returns Documents to the offset it was left at; a new path opens at the top. AppRoutes.jsx:60-90 | Invisible | SAME | Keep (test 104-r5-hunt6-dash-back-keeps-scroll). |
| SHEL-058 | **One new document per visit**: `made` ref: Copy, New Cover and the editor transition make one record even on a double click. Dashboard.jsx:73-86 | Invisible | SAME | Keep (test 105-r5-hunt1-dash-double-click). |

**1. PARITY TABLE 1i. Added by review (independent pass, 2026-10-06, from SOURCE and the re-opened boards)**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-113 | **Sign-in and sign-out change what Documents lists**: Signing in merges: a list made signed out (syncedUid null) joins the account; the account's cloud résumés arrive; a résumé edited on two devices keeps both, the other as "<name> (conflict copy)"; deletions made elsewhere remove the card and its public copy. Signing out takes the account's résumés OFF the screen (they stay in its cloud; unsent edits are kept aside for that account and sent at its next sign-in), so Documents falls to the empty state or to the browser's own signed-out list; another account signing in never sees the previous account's list. utils/cloudSyncLeave.js:1-50, cloudSyncPlan.js:47, cloudSyncLineage.js:10, hooks/useResumeStore.js:75-130 | Menus "Sign out" row only; no "your résumés leave this screen" wording | SAME | Keep. Do not add a "Keep my résumés on this device" choice (new capability). Tests 18-cloud-sync-*, 106-r5-hunt4-resume-recovery-leaves-with-account. |
| SHEL-115 | **Card thumbnail hover overlay**: On hover the thumbnail dims slightly and shows an "Open" pill; the thumbnail and the pill are one click target to `onOpen`. ResumeCard.jsx:114-128 | Whole card is a link; no overlay drawn | RESTYLED | n/a (hover affordance only; whole card link keeps the function). |
| SHEL-120 | **Default names of new documents**: New from a look: "Untitled Resume" (NEW_RESUME_NAME, newResume.js:13); (corrected by review 2: a role starter is NOT named "Untitled Resume": `createResume` ignores the name when a starter is given and the résumé takes the starter's own name, e.g. "Software Engineer (Full Stack)", starterTemplates.js:261-266, useResumeStore.js:363-374); blank from the Documents empty state: the store's "Untitled Resume"; new cover letter: "Cover Letter" (LETTER_NAME, letters.js:12); copy: "<name> (Copy)"; imported résumé: its own name read from the file; conflict: "<name> (conflict copy)". Card name display of these is SHEL-041. | Not drawn (the canvas names are sample data) | SAME | Keep the names (tests 96-dashboard, 99-cover-letters). |
| SHEL-121 | **Letters in the card flow**: A letter is a record of its own (`kind: 'letter'`), listed apart from résumés, never counted as one, carries the same card (rename, copy, delete, keep) and opens on `?tab=coverletter`; separate from the résumé's embedded cover letter tab. The canvas's "Cover letter" chip on a résumé card and "1 cover letter" in the subtitle describe the embedded letter or a letter record: not decidable from the board. utils/letters.js:1-40, Dashboard.jsx:64-68 | Chip on a résumé card; count in the subtitle; no letter cards | MISSING | Same fix as SHEL-039: letters need their own cards or filter on Documents. |

**1. PARITY TABLE 1j. Added by review 2 (file-by-file sweep of every source file of the area, then five user journeys, 202**

| ID | Live function and behaviour | Board placement | Status | Fix |
|---|---|---|---|---|
| SHEL-127 | **What a new letter, new résumé, starter and copy carry over**: `createLetter(fromId)`: a copy of the source résumé's Personal Info (name, title, contacts, photo, hidden fields), template and Design, sections, and its own letter's letterhead and sign-off choices, with the six letter fields (date, recipient name and title, company, subject, body) emptied, named "Cover Letter", never an original; no source, a gone one or a letter gives a blank letter. `createResume(name, starter, look, fromId)`: a copy of the source on the look picked, its embedded letter's six fields emptied; with a role starter and a source, the user's own name, contacts, links, photo and hidden fields (the role's title and summary stay as the example), uploaded contact icons and the paper size (A4 stored as none). Copy: deep copy named "<name> (Copy)", appended, made the open one, never an original. Blank: ATS defaults (Noto Sans, 11 pt, accent #374151, text #111111), blank personal info and sections in the template's own grids. hooks/useResumeStore.js:363-440, utils/letters.js:156-178, newResume.js:200-237, defaultData.js:157-170 | Invisible | SAME | Keep (tests 99-cover-letters, 96-dashboard, 93-picker-new-resume). [added by review 2] |
| SHEL-128 | **Card age wording**: `timeAgo(updatedAt)`: "Just now", "<n>m ago", "<n>h ago", "<n>d ago"; days never turn into weeks or months ("400d ago"). The letter picker reads it lower-case ("Last edited 3h ago"). ResumeCard.jsx:176-179, utils/resume.js:1-7, NewLetterModal.jsx:244-256 | Main: "Edited 2 hours ago", "Edited yesterday", "Edited 9 days ago"; MobileHome "Yesterday" | RESTYLED | New wording is allowed (same function: an age from `updatedAt`); the age must also stay on the letter picker rows. Pair with SHEL-042 (template name). [added by review 2] |
| SHEL-129 | **Card picture before the real page arrives, and the paper shape**: Until the real page 1 is painted a drawn page stands in: one drawing per template (classic, minimal, executive, timeline, banner, academic, compact, modern, sidebar and the designed layouts gridline, registry, bookend, lectern, chronicle, keystone, banded, keel, linen, broadsheet), a photo dot when the résumé has an unhidden photo, a letter drawing (letterhead, recipient lines, three paragraphs, signature) for a letter, in the résumé's paper shape (A4 80 x 112, US Letter 80 x 104) over an accent-tinted backdrop (default #2563eb); `data-thumb`, `data-thumb-photo`. ResumeThumbnail.jsx:39-156, ResumeCard.jsx:340-351 | One Paper stand-in 172 x 243 (A4 shape) on grey, whatever the template, paper or kind | RESTYLED | Keep the per-template drawing as the fallback, the letter drawing and the US Letter shape (the real picture is the résumé's own paper: SHEL-040). [added by review 2] |
| SHEL-130 | **How and when card pictures are painted, kept and dropped**: Painted only once a card is on screen (200 px margin), one at a time with a 120 ms gap through one queue, one paint per résumé however many cards ask; a new picture whenever what the résumé prints changes (`printHash`, which includes a letter's text); 80 pictures kept in memory, 24 in localStorage `cpwtcv_page_images` (least recently painted dropped), pruned at every store write to the résumés this browser holds (so a list that leaves with its account takes its pictures); a picture painted without the résumé's font or photo is shown but kept nowhere and painted again next visit. The picture is page 1 (a letter: its letter page) of the same PDF the preview and Export build, made in the PDF worker and painted by pdf.js, 160 px wide on a card and 240 px on a look card, as a JPEG at quality 0.82, in the résumé's own paper shape; it never changes the editor's font notice, and its canvas is freed at once (iOS caps canvas memory). utils/pageImageStore.js:13-157, hooks/usePicture.js:144-171, utils/pageImage.js:25-50 | Invisible; Paper stand-in | SAME | Keep (tests 83-dashboard-thumbnails, r5hunt6-card-picture-degraded). Any new surface that draws pages (New, ImportModal, a picker) asks the same queue. [added by review 2] |
| SHEL-131 | **Storage full or blocked: what gives way, and how the banner clears**: When a write is refused for room: the page-picture cache goes first, then backups of unreadable lists, oldest first, one at a time until the save fits; if it still does not fit they are all written back and the error stands (the user's data is never traded for a backup). The red banner (SHEL-052, SHEL-114) is the store's `persistError` and goes by itself when a later save succeeds; the edits stay in memory meanwhile (the Projects text warns "may be lost on reload"); a recovery notice that could not be written waits in memory and is written when a save frees room. A reload with an unreadable store backs the raw value up first. The Documents banner says "export your resumes as JSON" yet Documents has no export: the only JSON backup is per résumé, in the editor's Export menu ("Export Backup JSON"), and the Privacy text promises it ("Export your data at any time using the JSON export feature"). utils/storageBackup.js:68-100,176-205, hooks/useResumeStore.js:235-262, pages/Dashboard.jsx:235-241, ExportDropdown.jsx:115-119 | States "Storage full": one static banner; no clearing, no ordering | SAME | Keep all of it. Do not add a bulk "export all" to Documents (new capability); keep the editor's JSON export reachable. [added by review 2] |
| SHEL-139 | **Career History numbers and rules**: The panel lists, from the active résumé, every visible entry of every visible Experience section, each with only the company, role and dates the PDF prints (an eye-hidden field is blank; Show dates off blanks every date; an entry that prints nothing is not listed); the header reads "<total> total · <n> companies" where months are counted once across overlaps (gaps not at all), a promotion within a company is one company, a current job runs to this month, a past job with no end date has no length (its start alone is printed), and an end not after its start is no length; dates follow the résumé's own date format and its "Present" word; rows alternate six role colours; the current job has a ring and a "NOW" pill. components/CareerHistoryPanel.jsx:32-127, utils/careerHistory.js:1-60, utils/dates.js | JobsInsights Career history card: "3 yrs 9 mos total · 1 company", one entry with NOW | SAME | Invisible rules of SHEL-054; keep them with the card (tests 59-career-history, r5-hunt12-career-hidden-fields). [added by review 2] |
| SHEL-142 | **Deleting a résumé keeps the user's saved designs and moves the open one**: A design the user saved (Design → My designs) lives on the résumés, so a saved design held only by the résumé being deleted goes on to the most recently edited résumé left (a letter when that is all there is), which is stamped as edited so the sync carries it; the picker's "My designs" (SHEL-073, 074) therefore never loses one to a delete. When the deleted résumé was the open one, the first remaining record becomes the open one (Career History follows it, SHEL-054); none left gives the empty state. hooks/useResumeSyncActions.js:59-80 | Delete dialog only (States); no designs or career panel on the Documents boards | SAME | Invisible; keep (test 104-r5-hunt6-dash-delete-keeps-designs). [added by review 2] |

### Drawn but not in the live app (items of the parity files' "DRAWN BUT NOT" tables owned here)

- NEW-019 [editor-content] **DO NOT BUILD AS DRAWN**: What the canvas draws: An ATS score on the Documents cards ("ATS 82", "ATS 76", "ATS 68"). | Where: Main, ImportModal, MobileHome | Recommended handling: The Documents area's row; the live app computes a score only inside the ATS panel (checked: no other caller in src), so the same PARK as NEW-002.
- NEW-30 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: States "Confirm delete": "Its cover letter goes too." | What the canvas draws: A résumé's delete also removes its cover letter | Live today: A letter is a separate record (`kind: 'letter'`, a copy made from a résumé); deleting a résumé leaves letters; the live prompt is the native `confirm` with "This cannot be undone." only (Dashboard.jsx:25-30) | Handling: PARK; do not build the cascade or the sentence (it would also be untrue).
- NEW-31 [editor-letter-ats-export] **DO NOT BUILD AS DRAWN**: Board + element: Main / ImpModal / MobileHome: "Cover letter" chip on a résumé card and "1 cover letter" in the page subtitle | What the canvas draws: Letters shown as an attachment of one résumé | Live today: Letters are listed apart in a "Cover Letters" group with their own count (ELAE-132); a letter has no live link back to the résumé it was copied from | Handling: PARK the chip as an attachment; the count in the subtitle may stay as wording of the live "N letters" count. Owner decides how Documents lists letters (ELAE-034 / 132).
- D-02 [mobile] **DO NOT BUILD AS DRAWN**: Drawn control / behaviour: "ATS 82" and "Letter" chips on document cards | Where: MH | Live today: Cards show template and age only; the ATS score exists only inside the ATS tab | Recommended handling: PARK (new: a score on every card needs a stored or computed score).
- D-02 [mobile] **DO NOT BUILD AS DRAWN**: Drawn control / behaviour: ATS score chips | Where: MH cards, ME / MP / MD header | Live today: The score exists (atsChecker, ATS tab) | Recommended handling: Moved to the table as MOBI-161: same function, new placement; PARK only the per-card chip on MH if the owner will not pay for scoring every résumé.
- D-01 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: ATS score chip on each résumé card ("ATS 82", green/amber) | Where: Main | Live app: Cards have no score; the ATS checker is an editor tab/drawer | Handling: PARK. Review 2 note: the score itself is not new (utils/atsChecker.js and AtsCheckerPanel.jsx:297-310 give `totalScore` with bands at 90 / 75 / 60 in the editor's ATS tab; see mobile.md MOBI-161). Only a per-card chip is a new placement, and it would score every résumé on the list at paint time: the owner decides; no card chip is built until then.
- D-03 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: "Recently edited" sort control | Where: Main | Live app: No sort; creation order | Handling: PARK.
- D-04 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: "Applications" stage-count strip and "next interview" tile with "Open board" | Where: Main | Live app: Not on the live Documents page (only Job Tracker buttons) | Handling: PARK on Documents. The link itself is the nav entry (SHEL-003). Review note: the same figures already exist today on the Job Tracker's Summary view (components/job/JobSummary.jsx: Active, Interviewing, Offers, Response rate, Pipeline funnel, deadlines of the next two weeks), so the JobsInsights board is a same-function restyle; only the strip on Documents is new.
- D-05 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: Empty page offers "Start from a template: Pick one of 28 looks", "Import a file", "Start blank" side by side | Where: Empty | Live app: Single "Create Resume" button | Handling: PARK the extra options; Import and Blank already exist elsewhere (same functions). Count "28" verified by review: it is the real number of looks today without saved designs (SHEL-074); it must read the live count (+ saved designs), not a typed number.
- D-06 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: "Everything stays in this browser until you sign in." (Empty, Legal) | Where: Empty, Legal | Live app: No such sentence on these pages | Handling: PARK as new wording (true only when signed out or no cloud).
- D-09 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: "Its cover letter goes too." in the delete dialog | Where: States | Live app: A résumé's cover letter is part of the record and goes with it, but the live prompt does not say so | Handling: PARK as new wording.
- D-10 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: Storage-full banner advice "sign in to keep your work in your account" and button "Open Documents" | Where: States | Live app: Live advice: remove large photos, export JSON | Handling: PARK the new advice/button; keep the live text.
- D-18 [shell-docs] **DO NOT BUILD AS DRAWN**: Canvas draws: Résumé card "Cover letter" chip; subtitle counting cover letters | Where: Main | Live app: Letters are separate cards in their own group | Handling: PARK the chip; the count is SHEL-034.

## Tests that go red (computed: tests/ and cypress/ grepped for this batch's touched src files and for the visible labels found in them)

Touched src files (8): src/pages/Dashboard.jsx, src/components/ResumeCard.jsx, src/components/ResumeThumbnail.jsx, src/components/RecoveryNotice.jsx, src/components/CareerHistoryPanel.jsx, src/components/NewLetterModal.jsx, src/index.css, src/components/CardMenu.jsx. Labels scanned: 12 (title, aria-label, placeholder, button text of the files that exist today). Test files hit: 63; listed in this batch's "Existing tests to update": 18; NOT listed: 45.

FAIL: these hits are not covered by the batch's "Existing tests to update" list (add them to the plan or prove the hit harmless, in writing):

- FAIL cypress/e2e/07-regressions-store.cy.js: labels "Dismiss", "Download the copy"
- FAIL cypress/e2e/08-regressions-editor.cy.js: label "Dismiss"
- FAIL cypress/e2e/20-regressions-job-store.cy.js: label "Stop keeping"
- FAIL cypress/support/demoAccount.js: label "Stop keeping"
- FAIL tests/pdf/18-cloud-sync-originals.test.mjs: label "Stop keeping"
- FAIL tests/pdf/18-cloud-sync.test.mjs: label "Stop keeping"
- FAIL tests/pdf/30-date-editor.test.mjs: imports src/components/CareerHistoryPanel.jsx
- FAIL tests/pdf/34-recovery-notice-phone.test.mjs: imports src/components/RecoveryNotice.jsx; labels "Dismiss", "Download the copy"
- FAIL tests/pdf/34-recovery-notice-room.test.mjs: imports src/components/RecoveryNotice.jsx; label "Download the copy"
- FAIL tests/pdf/59-career-history.test.mjs: imports src/components/CareerHistoryPanel.jsx
- FAIL tests/pdf/71-startup-public-link-lazy.test.mjs: imports src/pages/Dashboard.jsx; imports src/index.css
- FAIL tests/pdf/83-templates-ui-leftovers.test.mjs: imports src/components/ResumeCard.jsx
- FAIL tests/pdf/89-app-routes.test.mjs: label "Privacy Policy"
- FAIL tests/pdf/91-page-size-control.test.mjs: imports src/components/ResumeThumbnail.jsx
- FAIL tests/pdf/91-starter-modal.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/93-picker-pictures.test.mjs: imports src/components/ResumeCard.jsx
- FAIL tests/pdf/96-modal-outside-click.test.mjs: imports src/components/NewLetterModal.jsx; label "New Cover Letter"
- FAIL tests/pdf/99-cover-letters.test.mjs: imports src/pages/Dashboard.jsx; imports src/components/ResumeCard.jsx; imports src/components/NewLetterModal.jsx; labels "Rename", "New Cover Letter"
- FAIL tests/pdf/99-import-ui.test.mjs: imports src/pages/Dashboard.jsx; label "Dismiss"
- FAIL tests/pdf/102-r4-dux-11-import-error-stays.test.mjs: imports src/pages/Dashboard.jsx; label "Dismiss"
- FAIL tests/pdf/103-r4-dph-29-personal-info.test.mjs: label "Résumé name"
- FAIL tests/pdf/103-r4-dvis-14-dashboard-projects-brand.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/103-r4-dvis-26-dashboard-header-stacks-until-lg.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/103-r4-dvis-27-sign-in-button.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/103-r4-dvis-29-career-sidebar-fits-window.test.mjs: imports src/pages/Dashboard.jsx; imports src/components/CareerHistoryPanel.jsx; label "Open Job Tracker →"
- FAIL tests/pdf/103-r4-dvis-32-career-panel-workspace-look.test.mjs: imports src/components/CareerHistoryPanel.jsx
- FAIL tests/pdf/104-r5-out-dout-04-projects-keep.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/104-r5-out-dout-04-sidebar-project-keep.test.mjs: imports src/pages/Dashboard.jsx
- FAIL tests/pdf/106-r5-hunt4-resume-recovery-leaves-with-account.test.mjs: label "Download the copy"
- FAIL tests/pdf/173-editor-header-render-count.test.mjs: labels "Dismiss", "Résumé name"
- FAIL tests/pdf/178-ui-b1-lazy-fallbacks.test.mjs: imports src/pages/Dashboard.jsx; imports src/components/CareerHistoryPanel.jsx; imports src/components/NewLetterModal.jsx; labels "Job Tracker →", "Try again", "Open Job Tracker →" (+1)
- FAIL tests/pdf/178-ui-b1-startup-headroom.test.mjs: imports src/pages/Dashboard.jsx; imports src/components/CareerHistoryPanel.jsx; imports src/components/NewLetterModal.jsx; labels "Open Job Tracker →", "New Cover Letter"
- FAIL tests/pdf/178-ui-b1-test-hooks.test.mjs: imports src/components/ResumeCard.jsx
- FAIL tests/pdf/r5hunt9-resume-name-text.test.mjs: imports src/components/ResumeCard.jsx; label "Rename"
- FAIL tests/pdf/r5hunt11-rename-other-resume.test.mjs: label "Résumé name"
- FAIL tests/unit/cursor-pointer.unit.mjs: imports src/index.css
- FAIL tests/unit/dead-code.unit.mjs: imports src/components/CareerHistoryPanel.jsx
- FAIL tests/unit/demo-seed.unit.mjs: label "Stop keeping"
- FAIL tests/unit/ime-enter-guard.unit.mjs: imports src/components/NewLetterModal.jsx
- FAIL tests/unit/legal-footer.unit.mjs: label "Privacy Policy"
- FAIL tests/unit/recovery-leaves-with-account.unit.mjs: label "Download the copy"
- FAIL tests/unit/storage-backup.unit.mjs: label "Download the copy"
- FAIL tests/unit/touch-reveal.unit.mjs: imports src/components/ResumeCard.jsx; imports src/index.css
- FAIL tests/unit/ui-b1-design-tokens.unit.mjs: imports src/index.css
- FAIL tests/unit/ui-b1-token-repoint.unit.mjs: imports src/index.css

Hits already in the update list:

- cypress/e2e/01-dashboard.cy.js: labels "Privacy Policy", "New Cover Letter"
- cypress/e2e/11-demo-account-keep.cy.js: label "Stop keeping"
- cypress/e2e/11-demo-account.cy.js: label "Stop keeping"
- tests/pdf/80-dashboard-import-read-error.test.mjs: imports src/pages/Dashboard.jsx
- tests/pdf/83-dashboard-thumbnails.test.mjs: imports src/components/ResumeCard.jsx
- tests/pdf/89-rename-fresh-name.test.mjs: imports src/components/ResumeCard.jsx; label "Rename"
- tests/pdf/96-dashboard.test.mjs: imports src/pages/Dashboard.jsx; imports src/components/NewLetterModal.jsx; labels "Résumé name", "Save name", "Rename" (+2)
- tests/pdf/99-public-link.test.mjs: imports src/pages/Dashboard.jsx
- tests/pdf/103-r4-dph-26-rename-box-touch-text.test.mjs: imports src/components/ResumeCard.jsx; labels "Résumé name", "Rename"
- tests/pdf/103-r4-dvis-28-dashboard-cards-wide-enough.test.mjs: imports src/pages/Dashboard.jsx; label "New Cover Letter"
- tests/pdf/104-r5-dash-card-name-two-lines.test.mjs: imports src/components/ResumeCard.jsx; labels "Save name", "Rename"
- tests/pdf/104-r5-dlg-new-letter-dialog.test.mjs: imports src/components/NewLetterModal.jsx; label "New Cover Letter"
- tests/pdf/104-r5-hunt6-dash-career-after-letter.test.mjs: imports src/components/CareerHistoryPanel.jsx
- tests/pdf/104-r5-hunt6-dash-import-after-sign-out.test.mjs: imports src/pages/Dashboard.jsx
- tests/pdf/105-r5-hunt1-dash-double-click.test.mjs: imports src/pages/Dashboard.jsx; label "New Cover Letter"
- tests/pdf/122-startup-json-resume-export-lazy.test.mjs: imports src/pages/Dashboard.jsx
- tests/pdf/162-redos-resume-card-name.test.mjs: imports src/components/ResumeCard.jsx
- tests/pdf/imp-import-busy.test.mjs: imports src/pages/Dashboard.jsx

## Progress log
(append: time, what, run ids, head sha)
