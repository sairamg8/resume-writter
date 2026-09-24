# 03 · Job Tracker — fixes first, then the redesign

Existing data stays readable: key `cpwtcv_jobs_v1`, `JOB_VERSION` 2 today. New fields are optional and the
normaliser (`normalizeJob.js`) repairs/defaults them — **no data-version bump that would re-add the demo job or
strip user jobs**; if a bump is truly needed, migrate without touching user jobs (read
`progress_sloppy-fixes-2026-09-23.md` in the store: clamping `dataVersion` was the wrong fix once already).

## JOBS-FIX (logic, step 1c)

Every verified `J-xx` logic bug in `boards-jobs-bugs/` (and the R2 rows linked there), fail-first. Pure logic
moves out of JSX into `src/utils/jobQuery.js` so it is testable: `filterJobs(jobs, {q, statuses})`,
`sortJobs(jobs, key, dir)` (status in **pipeline order**, dates as dates, salary by its first number, text by
`localeCompare` with `sensitivity: 'base'`), `jobStats(jobs, now)` (definitions below), `daysSince(iso, now)`.
Also here: the job-form save path (edit of a deleted job must not silently vanish; save must not write a stale
copy of the whole job over to-dos/history another tab added — write only the fields the form edits), status
history integrity, default `appliedDate` only when the status is past `saved` (and auto-fill today when a job
first moves to `applied` with none), CSV (UTF-8 BOM, formula-injection neutralised, notes as plain text), import
(`reader.onerror`, non-array, duplicate ids), one notes format (rich text everywhere; the form uses
`RichTextEditor`, plain text legacy notes converted with `plainTextToHtml`).

**Stats (definitions, in `jobStats`)** — Total; **Active** = saved/applied/phone_screen/interview (not offer,
on hold, rejected, withdrawn); **Interviewing** = phone_screen + interview; **Offers**; **Response rate** = of
jobs that reached `applied` (per `statusHistory`), the share that later reached phone_screen/interview/offer or
rejected; **Follow-ups due** = open jobs whose `followUpDate` ≤ today.

## New optional fields (normaliser + form + detail + CSV)

`followUpDate` ('YYYY-MM-DD'), `source` ('linkedin'|'company'|'referral'|'recruiter'|'board'|'other'|''),
`workMode` ('remote'|'hybrid'|'onsite'|''), `excitement` (0–5), `salaryMin`/`salaryMax`? — **no**: keep the free
`salary` text (users write "$150k – $200k", "₹30 LPA"); `interviews: [{ id, date, time, kind, notes }]`
(kind from the stage list) — should, not must.

## JOBS-UI (redesign, step 2b)

**Tracker** (`/jobs`, inside the shell): `PageHeader` "Job Tracker" + subtitle; actions: **Add job** (primary),
⋯ Menu (Import JSON, Export JSON, Export CSV, separator, Clear all… with ConfirmDialog stating the count).
**KPI row**: stat cards (Total, Active, Interviewing, Offers, Response rate %, Follow-ups due) — each clickable
to filter. **Toolbar**: SearchInput (`/`), Status MultiSelectPopover (counts per status), Sort Menu, view
SegmentedControl Board | Table; all four in the URL (`useUrlState`), so Back/refresh keep them; "N results ·
Clear filters" when filtered.
**Board view**: pipeline columns Saved · Applied · Phone screen · Interview · Offer at comfortable width
(272 px), plus the closed statuses (On hold, Rejected, Withdrawn) as **collapsed rails** (vertical label +
count; click expands; state remembered). Cards reorder within a column and move across (array order = rank;
`useJobStore.moveJob(id, { status, beforeId })`), dnd-kit Mouse + Touch (press-and-hold) + **Keyboard** sensors,
live preview, drop animation. Moving to a new status records history (the store already does) and shows a
toast with Undo.
**Job card**: `Avatar` (company initial), company, role, meta (location · work mode), salary, "Applied 5d ago",
follow-up / deadline `DatePill`, stage chip, tasks `2/5` bar, excitement dots. `tabIndex=0`, Enter opens,
⋯ Menu (Open, Edit, Move to ▸, Open posting, Delete). The posting link never also opens the job.
**Table view**: sticky header, sortable columns (Company, Role, Status, Applied, Follow-up/Deadline, Salary,
Updated), row click opens, ⋯ row menu; **below `md` it renders as a card list** (no sideways-scrolling table).
**Empty states**: no jobs at all ("Track your first application" + Add job + Import) vs filtered to nothing
("No applications match" + Clear filters).
**Career history panel**: moves into a collapsible right-hand "Insights" aside on ≥ xl (funnel: applied →
screen → interview → offer counts with conversion %, plus the existing career history), below the board on
smaller screens — styling only in `CareerHistoryPanel.jsx`.
**Job detail** (`/jobs/:id`, `?tab=`): header card — Avatar, company, role (InlineEdit), status `Select`
(pipeline + closed statuses), actions (Open posting, Edit, ⋯ Delete via ConfirmDialog). Two columns on ≥ lg:
main = Tabs **Overview | Tasks | Notes | Activity** (Overview: Pipeline stepper restyled + fields grid with
InlineEdit — company, role, location, work mode, salary, source, URL, contact, résumé used — and interviews
list); aside = Key dates (applied, deadline, follow-up — editable DatePills), Résumé used (link; a deleted
résumé shows "Résumé deleted" + unlink), Excitement, Status history timeline (On Hold later closed is not
"reopened"). Default tab Overview. No global W/R counters on a single job's page.
**Job form** (`/jobs/new`, `/jobs/:id/edit`): the same sections restyled with kit fields, notes via
RichTextEditor, validation message instead of a silently disabled button, unsaved-changes guard on Cancel/Back
(ConfirmDialog), Cmd/Ctrl+Enter saves. Unknown id on `/edit` → "Job not found" state, not an empty form.

## Tests

Fail-first node tests per logic fix (`tests/unit/job-*.unit.mjs`, extend `normalize-job.unit.mjs`,
`job-csv.unit.mjs`); `tests/unit/job-query.unit.mjs` for filters/sort/stats with a fixed `now`. Existing tests
stay green (`tests/pdf/34-job-store-ids`, `54-job-form-null-crash`, `unit/job-*`). Cypress `06-job-tracker.cy.js`
and `20-regressions-job-*.cy.js` are updated for the new selectors — written, not run.
