# r4-dsg-layout — findings so far (work in progress, NOT the cluster report)

Session session_01K2dRPYe8fZU5xwrczhag7U, branch `claude/wf-r4-dsg-layout`, base 94b4d9b. Written 2026-09-26 ~14:00 UTC
after the usage limit cut the finder stage short. Nothing is fixed yet. Every row below comes from one read-only
finder agent and is **not yet confirmed by a second agent** (the brief's step before a fix). IDs are provisional.

## Finder status
| Finder | Scope | Status |
|---|---|---|
| boards/shell phone | Boards, Board, Backlog, Settings, List/Summary/Timeline/Calendar, YourWork, board/**, shell/** | done |
| jobs + kit overlays phone | JobTracker, JobDetail, JobForm, job/**, ui/** dialogs, popovers, toasts, tabs | done |
| desktop/tablet consistency | headers, toolbars, kit vs one-off controls on every page | done |
| résumé side phone | Dashboard, Editor, NewResume, PublicResume, Terms/Privacy, src/components/*.jsx and their modals | **crashed at the usage limit — rerun** |

Kit guarantees the finders checked and found sound at 375 px: `<main>` is `overflow-x-hidden` (no page-level sideways
scroll: overflow is clipped instead); placement.js clamps popovers/menus to the viewport; Dialog fits (max-h, scrolling
body, large sizes full-screen below sm); kit fields are 16 px on touch; Toast, Tooltip, Tabs/NavTabs, Kanban and the job
ListView scroll inside their own boxes.

## Phone (≤ 640 px) — R4-DPH
| ID | Sev | Finding | Where | Fix idea |
|---|---|---|---|---|
| DPH-01 | high | Timeline's sticky name column is `w-80` (320 px): ~23 px left for the day grid | pages/ProjectTimeline.jsx:46,111,123 (today line hard-codes 320) | CSS var `--name-w` 9rem / sm:20rem, used by both cells and the today line |
| DPH-02 | high | Job Summary grid blows out: `truncate` rows in an `auto` grid track widen the column, card right sides clipped | pages/JobTracker.jsx:154, job/JobSummary.jsx:72 | `grid-cols-1` (minmax(0,1fr)) or `min-w-0` on the items |
| DPH-03 | high | A task with a URL/long word pushes its delete X off-screen (clipped, undeletable) | job/TodoItem.jsx:47 | `min-w-0 break-words [overflow-wrap:anywhere]` (as job/Field.jsx J-12) |
| DPH-04 | high | Top-bar QuickSearch is `hidden sm:block`, no phone alternative | shell/TopBar.jsx:73 | `sm:hidden` search IconButton opening the same combobox full width |
| DPH-05 | med | Calendar is a `min-w-[48rem]` grid; its Today/‹ › row scrolls away with it | pages/ProjectCalendar.jsx:49,56 | controls row outside the scroller; phone agenda or compact cells |
| DPH-06 | med | Board page chrome (header + wrapping toolbar) leaves ~200–300 px for columns | pages/Board.jsx:197,247, board/BoardToolbar.jsx:54 | filters behind one "Filters" button below md, or let chrome scroll on phones |
| DPH-07 | med | PageHeader is sticky on phones: ~160–230 px pinned | shell/PageHeader.jsx:42 | `max-md:static` (or only tabs sticky) |
| DPH-08 | med | Projects table `min-w-[48rem]`: ⋯ menu off-screen | pages/Boards.jsx:54 | `hidden sm:table-cell` on Key/Type/Lead/Updated, `sm:min-w-[48rem]` |
| DPH-09 | med | Project List table `min-w-[64rem]`: status control ~410 px in | pages/ProjectList.jsx:18-29,72 | hide Labels/Parent/Points/Updated below sm |
| DPH-10 | med | InlineCreate row variant squeezes the textarea to ~100 px | board/InlineCreate.jsx:44,64 | `sm:flex-row sm:items-center` (stack on phones) |
| DPH-11 | med | iOS zoom (fields < 16 px on touch) across boards | Board.jsx:41; InlineCreate.jsx:61; IssueChecklist.jsx:52,80; IssueActivity.jsx:66; IssueFields.jsx:195,230; BoardSettings.jsx:12,117; Backlog.jsx:147; TopBar.jsx:89 | `pointer-coarse:text-base` (InlineEdit via `inputClassName`) |
| DPH-12 | med | Job stage stepper labels collide ("Phone Screen"), connectors vanish | job/Pipeline.jsx:116-141 | only the active label below sm, or wrapping labels |
| DPH-13 | med | "Mark as: On Hold / Rejected / Withdrawn" row cannot wrap, spills into padding | job/Pipeline.jsx:164 | `flex-wrap`, `whitespace-nowrap` pills |
| DPH-14 | med | Overview "Resume Used" select overflows with a long résumé name | job/OverviewTab.jsx:150 (and :28) | `min-w-0` |
| DPH-15 | med | Kit Select has no `min-w-0`: long option overflows dialogs (CreateIssueDialog project) | ui/Select.jsx:278-292 | `min-w-0` in the kit |
| DPH-16 | med | JobForm sticky header ~483 px of content in 375: title/buttons wrap | pages/JobForm.jsx:88-95 | PageHeader (see DVIS-01) or `px-4 sm:px-6`, truncate, nowrap |
| DPH-17 | low | Column-delete strip: long column title pushes the select past the card | pages/BoardSettings.jsx:115-117 | `flex-wrap`, `min-w-0 max-w-full` |
| DPH-18 | low | Calendar controls row cannot wrap; note wraps to 3–4 lines | pages/ProjectCalendar.jsx:49-54 | `flex-wrap`, note `basis-full sm:basis-auto` |
| DPH-19 | low | Interview Stage header cramped; long custom stage overflows | job/InterviewStageSelector.jsx:19-26 | `flex-wrap`, `p-4 sm:p-6`, `break-words` |
| DPH-20 | low | `p-6` on phones where siblings use `p-4 sm:p-6` | JobForm.jsx:208, job/NotesTab.jsx:5 | `p-4 sm:p-6` |
| DPH-21 | low | Summary funnel bar column only ~69 px | job/JobSummary.jsx:76 | narrower label column below sm |

All widths, noted by the boards finder: BacklogParts.jsx:64 issue key `w-16` with no truncate overlaps the summary;
Backlog.jsx:147 sprint-name InlineEdit always drops to its own line.

## Desktop / tablet consistency — R4-DVIS
| ID | Sev | Finding | Where | Should match |
|---|---|---|---|---|
| DVIS-01 | med | JobForm header hand-built (16 px title, centred 768 px column, no breadcrumbs) | pages/JobForm.jsx:86-98 | shell/PageHeader as JobDetail/JobTracker |
| DVIS-02 | med | JobForm buttons hand-rolled, top and bottom pairs differ | JobForm.jsx:92-94, 212-216 | ui/Button |
| DVIS-03 | med | JobForm inputs hand-rolled (40 px, ring-2) | JobForm.jsx:27 | TextField/Select/controlClass |
| DVIS-04 | med | Job Tracker / JobDetail tabs hand-rolled (14 px, underline 1 px high) | JobTracker.jsx:39-42, JobDetail.jsx:100-111 | ui/Tabs tabClass / TabCount |
| DVIS-05 | med | BoardSettings content is a centred max-w-3xl column under a full-width header | pages/BoardSettings.jsx:210-213 | `px-4 md:px-8` like sibling views |
| DVIS-06 | med | BoardSettings controls hand-rolled next to a kit Button | BoardSettings.jsx:12,68,109-121,147,262 | Button / IconButton / controlClass |
| DVIS-07 | med | BulletOptimizerModal hand-built dialog (blur, rounded-2xl); NewLetterModal, ShareLinkModal too | BulletOptimizerModal.jsx:67-77, NewLetterModal.jsx:18-35, ShareLinkModal.jsx:77-87 | ui/Dialog |
| DVIS-08 | med | JobDetail "Posting" link hand-rolled beside kit Buttons | JobDetail.jsx:87-89 | `buttonClass()` |
| DVIS-09 | med | Overview/Tasks labels and controls hand-rolled (10 px uppercase labels) | job/OverviewTab.jsx:21-28,110-157, job/TasksTab.jsx:40-57 | kit Field label, TextField, Button |
| DVIS-10 | low | Kanban/List delete buttons hand-rolled beside IconButton | job/KanbanView.jsx:96-104, job/ListView.jsx:152-158 | IconButton sm |
| DVIS-11 | low | Backlog "Epic panel" toggle shows no pressed state | pages/Backlog.jsx:112 | BoardToolbar active filter style |
| DVIS-12 | low | Editor mode tabs may overflow at the 240–360 px panel width (unconfirmed estimate) | EditorHeader.jsx:95-121 | truncate labels / container query |
| DVIS-13 | low | NewResume hand-rolled select; max-w-6xl vs Dashboard's max-w-7xl | pages/NewResume.jsx:51,64,79-84 | ui/Select, max-w-7xl |
| DVIS-14 | low | Dashboard button says "Boards", the shell calls it "Projects"; different logo mark | pages/Dashboard.jsx:163-192 | SidebarContent/TopBar |
| DVIS-15 | low | TopBar search hand-rolled beside kit SearchInputs | shell/TopBar.jsx:89-91 | controlClass + Kbd |

## Next steps
1. Rerun the résumé-side phone finder (it crashed).
2. Second-agent confirmation of every row above; drop what does not hold; renumber by severity.
3. Fix each with a test that fails without it (`failfirst` on CI), second-agent review, oxlint.
4. Merge the latest claude/awesome-cerf-t3sh88, full gate, then `wf-reports/r4-dsg-layout.json`.
