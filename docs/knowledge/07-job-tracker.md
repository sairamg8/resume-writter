# 07 — Job Tracker

## Purpose

Help users track applications alongside tailored resumes — a differentiator vs pure resume builders.

## Routes

| Path | Component |
|------|-----------|
| `#/jobs` | `JobTracker.jsx` |
| `#/jobs/new` | `JobForm.jsx` |
| `#/jobs/:id` | `JobDetail.jsx` |
| `#/jobs/:id/edit` | `JobForm.jsx` |

## Views

- **Kanban:** `components/job/KanbanView.jsx` columns by status  
- **List:** `components/job/ListView.jsx`  
- Search + status filter on tracker page  
- Import/export jobs as JSON, export as CSV (`utils/jobCsv.js`)  
- An imported job's Applied / Deadline / Follow-up days are made 'YYYY-MM-DD' when readable: a timestamp, "15 Jan 2026", "Jan 15, 2026", "January 15 2026", "2026/1/15" (`jobDay`, `src/utils/normalizeJob.js`); an unreadable or ambiguous one ('next week', '10/15/2026') stays as written, and the Summary's "Upcoming deadlines" leaves such a deadline out (`isDeadlineUpcoming`, `src/utils/jobQuery.js`)  
- ⋯ → "Clear all jobs" (disabled with none) asks with the count, `clearDemoData` empties the list and returns it, and the "N jobs cleared" toast's Undo puts it back (`restoreJobs`; the sync sends them again, R4-DUX-02)  

## Detail tabs / widgets

Under `src/components/job/`:

| Component | Role |
|-----------|------|
| `OverviewTab` | Core fields, edited in place: company and role (not both blank), deadline, follow-up date, work mode, source, résumé |
| `NotesTab` | Freeform notes |
| `TasksTab` / `TodoItem` | Checklist todos; double-click renames a task, and a box left untouched writes nothing, so another tab's newer rename stays (R5-HUNT9) |
| `Pipeline` | Visual pipeline |
| `StatusBadge` / `StatusHistory` | Status UI + audit trail |
| `InterviewStageSelector` | Stage controls |
| `Field` | Form field helper |
| `ImportNotice` / `JobsNotSavedAlert` | What an import did; a list storage refused |

## Status model

From `constants/jobs.js`: Saved → Applied → Phone Screen → Interview → Offer, plus On Hold / Rejected / Withdrawn.

Changing status appends to `statusHistory`. A move on the board (drag or "Move to"), the job page's stepper or its status menu goes through the store's `changeStatus` and shows a toast with Undo: `undoStatus` puts the status, the history and an applied date the move filled in back as they were (`undoStatusChange`, `utils/jobEdits.js`, R5-HUNT7).

## Resume linkage

Jobs may store `resumeId` pointing at a resume in `cpwtcv_v1`. Tracker can show resume names via `useAppStore().appState.resumes`.

## Persistence limits

- No Firestore sync  
- Demo Google job seeded for first-time UX (`demoJobs`, `utils/jobEdits.js`)  
- Multi-tab: another tab's save is taken in through the `storage` event, keeping what this tab has not saved (`utils/unsavedJobs.js`)  
- Job form (`JobForm.jsx`): under the workspace's `PageHeader` (Job Tracker › the job › Add / Edit job application). With changes, every way out asks "Discard your changes?" (Keep editing / Discard): Cancel, ←, the breadcrumbs, the sidebar and top bar, quick search and the browser's Back (`useBlocker` in `LeaveGuard`, on the data router main.jsx mounts); Save and Add Job do not ask. Closing the tab is guarded (`beforeunload`), and for a reload or a crash the changed values are kept in sessionStorage (`jobform:new` / `jobform:<id>`) and restored on return with a "Restored your unsaved changes" line and Discard; Save and Discard clear the draft  

## Future ideas (not implemented)

- Sync jobs under `users/{uid}/jobs`  
- Calendar/deadline reminders  
- Attach cover letter snapshot per application  
- Browser extension for “Save job from LinkedIn”
