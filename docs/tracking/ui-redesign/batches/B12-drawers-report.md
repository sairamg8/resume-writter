# B12 drawers report: Applications and Projects drawers, dialogs, forms

Scope: pages JobDetail, JobForm, JobTracker, YourWork, ProjectSummary, ProjectList, ProjectCalendar, ProjectTimeline, Backlog, Board, BoardSettings, Boards and the components they render (components/job, tracker, board, CareerHistoryPanel).

## Done
- The job and board pages and components were already on the `cv-*` tokens (B12 to B16, see B5b-B10-report.md); a grep for bg-gray, bg-blue, text-gray, #f5f3ef, shadow-xl, border-gray finds nothing in the owned files.
- ProjectSummary, ProjectList, ProjectCalendar and ProjectTimeline still used the older token names and `bg-white`; they now use bg-cv-surface, border-cv-hairline, text-cv-ink / cv-muted / cv-faint, text-cv-brand-text, bg-cv-brand, bg-cv-stage (hover), bg-cv-sunken and rounded-cv-control. `border-line-subtle` is kept (no cv equivalent is defined). Pins updated in 103-r4-dph-01 and 103-r4-dvis-20.

## PARKED (drawn on the canvas, not in the live app, not built)
- Issue drawer "More details" disclosure regrouping of properties (the live IssueDialog keeps all fields visible).
- Weeks / Months switch on the Timeline.
- Single Filter button with a count on the board toolbar (live toolbar keeps its separate controls).
- Simplified Summary (one stat strip, donut, "More charts" disclosure); the live Summary keeps all charts.
- Job Add modal restructured with "More details" (the live JobForm keeps its long form).
- Insights page simplification and "Next steps" merged list.
The canvas files themselves (Jobs.dc.html and the boards) were not available in the worktree, so drawer layouts were not compared pixel by pixel.
