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
- Import/export jobs as JSON  
- `clearDemoData` for removing seed demos  

## Detail tabs / widgets

Under `src/components/job/`:

| Component | Role |
|-----------|------|
| `OverviewTab` | Core fields summary |
| `NotesTab` | Freeform notes |
| `TasksTab` / `TodoItem` | Checklist todos |
| `Pipeline` | Visual pipeline |
| `StatusBadge` / `StatusHistory` | Status UI + audit trail |
| `InterviewStageSelector` | Stage controls |
| `Field` | Form field helper |

Also: `JobModal.jsx` at components root for modal flows.

## Status model

From `constants/jobs.js`: Saved → Applied → Phone Screen → Interview → Offer, plus On Hold / Rejected / Withdrawn.

Changing status appends to `statusHistory`.

## Resume linkage

Jobs may store `resumeId` pointing at a resume in `cpwtcv_v1`. Tracker can show resume names via `useAppStore().appState.resumes`.

## Persistence limits

- No Firestore sync  
- Demo Google job seeded for first-time UX  
- Multi-tab: last write to localStorage wins  

## Future ideas (not implemented)

- Sync jobs under `users/{uid}/jobs`  
- Calendar/deadline reminders  
- Attach cover letter snapshot per application  
- Browser extension for “Save job from LinkedIn”
