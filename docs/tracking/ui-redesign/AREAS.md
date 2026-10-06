# The five drawing areas (about 25 artboards still to draw)

Each is one agent's job (see README.md step 3). Names are the artboard file names (`<Name>.dc.html`); every desktop one is a PAGE 1440 wide
with the unified top bar (active nav link as noted); phone ones are fixed 390x844 with the bottom tab bar (Documents / Applications /
Projects) as in `MobileHome.dc.html`. Source files to read are under `src/`; live screenshots from `tools/crawl*.mjs`.

## A1 editor-extras (editor-based: use the Editor's own top bar and the left panel / stage / drawer structure of `Editor.dc.html`)
1. EditorPersonal: Resume tab, Personal info card OPEN: photo (round upload), full name, job title, email, phone, location, links (+ Add link),
   summary with an Improve button, an eye per optional field; "Header look" disclosure OPEN (alignment left/center, contacts icons/dots/bars,
   photo shape). Sources: PersonalInfoEditor*.jsx, HeaderIconPickerModal.jsx.
2. EditorDownload: the Download PDF split-button menu OPEN: Download PDF (ATS-safe note), Word, Plain text for application forms, Markdown,
   JSON backup (restores everything), JSON Resume; plus Copy plain text. Sources: ExportDropdown.jsx, hooks/useEditorExports.js.
3. EditorShare: Share modal over the editor: link on/off, link field + Copy, "Published 2 min ago, updates as you edit", Stop sharing, what is public.
   Source: ShareLinkModal.jsx (read it for the real options).
4. EditorTemplates: template gallery modal (wide): filter chips, 8 templates drawn with `Paper` imports, current one marked, "My designs" row,
   Cancel / Use template, note that content is kept. Sources: TemplateGallery.jsx, constants/templatePresets.js.
5. EditorImprove: a highlight focused with an "Improve" popover: the bullet, three suggestions (stronger verb, add a number, shorter) with Apply,
   a strength line (verb ok, number ok, words), an Undo toast. Sources: BulletOptimizerModal.jsx, utils/bulletOptimizer.js.
6. EditorDraft: Cover letter tab with the "Draft from my résumé" modal: job posting (paste or pick an application), recipient, tone (Warm / Direct /
   Formal), length, preview, Apply (with Undo) / Cancel. Source: CoverLetterGeneratorModal.jsx.

## A2 projects-core (nav: Projects)
1. Projects: area landing = "Your work" (to-do list grouped Due today / This week with checkbox, project chip, due chip, priority) beside Recent
   projects cards; header "Projects" with primary New project and a small All projects table/cards. Sources: YourWork.jsx, Boards.jsx.
2. ProjectBoard: in-page project header (breadcrumb, colour tile, name, key chip LIFE, star, ... menu), view tabs [Board List Calendar Timeline
   Summary], toolbar (search, one Filter button with a count, Due this week chip, Group by), 4 columns (Inbox, This week, Today with WIP chip,
   Done) with compact cards (title, label chip, key, due chip, priority, checklist, comments), + Add task, + add column.
   Sources: Board.jsx, IssueCard.jsx, BoardColumn.jsx.
3. ProjectList: same header, List tab, rows (checkbox, key, title, status chip, priority, due, label), Add task row. Source: ProjectList.jsx.
4. ProjectIssue: board dimmed + right drawer (about 520 wide): title, status chip, checklist, description, ONE compact properties block (priority,
   due, labels) + "More details" disclosure (type, group/epic, story points, start date, repeats), Comments / History tabs. Sources: IssueDialog.jsx,
   IssueDetails.jsx, IssueFields.jsx, IssueActivity.jsx.
5. ProjectSettings: name, key, description, colour, way of working (Kanban / Scrum), columns (name, kind, WIP, reorder, delete) with an Advanced
   disclosure, Delete project. Source: BoardSettings.jsx.

## A3 projects-views (nav: Projects)
1. ProjectCalendar: month grid with task chips, month nav + Today, a "No due date" rail. Source: ProjectCalendar.jsx.
2. ProjectTimeline: gantt (task names left, day scale right, bars, today line, group rows, Weeks / Months). Source: ProjectTimeline.jsx.
3. ProjectSummary: ONE stat strip, status donut (conic-gradient div) with legend, Due soon list, Recent activity (5), "More charts" disclosure.
   Source: ProjectSummary.jsx.
4. ProjectBacklog: the Plan view with sprints ON: active sprint block with Complete sprint, Backlog block, drag handles, a Groups (epics) toggle.
   Sources: Backlog.jsx, components/board/BacklogParts.jsx.
5. MobileProject (phone): project header, view tabs scroller, a column switcher (Inbox 3 / This week 2 / Today 2 / Done 2), cards, floating New task,
   bottom tab bar.

## A4 applications (nav: Applications; `Jobs.dc.html` is the board + drawer, already drawn)
1. JobsList: header + view switch [Board List Insights], toolbar (search, Filter, sort), table (company + role, status chip, applied, next step or
   deadline, résumé used, tasks 2/4, ...). Sources: JobTracker.jsx, components/job/ListView.jsx.
2. JobAdd: "Add job" modal over the board: Company, Role, Posting link, Status, Applied date, Résumé used; "More details" OPEN (location, salary, work
   mode, source, deadline, follow-up, contact, notes). Source: JobForm.jsx (the long form it replaces).
3. JobsInsights: the Summary page simplified: stat strip (active, interviewing, offers, response rate), pipeline funnel (div bars), Next steps (deadlines
   + follow-ups in one list), compact Career history card. Sources: components/job/JobSummary.jsx, tracker/Charts.jsx.
4. MobileJobs (phone): stage chips (Saved 2, Applied 3, Interviewing 1, Offer 1, Closed 1), cards, floating Add job, bottom tab bar.

## A5 shell-and-states (nav as noted)
1. ShellMenus: 1440x720 sheet: top bar with the avatar menu OPEN (name, email, "Cloud sync on, saved 1 min ago", Sign out); the signed-out prompt
   (Sign in with Google to back up and sync); the global search palette (query "ver": Documents / Applications / Tasks groups, keyboard hints).
   Sources: AuthBar.jsx, components/shell/TopBar.jsx.
2. Empty: Documents first run: "Make your first résumé" with the three start options (template, import, blank) and a note that everything stays in
   this browser until sign-in. Source: pages/Dashboard.jsx (empty state).
3. ImportModal: "Import a file" over Documents: drop zone, accepted types (PDF, Word, Markdown, text, JSON backup, JSON Resume), best-effort notice.
   Sources: ImportMenu.jsx, utils/importDocument.js.
4. Public: the shared résumé page (#/r/id): slim bar with "Made with CPWT-CV" + Download PDF, the paper centred large. Source: pages/PublicResume.jsx.
5. Legal: Terms / Privacy as one readable page (max 680 px column, side table of contents, last updated), shell with no active nav. Sources:
   pages/TermsPage.jsx, pages/PrivacyPage.jsx (use the real headings).
6. States: a sheet of reusable states: toast with Undo, confirm-delete dialog, empty Applications, empty Projects, sync chips (Saved, Saving, Offline,
   Sync paused), inline storage-full error banner.

## Canvas layout for the new rows (existing rows are at y = 0, 1280, 2560, 3840, 5120, 6344)
Add rows below y = 8000, one row per area, a `title1` note 260 px above each, 380 px between rows; or insert a "Projects" row after "Applications" and
move the later rows down (then send the index with every key kept).
