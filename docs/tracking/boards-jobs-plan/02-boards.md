# 02 · Boards v2 — the Jira core

"Manage day-to-day project and life tasks just like Jira." Single user (no assignee), local-first
(localStorage), Google sync stays out of scope (boards-plan.md phase 3) but the model keeps per-board
`updatedAt` for it.

## Data model (v2) — `src/utils/boardModel.js` (pure)

```
Board {
  id, key: 'LIFE',            // 2–10 chars, A–Z then A–Z0–9, unique across boards (case-insensitive)
  title, description, color, starred: bool,
  mode: 'kanban' | 'scrum',
  columns: [{ id, title, category: 'todo'|'inprogress'|'done', wipLimit: number|null }],   // ≥ 1, ≥ 1 'done' recommended
  labels:  [{ id, name, color }],
  sprints: [{ id, name, goal, startDate, endDate, state: 'future'|'active'|'closed', completedAt }],
  issues:  Issue[],           // ARRAY ORDER IS THE GLOBAL RANK (board columns and backlog both sort by it)
  nextNumber: int,            // monotonic; numbers are never reused
  hideDoneAfterDays: 14,      // kanban board hides done issues resolved longer ago (still in List view)
  createdAt, updatedAt, dataVersion: 2
}
Issue {
  id, number,                 // key = `${board.key}-${number}` (computed; a key rename re-keys every issue)
  type: 'task'|'bug'|'story'|'epic', title, description (sanitized rich-text HTML),
  columnId, priority: 'highest'|'high'|'medium'|'low'|'lowest',
  labelIds: [], due: 'YYYY-MM-DD'|'', startDate: ''|'YYYY-MM-DD', estimate: number|null (story points),
  epicId: issueId|null (an issue of type 'epic' on the same board), sprintId: id|null,
  checklist: [{ id, text, done }],             // "subtasks"
  comments: [{ id, text, createdAt, editedAt }],
  activity: [{ id, at, kind: 'created'|'field'|'comment', field, from, to }],  // capped at the newest 200
  recurrence: 'none'|'daily'|'weekdays'|'weekly'|'monthly',
  createdAt, updatedAt, resolvedAt: number|null
}
```

Rules the store enforces (and unit tests prove):
- Moving an issue into a `done`-category column sets `resolvedAt` (now); out of one clears it. Activity records
  status changes as `field: 'status'` with column titles.
- A **recurring** issue moved to done spawns the next occurrence in the board's first `todo` column: same
  title/type/priority/labels/epic/estimate/checklist (unticked), new number, `due` advanced from the old due (or
  today) by the rule (weekdays skips Sat/Sun; monthly clamps to month end). Only once per resolution.
- Deleting a column requires a target column; its issues move there (never silently lost).
- Deleting an epic unlinks its children (`epicId = null`). Deleting a label removes it from issues.
- Deleting a sprint moves its issues to the backlog. Completing the active sprint: done issues keep the closed
  sprint id; open issues go to the backlog or to a chosen future sprint. Only one `active` sprint at a time.
- `key` edits validate (pattern + unique); issue numbers never change.
- Every mutation stamps `board.updatedAt`; issue mutations stamp `issue.updatedAt`.

## Storage and migration

- Key **`cpwtcv_boards_v2`** (`{ boards, dataVersion: 2 }`) through the same `storageBackup` helpers
  (`loadSavedList`, `readSavedList`, `setItemWithRoom`, `pendingRecovery`/`rememberRecovery`) and the same
  cross-tab `keepUnsaved` logic as today.
- If v2 is absent and **`cpwtcv_boards_v1`** exists: migrate it, loss-free, and **leave v1 in place**.
  `lists` → `columns` (a list titled like done/complete/finished → `done`; the first list → `todo`; the rest →
  `inprogress`), `cards` → issues in list order (`type: 'task'`, `priority: 'medium'`, numbers 1…n,
  `nextNumber` = n+1), card `labels [{color,name}]` → board labels deduplicated by colour+name → `labelIds`,
  `checklist`, `description`, `due`, timestamps kept. Keys derived from titles, made unique.
- Nothing saved at all → the demo project (ids `demo_*`), "Personal & Projects" (`LIFE`): Inbox / This week /
  Today / Done, a few issues showing each type, priority, labels, an epic with children, a recurring chore,
  a checklist, a comment — **due dates relative to today** (computed at load, not hard-coded past dates).
- The normaliser (`normalizeBoard.js`, rewritten for v2) keeps the never-destroy contract: unreadable entries
  are left out and reported (`lost`) so the raw value is backed up first; ids de-duplicated **board-wide**
  (issues, columns, labels, sprints, checklist items, comments); dangling `columnId` → first column,
  dangling `labelIds`/`epicId`/`sprintId` dropped; bad enums → defaults; `nextNumber` ≥ max number + 1.

## Pure helpers (unit-tested, no React)

- `boardModel.js`: `createBoard({title,key,template})`, templates (**Kanban**: To Do/In Progress/Done ·
  **Scrum**: To Do/In Progress/In Review/Done, mode scrum · **Personal**: Inbox/This week/Today/Done + labels
  Home/Health/Finance/Errands/Learning · **Blank**: To Do/Done), `deriveKey(title, takenKeys)`,
  `isValidKey`, `issueKey(board, issue)`, `findIssueByKey(boards, 'LIFE-12')`, `migrateV1(board)`, `nextDue()`.
- `boardOps.js`: every mutation as a pure `(board, args) → board` (the store wraps these), including
  `moveIssue(board, issueId, { columnId, sprintId, beforeId })` (splice in the global array: before `beforeId`,
  or after the last issue of the target group when `beforeId` is null).
- `boardQuery.js`: `filterIssues(board, filters)` (text over key/title/plain description; types; priorities;
  labelIds; epicIds; due = overdue|today|week|none; `onlyOpen`), `groupIntoColumns`, `swimlanes(by: none|epic|
  priority|type)`, `sortIssues(by)`, `columnCounts` + WIP state, `sprintStats` (issues, points, done points),
  `yourWork(boards, now)` → `{ overdue, today, week, inProgress, recent }` across boards.

## Store — `src/hooks/useBoardStore.js`

Module singleton + `useSyncExternalStore` exactly like today. Exposes: `boards`, persist/recovery state, and
`addBoard, updateBoard, deleteBoard, restoreBoard, toggleStar, addColumn, updateColumn, deleteColumn,
moveColumn, addLabel, updateLabel, deleteLabel, addIssue, updateIssue, moveIssue, deleteIssue (returns the
removed issue + index for Undo), restoreIssue, duplicateIssue, addComment, updateComment, deleteComment,
addSprint, updateSprint, startSprint, completeSprint, deleteSprint`. `_resetBoardStoreForTest` stays.

## Views

**Board view** (`/boards/:id`): `PageHeader` (breadcrumb Projects › name, title InlineEdit, tabs Board | Backlog
(or List) | Settings, actions: Create, ⋯ menu). **Filter bar**: SearchInput (`/`), quick filters as toggle chips
(Overdue, Due this week, High priority), popovers for Type, Priority, Label, Epic; "Group by" (none/epic/priority/
type); "Clear". Scrum mode shows the active sprint name, dates, days left and "Complete sprint"; with no active
sprint an EmptyState linking to the Backlog.
**Columns**: header = title, count, WIP `3/5` (red when over), ⋯ (rename, set WIP limit, set category, move
left/right, delete…); cards sortable within and across columns (dnd-kit `MouseSensor` distance 6,
`TouchSensor` delay 180/tolerance 8, **`KeyboardSensor` + `sortableKeyboardCoordinates`**, live `onDragOver`
preview, `closestCorners`, announcements text); inline "+ Create issue" at the bottom (Enter adds, stays open,
type picker). Horizontal scroll with snap on phones; column tab strip on phones.
**Issue card**: title (2-line clamp), labels as named pills (max 3 + "+N"), epic chip, footer: type icon, key,
priority icon, DatePill, estimate bubble, checklist `2/5`, comment count. `tabIndex=0`, Enter/Space opens,
`⋯` menu (Open, Move to ▸ columns, Priority ▸, Copy link, Duplicate, Delete). Done-category cards: key struck.
**Issue modal** (`?issue=KEY-N`, `Dialog size="xl"`, full-screen sheet on phones): header breadcrumb (KEY ›
epic › KEY-N), actions (copy link, duplicate, ⋯ delete with ConfirmDialog → toast with Undo, close). Left: title
InlineEdit (single line, Enter commits), Description (RichTextEditor; view mode renders sanitized HTML, click
to edit), Checklist (progress bar, add/rename/reorder/delete/toggle), Epic children list when type = epic,
Activity tabs **Comments | History**. Right "Details": Status (Select of columns), Type, Priority, Labels
(MultiSelectPopover with create), Due, Start, Estimate, Epic, Sprint (scrum), Recurrence; Created/Updated/
Resolved (relative + absolute tooltip).
**Create issue dialog** (`c`): project, type, summary (required), description, status, priority, labels, due,
estimate, epic, sprint; "Create another" checkbox; Enter in summary submits.
**Backlog** (scrum): sections Active sprint, each future sprint, Backlog — rows (type, key, title, labels, epic,
DatePill, priority, estimate, status pill), drag between sections and to reorder, inline create per section,
section header stats (issues, points, done points), Create sprint, Start sprint dialog (name, start/end
default 2 weeks, goal), Complete sprint dialog (open issues → backlog | next sprint), rename/delete sprint.
**List** (kanban): the same rows, flat, sortable headers (Key, Type, Summary, Status, Priority, Due, Estimate,
Updated), grouped-by-status toggle, filters shared with the board.
**Projects** (`/boards`): table/grid of projects (star, colour, name, KEY, mode, open/total issues, updated
relative), search, "Create project" dialog (name → auto KEY editable + validated, template cards, colour),
row ⋯ (open, settings, delete with ConfirmDialog naming the project). EmptyState when none.
**Your work** (`/work`): sections Overdue / Due today / Due this week / In progress / Recently updated, rows
with project chip; opens the issue modal in place.
**Settings** (`/boards/:id/settings`): details (name, KEY, description, colour, mode), columns editor (add,
rename, reorder, category, WIP, delete-with-target), labels editor (name, colour, delete), "Hide done after N
days", danger zone (delete project).
**Shortcuts**: `c` create · `/` search · `?` shortcut help dialog · `Esc` close. Ignored while typing.

## Tests (all node, fail-first where a bug is fixed)

`tests/unit/normalize-board.unit.mjs` (v2 reader, repairs, board-wide id dedupe, dangling refs, loss flags),
`tests/unit/board-migrate.unit.mjs` (v1 → v2 loss-free incl. labels/checklists/order, v1 kept),
`tests/unit/board-ops.unit.mjs` (every op incl. moveIssue maths, resolvedAt, recurrence, sprint lifecycle,
column delete-with-target, numbers never reused), `tests/unit/board-query.unit.mjs` (filters, swimlanes, WIP,
yourWork with a fixed `now`), `tests/unit/board-store.unit.mjs` (persist, v1 migration through the store,
cross-tab keepUnsaved, quota error surfaced). Cypress: `cypress/e2e/2x-boards.cy.js` written, not run.
