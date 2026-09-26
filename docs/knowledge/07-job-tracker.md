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
- `clearDemoData` ("Clear all jobs and start fresh?") empties the list  

## Detail tabs / widgets

Under `src/components/job/`:

| Component | Role |
|-----------|------|
| `OverviewTab` | Core fields, edited in place: company and role (not both blank), deadline, follow-up date, work mode, source, résumé |
| `NotesTab` | Freeform notes |
| `TasksTab` / `TodoItem` | Checklist todos |
| `Pipeline` | Visual pipeline |
| `StatusBadge` / `StatusHistory` | Status UI + audit trail |
| `InterviewStageSelector` | Stage controls |
| `Field` | Form field helper |
| `ImportNotice` / `JobsNotSavedAlert` | What an import did; a list storage refused |

## Status model

From `constants/jobs.js`: Saved → Applied → Phone Screen → Interview → Offer, plus On Hold / Rejected / Withdrawn.

Changing status appends to `statusHistory`.

## Resume linkage

Jobs may store `resumeId` pointing at a resume in `cpwtcv_v1`. Tracker can show resume names via `useAppStore().appState.resumes`.

## Persistence limits

- No Firestore sync  
- Demo Google job seeded for first-time UX (`demoJobs`, `utils/jobEdits.js`)  
- Multi-tab: another tab's save is taken in through the `storage` event, keeping what this tab has not saved (`utils/unsavedJobs.js`)  
- Job form (`JobForm.jsx`): with changes, Cancel and ← ask "Discard your changes?" and closing the tab is guarded (`beforeunload`). The plain HashRouter cannot hold the browser's Back or a link, so the changed values are kept in sessionStorage (`jobform:new` / `jobform:<id>`) and restored on return with a "Restored your unsaved changes" line and Discard; Save and Discard clear the draft  

## Future ideas (not implemented)

- Sync jobs under `users/{uid}/jobs`  
- Calendar/deadline reminders  
- Attach cover letter snapshot per application  
- Browser extension for “Save job from LinkedIn”
