# Parity table: Projects (key "projects")

Area: Projects (Board, Backlog, Kanban-style project views, Your work, create project / task, settings, issue view).
Source: `src/pages/{Boards,YourWork,Board,Backlog,BoardSettings,ProjectList,ProjectCalendar,ProjectTimeline,ProjectSummary}.jsx`,
`src/components/board/*`, `src/components/shell/{TopBar,SidebarContent,WorkspaceLayout,WorkspaceRoute,projects,projectViews}.*`,
`src/hooks/{useBoardStore,boardStoreState}.js`, `src/utils/board*.js`, `src/constants/boards.js`.
Canvas boards read: Projects, ProjectBoard, ProjectList, ProjectIssue, ProjectSettings, ProjectCalendar, ProjectTimeline,
ProjectSummary, ProjectBacklog, MobileProject (plus States and ShellMenus for the shared states and the search palette).
Out of this area: `src/components/job/KanbanView.jsx` is the Job Tracker's board (Applications area), not a project view.

How a row is judged (the canvas is static, so it cannot show gestures, popovers or toasts):
- SAME: same place, same look. Also used for invisible behaviour and gestures the canvas cannot contradict (the build must keep them).
- RESTYLED: same function, new look. A menu or popover whose trigger is drawn but whose content is not drawn is RESTYLED, and the Fix cell names what it must hold.
- MOVED: same function, another place (menu, drawer, disclosure, page), still reachable.
- CHANGED: the canvas alters what the function does or shows, or hides it.
- MISSING: no trigger or surface for it is drawn at all.
Word changes the canvas makes (Issue to Task, Epic to Group, Backlog to Plan, Status category to Kind) are listed once in section 2 (D-01), not on every row.

## 1. PARITY TABLE

### A. Projects landing and the project list (Boards.jsx, YourWork.jsx)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-001 | Projects page header with primary Create project | Boards.jsx:46 `PageHeader` "Projects", button "Create project" opens the dialog via `?create=1` | Projects: h1 "Projects", primary link "New project" (goes straight to ProjectBoard) | RESTYLED | Keep the label "Create project" or accept "New project"; it must open the create dialog (PROJ-002), not a board |
| PROJ-002 | Create project dialog | CreateProjectDialog.jsx:9-115: Name (required, max 80, error "A project needs a name."), Key (derived from the name until edited, `keyInput`, live `keyError`, 2-10 chars letter first), Template radio of 4 (Kanban, Scrum, Personal, Blank, each with description, mode tag and its column names), Colour (8 swatches, default cycles by project count), Description, Cancel / Create project; one project per opening (`made` ref); Escape or overlay click with typed text asks "Discard this project?" | Not drawn (New project is a link to ProjectBoard) | MISSING | Draw the dialog (same fields, all 4 templates, key rules, discard confirm) or restyle the live dialog; the function cannot be dropped |
| PROJ-003 | `?create=1` deep link opens the dialog | Boards.jsx:29,119; used by TopBar.jsx:213 (Projects menu "Create project"), SidebarContent `newProjectTo`, YourWork.jsx:93, CreateIssueDialog.jsx:194 | Not drawn | MISSING | Build keeps the route param; every "Create project" entry (top bar menu, empty states, "Create a project first") must still land on the dialog |
| PROJ-004 | Search projects by name or key | Boards.jsx:30-34,58 `SearchInput` "Search projects" | Projects: "All projects" section, input "Search projects" | RESTYLED | none |
| PROJ-005 | Row order: starred first, then most recently updated | Boards.jsx:34 | Projects: All projects table (one row drawn) | SAME | Order not decidable from one row; keep live order |
| PROJ-006 | Star / unstar a project from its row | Boards.jsx:80 `IconButton` "Star X" / "Unstar X", pressed state | Projects: star button "Starred project" in the row | RESTYLED | none |
| PROJ-007 | Name cell: avatar + name opens the project board | Boards.jsx:86-89 | Projects: tile + name link to ProjectBoard | RESTYLED | none |
| PROJ-008 | Key column | Boards.jsx:91 | Projects: Key column | SAME | none |
| PROJ-009 | Type column (Kanban or Scrum) | Boards.jsx:92 | Projects: Type column | SAME | none |
| PROJ-010 | Lead column ("You" with avatar) | Boards.jsx:93 | Not drawn (columns are Name, Key, Type, Tasks, Updated) | MISSING | Add the Lead column back, or put "Lead: You" on the row on hover / in the card; the data is shown today |
| PROJ-011 | Issues column "N open · M total" | Boards.jsx:94, `issueCounts` boardQuery.js:303-307 | Projects: Tasks column "8 open, 10 in total" | RESTYLED | none |
| PROJ-012 | Updated column (relative time) | Boards.jsx:95 `relativeTime` | Projects: Updated "1 hour ago" | SAME | none |
| PROJ-013 | Row menu: Open board, Summary, Project settings, Delete project | Boards.jsx:97-106 `Menu` | Projects: row button "Project menu" (menu not drawn) | RESTYLED | Menu must keep Open board, Summary, Project settings, Delete project |
| PROJ-014 | Delete project from the row: confirm (names the issue count) then toast with Undo | Boards.jsx:37-42 `confirm` "Delete X?", `store.deleteBoard`, toast Undo `restoreBoard` | States: confirm dialog and Undo toast drawn generically ("Task deleted") | RESTYLED | Keep the project wording (issue count in the body, "You can undo this for a few seconds") |
| PROJ-015 | Empty state: no projects | Boards.jsx:50-55 "Plan your work and your life in projects" + Create project | States: "No projects yet" + "New project" | RESTYLED | New wording, see D-01; keep the Create project action |
| PROJ-016 | "No projects match “q”" line | Boards.jsx:114 | Not drawn | MISSING | Draw the no-match line under the table |
| PROJ-017 | Phone: Key, Type, Lead, Updated columns hidden below sm so each row's menu stays in view | Boards.jsx:17,66-70,91-95 `PHONE_HIDDEN` | No phone Projects landing drawn (MobileProject is a project board) | MISSING | Draw the phone landing (cards or reduced table) with the row menu in view |
| PROJ-018 | "Not saved" banner when storage refuses a write, on every project page | BoardStorageNotice.jsx:17-22 `notSavedMessage('boards', ...)`, role=alert | States: inline "Browser storage is full" banner (new text, "Open Documents" link) | RESTYLED | Banner must show on every Projects page and say the project list is not saved (text for boards, not documents) |
| PROJ-019 | Recovery notice when the saved board list could not be read in full, with Dismiss | BoardStorageNotice.jsx:24-28 `RecoveryNotice` "board list", `dismissRecovery` boardStoreState.js:127 | Not drawn | MISSING | Draw the recovery notice (what, backup key, Dismiss) |
| PROJ-020 | "Sync held" notice (which projects the cloud sync holds back) | BoardStorageNotice.jsx:29 `SyncHeldNotice name="boards"` | Not drawn (States shows only chips Saved / Saving / Offline / Sync paused) | MISSING | Draw the held-back notice |

### B. Your work (YourWork.jsx, route /work)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-021 | Your work header with subtitle "N issues need attention across M projects" | YourWork.jsx:89 (N = overdue + today + week + in progress) | Projects: subtitle "4 tasks need you this week, across 1 project" | RESTYLED | Wording differs (D-07); keep the live count rule |
| PROJ-022 | Recent projects: up to 4 cards (starred first, then updated), colour band, avatar, name link, "Kanban / Scrum project", quick links Open issues N, Backlog, Summary | YourWork.jsx:64,96-125 | Projects: "Recent projects" card (one drawn): name, "Edited 1 hour ago", Open / Done / Due soon counts, chips Board / List / Summary | CHANGED | Backlog quick link and the Kanban/Scrum label are gone; keep Backlog (or Plan) reachable from the card, keep "Open issues N" |
| PROJ-023 | "View all projects" link | YourWork.jsx:99 | Projects: "All projects" section on the same page | MOVED | none |
| PROJ-024 | Tabs To do (with count) and Worked on | YourWork.jsx:127 `Tabs` | Projects: pills "To do 4" and "Worked on" (the second is a link to the ProjectList board) | RESTYLED | Worked on must switch the list in place (PROJ-029) |
| PROJ-025 | To do sections: Overdue, Due today, Due this week, In progress (empty ones hidden) | YourWork.jsx:17-22,130-135; `yourWork` boardQuery.js:278 | Projects: "Due today" and "This week" only | CHANGED | Overdue and In progress buckets not drawn; keep both (a section shows only when it holds rows) |
| PROJ-026 | Row content: type icon, title (struck when done), "KEY · project", priority, due pill, status lozenge, updated time on Worked on | YourWork.jsx:25-47 | Projects: circle, title, "LIFE-4 in Personal & Projects", due chip, priority | CHANGED | Type icon, status lozenge and the Worked-on "updated" time are not drawn; restore the status and updated time (the type icon may go to the tooltip only if the owner agrees) |
| PROJ-027 | ✓ Mark done: moves the issue to the project's first done column, toast "KEY marked done" with Undo (puts it back at its rank, removes a spawned recurrence) | YourWork.jsx:42-44,70-84; not offered for a project with no done column | Projects: row circle "Not done" is a static `span role="img"`, not a button (corrected by review: it was RESTYLED) | CHANGED | If the circle is meant as the mark-done control it must be a real control; keep the Undo toast and the recurrence cleanup; hide it when the project has no done column |
| PROJ-028 | A row opens the issue in place over Your work (`?issue=KEY`) | YourWork.jsx:31,85; `useIssueRoute` (useIssueActions.jsx:27-80) | Projects: row links to ProjectIssue (drawer over the project's board) | MOVED | none; the drawer opens at the project board |
| PROJ-029 | Worked on tab: the 15 most recently updated issues, open or done, with updated time | YourWork.jsx:137-143; boardQuery.js:278-300 | Not drawn (the pill is a link to ProjectList) | MISSING | Draw the Worked on list |
| PROJ-030 | Empty states of Your work: no projects ("Nothing here yet" + Create a project), no work ("Nothing overdue, due this week or in progress. Well done."), no issues ("No issues yet.") | YourWork.jsx:92-93,129,139 | Not drawn (States draws only "No projects yet") | MISSING | Draw the two list-empty lines |
| PROJ-031 | Epics are left out of Your work | YourWork.jsx:61 | n/a | SAME | none |
| PROJ-032 | Separate "Your work" page and sidebar item | AppRoutes.jsx:116; SidebarContent.jsx:8 | Merged into the Projects landing | MOVED | none; keep `/work` working (redirect) |

### C. Project header and navigation (ProjectTabs.jsx, projectViews.js, shell)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-040 | Breadcrumb Projects / project | ProjectTabs.jsx:40 | All project boards: breadcrumb | SAME | none |
| PROJ-041 | Project avatar (first letter on its colour) | ProjectTabs.jsx:18-29 | Colour tile "L" | RESTYLED | none |
| PROJ-042 | Rename the project by clicking its title | ProjectTabs.jsx:41-43 `onTitleChange` to `updateBoard` | Title is a static h1; the Name field in ProjectSettings does the same | MOVED | none |
| PROJ-043 | Star / unstar in the header (pressed state) | ProjectTabs.jsx:47-53 | Header star button | RESTYLED | none |
| PROJ-044 | Six view tabs: Summary, Timeline, Backlog, Board, Calendar, List | projectViews.js:6-13; ProjectTabs.jsx:8-14 | Board, List, Calendar, Timeline, Summary on every board; a "Plan" tab only on ProjectBacklog (Scrum) | CHANGED | A Kanban project loses its Backlog page (single backlog, create issues, "Use sprints"); keep a Backlog tab for Kanban too |
| PROJ-045 | Project settings entry (Board actions menu, sidebar tree, Projects row menu) | Board.jsx:262; SidebarContent.jsx:53-68 | Header "Project menu" button (menu not drawn); no Settings tab | MOVED | The "Project menu" must list Project settings |
| PROJ-046 | Board actions menu: Create issue | Board.jsx:258-265 | Header primary "New task" on every view | MOVED | none (see PROJ-116 for the dialog) |
| PROJ-047 | "Complete sprint" button on the board header while a sprint is active (links to `/backlog?complete=1`) | Board.jsx:257 | ProjectBoard: none; ProjectBacklog sprint block has "Complete sprint" | MOVED | Scrum board header should keep the shortcut, or the Plan tab must be one click away |
| PROJ-048 | Project not found state "This project doesn’t exist" + View all projects (every view) | Board.jsx:107-116; same on Backlog, List, Calendar, Timeline, Summary, Settings | Not drawn | MISSING | Draw it once (shared) |
| PROJ-049 | Sidebar: projects (starred first, then recent, up to 8, current one open as a tree of views) and "+ Create project", "View all projects (N)" | SidebarContent.jsx:79-160; projects.js:29-34 | Not drawn (top bar only) | MISSING | Project switcher is a live function; draw a sidebar or a project switcher (see PROJ-050) |
| PROJ-050 | Top bar Projects menu: starred / recent 6, View all projects, Create project | TopBar.jsx:207-241 | Top nav "Projects" is a plain link | MISSING | Add a project switcher (menu or sidebar) holding starred and recent projects, View all, Create |

### D. Board (Board.jsx, BoardToolbar.jsx, BoardColumn.jsx, IssueCard.jsx)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-060 | Column header: caps title, issue count, "n/limit" (red once over), "Max N" chip | BoardColumn.jsx:30-41; counts boardView.js:99-110 | ProjectBoard: column h2 + count, "2/3 Limit 3" chip on Today | RESTYLED | Keep the red over-limit state (not drawn) |
| PROJ-061 | Column ⋯ menu: Rename, Set / Change limit, Status category (To do, In progress, Done), Move left / right, Delete column | BoardColumn.jsx:58-78 | No ⋯ on a board column; ProjectSettings Columns has name, Kind, Limit, up / down, delete | MOVED | none (all five actions exist in settings) |
| PROJ-062 | Rename and Set-limit dialogs (blank name blocks Save; limit blank or 0 clears, fraction rounds down) | BoardColumn.jsx:81-124 | ProjectSettings column name and limit fields (save on leaving the field) | MOVED | none |
| PROJ-063 | Add column: "+" at the end, name typed at once (Enter adds, Escape cancels, blur adds) | Board.jsx:28-52,317 | ProjectBoard: "Add column" button | RESTYLED | none |
| PROJ-064 | Card face: title (3 lines), epic lozenge, up to 2 label pills and "+N", type icon, key (struck when done), due pill, checklist n/m, comment count, story points, priority | IssueCard.jsx:18-59 | ProjectBoard card: title, epic name, label chip, key, checklist, comment count, due chip, priority | CHANGED | Story points and "+N more labels" are not drawn; the type icon is confirmed absent (review read the card markup: nothing sits before the key); restore points and the type icon on the card (see PROJ-229) |
| PROJ-065 | Click, Enter or Space on a card opens the issue view | IssueCard.jsx:106-130 `openOnKey` | Card is a link to ProjectIssue | RESTYLED | none |
| PROJ-066 | Card ⋯ menu: Open, Move to (columns), Priority, Copy link, Duplicate, Delete (the way to move a card without dragging) | IssueCard.jsx:74-99; Board.jsx:206-232 | No ⋯ on a card | MISSING | Put the card menu back (hover, and always visible on touch); it is the non-drag way to move a card |
| PROJ-067 | Drag a card between and within columns (mouse 6px, touch after 200ms, drag overlay, gap preview, drop outside any column is called off, Space then arrows then Space by keyboard) | Board.jsx:24-25,98-148,282-352; boardDnd.js; boardView.js:131-167 | Not shown (static) | SAME | Build keeps the sensors (tests/pdf/172) and the collision rule |
| PROJ-068 | "+ Create issue" at the foot of each column: composer with type picker (Task, Bug, Story), Enter creates and stays open, Escape closes, IME-safe, blank ignored | InlineCreate.jsx:13-75; Board.jsx:236-241,313 | ProjectBoard: "Add task" link at each column foot (no composer drawn) | CHANGED | Draw the composer with its type picker; the type cannot be chosen elsewhere before creating |
| PROJ-069 | New issue hidden by the filters: toast "KEY created, hidden by your filters" with Open | Board.jsx:236-241 | Not shown | SAME | Build keeps it (also Backlog.jsx:84-89, ProjectList.jsx:74-79) |
| PROJ-070 | Search this project (key, title, description) | BoardToolbar.jsx:64-71; boardQuery.js:76-97 | ProjectBoard: "Search this project" | SAME | none |
| PROJ-071 | Filters: Epic (only when epics exist), Type, Label (only when labels exist), Priority; each multi-select with a count badge | BoardToolbar.jsx:76-107 | ProjectBoard: one "Filter" button (popover not drawn, no count drawn) | MOVED | Popover must hold Epic, Type, Label, Priority (multi-select, "Issues without an epic") and a count on the button |
| PROJ-072 | Quick filter Overdue | BoardToolbar.jsx:12-14,109-122 | Not drawn | MISSING | Add Overdue beside "Due this week" (or inside Filter) |
| PROJ-073 | Quick filter Due this week | BoardToolbar.jsx:14 | ProjectBoard: chip "Due this week" (aria-pressed) | RESTYLED | none |
| PROJ-074 | Clear filters button | BoardToolbar.jsx:123-127 | Not drawn | MISSING | Draw it (inside Filter or next to it) |
| PROJ-075 | Group by: None, Epic, Priority, Issue type (radio) | BoardToolbar.jsx:17-22,130-136 | ProjectBoard: button "Group by: None" (options not drawn) | RESTYLED | Menu keeps all four options |
| PROJ-076 | Swimlanes: lane header with fold, icon, name, "(n issues)"; sticky column-name row; "No epic" lane; empty board still shows its columns | Board.jsx:64-76,321-346; boardQuery.js:128-144 | Not drawn (only Group by: None) | MISSING | Draw the grouped state |
| PROJ-077 | "No issues match these filters. Clear filters" line (an epic or label deleted since ticked does not count) | Board.jsx:55-62,242-249,305 | Not drawn | MISSING | Draw the no-match line |
| PROJ-078 | Info line under the toolbar: active sprint name, end date, goal; "No sprint is active, so every issue is shown. Plan one in the backlog"; "N done issues are hidden: resolved more than D days ago" | Board.jsx:271-280 | Not drawn | MISSING | Draw the line; the hidden-done notice is the only hint that Kanban cards are hidden |
| PROJ-079 | Phone toolbar: search and one "Filters" button (with count) that opens the rest | BoardToolbar.jsx:63-75 | MobileProject: no search or filters | MISSING | Draw search and Filters on the phone board |
| PROJ-080 | Phone: columns swipe and snap, the next one peeking | Board.jsx:302 | MobileProject: segmented column switcher (Inbox 3, This week 2, Today 2, Done 2), one column's cards at a time | CHANGED | Still reachable, but a card cannot be dragged to another column in the drawn layout; keep the card menu Move to (PROJ-066) on the phone |
| PROJ-081 | Kanban hides done issues resolved more than N days ago; Scrum board shows the active sprint (every issue when none); epics never appear as cards | boardView.js:17-35,99-110; constants/boards.js:52 | Invisible | SAME | none |
| PROJ-082 | Column delete: confirm names the issue count, where they go and whether they are reopened or resolved; toast with Undo. Category change that reopens or resolves asks first, Undo toast | Board.jsx:150-188; boardView.js:46-86 | ProjectSettings column delete (inline) and the shared confirm and toast | MOVED | Keep the counts, target and reopen / resolve wording and both Undo toasts |
| PROJ-083 | Phone floating create button and bottom tab bar | WorkspaceLayout (drawer nav on a phone) | MobileProject: floating "New task", bottom bar Documents / Applications / Projects | RESTYLED | Shell area owns the frame |

### E. Issue view (IssueDialog.jsx, IssueDetails.jsx, IssueFields.jsx, IssueActivity.jsx, IssueChecklist.jsx, useIssueActions.jsx)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-090 | Issue opens over the page at `?issue=KEY` (shared link works, Back closes, close steps back over opened issues, a second close is ignored) | useIssueActions.jsx:27-86; IssueDialog.jsx:272-284 | ProjectIssue: right drawer (about 520 wide) over a dimmed board | RESTYLED | Keep the URL behaviour; the drawer opens over any project view (live opens over List, Calendar, Timeline, Summary, Your work too) |
| PROJ-091 | Trail project › epic › key; epic crumb opens the epic | IssueDialog.jsx:178-207 | "Personal & Projects / LIFE-3"; epic crumb not drawn; the project crumb is plain text, not a link | CHANGED | Show the parent epic in the trail or in the properties block with a link; the project crumb must stay a link (see PROJ-225) |
| PROJ-092 | Copy link | IssueDialog.jsx:208 | "Copy link" button | SAME | none |
| PROJ-093 | Issue actions menu: Duplicate (toast Open), Delete (confirm, Undo; an epic's children leave it) | IssueDialog.jsx:152-171,209-217 | "Task menu" button (not drawn open) | RESTYLED | Menu keeps Duplicate and Delete |
| PROJ-094 | Close | IssueDialog.jsx:218 | "Close" | SAME | none |
| PROJ-095 | Summary edited in place (click) | IssueDialog.jsx:224-229 `InlineEdit` | h2 title | SAME | none |
| PROJ-096 | Status menu (lozenge by category) and "✓ Done" note | IssueDialog.jsx:255-258 | Status chip button ("Today") | RESTYLED | none |
| PROJ-097 | Checklist: "Add checklist item", progress bar, tick, rename in place, delete with Undo, Enter adds and stays, Escape | IssueDialog.jsx:231,241-243; IssueChecklist.jsx:14-92 | "Checklist 1 of 2", items, "Add checklist item" | RESTYLED | Keep item rename, delete with Undo, the progress bar |
| PROJ-098 | Description: rich text, click to edit with Save / Cancel; a draft left open is saved on close | IssueDialog.jsx:24-71,237-240 | Description paragraph | RESTYLED | Keep the rich-text editor (formatting) and the draft-save rule |
| PROJ-099 | Priority picker | IssueDetails.jsx:49 | Properties: "Priority Highest" | RESTYLED | none |
| PROJ-100 | Due date (native date field, guards a half-typed year) | IssueDetails.jsx:59; IssueFields.jsx:168-201 | Properties: "Due Tomorrow Oct 7" | RESTYLED | Keep the guard |
| PROJ-101 | Labels picker: pills, multi-select with search, create a label from the search | IssueDetails.jsx:50-52; IssueFields.jsx:66-88 | Properties: "Labels Home" | RESTYLED | Popover keeps search and create |
| PROJ-102 | Issue type picker (Task, Bug, Story, Epic; retyping an epic frees its children, toast Undo) | IssueDetails.jsx:48; IssueDialog.jsx:119-143 | More details (collapsed): "Type" | MOVED | none |
| PROJ-103 | Parent epic picker | IssueDetails.jsx:53-55 | More details: "group" | MOVED | none |
| PROJ-104 | Story points (number, step 0.5, blank for none) | IssueDetails.jsx:57; IssueFields.jsx:207-245 | More details: "story points" | MOVED | none |
| PROJ-105 | Start date | IssueDetails.jsx:58 | More details: "start date" | MOVED | none |
| PROJ-106 | Repeats (none, daily, weekdays, weekly, monthly; the next one is made when done) | IssueDetails.jsx:60; IssueFields.jsx:156-166 | More details: "repeats" | MOVED | none |
| PROJ-107 | Sprint picker (Scrum projects or any with sprints) | IssueDetails.jsx:56 | Not in the properties or the More details list | MISSING | Add Sprint to More details (or the main block when the project has sprints) |
| PROJ-108 | Created / Updated / Resolved stamps | IssueDetails.jsx:17-21,64-68 | "Created 4 days ago, Updated 2 hours ago" | CHANGED | Resolved stamp not drawn; keep it |
| PROJ-109 | Activity tabs All, Comments (with count), History | IssueActivity.jsx:178-188 | Tabs "Comments 1" and "History" | CHANGED | "All" tab not drawn; keep it (default merged view) |
| PROJ-110 | Comment box: one-line prompt, opens to a field with Save / Cancel, Ctrl or Cmd+Enter saves, Escape cancels, text left in it is saved on close | IssueActivity.jsx:20-88 | Input "Add a comment" | RESTYLED | Keep the expanding field with Save / Cancel and the draft-save rule |
| PROJ-111 | `m` jumps to the comment box (only on the top dialog); "Pro tip: press M" line | IssueActivity.jsx:157-168,197 | Not shown | SAME | Hint text may go; the key stays |
| PROJ-112 | Comment edit and delete (confirm "Delete this comment?"), "(edited)" mark, plain text | IssueActivity.jsx:90-124 | Comment row with Edit / Delete | SAME | none |
| PROJ-113 | History entries: "changed the Priority" with old value struck and new value | IssueActivity.jsx:126-144; issueHistory.js:25-31 | History tab content not drawn | MISSING | Draw a History entry (field, from, to, time) |
| PROJ-114 | Epic view: "Add child issue" button, Child issues list (type, key, summary, priority, status; "n of m done"), each opens | IssueDialog.jsx:73-104,232-235,244-246 | Not drawn (the drawn issue is a task) | MISSING | Draw the epic drawer with its child list, its "n of m done" and its empty line "No child issues yet." (IssueDialog.jsx:101) |
| PROJ-115 | Issue lock-in behaviours: opening another issue starts from its own view; deleted issue closes the view | IssueDialog.jsx:274-281 | Invisible | SAME | none |
| PROJ-116 | Create issue dialog: Project select (switching keeps typed fields), Type, Status, Summary (required, max 255), rich Description, Priority, Labels, Parent epic, Sprint (Scrum), Story points, Start, Due, "Create another", Cancel / Create; discard confirm; "Create a project first" when none; toast "KEY has been created" with View issue | CreateIssueDialog.jsx:12-199 | Not drawn (only "New task" buttons) | MISSING | Draw the dialog (all fields) or restyle the live one |
| PROJ-117 | Ways to create an issue: top bar Create, `c`, column "+", calendar day "+", epic "Add child issue"; opens in the project being viewed | TopBar.jsx:204-205,245-248; WorkspaceLayout.jsx:82-86; ProjectCalendar.jsx:78; IssueDialog.jsx:232 | Project header "New task" on project views; none in the top bar or on the landing | CHANGED | Keep a global Create (top bar) and `c`; the landing needs one too |

### F. List, Calendar, Timeline, Summary

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-120 | List columns: Type, Key, Summary, Status, Priority, Labels, Parent, Due date, Points, Updated | ProjectList.jsx:25-36 | ProjectList: Key, Task, Status, Priority, Due, Label | CHANGED | Type, Parent (epic), Points and Updated are gone; keep them as columns or one tap away (README rule: nothing less reachable) |
| PROJ-121 | Sort by clicking a header (asc, desc, back to rank) | ProjectList.jsx:38-51,71 | Headers drawn as plain text | MISSING | Draw sortable headers with direction |
| PROJ-122 | List holds every issue, done ones and epics too; a row's title opens it | ProjectList.jsx:54,108 | All 10 rows incl. done, epic LIFE-1; title links to the drawer | SAME | none |
| PROJ-123 | Status changed in place from the row | ProjectList.jsx:111 `StatusMenu` | Status chip per row is a static `span` with no caret or trigger (corrected by review: it was RESTYLED) | CHANGED | Draw the chip as a status menu (all columns of the project); nothing in the List row sets status otherwise |
| PROJ-124 | Count "N of M issues" | ProjectList.jsx:86 | "10 tasks" | RESTYLED | Keep "n of m" when filtered |
| PROJ-125 | Foot composer "+ Create issue" with type picker | ProjectList.jsx:74-79,129-131 | "Add task" link | CHANGED | As PROJ-068 |
| PROJ-126 | Empty lines: "No issues match these filters." and "No issues yet. Create the first one below." | ProjectList.jsx:128 | Not drawn | MISSING | Draw both |
| PROJ-127 | List toolbar: search, Epic / Type (incl. Epic) / Label / Priority, Overdue, Due this week, Clear | ProjectList.jsx:86; BoardToolbar.jsx:54-139 | ProjectList: search + "Filter" only | CHANGED | Overdue, Due this week, Clear not drawn (see PROJ-072/074); Type must still offer Epic |
| PROJ-130 | Calendar: month of weeks (Mon first), issue chips (struck when done), 3 per day then "+N more" / "Show less", today dot, out-of-month shading | ProjectCalendar.jsx:16-17,61-99 | ProjectCalendar grid with chips (cell data is in the board's `renderVals`, readable by review: today is a blue disc on day 6, out-of-month days shaded, each cell holds at most ONE chip, tinted amber for today/tomorrow and blue otherwise, no type icon, no done strike-through possible) | RESTYLED | The canvas cannot show more than one chip a day, so "+N more" / "Show less" (3 a day) must be kept; keep the type icon on the chip and the struck look for done issues |
| PROJ-131 | Today, previous month, next month, month title | ProjectCalendar.jsx:54-57 | Same four controls | SAME | none |
| PROJ-132 | "N issues have no due date" note | ProjectCalendar.jsx:40,58 | "No due date 5" rail listing the tasks | RESTYLED | none (the list is new, D-08) |
| PROJ-133 | "+" on a day creates an issue due that day | ProjectCalendar.jsx:78 | Not drawn | MISSING | Add the day "+" (hover, always on touch) |
| PROJ-134 | Calendar toolbar: search + all filters + quick filters | ProjectCalendar.jsx:47 | ProjectCalendar: "Filter" button only | CHANGED | Search, Overdue, Due this week, Clear missing |
| PROJ-135 | Timeline window: 8 weeks (56 days), moves a week at a time, range label | ProjectTimeline.jsx:16-17,104-109 | ProjectTimeline: Previous / Next weeks, "Sep 28 to Nov 22" | RESTYLED | none |
| PROJ-136 | Timeline "Today" button back to this week | ProjectTimeline.jsx:105 | ProjectTimeline: a "Today" button is drawn left of Previous / Next weeks (corrected by review: the table said not drawn; the scale also marks "Oct 5 · this week") | SAME | none |
| PROJ-137 | Today line and day scale | ProjectTimeline.jsx:113-128 | Scale with a this-week marker | RESTYLED | none |
| PROJ-138 | Epic rows that fold into their issues (indented), then issues in no epic; epic bar spans its children | ProjectTimeline.jsx:28-34,129-138 | Flat list of 10 rows, no fold, no indent | CHANGED | Draw epic rows with fold and indented children |
| PROJ-139 | Row: type icon, key, title, status lozenge (xl), bar by status (grey, blue, green; epics purple) | ProjectTimeline.jsx:37-76 | Key + title + bar link; no icon, no status | CHANGED | Restore the status chip and type icon |
| PROJ-140 | Click a bar or name opens the issue; "No due date" for undated rows | ProjectTimeline.jsx:55,62-73 | Bars are links; "No due date" drawn | SAME | none |
| PROJ-141 | Timeline empty line "No issues yet." | ProjectTimeline.jsx:139 | Not drawn | MISSING | Draw it |
| PROJ-142 | Summary: four stat cards (completed, updated, created in last 7 days; due in next 7) | ProjectSummary.jsx:61-66; projectSummary.js:17-43 | ProjectSummary: stat strip | RESTYLED | none |
| PROJ-143 | Status overview donut with legend and "View all issues" link | ProjectSummary.jsx:68-77 | "Where things stand" donut, legend, "View all tasks" | RESTYLED | none |
| PROJ-144 | Recent activity: 8 entries, "You changed the X to Y on KEY: title", time, each opens the issue | ProjectSummary.jsx:78-98; projectSummary.js:36-40 | 5 entries: "You commented on", "You marked as done", "You created" | CHANGED | Entry count and the field-change sentence ("changed the Priority to High") differ (D-14); keep the live sentence |
| PROJ-145 | Priority breakdown (column bars) | ProjectSummary.jsx:99-101 | "More charts" disclosure (collapsed) | MOVED | none |
| PROJ-146 | Types of work (share bars) | ProjectSummary.jsx:102-104 | "More charts" disclosure | MOVED | none |
| PROJ-147 | Epic progress (bar per epic, "n of m done", opens the epic) | ProjectSummary.jsx:105-119 | Not in "More charts" (lists only Priority breakdown, types of work) | MISSING | Add Epic progress to More charts |
| PROJ-148 | Summary empty lines ("Nothing has happened yet.", "No epics yet…") | ProjectSummary.jsx:79,106 | Not drawn | MISSING | Draw them |

### G. Backlog and sprints (Backlog.jsx, BacklogParts.jsx)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-160 | Sections fold and unfold (active sprint, each future sprint, backlog) | Backlog.jsx:177-179 | ProjectBacklog: a down chevron is drawn at the left of each section header (Sprint 1 and Backlog), as a static `span` (corrected by review: the table said no chevron) | RESTYLED | Make the chevron the fold / unfold control (sections keep folding, a drop on a folded header still lands) |
| PROJ-161 | Section header: sprint name, "Active" badge, dates, "(n issues)", goal | Backlog.jsx:183-212; sprintDates BacklogParts.jsx:17 | ProjectBacklog: "Sprint 1 Active Oct 6 – Oct 20 · 6 tasks", goal line | RESTYLED | none |
| PROJ-162 | Points by status bubbles (to do, in progress, done) per section | BacklogParts.jsx:20-33 | "4 open 2 done" (counts, not points) | CHANGED | Keep the three points bubbles |
| PROJ-163 | Start sprint button (disabled with reasons: a sprint is already active, or no issues) | Backlog.jsx:195-199 | Backlog block: "Start next sprint" | RESTYLED | Keep the disabled reasons |
| PROJ-164 | Start sprint dialog (name, start, end, goal; blank name and end before start block Start) | BacklogParts.jsx:130-159 | Not drawn | MISSING | Draw it |
| PROJ-165 | Complete sprint button | Backlog.jsx:200 | Sprint block: "Complete sprint" | SAME | none |
| PROJ-166 | Complete sprint dialog (done / open counts, move open issues to Backlog or a future sprint, "Nice work"); opened by `?complete=1` | BacklogParts.jsx:161-182; Backlog.jsx:56-61,123 | Not drawn | MISSING | Draw it |
| PROJ-167 | Create sprint (Scrum backlog section) | Backlog.jsx:201 `addSprint` | Not drawn ("Start next sprint" only) | MISSING | Keep Create sprint (a future sprint to plan into) |
| PROJ-168 | Sprint ⋯ menu: Delete sprint (confirm, issues to backlog, Undo) | Backlog.jsx:115-121,202-208 | Not drawn | MISSING | Add the sprint menu |
| PROJ-169 | Sprint name renamed in place | Backlog.jsx:183-189 `InlineEdit` | Plain heading | SAME | none |
| PROJ-170 | Backlog row: type icon, key (struck when done), summary, epic lozenge, status menu, points, priority | BacklogParts.jsx:40-92 | Row: handle, key, title, epic name, due chip, status chip, priority | CHANGED | Type icon and story points not drawn; restore them |
| PROJ-171 | Row ⋯ menu: Move to (sprints and Backlog, Scrum only), Delete (confirm, Undo) | BacklogParts.jsx:80-89 | Button "Move or edit LIFE-3" (menu not drawn) | RESTYLED | Menu keeps Move to and Delete |
| PROJ-172 | Row status changed from the row | BacklogParts.jsx:76 | Status chip per row is a static `span` (no caret, no button; only the row's "Move or edit" button is a trigger) (corrected by review: it was RESTYLED) | CHANGED | Draw the status as a menu trigger, or put Status in the row menu; keep the status of every column of the project reachable from the row |
| PROJ-173 | Drag a row to reorder or move between sections (drop anywhere on a section incl. header and fold) | Backlog.jsx:23-33,92-113 | Drag handles drawn, hint "Drag a task by its handle…" | RESTYLED | none |
| PROJ-174 | Section composer "+ Create issue" with type picker | Backlog.jsx:241; InlineCreate.jsx | "Add a task to this sprint" / "Add a task" links | CHANGED | As PROJ-068 |
| PROJ-175 | Epic panel: epics with progress, click filters by epic, open an epic, "Create epic" | BacklogParts.jsx:94-127; Backlog.jsx:136-146,157-166 | Toggle "Groups" (panel not drawn) | RESTYLED | Panel keeps progress, filter, open, create epic |
| PROJ-176 | "Plan in sprints?" banner with "Use sprints" on a Kanban project | Backlog.jsx:148-155 | Not drawn; Settings "Way of working" Scrum card | MOVED | none (but see PROJ-044) |
| PROJ-177 | Empty section lines ("Plan this sprint: drag issues here…", "Your backlog is empty.", "No issues here match the filters.") | Backlog.jsx:217-220 | Not drawn | MISSING | Draw them |

### H. Project settings (BoardSettings.jsx)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-180 | Name (saves on leaving the field or Enter, Escape restores) | BoardSettings.jsx:25-49,267-269 | ProjectSettings: Name | SAME | none |
| PROJ-181 | Key with live check, "Save key", "Issue keys use it: A-1 becomes B-1" | BoardSettings.jsx:65-85,270-272 | Key + "Save key" + note | RESTYLED | Keep the live check and refusal messages |
| PROJ-182 | Description | BoardSettings.jsx:273-275 | Description textarea | SAME | none |
| PROJ-183 | Colour (8 swatches) | BoardSettings.jsx:276-289 | 8 swatches | SAME | none |
| PROJ-184 | Way of working: Kanban or Scrum | BoardSettings.jsx:290-294 | Two radio cards | RESTYLED | none |
| PROJ-185 | Column rows: title, category, WIP limit, count, move up / down, delete (disabled on the last column) | BoardSettings.jsx:88-158 | Name, Kind, Limit, "4 tasks", up, down, delete | RESTYLED | none |
| PROJ-186 | Column delete panel (move issues to which column, effect text, Cancel / Delete) and category-change confirm with Undo | BoardSettings.jsx:113-177 | Delete button drawn, panel not drawn | RESTYLED | Keep the panel and the confirm |
| PROJ-187 | Add column (name, Enter or Add) | BoardSettings.jsx:179-199,301 | "New column name" + "Add column" | SAME | none |
| PROJ-188 | Labels: add (name + colour), rename, recolour (10 colours), delete (confirm "comes off N issues"), duplicate-name messages | BoardSettings.jsx:226-246,304-320 | "Advanced" disclosure (collapsed): "Labels and hiding old done tasks" | MOVED | Keep the "No labels yet." line, the 10 colours (a label's own colour kept when not in the palette) and the two duplicate-name messages (added by review) |
| PROJ-189 | Hide done issues after N days (checkbox + days, 0 allowed) | BoardSettings.jsx:322-344 | Inside "Advanced" | MOVED | none |
| PROJ-190 | Delete project (confirm, navigate to Projects, toast Undo) | BoardSettings.jsx:248-254,346-348 | "Delete project" card with undo note | SAME | none |
| PROJ-191 | Page heading "Project settings" | BoardSettings.jsx:261 | "Project settings, Changes save when you leave a field" | RESTYLED | none |

### I. Invisible behaviour, persistence, shell links

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-200 | Projects live in localStorage `cpwtcv_boards_v2` (v1 migrated once and kept, backups, never-destroy writes, full-storage handling) | constants/boards.js:7-9; boardStorage.js:35-73; boardStoreState.js:23-45 | Invisible | SAME | none |
| PROJ-201 | Demo project "Personal & Projects" (LIFE) seeded when nothing is saved | boardStorage.js:57; boardDemo.js | The whole canvas is drawn on it | SAME | none |
| PROJ-202 | Cross-tab merge: another tab's save is taken, unsaved local changes kept, key clashes re-keyed | boardStoreState.js:52-70,72-89,97-109 | Invisible | SAME | none |
| PROJ-203 | Each change stamps the project's `updatedAt` (per-project last-write-wins for the cloud sync) | boardActions.js:34-47 | Invisible | SAME | none |
| PROJ-204 | Cloud sync of projects when signed in; the top bar cloud icon and its status | App.jsx:15; CollectionSyncDot.jsx; useCollectionSync | ShellMenus: "Cloud sync on, saved 1 min ago"; States sync chips | RESTYLED | none |
| PROJ-205 | Signed-out and demo account: projects stay in this browser; the workspace has Sign in / Sign out in the top bar | TopBar.jsx:187-194 (R4-DUX-07) | ShellMenus: signed-out prompt and avatar menu | RESTYLED | none |
| PROJ-206 | Undo toasts: project, column, sprint, issue, checklist item, category change, mark done | Boards.jsx:41; Board.jsx:168,187; Backlog.jsx:120; IssueDialog.jsx:162; YourWork.jsx:83 | States: "Undo toast" | SAME | Each toast keeps its own text |
| PROJ-207 | Quick search `/`: issues by key or title words and projects; arrow keys, Enter, Escape; phone search button | TopBar.jsx:47-185; workspaceSearch.js:15-46 | ShellMenus palette "Search everything": Documents, Applications, Tasks groups | CHANGED | No Projects group is drawn; live finds projects by name or key; add it |
| PROJ-208 | Keyboard shortcuts: `c` create, `/` search, `[` collapse sidebar, `?` help dialog, Enter opens, Escape closes, Space picks up a card, `m` comment | TopBar.jsx:14-28,205; IssueActivity.jsx:157 | ShellMenus: avatar menu "Keyboard shortcuts ?"; top bar "/" chip | RESTYLED | Shortcut dialog content not drawn |
| PROJ-209 | Dashboard button "Projects" | Dashboard.jsx:210-216 | Documents top nav tab "Projects" | MOVED | none |
| PROJ-210 | Routes: /boards, /work, /boards/:id and /backlog /summary /timeline /calendar /list /settings | AppRoutes.jsx:115-123 | One artboard per view | SAME | Build keeps every route |
| PROJ-211 | Issue deep links (`#/boards/:id?issue=KEY`) from search, toasts, Copy link, shared links | workspaceSearch.js:35; useIssueActions.jsx:14 | Invisible | SAME | none |
| PROJ-212 | Phone project header: breadcrumb "Projects / name" (the way back), avatar, name (click to rename), Star, and on the Board only the "Complete sprint" button and the Board actions menu (the live header has no key chip and no per-view menu; the earlier cell described the new design) | ProjectTabs.jsx:36-61; Board.jsx:253-267; WorkspaceLayout (drawer) | MobileProject header: back arrow, avatar, name, key chip, "Project menu"; no Star, no rename, no Complete sprint | CHANGED | Keep Star (PROJ-043) and rename (PROJ-042 puts it in Settings) on the phone; keep the "Complete sprint" shortcut (PROJ-047) |

## 2. DRAWN BUT NOT IN THE LIVE APP

Handling per PARITY-RULE.md: PARK (not built, owner decides) unless it is the same function under another name.

| ID | What the canvas draws | Where | Handling |
|---|---|---|---|
| D-01 | New names for existing things: Issue as "Task", Epic as "Group", Backlog as "Plan" (Plan tab only for Scrum), Status category as "Kind", "New project" for Create project, "Summary / More details" labels | all Project boards | PARK; live words stay unless the owner approves. Same functions under other names, so the functions are kept |
| D-02 | Key chip (LIFE) next to the project title | every project header | Same data the sidebar already shows; harmless display, owner may keep or drop |
| D-03 | Timeline Weeks / Months scale | ProjectTimeline | PARK (already in README); live has one 8-week scale |
| D-04 | "Due soon" list card on Summary (live has the count only) | ProjectSummary | PARK |
| D-05 | Recent-project card stats: Done, Due soon, "Edited 1 hour ago" | Projects | PARK |
| D-06 | A checkbox-style square at the left of every project List row (static `span role="img"` "Not done", so nothing in the markup toggles it) | ProjectList | PARK (live List changes status only through the status menu; the Your work ✓ exists). Reviewed: not the same function as the live ✓ Mark done, which is on Your work rows only |
| D-07 | Your work subtitle "4 tasks need you this week" (week-based wording) | Projects | PARK; live wording and count rule stay |
| D-08 | "No due date" rail that lists the tasks (live shows only a count) | ProjectCalendar | PARK |
| D-09 | WIP hint line "Today holds up to 3 tasks, so one more fits." and "2 of 3" header | MobileProject | PARK; live shows "n/limit" and "Max N" |
| D-10 | "Start next sprint" in the Backlog block (may mean create + start in one) | ProjectBacklog | PARK; live has Create sprint and Start sprint per future sprint |
| D-11 | Open / Done counts in a sprint header instead of points bubbles | ProjectBacklog | PARK; points bubbles stay (PROJ-162) |
| D-12 | Settings note "Changes save when you leave a field" | ProjectSettings | Same behaviour as live (CommitField); wording only |
| D-13 | Way of working text "Adds a Plan tab for the backlog"; Plan tab hidden for Kanban | ProjectSettings, ProjectBacklog | PARK (see PROJ-044, PROJ-176) |
| D-14 | Summary activity wording "You commented on / You marked as done / You created" and 5 entries | ProjectSummary | PARK; live sentences stay (PROJ-144) |
| D-15 | Issue drawer author "Alex Johnson" on comments and activity (live shows "You") | ProjectIssue | PARK; live "You" stays |
| D-16 | Issue drawer "Comments" as the default tab and Comments before History with no "All" | ProjectIssue | Covered by PROJ-109 (restore All) |
| D-17 | Calendar chips and Summary lists as links to the issue | ProjectCalendar, ProjectSummary | Same function (opens the issue) as live buttons |
| D-18 | Global search groups Documents / Applications (live top-bar search covers issues and projects only) | ShellMenus | Shell area owns it; Projects results must stay (PROJ-207) |
| D-19 | Compact "Properties" block with a "More details" disclosure (live shows all nine fields in one Details panel) | ProjectIssue | Layout only; every field kept (PROJ-099 to 107) |
| D-20 | Visible drag handles on Backlog rows and the line "Drag a task by its handle to move it between the sprint and the backlog, or use the menu on a row." (live drags the whole row, no handle; its drag text is for screen readers) (added by review) | ProjectBacklog | Same function (drag a row, or its menu); handle and hint are look and wording only, the whole row may stay draggable |
| D-21 | Weeks / Months scale switch (D-03), "Groups" on/off toggle drawn as a switch (live: "Epic panel" toggle button) and the timeline "Scale" group (added by review, for completeness) | ProjectBacklog, ProjectTimeline | Groups is the Epic panel under D-01's names (PROJ-175); Weeks / Months stays PARK |

## 3. TESTS THAT PIN THIS AREA'S CURRENT UI

Node tests mount the real components with react-dom over `tests/pdf/fake-dom.mjs` or render to string. There is no Cypress or Playwright spec for Projects (Cypress `26-mobile-layout.cy.js:135-136` only checks the Dashboard's "Projects" button).

Page and flow tests (selectors, roles, text):
- `tests/pdf/82-board-pages.test.mjs`: Board and Boards pages over store v2; status columns of cards, card menu, issue view at `?issue=KEY`, not-saved notice.
- `tests/pdf/82-backlog-page.test.mjs`, `tests/pdf/103-r4-backlog-page.mjs` (helper): Backlog page; Use sprints, create / start / complete / rename / delete sprint, class tokens of the layout.
- `tests/pdf/82-backlog-r4.test.mjs`: date typing guard, backlog drop outside a section, Kanban backlog, epic panel "Create epic" without type picker.
- `tests/pdf/82-board-columns-r4.test.mjs`: column delete question counts every issue; Settings "Move its issues to" select.
- `tests/pdf/82-settings-page.test.mjs`, `tests/pdf/103-r4-board-settings-helpers.mjs` (helper): Settings page controls by aria-label ("Project key", "Column title", "WIP limit", "Colour …", "Hide old done issues").
- `tests/pdf/82-your-work-page.test.mjs`: Your work sections, data-section / data-issue hooks, mark done.
- `tests/pdf/82-board-summary-labels.test.mjs`: label flows (Settings add / rename, picker create) on the tracker look.
- `tests/pdf/82-board-ime-enter.test.mjs`, `tests/unit/board-ime-enter.unit.mjs`: IME Enter in the column composer, checklist add, Add column, comment.
- `tests/pdf/82-issue-summary-wrap.test.mjs`, `tests/unit/board-checklist-wrap.unit.mjs`: long-word wrapping classes in the issue view.
- `tests/pdf/issue-view-page.mjs` (helper) with `tests/pdf/82-issue-view-r4-02.test.mjs`, `-r4-03`, `-r4-05`, `-r4-06`: issue view state per issue, router history on open and close, activity tab, description draft.
- `tests/pdf/81-job-tracker-ui.test.mjs`: board card role=button, Enter / Space opens, drag instructions text.
- `tests/pdf/172-board-sensors-stable.test.mjs`: Board and Backlog pass stable DnD sensors (render counts).
- `tests/pdf/104-r5-brd-helpers.mjs` (helper) with `104-r5-brd-sw-b-01-column-delete-undo`, `104-r5-hunt2-board-stale-filter` ("No issues match these filters."), `104-r5-hunt2-kanban-move-to-bottom` (card menu "Move to"), `107-r5-hunt6-column-category-undo`, `107-r5-hunt6-type-filter-epic` (Type filter offers Epic on List and Calendar).
- `tests/pdf/102-r4-dux-01-create-issue-project-switch.test.mjs`, `102-r4-dux-05-discard-typed-create.test.mjs`: Create issue dialog fields and "Discard this issue?" / "Discard this project?" confirms.
- `tests/pdf/102-r4-dux-19-mark-done-undo.test.mjs`: Your work ✓ "Mark KEY done" and its Undo toast.
- `tests/pdf/102-r4-dux-20-undo-task-delete.test.mjs`: checklist item delete toast and Undo.
- `tests/pdf/102-r4-dux-21-sprint-column-errors.test.mjs`: Start sprint validation, column Rename Save hold.
- `tests/pdf/102-r4-dux-07-workspace-account.test.mjs`: sign-in / account control in the workspace top bar.
- `tests/pdf/105-r5-hunt3-create-in-viewed-project.test.mjs`, `105-r5-hunt3-list-backlog-hidden-create.test.mjs`: Create opens in the viewed project; "created, hidden by your filters" toast on List and Backlog.
- `tests/pdf/106-r5-hunt5-swimlanes-empty-board.test.mjs`: Group by on an empty board shows columns and "+ Create issue".
- `tests/pdf/106-r5-hunt7-create-project-double-submit.test.mjs`: one project per opening of Create project.
- `tests/pdf/r5hunt8-points-invalid-text.test.mjs`, `r5hunt8-rev-unreadable-text-stays.test.mjs`, `r5hunt8-settings-wip-fraction.test.mjs`: Story points and WIP number fields.

Layout and class-token pins (break on a restyle; update, do not weaken):
- `tests/pdf/103-r4-dph-06-board-toolbar-filters.test.mjs`: phone "Filters" button, `md:hidden`, `md:contents` wrapper.
- `tests/pdf/103-r4-dph-08-projects-table-phone.test.mjs`, `103-r4-dph-09-project-list-phone.test.mjs`: `hidden sm:table-cell` columns and 48rem / 64rem floors.
- `tests/pdf/103-r4-dph-10-row-composer-stacks.test.mjs`, `103-r4-dph-11-add-column.test.mjs`, `103-r4-dph-11-board-fields.test.mjs`: composer stacking, 16px touch text on board fields.
- `tests/pdf/103-r4-dph-01-timeline-name-column.test.mjs`, `103-r4-dvis-20-timeline-row-hover.test.mjs`: Timeline name column width variable and sticky hover colour.
- `tests/pdf/103-r4-dph-05-calendar-controls-outside-scroller.test.mjs`, `103-r4-dph-18-calendar-controls-wrap.test.mjs`: Calendar controls row outside the grid scroller, wrapping.
- `tests/pdf/103-r4-dph-04-phone-search.test.mjs`, `103-r4-dph-11-topbar-search.test.mjs`, `103-r4-dvis-15-topbar-search-kit.test.mjs`, `tests/unit/r4-lo-25-quick-search-shrunk-list.unit.mjs`, `tests/unit/r5-job-03-quick-search-fits.unit.mjs`: top-bar quick search (phone button, 16px text, kit styling, highlighted row, result height).
- `tests/unit/board-scroll-snap.unit.mjs`: `snap-x snap-mandatory` on the board's scroller.
- `tests/unit/ui-shell.unit.mjs`: workspace shell routes, scroll reset, sidebar project list.
- `tests/unit/collection-sync-status.unit.mjs`, `tests/pdf/95-sync-privacy-notices.test.mjs`: boards sync status and the Privacy page text about it.

Logic-only tests that stay as they are (no UI): `tests/unit/board-{model,ops,query,store,store-sync,sync,migrate,transfer,drop,drop-preview,collision,column-delete,store-harness}.unit.mjs`, `tests/unit/normalize-board.unit.mjs`, `tests/unit/tf-xtab-board-store-write-before-hearing.unit.mjs`, `tests/unit/r5-hunt5-*`, `tests/unit/r5-hunt6-undo-demo-project-next-account.unit.mjs`, `tests/pdf/71-startup-chunks` (the project pages must stay lazy chunks; a new page file must be added to its regex).

## 4. UNKNOWNS

- The canvas is static: drag and drop, touch gestures, hover affordances, menu and popover contents, validation messages and toasts are not drawn, so rows for them are judged by whether a trigger exists (see the legend), not by what opens.
- Card face: story points are not drawn on a card, and the board draws at most one label a card, so "+N" is not decidable. RESOLVED by review: a type icon is not drawn on the Board card, nor on any Project board (no board has a type icon anywhere; see PROJ-229).
- "Worked on" (Projects) is a link to the ProjectList board, so what the tab shows is unknown (PROJ-029).
- Recent projects: only one card is drawn, so the count (live: 4) and the order are unknown; the All projects order (live: starred first, then updated) likewise.
- Calendar chips and day cells are templates (`{{c.day}}`, `{{c.t}}`) filled by the board's `renderVals`. RESOLVED by review: the data holds one chip a day, the today mark is a blue disc, out-of-month days are shaded, and there is no "+N more", no day "+" and no done look; the 3-a-day limit and "+N more" are therefore unproven in the canvas and must be kept (PROJ-130).
- The "Project menu" and "Task menu" buttons are drawn but never open; whether Project settings, Duplicate and Delete live there is assumed from the live app.
- Settings "Advanced" is collapsed in the drawing; Labels and "hide done" are placed there only by its caption.
- No Kanban Backlog is drawn: the Plan tab shows on a Scrum project only, so how a Kanban project reaches its backlog and "Use sprints" is open (PROJ-044, PROJ-176).
- Phone: only the Board is drawn (MobileProject). List, Calendar, Timeline, Summary, Backlog, Settings, the issue drawer and the Projects landing have no phone board.
- `src/utils/boardTransfer.js` (export and import of projects as a JSON file) has no caller in `src`: no live button was found, so it has no row. Confirm with the owner whether any UI is meant to expose it.
- `src/components/job/KanbanView.jsx` belongs to the Job Tracker area; it was not audited here.
- The Quick search, avatar menu, sync chips and the signed-out prompt are the shell area's boards (ShellMenus, States); rows PROJ-204 to 208 only record what the Projects area needs from them.
- Accessibility (labels, roles, focus, targets) was not audited (deferred, CLAUDE.md).

## 5. ADDED BY REVIEW

Independent review of the audit (read the whole `src` area again, then re-opened the artboards for every CHANGED / MISSING row and for a sample of SAME / RESTYLED / MOVED rows: PROJ-005, 008, 012, 040, 070, 092, 112, 122, 131, 140, 165, 180, 187, 190). The audit's 165 rows stand, with these corrections to existing rows (done in place, each marked "corrected by review"):

- PROJ-027 RESTYLED to CHANGED: the Your work circle is a static `span role="img"`, not a control.
- PROJ-123 RESTYLED to CHANGED and PROJ-172 RESTYLED to CHANGED: the status chips on List and Backlog rows are static spans (no caret, no button).
- PROJ-136 MISSING to SAME: ProjectTimeline draws a "Today" button.
- PROJ-160 MISSING to RESTYLED: both Backlog section headers draw a chevron.
- PROJ-212 RESTYLED to CHANGED: the live phone header was described from the new design; the live header has Star and rename and no key chip, and the phone design drops Star.
- PROJ-130, PROJ-064, PROJ-091, PROJ-114, PROJ-188, D-06 and two Unknowns: notes sharpened from the real markup (calendar cell data, no type icon on any board, project crumb not a link).

Counts after review: 189 rows = same 42, moved 22, restyled 54, changed 29, missing 42 (the audit's 165 became same 34, moved 22, restyled 49, changed 26, missing 34, plus 24 rows added below).

### J. Rows added by review (IDs continue from PROJ-212)

| ID | Live function | Live behaviour (src) | New design (board + element) | Status | Fix if CHANGED/MISSING |
|---|---|---|---|---|---|
| PROJ-213 | After "Create project", the new project's board opens (replacing the history entry, so Back skips the dialog) | Boards.jsx:119 `onCreated` navigate `/boards/:id` with `replace` | Projects: "New project" links straight to ProjectBoard, no dialog (PROJ-002) | MISSING | Whatever dialog is built, creating a project must land on that project's Board (added by review) |
| PROJ-214 | Your work ordering and counts: Overdue oldest first, Due today by priority, Due this week soonest first (next 7 days), In progress latest update first (open, in an in-progress column, not already above); done and epic issues never listed; subtitle and "To do" count hidden at 0 | boardQuery.js:269-300; YourWork.jsx:61-63,89,127 | Projects: "Due today" and "This week" lists, "To do 4" | SAME | Invisible rules; the build keeps them (added by review) |
| PROJ-215 | Due-date pill states: overdue, today, soon and later look different, a done issue's pill is calm; used on cards, List, Your work, Backlog | DatePill in IssueCard.jsx:45, ProjectList.jsx:120, YourWork.jsx:38 | Amber "Today" / "Tomorrow", grey "Oct 9" drawn; no overdue state drawn | RESTYLED | Draw an overdue state (the live one is the way an overdue task is noticed) and the done look (added by review) |
| PROJ-216 | Fallback words and plurals: "Untitled project", "Untitled" (column), "1 issue" / "2 issues", "1 done issue is hidden" | Boards.jsx:88,38; BoardColumn.jsx:32; Board.jsx:73,277 | Invisible | SAME | Keep the fallbacks and singular / plural forms (added by review) |
| PROJ-217 | Sidebar collapse to a 64 px rail (tooltips name each project and KEY), `[` toggles it, the choice is kept in `cpwtcv_sidebar_collapsed`; on a phone a drawer opened by a menu button, closed by any navigation | WorkspaceLayout.jsx:12-95; SidebarContent.jsx:79-177; TopBar.jsx:218 | No sidebar drawn (top nav, bottom tab bar on the phone) | MISSING | Shell area owns the frame; if the sidebar becomes a switcher or goes, the owner must say where `[` and the remembered state go (PARITY-RULE: a function cannot just be dropped). See PROJ-049 (added by review) |
| PROJ-218 | Each project view keeps its own filters, Group by, folded swimlanes, sort and folded sections as page state for the visit (reset on leaving); filters do not carry from Board to List | Board.jsx:94-96; Backlog.jsx:49-51; ProjectList.jsx:63-64; ProjectCalendar.jsx:32-33 | Invisible | SAME | Keep per-view state (added by review) |
| PROJ-219 | An issue made from a column's "+ Create issue" goes into that column and, on a Scrum project, into the active sprint; one made in a Backlog section goes into that sprint; made from the List, the first column and the backlog | Board.jsx:236-237; Backlog.jsx:84-85; ProjectList.jsx:74-75 | Invisible ("Add task" links) | SAME | Keep where each composer files the new issue (added by review) |
| PROJ-220 | Backlog toolbar: search, Epic / Type / Label / Priority, Overdue, Due this week, Clear filters, and the filtered section line "No issues here match the filters." | Backlog.jsx:129-147; BoardToolbar.jsx:54-141 | ProjectBacklog: search + "Filter" + "Groups" toggle only | CHANGED | Overdue, Due this week and Clear filters are not drawn (as PROJ-072/074); the Filter popover must hold the four filters (added by review) |
| PROJ-221 | Kanban project's Backlog page: one "Backlog" section holding every open issue (also ones still in a sprint), no sprint sections, no "Create sprint", no "Move to" in a row menu, the "Plan in sprints?" banner with "Use sprints" | Backlog.jsx:71-81,148-155,201; BacklogParts.jsx:84 | Not drawn (Plan tab on a Scrum project only) | MISSING | Draw / keep the Kanban backlog (see PROJ-044, PROJ-176, PROJ-167) (added by review) |
| PROJ-222 | Sprint toasts "NAME started" and "NAME completed"; the "Start sprint" button's title says why it is disabled (complete the active sprint first / add issues) | Backlog.jsx:196,250,257 | States draws only the generic Undo toast | MISSING | Keep both toasts and the disabled reasons (added by review) |
| PROJ-223 | Epic panel details: close button, "No epics yet. An epic groups the issues of a bigger piece of work.", progress bar and "n of m issues done · a/b points", several epics ticked at once filter the backlog, the epic's key opens it, "Create epic" composer has no type picker and prompt "What is this epic?" | BacklogParts.jsx:94-127; Backlog.jsx:157-166 | ProjectBacklog: toggle "Groups" (panel not drawn) | RESTYLED | Panel keeps all of this; extends PROJ-175 (added by review) |
| PROJ-224 | `?complete=1` with no sprint to complete is dropped from the address | Backlog.jsx:56-60 | Invisible | SAME | Keep (added by review) |
| PROJ-225 | The issue trail's project link closes the view when the issue is open over that project's board (a plain click), goes to the board from any other page, and keeps middle / Ctrl / Cmd click for a new tab | IssueDialog.jsx:179-194 | ProjectIssue: "Personal & Projects / LIFE-3" as plain text | CHANGED | Draw the project crumb as a link with the same behaviour (added by review) |
| PROJ-226 | Copy link toasts: "Link copied", or "Could not copy the link" when the clipboard refuses; from the drawer's button and from a card's menu | IssueDialog.jsx:208; useIssueActions.jsx:108-110 | "Copy link" button drawn; toasts not | RESTYLED | Keep both toasts (added by review) |
| PROJ-227 | Details field rules: Parent epic is not offered on an epic; Sprint shows only on a Scrum project or one that has sprints; the Details box folds (open by default) | IssueDetails.jsx:30-60 | Properties block + "More details" (collapsed, no Sprint) | RESTYLED | Keep the two visibility rules (Sprint: see PROJ-107); the fold is the "More details" disclosure (added by review) |
| PROJ-228 | Activity empty lines "No comments yet." (All, Comments) and "No changes yet." (History) | IssueActivity.jsx:205-207 | Not drawn | MISSING | Draw both (added by review) |
| PROJ-229 | Issue type icon (Task, Bug, Story, Epic) on a card, a List row, a Backlog row, a Calendar chip, a Timeline row, a Your work row, a Summary activity and epic row, the issue trail and a quick-search result | IssueCard.jsx:42; ProjectList.jsx:102; BacklogParts.jsx:68; ProjectCalendar.jsx:85; ProjectTimeline.jsx:54; YourWork.jsx:32; ProjectSummary.jsx:89,111; IssueDialog.jsx:199,205; TopBar.jsx:168 | No project board draws a type icon (type shows only under "More details") | CHANGED | A Bug, Story and Epic can no longer be told apart on any board: restore the type icon on every one of these surfaces (or the owner agrees to a smaller set); consolidates PROJ-026/064/120/139/170 (added by review) |
| PROJ-230 | Create issue opens with defaults from its opener: the viewed project, the clicked column, a calendar day's date as Due, an epic's id as Parent, the active sprint on Scrum; "Create another" keeps type, status, epic and sprint and clears the rest | CreateIssueDialog.jsx:12-27,89-92; WorkspaceLayout.jsx:82-86; ProjectCalendar.jsx:78 | Not drawn | MISSING | Part of PROJ-116: keep these defaults (added by review) |
| PROJ-231 | Timeline bar span: start date (else the day created) to due; epic bar spans its children; bars clipped to the 8-week window; bar tooltip "KEY: start – end"; dates are set in the issue, not by dragging | ProjectTimeline.jsx:21-34,60-72 | Bars drawn (data-only) | SAME | Keep the rules; no drag-to-resize is added (added by review) |
| PROJ-232 | Settings column delete rules: the last column cannot be deleted (button disabled, title "A project keeps at least one column"); an empty column asks "Delete the X column? It holds no issues."; a refused delete says "The column could not be deleted. Pick where its issues go and try again."; the move target defaults to the nearest column | BoardSettings.jsx:93-175 | ProjectSettings: delete button per column; no panel | RESTYLED | Extends PROJ-186 (added by review) |
| PROJ-233 | Quick search: results ranked (key typed in full, projects, key prefix, title words; open before done), at most 8, empty line "No issues or projects match “q”." | workspaceSearch.js:15-46; TopBar.jsx:153-154 | ShellMenus: results grouped, no empty line, no Projects group | MISSING | Draw the empty line; Projects group as PROJ-207 (added by review) |
| PROJ-234 | A page that crashes takes only itself down (error boundary per path); the shell keeps its scroll position per page (new page at the top, Back returns to the old offset) | WorkspaceLayout.jsx:72,122; useScrollMemory.js | Invisible | SAME | Keep (added by review) |
| PROJ-235 | Field limits: project name 80, key 2-10 (letter first), issue summary 255, column name 60, WIP limit a whole number from 1, each issue keeps its newest 200 history entries | CreateProjectDialog.jsx:42; CreateIssueDialog.jsx:124; BoardColumn.jsx:97; boardOps.js:25; constants/boards.js:44 | Invisible | SAME | Keep the limits and their messages (added by review) |
| PROJ-236 | Phone versions of the project views: List with Type / Labels / Parent / Points / Updated hidden below sm, Calendar grid panning in its own scroller under fixed controls, Timeline 10rem name column, Backlog, Summary, Settings, the issue view and the Projects landing | ProjectList.jsx:23; ProjectCalendar.jsx:48-61; ProjectTimeline.jsx:111-113; tests dph-* | Only MobileProject (Board) is drawn | MISSING | Draw (or declare as the desktop layouts reflowed) every other project view on a phone; see PROJ-017 (added by review) |

### K. Still open after review

- `src/utils/boardTransfer.js` (export and import of projects as a JSON file) still has no caller in `src` (grep: only a comment in `normalizeBoard.js`); it is not a reachable live function, so it has no row. The owner decides whether to expose it.
- The canvas "Plan" tab appears on the ProjectBacklog artboard only, yet the project there is the same Kanban "Personal & Projects" that Projects lists as Kanban: the Plan / Scrum rule is not self-consistent in the canvas (PROJ-044).
