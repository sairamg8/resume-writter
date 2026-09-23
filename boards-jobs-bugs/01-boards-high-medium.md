---
title: Boards — verified bugs, High and Medium (B-01…B-13)
---

# Boards — verified bugs, High and Medium (B-01…B-13)

> Part of [README.md](README.md). Status: 🔴 open · ⏸ fixed on `boards-jobs-ui` (not merged) · ✅ merged to master · ✖ not a bug.
> Set the row (status + commit + test) in the SAME commit as the fix. Found by WF-1 `wf_a523cc8e-2ca` at `8409472`, 2026-09-23.

### B-01 · High · data-loss · 🔴 Open
**After you leave the board pages, the store stops listening to other tabs. When you come back it shows a stale list, and the next edit overwrites boards another tab saved**
- **Where:** `src/hooks/useBoardStore.js` : 101-120 (subscribe), 79-82 (snapshot), 127-133 (setBoards)
- **Repro:** 1) Tab A: open /#/boards, then click the back arrow to the dashboard. 2) Tab B: open /#/boards, click New board and add a card to it. 3) Tab A: click Boards. B's board is missing. 4) Tab A: rename any board. 5) B's board is removed from storage and from tab B. Reloading either tab does not bring it back, and there is no backup or notice.
- **Expected:** When tab A returns to /boards it re-reads storage and shows B's board, and A's edit keeps that board. **Actual:** Tab A shows the list from before it left. Its first edit writes that list over storage, and the board made in tab B is deleted in every tab.
- **Fix hint:** In subscribe(), when wasEmpty && initialized, call takeOtherTabsList() (or reload current from load()) before re-adding the listener. Alternatively, add the storage listener once in init() and never remove it. useJobStore.js has the same subscribe/init shape, so fix it the same way.
- **Verified (WF-1):** Code read at useBoardStore.js:101-120: init() runs only while !initialized. The 'storage' listener is removed when listeners.size hits 0, but `current` and `initialized` stay as they are, so a later subscribe re-adds the listener without re-reading storage. grep shows only Boards.jsx and Board.jsx import useBoardStore, so any visit to the dashboard, editor or jobs leaves the store deaf. Ran scratchpad/audit/verify-boards/v1-stale.mjs: two module instances (two tabs) share one fake localStorage that fires storage events to the other tab's window, with react stubbed. Printed: "storage after B adds a board : ['Product launch','Made in B']", "tab A shows on return : ['Product launch']", "storage after one edit in A : ['Renamed in A']", "tab B now shows : ['Renamed in A']".
- **Fail-first test:** tests/unit/board-store.unit.mjs: register a react stub with node:module register, then import useBoardStore.js twice with different ?tab queries sharing one fake localStorage that dispatches storage events to the other tab's window stub. A subscribes and unsubscribes, B calls addBoard, A subscribes again. Assert A.snapshot().boards contains B's board. Then call A.updateBoard and assert the stored JSON still holds B's board. Fails today.
- **Owner:** BOARDS-MODEL · **Fix commit:** — · **Test:** —

### B-02 · Medium · crash · 🔴 Open · links **R2-041**
**A saved list whose cards array is missing or null passes normalisation and crashes /boards and /boards/:id on every load, with no backup or recovery notice**
- **Where:** `src/utils/normalizeBoard.js` : 118, 178 (crash sites: src/pages/Boards.jsx:68, src/pages/Board.jsx:196 and 99-100, src/components/board/BoardColumn.jsx:24, src/hooks/useBoardStore.js:213)
- **Repro:** 1) In DevTools set localStorage cpwtcv_boards_v1 to {"boards":[{"id":"b","title":"B","lists":[{"id":"l","title":"x"}]}],"dataVersion":1}. 2) Open /#/boards: the ErrorBoundary replaces the page. 3) Reload: it crashes again. 4) /#/boards/b crashes as well.
- **Expected:** The list is repaired to cards: [] and both pages render. **Actual:** Both board pages crash on every visit, and no recovery is offered. init() writes the bad value back.
- **Fix hint:** In readList, when !Array.isArray(list.cards), set cards to [] (mark it lost only when list.cards != null). In completeLists, also default cards to [], as completeBoard already does for lists.
- **Verified (WF-1):** Code read: readList repairs cards only when list.cards != null (normalizeBoard.js:118), and completeLists skips non-arrays (L178). Ran verify-boards/v2-nocards.mjs with lists [{id:'l'},{id:'m',cards:null}]. Printed: 'recovery notice: null'. Storage was rewritten unchanged by init. 'backup keys: []', 'Boards.jsx:68 expression throws: Cannot read properties of undefined (reading 'length')', 'useBoardStore addCard throws: l.cards is not iterable'. The throw is caught by the ErrorBoundary in AppRoutes.jsx:20.
- **Fail-first test:** tests/unit/normalize-board.unit.mjs (the file normalizeBoard.js:6 already cites): completeBoard(readBoard({id:'b',lists:[{id:'l'},{id:'m',cards:null}]}).kept).lists.every(l => Array.isArray(l.cards)) must be true. Fails today.
- **Owner:** BOARDS-MODEL · **Fix commit:** — · **Test:** —

### B-03 · Medium · data-loss · 🔴 Open · links **R2-037**
**The board page never shows the storage-full alert or the recovery notice, so edits made there are lost on reload without warning**
- **Where:** `src/pages/Board.jsx` : 74 (store read; compare src/pages/Boards.jsx:40-51)
- **Repro:** 1) Fill localStorage close to its quota (for example with a large résumé photo). 2) Open /#/boards/demo_board_1 and add several cards. No alert appears. 3) Reload: the cards are gone. 4) Go to /#/boards: the 'Changes aren't being saved' alert appears only there.
- **Expected:** The same not-saved alert and RecoveryNotice appear under the board header. **Actual:** Nothing is shown on the page where the edits happen.
- **Fix hint:** Move the alert and RecoveryNotice block (Boards.jsx:40-51) into a shared BoardStorageBanner and render it under the Board header too. Add NOT_SAVED_MESSAGES.boards in storageBackup.js.
- **Verified (WF-1):** Code read: Board.jsx uses only store.boards and the store actions. grep for persistError\|persistReason\|recovery in Board.jsx and src/components/board/* finds nothing. Only Boards.jsx:40-51 renders them. setBoards (useBoardStore.js:127-133) keeps the edit in memory and records persistError when setItemWithRoom throws, so the page looks saved.
- **Fail-first test:** SSR test through tests/pdf/harness.mjs loadModule plus react-dom/server: use a fake localStorage whose setItem throws a QuotaExceededError, render Board under MemoryRouter at /boards/demo_board_1, and assert the markup contains role="alert" and 'being saved'. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-04 · Medium · data-loss · 🔴 Open · links **R2-140**
**Boards exist only in this browser's localStorage (no sync, no export), but the Privacy page says all content syncs and is restored after clearing storage**
- **Where:** `src/hooks/useBoardStore.js` : 16, 39-46 (src/pages/PrivacyPage.jsx:50, 61)
- **Repro:** 1) Sign in with Google. 2) Create a board with cards. 3) Clear site data (or open the app on another device) and sign in again. 4) The résumés come back and the board does not.
- **Expected:** Boards sync as the Privacy page states. Otherwise the Privacy page and the Boards UI say that boards stay on this device, and offer an export and import. **Actual:** The boards are lost, and nothing warned the user.
- **Fix hint:** Until Phase 3 (per-board last-write-wins sync) ships, correct PrivacyPage.jsx:50/61 and add 'Export boards (JSON)' and 'Import' on /boards, routing imports through readBoard/completeBoard/addressableBoards.
- **Verified (WF-1):** Code read: persist writes only cpwtcv_boards_v1 (L16, L39-46). No sync module imports the board store (grep: only Boards.jsx and Board.jsx do). Boards.jsx has no export or import control. PrivacyPage.jsx:50 says 'all content you enter into CPWT-CV, synced to Firebase Firestore', and :61 says 'To restore your data if you clear your browser's local storage.' (the finder cited :60; it is :61). Not run, because it needs a Google sign-in. R2-145 is the Low duplicate for jobs and boards together.
- **Fail-first test:** tests/unit/board-transfer.unit.mjs for a new exportBoards/importBoards pair: export → JSON → import round-trips every board, list, card and checklist item with lost=false. Also an SSR render of Boards asserting an 'Export boards' control. Fails today (the functions do not exist).
- **Owner:** BOARDS-MODEL (export/import fns) + BOARDS-UI-B (UI + PrivacyPage.jsx) · **Fix commit:** — · **Test:** —

### B-05 · Medium · bug · 🔴 Open
**A card dragged to another list can never land at the bottom of a list with 2 or more cards: it is inserted above the last card, and no placeholder shows during the drag**
- **Where:** `src/pages/Board.jsx` : 122-135, 204
- **Repro:** On the demo 'Product launch' board: 1) Drag 'Build pricing page' out of 'In progress'. 2) Release it just below 'Pick hero image', the last card of 'To do' (over its 'Add a card' button), or anywhere lower. 3) It lands between 'Draft landing copy' and 'Pick hero image'. No gap opened in 'To do' during the drag.
- **Expected:** Dropping below the last card appends the card. During the drag, the target list opens a gap where the card will land. **Actual:** The card is always inserted above the hovered or last card. The bottom slot of any list with 2 or more cards cannot be reached by a cross-list drop, and neither list previews the move.
- **Fix hint:** Use dnd-kit's multi-container pattern: in onDragOver, move the card into the hovered list's items so its SortableContext shows the gap, and commit in onDragEnd. At minimum, insert at overIndex + 1 when the active rect's centre Y is below the over rect's centre, and use pointerWithin before closestCorners.
- **Verified (WF-1):** Ran verify-boards/v5-dnd.mjs, which runs dnd-kit 6.3.1's own closestCorners on a layout taken from the Board, BoardColumn and BoardCard classes. With the overlay 8, 30, 60 and 200px below 'Pick hero image', every drop gave over=hero, i.e. 'insert at index 1 of todo (above hero)' (hero:59.6 vs todo:100.19 at +8px). A 4-card list gave 'insert at index 3 of todo (above c4)'. Analytically, the column rect wins only when its top is within about 42px of the last card's top, which means 0 or 1 cards. No preview: sortable.esm.js:310-314 gives activeIndex -1 and overIndex ≠ -1 in the target list, so disableTransforms is true, and there is no onDragOver. Same-list moves are correct, because strip-then-insert matches arrayMove.
- **Fail-first test:** Extract onDragEnd's target maths into a pure resolveCardDrop(board, activeId, over, activeRect, overRect) in src/utils/boardDnd.js. tests/unit/board-dnd.unit.mjs feeds it closestCorners output on the v5 geometry and asserts that a drop below the last card of a 2-card list gives toIndex 2 (append). Fails today (gives 1).
- **Owner:** BOARDS-MODEL (moveIssue maths) + BOARDS-UI-A (drop handling) · **Fix commit:** — · **Test:** —

### B-06 · Medium · a11y · 🔴 Open · links **R2-039**
**Keyboard users cannot open a board card: the focusable role=button card ignores Enter and Space (the 'open' part of R2-039)**
- **Where:** `src/components/board/BoardCard.jsx` : 59-66 (src/pages/Board.jsx:85-88)
- **Repro:** 1) Open /#/boards/demo_board_1. 2) Press Tab until the 'Draft landing copy' card is focused. 3) Press Enter, then Space. Nothing opens.
- **Expected:** Enter (and Space when not dragging) opens the card sheet. **Actual:** Nothing happens. A screen reader announces a 'draggable' button with instructions that do not work.
- **Fix hint:** Add onKeyDown to SortableCard so Enter opens the sheet (and Space too, if no KeyboardSensor is added), or render the title as a real <button> inside the card.
- **Verified (WF-1):** Code read: BoardCard.jsx:62-63 spreads dnd-kit attributes. core.esm.js:3406-3439 gives role 'button', tabIndex 0, aria-roledescription 'draggable' and aria-describedby, which points at the default 'To pick up a draggable item, press the space bar…' text (core.esm.js:41). The listeners come only from MouseSensor and TouchSensor (Board.jsx:85-88). The only open path is onClick on a <div> (L64), which Enter and Space do not fire.
- **Fail-first test:** Playwright spec tests/playwright/boards-keyboard.spec.mjs: goto /#/boards/demo_board_1, focus the 'Draft landing copy' card, press Enter, and expect the card sheet (a dialog titled with the card) to be visible. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-07 · Medium · a11y · 🔴 Open · links **R2-039**
**Cards and lists can be moved only by a pointer drag: there is no KeyboardSensor and no Move/Status control, and the announced space-bar instructions do nothing (the 'move' part of R2-039)**
- **Where:** `src/pages/Board.jsx` : 85-88, 204 (src/components/board/BoardColumn.jsx:41-49; src/components/board/CardDetailSheet.jsx:32)
- **Repro:** 1) Using only the keyboard, open the demo board. 2) Focus 'Draft landing copy' and press Space, then the arrow keys: nothing moves. 3) Open the card with the mouse: the sheet says 'in To do' as plain text and offers no way to change it. 4) Tab to a list's 'Drag to reorder list' grip and press Space, then the arrows: nothing happens.
- **Expected:** Cards and lists can be moved without a pointer: keyboard dragging with announcements that use titles, a Status/List select in the card sheet, and Move left/right for lists. **Actual:** Only a mouse drag or a touch press-and-hold drag can change a card's list or a list's position.
- **Fix hint:** Add useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) and DndContext accessibility.announcements that use card and list titles. Add a Status select in CardDetailSheet that calls store.moveCard(board.id, {cardId, toListId, toIndex: null}), and a column menu with Move left and Move right.
- **Verified (WF-1):** Code read: useSensors (Board.jsx:85-88) registers only MouseSensor and TouchSensor. The grip <button> (BoardColumn.jsx:41-49) gets attributes and listeners but no onClick or onKeyDown. CardDetailSheet.jsx:32 prints 'in {listTitle}' as text. grep shows no caller of store.moveCard or store.moveList other than onDragEnd. dnd-kit's default screen-reader text (core.esm.js:41) promises space-bar pickup.
- **Fail-first test:** Playwright: focus 'Draft landing copy', press Space, ArrowRight, Space, and expect the card under 'In progress'. Also open the sheet, pick 'In progress' in the Status select, and expect the card to move. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-08 · Medium · a11y · 🔴 Open
**Board tiles on /boards are click-only divs, so no keyboard user can open a board, and tiles are not links (no middle-click or open in new tab)**
- **Where:** `src/pages/Boards.jsx` : 70-74
- **Repro:** 1) Open /#/boards. 2) Press Tab repeatedly: focus goes Back → New board → each tile's (invisible) Delete button. No tile ever takes focus, so no key opens a board. 3) Middle-click a tile: nothing opens in a new tab.
- **Expected:** Each tile is a focusable link with a visible focus ring, and Enter opens the board. **Actual:** Only a mouse or touch click can open a board.
- **Fix hint:** Render each tile as <Link to={`/boards/${encodeURIComponent(b.id)}`}> with a focus-visible ring. Put the Delete button outside the link (for example absolutely positioned as a sibling).
- **Verified (WF-1):** Code read: the tile is <div key onClick={() => navigate(...)}> with no role, tabIndex, href or key handler. Its only focusable descendant is the Delete button (L78-85). The header supplies Back (L26) and New board (L34). R2-039 covers the cards on /boards/:id, not this grid.
- **Fail-first test:** SSR render of Boards through tests/pdf/harness.mjs loadModule and renderToString inside MemoryRouter: assert each board renders as <a href="/boards/demo_board_1"> (or a button). Fails today.
- **Owner:** BOARDS-UI-B · **Fix commit:** — · **Test:** —

### B-09 · Medium · a11y · 🔴 Open
**The card sheet is not a modal dialog: it has no role, aria-modal or label, Escape does nothing, and focus is not moved in, trapped or returned**
- **Where:** `src/components/board/CardDetailSheet.jsx` : 20-37
- **Repro:** 1) Click a card to open its sheet. 2) Press Escape: the sheet stays open. 3) Press Tab or Shift+Tab repeatedly: focus reaches the board controls behind the backdrop. 4) Click X, then press Tab: focus restarts at the top of the page instead of at the card.
- **Expected:** role=dialog with aria-modal, labelled by the card title. Escape closes it. On open, focus moves into the sheet and Tab stays inside it. On close, focus returns to the card that opened it. **Actual:** None of these happen.
- **Fix hint:** Use a native <dialog> with showModal(), or a shared useDialog hook that remembers document.activeElement, focuses the title, traps Tab, closes on Escape and restores focus on unmount. Give the title field an id for aria-labelledby. This is app-wide: no modal in src uses dialog semantics.
- **Verified (WF-1):** Code read: the overlay and panel are plain divs with onClick only. grep for 'Escape' finds handlers only in AddCard, BoardColumn, AddListColumn and the board-title input, none for the sheet. There is no focus management on mount or unmount. grep for role="dialog" and aria-modal across src finds none.
- **Fail-first test:** SSR: renderToString(CardDetailSheet) must contain role="dialog", aria-modal="true" and aria-labelledby. Playwright: open a card, press Escape, and expect the sheet gone and document.activeElement to be the card. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-10 · Medium · a11y · 🔴 Open
**List titles and checklist items can be renamed only by a mouse double-click on a span that cannot be focused**
- **Where:** `src/components/board/BoardColumn.jsx` : 64-70 (src/components/job/TodoItem.jsx:43-48)
- **Repro:** 1) Using only the keyboard, Tab through a column header: focus goes grip → Delete list, and the title is skipped. 2) In a card's checklist, Tab reaches the toggle and delete buttons but never the text. 3) Neither can be renamed without a mouse.
- **Expected:** The title is a button (or an input styled as text) that enters edit mode on click or Enter, or there is an explicit Rename action. **Actual:** Renaming needs a mouse double-click. The only hint is a title tooltip, which touch screens never show.
- **Fix hint:** Render the list title as a <button> that swaps to the input on click or Enter, as Board.jsx:167-173 does for the board title, or add Rename to a column '…' menu. Do the same in TodoItem.
- **Verified (WF-1):** Code read: BoardColumn.jsx:64-70 is <span onDoubleClick title="Double-click to rename"> with no tabIndex, role or key handler. TodoItem.jsx:43-48 is the same without even the title. No other rename path exists.
- **Fail-first test:** SSR render of BoardColumn: assert the list title is a <button> or that a 'Rename list' button exists. Playwright: Tab to the list title, press Enter, type, press Enter, and expect the title to change. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-11 · Medium · a11y · 🔴 Open
**The card checklist's toggle, delete and add buttons have no accessible name, and the toggle exposes no checked state**
- **Where:** `src/components/job/TodoItem.jsx` : 22-27, 51-56 (src/components/job/TasksTab.jsx:46-52)
- **Repro:** 1) Open 'Draft landing copy' (it has a 3-item checklist). 2) With NVDA or VoiceOver, Tab into the checklist. 3) Each toggle is read as 'button', with no name and no checked state, each delete as 'button', and add as 'button, dimmed'.
- **Expected:** 'Write hero, checkbox, not checked', 'Delete Write hero' and 'Add item'. **Actual:** The buttons have no names and no state.
- **Fix hint:** Use <input type=checkbox> labelled by the item text, or role=checkbox with aria-checked. Add aria-label={`Delete ${todo.text}`} to delete and aria-label="Add item" to add. The Job Tracker's Tasks tab shares these components, so one fix covers both.
- **Verified (WF-1):** Code read: lucide-react 1.28 Icon.mjs:36 adds aria-hidden="true" to an icon with no a11y prop. The toggle (TodoItem.jsx:22-27), the delete button (L51-56) and TasksTab's add button (L46-52) contain only an icon and have no aria-label, title or text. The toggle has no aria-pressed or role=checkbox.
- **Fail-first test:** SSR render of TodoItem and TasksTab: assert every <button> has a non-empty aria-label, and the toggle is role="checkbox" with aria-checked (or is an <input type=checkbox>). Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-12 · Medium · a11y · 🔴 Open
**The description editor's toolbar runs its commands only on mousedown, so Bullet list, Numbered list, Insert link, the alignment buttons and STAR Optimizer do nothing from the keyboard**
- **Where:** `src/components/RichTextEditor.jsx` : 244-255 (Btn), 158-169 (STAR button)
- **Repro:** 1) Open a card. 2) Tab to the description toolbar's 'Bullet list' button. 3) Press Enter or Space: nothing happens.
- **Expected:** The button runs its command. **Actual:** Nothing happens. Only Bold, Italic and Underline have native Ctrl shortcuts.
- **Fix hint:** Keep preventDefault on mousedown so the selection is preserved, but run the command in onClick. Save the editor's selection Range on blur and restore it before execCommand for keyboard activation.
- **Verified (WF-1):** Code read: Btn (L244-255) has only onMouseDown={e => { e.preventDefault(); onExec(); }}, and the STAR button (L161-164) is the same. Enter and Space on a <button> dispatch click, not mousedown. The editor is used for the card description (CardDetailSheet.jsx:64-70) and for every résumé rich-text field.
- **Fail-first test:** Playwright: open a card, Tab to 'Bullet list', press Enter, and expect a <ul> in the description. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

### B-13 · Medium · mobile · 🔴 Open
**Column scroll-snap never works on phones: snap-x snap-mandatory is on the inner flex row, not on the overflow-x-auto scroller**
- **Where:** `src/pages/Board.jsx` : 205-206
- **Repro:** 1) Open a board at 375px width (a phone, or DevTools device mode). 2) Swipe horizontally and let go between two columns. 3) The board stops wherever the fling ends, showing half of each of two columns.
- **Expected:** Each swipe settles with one column centred and the next one peeking, as the BoardColumn docblock describes. **Actual:** There is no snapping at all.
- **Fix hint:** Move `snap-x snap-mandatory md:snap-none` onto the overflow-x-auto div (L205) and add scroll-px-3 so the padding is respected.
- **Verified (WF-1):** Code read: L205 is the scroll container (overflow-x-auto). L206 carries snap-x snap-mandatory but has no overflow of its own, so it is not a scroll container and scroll-snap-type has no effect there. The columns' snap-center (BoardColumn.jsx:38; Board.jsx:33, 41) snaps against the nearest scroll container, L205, whose scroll-snap-type is none.
- **Fail-first test:** Static unit test in the style of tests/unit/touch-reveal.unit.mjs: find the className in Board.jsx that contains overflow-x-auto and assert it also contains snap-x and snap-mandatory. Fails today.
- **Owner:** BOARDS-UI-A · **Fix commit:** — · **Test:** —

