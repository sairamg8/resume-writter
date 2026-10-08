# B11 report: workspace shell on the canvas look

Files: `src/components/shell/{TopBar,Sidebar,SidebarContent,WorkspaceLayout,PageHeader}.jsx` (restyled with the `cv-*` tokens); CollectionSyncDot, projectViews and projects needed no change (the sync dot is AuthBar's SyncDot, which draws it).

## Done
- The top bar is now the shared `AppBar` (brand, Documents / Applications / Projects, account); the Create button, quick search, "Switch project" menu (recent projects, Your work, View all, Create project), menu button (phones), sync dot, shortcuts help and AuthBar sit in its slots. `c`, `/`, `?`, `[` all stay.
- Search results are grouped: an "Issues" and a "Projects" heading in the list (the heading rows are not options; order and keyboard behaviour unchanged).
- The workspace shows the phone `BottomTabBar`; `<main>` gets 72 px bottom padding below md.
- Sidebar (kept, restyled), drawer, PageHeader, skip link, search panel: old blue/gray/white/shadow-xl classes swapped for cv tokens. Nothing new imported into start-up files (AppBar and BottomTabBar are already in the start-up chunk through Dashboard).

## Parked (on the canvas, absent in the live app)
- A separate "Your work" and "Job Tracker" link row in the top bar (the AppBar's three areas replace it; Your work is in the switcher menu and the sidebar).
- Project switcher as a popover with search/starred groups and the recent-project avatars.
- Per-type grouped search with "see all results" footers and recent searches.
- Create as a split menu (issue / project / job).
