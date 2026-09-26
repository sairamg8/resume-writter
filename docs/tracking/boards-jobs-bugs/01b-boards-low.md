---
title: Boards — verified bugs, Low (B-14…B-31)
---

# Boards — verified bugs, Low (B-14…B-31)

> Part of [README.md](README.md). Status: 🔴 open · ⏸ fixed on the work branch, not yet on master (not deployed) · ✅ on master (deployed) · ✖ not a bug.
> Set the row (status + commit + test) in the SAME commit as the fix. Found by WF-1 `wf_a523cc8e-2ca` at `8409472`, 2026-09-23.

### B-14 · Low · data-loss · ✅ Fixed by the revamp
**The data-version migration throws away a demo board the user has adopted (renamed, with added cards) and re-adds a deleted demo, with no backup. Latent until BOARD_VERSION changes**
- **Where:** `src/hooks/useBoardStore.js` : 31, 62
- **Repro:** 1) On the demo 'Product launch' board, rename it and add a card. 2) Load with a stored dataVersion other than 1. Any build that bumps BOARD_VERSION does this; today it takes a DevTools edit. 3) The board is back to the stock demo title and cards, your card is gone, and there is no backup key or notice. 4) Separately: delete the demo, remove dataVersion and reload. The demo comes back.
- **Expected:** A demo board the user changed keeps the changes, a deleted demo stays deleted, and nothing is dropped without a backup. **Actual:** Every demo_* board is replaced by the stock demo, and init() persists the result at once.
- **Fix hint:** Replace only an untouched demo (its ids and updatedAt equal the constant's). Never re-add a demo the user dismissed (store a demoDismissed flag). Back up the raw value before any migration that drops boards. Leave dataVersion > BOARD_VERSION alone. The planned v2 migrateV1 must follow the same rule.
- **Verified (WF-1):** Ran verify-boards/v3-migrate.mjs. dataVersion=2 and a missing dataVersion both loaded ['Product launch','Own board'] with 'has MY TASK: false', 'stored keys: [cpwtcv_boards_v1]' (no backup) and 'stored dataVersion: 1'. A deleted demo gave ['Product launch','Only mine']. Reachability: git log -S BOARD_VERSION shows it has been 1 since the feature's first commit (2fb84c5), and boards-jobs-plan/02-boards.md puts v2 under a new key (cpwtcv_boards_v2) and leaves v1 in place. No shipped or planned build triggers this today, hence Low (the finders said Medium and Low).
- **Fail-first test:** tests/unit/board-store.unit.mjs: seed storage with the demo board renamed plus an extra card, and dataVersion 0. After init, assert the title and the card are kept, and that a deleted demo is not re-added. Fails today.
- **Now (checked at `45b6b60`):** Boards v2 lives under its own key (`cpwtcv_boards_v2`); v1 is read only while nothing is saved under v2 and is never written or removed, so it stays a copy (src/utils/boardStorage.js:1-5). Only the v1 demo exactly as shipped (its id and shipped updatedAt) is replaced by the v2 demo; one the user renamed or added to is migrated like any board (src/utils/boardMigrate.js:17-21, boardStorage.js:14-17). A saved v2 list — an empty one included — is read as it is, so a deleted demo is not re-added (boardStorage.js:39-47), and a list a newer build saved is backed up before this build's first save (:42-45). Test: board-migrate.unit.mjs:93.
- **Owner:** BOARDS-MODEL · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** tests/unit/board-migrate.unit.mjs, tests/unit/board-store.unit.mjs

### B-15 · Low · data-loss · ✅ Fixed · links **R2-098**
**Card ids are made unique only within one list, so moving one of two same-id cards in different lists deletes the other**
- **Where:** `src/hooks/useBoardStore.js` : 233-251 (src/utils/normalizeBoard.js:164-165, 175-183)
- **Repro:** 1) Using hand-edited or merged data, put a card with id 'dup' in list One and another with id 'dup' in list Two. 2) Drag either card. 3) The other card disappears.
- **Expected:** Card ids are unique across the whole board and distinct from list ids, so a move affects only the dragged card. **Actual:** The other card is deleted.
- **Fix hint:** In completeBoard, run withOwnIds over every card of the board with one shared `seen` set that also holds the list ids. In moveCard, strip the card only from its source list.
- **Verified (WF-1):** Ran verify-boards/v4-dupid.mjs. After load: 'l1:[Card in One] l2:[Card in Two, Z] x:[Card sharing the list id]', so the duplicates and the list id equal to a card id both survive normalisation. After moveCard(dup → l2, index 1): 'l1:[] l2:[Z, Card in Two]'. Reachable only with hand-edited or merged data, since newId prefixes list_ and card_.
- **Fail-first test:** normalize-board.unit.mjs: completeBoard of the v4 input yields card ids unique across the board and disjoint from list ids. board-store.unit.mjs: after the move, both cards still exist. Fails today.
- **Now:** completeBoard makes every id unique across the board with one shared set: the lists claim theirs first, then the cards and their checklist items in board order, so the first holder keeps its id (a link still opens it). moveCard takes the card out of its own list only. The v2 normaliser keeps the rule board-wide for issues, columns, labels, sprints, checklist items and comments. Fail-first: both tests failed at HEAD (the duplicate ids survived normalisation, and the store test's move lost a card).
- **Owner:** BOARDS-MODEL · **Fix commit:** `08aaa66` (`fix(boards): card ids are unique across the whole board (B-15)`) · **Test:** tests/unit/normalize-board.unit.mjs, tests/unit/board-store.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### B-16 · Low · data-loss · ✅ Fixed by the revamp
**Delete card permanently removes the card, its description and its checklist in one tap, with no confirm and no undo**
- **Where:** `src/components/board/CardDetailSheet.jsx` : 78-82 (src/pages/Board.jsx:240)
- **Repro:** 1) Open 'Draft landing copy'. 2) Scroll to the bottom of the sheet and tap 'Delete card'. 3) The card, its description and its 3 checklist items are gone, and nothing can restore them.
- **Expected:** A confirm, or an Undo toast or archive, as other deletes in Boards have. **Actual:** The card is deleted immediately and permanently.
- **Fix hint:** Soft-delete the card and show an Undo toast that restores it to the same list and index within 5 to 10 seconds, or add an archive with a restore view.
- **Verified (WF-1):** Code read: Board.jsx:240 calls onDelete → store.deleteCard then setOpen(null), with no confirm. Every other destructive action in Boards confirms (Boards.jsx:18, Board.jsx:176, and Board.jsx:215 for lists that hold cards). The store has no undo or archive.
- **Fail-first test:** board-store.unit.mjs for a new archiveCard/restoreCard pair that restores to the same list and index. Playwright: Delete card, then Undo, and the card is back. Fails today.
- **Now (checked at `45b6b60`):** Deleting an issue asks first and then offers Undo: the issue view's Delete (src/components/board/IssueDialog.jsx:102-113) and the card and backlog-row menus (src/components/board/useIssueActions.jsx:37-42) confirm, then show a toast whose Undo puts the issue, its place and its children back (`restoreIssue`, src/utils/boardIssueOps.js:262).
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** tests/unit/board-ops.unit.mjs, tests/unit/board-store.unit.mjs

### B-17 · Low · ux-defect · ⏸ Fixed (not deployed)
**A drop is never cancelled: closestCorners always returns a target, so a card released over the header or the Add-list column is still moved, and a list drag shows no preview while over a list that has cards**
- **Where:** `src/pages/Board.jsx` : 109-119, 204
- **Repro:** On the demo board: 1) Drag 'Pick hero image' and release it over the page header: it moves to the top of 'To do'. 2) Release it over the dashed 'Add list' button: it moves to the top of 'Done'. 3) Drag the 'To do' list by its grip over 'In progress': no column moves aside during the drag, but the order changes on release.
- **Expected:** Releasing a drag outside every list does nothing. While a list is dragged, the other columns shift to show the new order. **Actual:** Every drop moves the item somewhere, and list drags give no preview.
- **Fix hint:** Pass a custom collisionDetection. For a list drag, filter droppableContainers to list ids. For a card drag, use pointerWithin and fall back to rectIntersection, returning [] when the pointer is outside every column so over is null and the L111 guard applies.
- **Verified (WF-1):** Ran verify-boards/v5-dnd.mjs. Overlay on the page header (y=10): 'insert at index 0 of todo (above copy)', with 8 collisions returned. The list is never empty, so `if (!over) return` at L111 cannot run. Overlay on the Add-list column: 'insert at index 0 of done (above analytics)'. A list overlay on the 'To do' header gave over=copy (copy:56.6 vs todo:81.5), and on 'In progress' over=pricing. A card id is not in the lists' SortableContext, so overIndex is -1 (sortable.esm.js:311) and no column is displaced. onDragEnd L116 maps the card back to its list and reorders on drop.
- **Fail-first test:** Extract boardCollision(args) and unit-test it: for type 'list' only list ids are returned, and for a card whose pointer is outside every column rect it returns []. Fails today.
- **Now:** `boardCollision` (src/utils/boardDnd.js) asks what is under the pointer (dnd-kit's pointerWithin), the card before the column that holds it; outside every column nothing is, so the drop is called off and the card goes back where it was. A drag with no pointer (the keyboard's) keeps closestCorners. The whole column section is the droppable, so a card released over a column's name lands in it.
- **Owner:** BOARDS-UI-A · **Fix commit:** `f568ac3` (work branch, not deployed) · **Test:** tests/unit/board-collision.unit.mjs

### B-18 · Low · bug · ✅ Fixed by the revamp
**The open card sheet is tied to the card's old list: when another tab moves the card, the sheet vanishes mid-edit, and it reopens by itself if the card comes back**
- **Where:** `src/pages/Board.jsx` : 78, 102-103, 234-241
- **Repro:** 1) Open the demo board in two tabs. 2) Tab A: open 'Draft landing copy' and start typing in the description. 3) Tab B: drag that card to 'In progress'. 4) Tab A's sheet disappears mid-sentence. 5) Tab B drags it back to 'To do': tab A's sheet opens again by itself.
- **Expected:** The sheet follows the card (its header now reads 'in In progress'), and edits keep saving. **Actual:** The sheet closes, and it reappears only if the card returns to its old list.
- **Fix hint:** Keep only cardId in `open`. On each render, find the list with findListOf(open.cardId) and pass that list's id to updateCard and deleteCard. Clear `open` when the card no longer exists.
- **Verified (WF-1):** Ran verify-boards/v7-open-sheet.mjs, replaying Board.jsx:102-103 on tab A's snapshot. It printed 'A sheet shows : Draft landing copy'. After tab B's moveCard to doing: 'null (sheet unmounts; open state kept)'. After moving it back: 'Draft landing copy (sheet re-opens by itself)'. The modal overlay blocks drags in the same tab, so only a second tab or device triggers this.
- **Fail-first test:** Extract openCardOf(board, open) and unit-test that it finds the card in any list. Or run a two-tab board-store test as in v7. Fails today.
- **Now (checked at `45b6b60`):** The issue view is opened by the issue's id and finds it in whatever column it is now (`issueById(board, issueId)`, src/components/board/IssueDialog.jsx:93), with its status read from that column, so a move in another tab updates the open view instead of closing it; it closes only when the issue no longer exists (:94).
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** —

### B-19 · Low · bug · ✅ Fixed by the revamp
**The card checklist silently refuses an item whose text matches any existing item, including completed ones**
- **Where:** `src/components/job/TasksTab.jsx` : 20
- **Repro:** 1) Open a card and add the checklist item 'Review'. 2) Tick it done. 3) Type 'Review' again and press Enter (or click +). 4) Nothing is added, no message appears, and the text stays in the input.
- **Expected:** The item is added, or an inline message explains why not. **Actual:** The input is silently ignored.
- **Fix hint:** Drop the duplicate-text check, or make it opt-in (an allowDuplicates prop set by card checklists) and show an inline hint when it applies. The Job Tracker's tasks share this code.
- **Verified (WF-1):** Code read at TasksTab.jsx:19-21: `if (!t \|\| todos.some(td => td.text === t)) return;` runs before onChange and before setInput(''), so the text stays. The + button stays enabled (L48) and does nothing. CardDetailSheet.jsx:75 uses TasksTab for card checklists.
- **Fail-first test:** Extract a pure addChecklistItem(todos, text) and assert that adding 'Review' twice yields two items (or returns an explicit reason). Fails today.
- **Now (checked at `45b6b60`):** The issue checklist adds any non-blank text (src/components/board/IssueChecklist.jsx:16-21): no duplicate-text check, so 'Review' can be added again after one is ticked.
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** —

### B-20 · Low · bug · ⏸ Fixed (not deployed)
**Enter handlers ignore IME composition, so the Enter that confirms a CJK conversion adds the card, list or checklist item too early**
- **Where:** `src/components/board/AddCard.jsx` : 42 (src/pages/Board.jsx:47, 160; src/components/board/BoardColumn.jsx:57; src/components/job/TasksTab.jsx:42; src/components/job/TodoItem.jsx:37)
- **Repro:** 1) Turn on a Japanese IME. 2) In 'Add a card', type 'かいもの' and press Enter to confirm the conversion to 買い物. 3) A card is created from the unconfirmed text, and the composer resets while the IME is still composing.
- **Expected:** An Enter during composition only confirms the IME. **Actual:** The card, list or item is committed early.
- **Fix hint:** Add a shared isCommitEnter(e) helper: e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229. Use it in every Enter handler listed.
- **Verified (WF-1):** Code read: every listed handler tests only e.key === 'Enter' (plus !shiftKey in AddCard), and none checks isComposing or keyCode 229. The repo's own RichTextEditor already guards composition (L17, 185-186). Not run, because it needs a real IME. The claim relies on documented browser behaviour: Chrome sends the confirming Enter keydown with isComposing true, and Safari sends keyCode 229 after compositionend.
- **Fail-first test:** Unit test for the new isCommitEnter helper: {key:'Enter', nativeEvent:{isComposing:true}} → false, {key:'Enter', keyCode:229, nativeEvent:{}} → false, plain Enter → true. Add a static scan asserting that no board or checklist onKeyDown compares e.key === 'Enter' directly. Fails today.
- **Now:** The checklist's 'Add an item' field (src/components/board/IssueChecklist.jsx) and a column's '+ Create issue' composer (src/components/board/InlineCreate.jsx) step aside while the keystroke is the input method's — nativeEvent.isComposing, or keyCode 229 (Safari) — so the Enter that picks a Chinese, Japanese or Korean word adds nothing, and an Escape that cancels the composition keeps the text. InlineEdit already waited on isComposing. (The v1 AddCard, BoardColumn and TodoItem handlers the row named are gone with the revamp.)
- **Owner:** BOARDS-UI-A · **Fix commit:** `617f24f` (work branch, not deployed) · **Test:** tests/unit/board-ime-enter.unit.mjs

### B-21 · Low · ux-defect · ✅ Fixed by the revamp
**The card title field is a fixed 1-row textarea: long titles are clipped, Enter inserts newlines, and a blank or whitespace-only title is saved**
- **Where:** `src/components/board/CardDetailSheet.jsx` : 24-31 (src/components/board/BoardCard.jsx:27)
- **Repro:** 1) Add a card titled 'Call the landlord about the leaking kitchen tap and ask for the plumber's number'. 2) Open it: only the first line is visible in the sheet header, and the rest scrolls inside the 1-row box. 3) Put the caret at the end, press Enter and type 'second line': the face shows '…number second line'. 4) Select all and type three spaces: the card face shows an empty box.
- **Expected:** The field grows to show the whole title. Enter commits instead of adding a newline, newlines are stripped, and a blank title reverts to the previous one. **Actual:** The title is clipped, can hold newlines, and can be blank.
- **Fix hint:** Auto-size the textarea from scrollHeight. On Enter (when not composing), preventDefault and blur. Keep a local draft and commit on blur with trim(), reverting when blank. Strip \n on paste and in AddCard.
- **Verified (WF-1):** Code read: <textarea rows={1} className="… resize-none"> has no auto-size and no key handling, and onChange writes the raw value on every keystroke. CardView prints card.title \|\| 'Untitled', so '' shows 'Untitled' but ' ' renders an empty title. The <p> has no whitespace-pre-line, so newlines collapse to spaces. AddCard trims and refuses blank titles, so the two paths disagree.
- **Fail-first test:** Unit test a pure normalizeCardTitle(draft, previous): 'a\nb' → 'a b', and ' ' → previous. Playwright: a 90-character title in a 375px sheet has scrollHeight equal to clientHeight. Fails today.
- **Now (checked at `45b6b60`):** The summary is edited with the kit's InlineEdit (src/components/board/IssueDialog.jsx:163), a one-line field (src/components/ui/InlineEdit.jsx:83): Enter commits, no line break can be typed, the text is trimmed and a blank one reverts to the previous title (:50-55). Shown, the whole summary wraps in the heading; while editing, a long one scrolls inside its one-line field.
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** —

### B-22 · Low · ux-defect · ✅ Fixed by the revamp
**Selecting text in the card sheet and releasing the mouse over the backdrop closes the sheet**
- **Where:** `src/components/board/CardDetailSheet.jsx` : 20-21
- **Repro:** 1) On a desktop, open a card. 2) Press inside the description and drag-select to the left, releasing outside the white panel. 3) The sheet closes.
- **Expected:** The sheet stays open. Only a press and release both on the backdrop closes it. **Actual:** The sheet closes in the middle of editing.
- **Fix hint:** Record the pointerdown target, and close only when both pointerdown and click happened on the overlay itself (e.target === e.currentTarget).
- **Verified (WF-1):** Code read: the overlay has onClick={onClose}, and the panel only stops propagation. When mousedown is inside the panel and mouseup is on the overlay, the click is dispatched to their nearest common ancestor, the overlay, so the panel's stopPropagation never runs.
- **Fail-first test:** Playwright: open a card, mouse.down inside the description, move outside the panel, mouse.up, and expect the sheet still visible. Fails today.
- **Now (checked at `45b6b60`):** The kit's Dialog, which the issue view uses, closes on the overlay only when the press both starts and ends on it (src/components/ui/Dialog.jsx:73-84), so a text selection released over the backdrop keeps it open.
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** tests/unit/ui-overlays.unit.mjs

### B-23 · Low · ux-defect · ✅ Fixed by the revamp
**The demo board's due dates are fixed calendar dates, so every new user's first board already shows overdue work**
- **Where:** `src/constants/boards.js` : 45, 75
- **Repro:** 1) In a fresh browser profile, open /#/boards and then 'Product launch'. 2) 'Build pricing page' shows a red overdue date. From 2026-09-26, so does 'Draft landing copy', permanently.
- **Expected:** A realistic demo: one card due soon, one due later, none overdue. **Actual:** The first board a user sees is full of overdue work.
- **Fix hint:** Build DEMO_BOARDS with a function that sets due dates relative to today (for example today+2 and today+7) when it seeds, or leave the demo undated.
- **Verified (WF-1):** Ran verify-boards/v6-demo-due.mjs with the real deadlineState. On 2026-09-23: 'Draft landing copy(2026-09-24)=soon \| Build pricing page(2026-09-22)=past'. On 2026-09-26 and 2027-03-01 both are 'past'. BoardCard.jsx:29 colours 'past' red.
- **Fail-first test:** Unit test: makeDemoBoards(now) has no card with deadlineState(due, now) === 'past' for several `now` values. Fails today (the constant is static).
- **Now (checked at `45b6b60`):** The demo project is built by `makeDemoBoards(now)` with due dates in days from today (src/utils/boardDemo.js:29, :61), so a first-run board is never overdue. Test: board-store.unit.mjs:103.
- **Owner:** BOARDS-MODEL · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** tests/unit/board-store.unit.mjs

### B-24 · Low · a11y · 🔴 Open
**Hover-revealed delete buttons (board tiles, checklist items) stay invisible while focused, so keyboard focus lands on a hidden destructive control**
- **Where:** `src/pages/Boards.jsx` : 80 (src/components/job/TodoItem.jsx:53)
- **Repro:** 1) On a desktop, open /#/boards. 2) Tab past 'New board': the focus ring vanishes. 3) Press Enter: 'Delete "Product launch"?' appears for a button the user never saw.
- **Expected:** A focused control is visible. **Actual:** The focused control stays at 0% opacity.
- **Fix hint:** Add `focus-visible:opacity-100 group-focus-within:opacity-100` to both buttons.
- **Verified (WF-1):** Code read: both buttons use 'opacity-0 group-hover:opacity-100 no-hover:opacity-100' with no focus variant. On a (hover: hover) device, focus does not lift them off 0%. no-hover (src/index.css:9) covers touch screens only.
- **Fail-first test:** Extend tests/unit/touch-reveal.unit.mjs: every opacity-0 + group-hover reveal must also compile to opacity 1 under :focus-visible or :focus-within. Fails today for Boards.jsx:80 and TodoItem.jsx:53.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-25 · Low · a11y · 🔴 Open
**A card's due status (overdue or due soon) is shown only by the colour of a raw ISO date**
- **Where:** `src/components/board/BoardCard.jsx` : 30-33
- **Repro:** 1) Open the demo board. 2) 'Build pricing page' shows '2026-09-22' in red, and 'Draft landing copy' shows '2026-09-24' in amber. 3) In greyscale or with a screen reader, both are just dates, with no overdue or soon status.
- **Expected:** Status in text or an icon, for example 'Overdue · 22 Sep' or 'Due tomorrow', in a localised short date. **Actual:** The status is conveyed by colour alone (WCAG 1.4.1).
- **Fix hint:** Format with Intl.DateTimeFormat(undefined,{day:'numeric',month:'short'}) and add a status word or sr-only text. Use tinted chips that meet contrast (bg-red-50 text-red-700).
- **Verified (WF-1):** Code read: the only difference between overdue, soon and normal is text-red-500, text-amber-500 or text-gray-400 on '{card.due}'. The Job Tracker's KanbanView.jsx:53-54 prints 'Deadline passed' or 'Due soon' as text, which the board card dropped.
- **Fail-first test:** SSR render of CardView with due set to yesterday: the markup contains 'Overdue' (visible or sr-only). Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-26 · Low · a11y · 🔴 Open
**Board icon controls and meta text fail WCAG contrast: gray-200/300 icons, and 10-11px gray-400 or amber-500 text**
- **Where:** `src/pages/Board.jsx` : 177 (src/pages/Boards.jsx:80, 87; src/components/board/BoardColumn.jsx:44, 73; src/components/board/BoardCard.jsx:29-38; src/components/job/TodoItem.jsx:24, 53)
- **Repro:** 1) Open a board on a laptop at normal or reduced brightness. 2) The header trash icon, the column grips and delete icons, and the checklist toggle and delete icons are barely visible. The 10px due and checklist meta text is hard to read.
- **Expected:** Icon controls at 3:1 or better (1.4.11), and text at 4.5:1 or better (1.4.3). **Actual:** All of them are well below.
- **Fix hint:** Use gray-500 or darker for idle icons, and gray-600 for meta text at a minimum of 11-12px. Put due status in tinted chips (bg-red-50 text-red-700).
- **Verified (WF-1):** Ran verify-boards/v8-contrast.mjs with Tailwind v4's own oklch values from node_modules/tailwindcss/theme.css, converted to sRGB. On white: gray-200 1.24:1, gray-300 1.47:1, gray-400 2.60:1, amber-500 2.15:1, red-500 3.82:1. The icons (text-gray-300/200) fail 3:1, and the 10-11px gray-400, amber-500 and red-500 text fails 4.5:1. The column background (gray-100/70) is darker still.
- **Fail-first test:** Unit test that compiles the used colour classes with Tailwind, as touch-reveal.unit.mjs does, and asserts contrast ≥ 4.5 for text classes and ≥ 3 for icon-button classes in src/components/board and src/pages/Board*.jsx. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-27 · Low · a11y · 🔴 Open
**Board pages have no headings or list structure, and the column count badge has no label**
- **Where:** `src/components/board/BoardColumn.jsx` : 64-72, 78-84 (src/pages/Boards.jsx:32; src/pages/Board.jsx:167-173)
- **Repro:** 1) Open the demo board with NVDA. 2) Press H to jump between headings: there are none. 3) Press L for lists: there are none. 4) Focus a card: nothing says it is in 'To do', card 1 of 2. The badge reads just '2'.
- **Expected:** An <h1> for the board, a heading and region per column, and cards as list items with counts ('To do, 2 cards'). **Actual:** A flat set of divs and buttons.
- **Fix hint:** Put the board title in an h1 (with the rename button inside it). Make each column a <section aria-labelledby> with an h2 and a <ul role=list>, and give the badge aria-label={`${n} cards`}.
- **Verified (WF-1):** Code read: 'Boards' is a <span> (Boards.jsx:32). The board name is a <button> with no heading (Board.jsx:167-173). Column titles are spans, and columns and cards are plain divs (BoardColumn.jsx:78-84). The badge (L72) prints only the number.
- **Fail-first test:** SSR render of Board: assert exactly one <h1>, one <h2> per list, and cards rendered as <li>. Fails today.
- **Owner:** BOARDS-UI-A (board view) + BOARDS-UI-B (projects page) · **Fix commit:** — · **Test:** —

### B-28 · Low · a11y · 🔴 Open
**Closing an inline composer or editor (Add card, Add list, list or board title) drops keyboard focus to <body>**
- **Where:** `src/components/board/AddCard.jsx` : 43, 51 (src/pages/Board.jsx:48, 56, 160; src/components/board/BoardColumn.jsx:57-58)
- **Repro:** 1) Tab to a list's 'Add a card' and press Enter. 2) Type something, then press Escape. 3) Press Tab: focus restarts at the header's Back button, not next to 'Add a card'.
- **Expected:** Focus returns to the control that opened the editor. **Actual:** Focus is lost to the document body.
- **Fix hint:** Keep a ref to the trigger button and focus it in a useEffect when `open` goes from true to false. Do the same for AddListColumn and the list and board title editors.
- **Verified (WF-1):** Code read: on Escape or Cancel the focused textarea or input unmounts and the trigger button remounts, with no focus() call. AddCard's useEffect (L13) focuses only when open becomes true. Board.jsx:160 blurs the title input on Enter.
- **Fail-first test:** Playwright: Tab to 'Add a card', press Enter, then Escape, and expect document.activeElement's text to be 'Add a card'. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-29 · Low · mobile · ⏸ Fixed (not deployed)
**A long unbroken checklist item (such as a URL) overflows its row and makes the card sheet scroll sideways**
- **Where:** `src/components/job/TodoItem.jsx` : 43-48
- **Repro:** 1) At 375px width, open a card. 2) Add the checklist item 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit'. 3) The sheet scrolls horizontally, and the item's delete X is pushed off-screen.
- **Expected:** The text wraps inside the row. **Actual:** The row overflows the sheet.
- **Fix hint:** Add `min-w-0 break-words` (or [overflow-wrap:anywhere]) to the text span.
- **Verified (WF-1):** Code read: the text span is flex-1 with no min-w-0 or break-words inside a flex row, so its min-content width (the whole URL) sets the row's minimum width. The sheet panel is overflow-y-auto, which makes overflow-x auto, so the panel scrolls horizontally. Card titles use break-words (BoardCard.jsx:27); checklist items do not.
- **Fail-first test:** Playwright at 375px: add a 90-character URL item and assert panel.scrollWidth <= panel.clientWidth. Or a static class check on TodoItem's span. Fails today.
- **Now:** Each checklist item's text (its InlineEdit in src/components/board/IssueChecklist.jsx) carries `min-w-0 break-words`, done or open and in its edit field, so a pasted URL wraps in its row instead of scrolling the issue view sideways. The same for the issue's summary followed in `b9805bb` (B-29b).
- **Owner:** BOARDS-UI-A · **Fix commit:** `4345a13` (work branch, not deployed) · **Test:** tests/unit/board-checklist-wrap.unit.mjs

### B-30 · Low · mobile · ✅ Fixed by the revamp
**The board page is sized with 100vh (h-screen), so mobile browser toolbars hide the bottom of the columns**
- **Where:** `src/pages/Board.jsx` : 145
- **Repro:** 1) On iPhone Safari or Android Chrome, open a board whose 'To do' list has about 10 cards. 2) Scroll that list to its end: 'Add a card' sits under the browser toolbar until you scroll the whole page.
- **Expected:** The board fits the visible viewport. **Actual:** The bottom 56-90px of the board is clipped while the toolbar is visible.
- **Fix hint:** Use `h-dvh` (Tailwind v4), with h-screen as the fallback.
- **Verified (WF-1):** Code read: 'min-h-screen h-screen' is height 100vh. On iOS Safari and Android Chrome that is the large viewport, measured with the toolbars hidden, so the flex-1 board area extends under the visible toolbar and the document itself becomes scrollable.
- **Fail-first test:** Static check that the Board root uses h-dvh. Or Playwright mobile emulation: root.getBoundingClientRect().height <= window.innerHeight. Fails today.
- **Now (checked at `45b6b60`):** The board page sits in the workspace shell, which fills the dynamic viewport (`h-dvh`, src/components/shell/WorkspaceLayout.jsx:78), so a phone's toolbar no longer hides the bottom of the columns. Test: ui-shell.unit.mjs:126.
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** tests/unit/ui-shell.unit.mjs

### B-31 · Low · mobile · ✅ Fixed by the revamp
**The list drag grip is a 14×14px target and the only way to reorder lists, which makes press-and-hold list reordering near impossible on a phone**
- **Where:** `src/components/board/BoardColumn.jsx` : 41-49, 73-75
- **Repro:** 1) On a phone, press and hold the grip to move 'Review' left: most attempts land on the title or scroll the board. 2) The 'Delete list' button beside the count badge is about 20px, and an empty list is removed on a single tap.
- **Expected:** Touch targets of at least 24px (ideally 44px), and a list menu for less error-prone actions. **Actual:** The targets are tiny.
- **Fix hint:** Add padding (p-2 or larger) to the grip. Move Rename, Move left/right and Delete into a column '…' menu (see proposals).
- **Verified (WF-1):** Code read: the grip <button> has no padding around a 14px GripVertical icon. The column's drag listeners are only on this button, so a list drag must start on it and survive the TouchSensor's 200ms/8px constraint (Board.jsx:87). The delete button is p-1 around a 12px icon (≈20px).
- **Fail-first test:** Playwright mobile: boundingBox of the 'Drag to reorder list' button is at least 24×24. Fails today (14×14).
- **Now (checked at `45b6b60`):** The v1 grip is gone: a column is moved with its ⋯ menu's Move left / Move right (src/components/board/BoardColumn.jsx:57-77) or Project settings' Move up / down, and the menu's trigger is a 28 px IconButton whose hit area grows on a coarse pointer (src/components/ui/IconButton.jsx:13-16). Delete column sits in that menu, and a column holding issues asks first and moves them to its neighbour (src/pages/Board.jsx:128-143).
- **Owner:** BOARDS-UI-A · **Fix commit:** the Lane C redesign and the Jira-style revamp (merges `de0911f`, `75236a2`; on master `e6b1a4a`, deployed) · **Test:** —
