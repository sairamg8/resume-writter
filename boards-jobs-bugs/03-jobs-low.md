---
title: Job Tracker — verified bugs, Low (J-16…J-41)
---

# Job Tracker — verified bugs, Low (J-16…J-41)

> Part of [README.md](README.md). Status: 🔴 open · ⏸ fixed on `boards-jobs-ui` (not merged) · ✅ merged to master · ✖ not a bug.
> Set the row (status + commit + test) in the SAME commit as the fix. Found by WF-1 `wf_a523cc8e-2ca` at `8409472`, 2026-09-23.

### J-16 · Low · data-loss · 🔴 Open · links **R2-075**
**/jobs/:id/edit for an unknown or deleted job shows an editable form whose Save discards the input without a message**
- **Where:** `src/pages/JobForm.jsx` : 34-35, 55-58
- **Repro:** 1. Visit /#/jobs/nope/edit. 2. Fill in Company and Role and click Save Changes. 3. 'Job not found.' appears, and what was typed is gone. The same happens when another tab deletes the job while its edit form is open.
- **Expected:** A not-found state instead of the form, or, on save, an offer to keep the input as a new job. **Actual:** The form accepts input and then throws it away.
- **Fix hint:** When isEdit && !existing, render the not-found view. In handleSave, check again that the job exists and offer 'Save as new job'.
- **Verified (WF-1):** Read the code: isEdit comes from the URL param alone (34), and existing is undefined for an unknown id. Ran verify-jobs/v-store.mjs: updateJob('nope', {...}) left storage as ['Acme'] with no 'nope' job. The navigate at 57 then lands on JobDetail's 'Job not found.' view (JobDetail.jsx:28-38).
- **Fail-first test:** Store test: updateJob('missing', {...}) returns false (or reports not found). Cypress: /#/jobs/nope/edit shows a not-found state and no inputs.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-17 · Low · security · 🔴 Open · links **R2-102**
**CSV export does not neutralise formula cells (CSV/formula injection)**
- **Where:** `src/utils/jobCsv.js` : 8-12
- **Repro:** 1. Import a job JSON whose company is '=HYPERLINK("http://evil.example","Click")', or type it. 2. Export CSV and open the file in Excel or Sheets: the cell is evaluated as a formula or link.
- **Expected:** The value is shown as text. **Actual:** The spreadsheet evaluates it.
- **Fix hint:** In escapeCsvField, when /^[=+\-@\t\r]/ matches, prefix a single quote before quoting.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs: the row was written as "=HYPERLINK(""http://evil.example"",""Click"")","+SUM(1,1)", unchanged apart from the quote doubling.
- **Fail-first test:** job-csv.unit.mjs: escapeCsvField('=1+1') === "\"'=1+1\"", and the same for values starting with +, -, @, \t and \r.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-18 · Low · bug · 🔴 Open
**List view sorts every column as text: Status by internal id, Salary as a string, and blank dates first**
- **Where:** `src/components/job/ListView.jsx` : 13-23
- **Repro:** 1. On /jobs switch to List view. 2. Click Status: Phone Screen sorts after Offer and On Hold. 3. Click Salary: $90k sorts above $180k. 4. Click Deadline: rows without a deadline come first. 5. After clicking any header, the default order (last updated) cannot be chosen again.
- **Expected:** Status in pipeline order, salary by numeric value, blanks last in both directions, and a way back to the default order. **Actual:** Text order for every column.
- **Fix hint:** Give each column its own comparator: status by its JOB_STATUSES index, dates with blanks last, salary by the first number parsed (with k/m suffixes). Add an 'Updated' column or sort option.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs with the comparator copied verbatim from ListView.jsx:19-23. Status ascending gave 'applied < interview < offer < on_hold < phone_screen < rejected < saved < withdrawn'. Salary ascending gave '"" < "$120,000" < "$180k – $250k" < "$90k"'. Deadline ascending put "" first.
- **Fail-first test:** Extract the comparator to src/utils/jobSort.js. Test status in JOB_STATUSES order, blanks last in both directions, and $90k < $120,000 < $180k.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-19 · Low · bug · 🔴 Open
**Imported status history and to-dos are not normalised like the job: wrong rejection count, no 'Current', 'Invalid Date', and done:'false' counted as done**
- **Where:** `src/utils/normalizeJob.js` : 42-48, 66-70, 122-125 (rendered by src/components/job/StatusHistory.jsx:15, 42-43, 62, 77-79)
- **Repro:** 1. Import [{"company":"X","status":"Rejected","statusHistory":[{"status":"Applied","changedAt":"yesterday"},{"status":"Rejected"}],"todos":[{"text":"a","done":"false"}]}]. 2. Open X, then Overview: there is no 'Rejected 1×' badge and no 'Current', and 'Invalid Date' appears under Applied. 3. On Tasks, task 'a' is listed as completed.
- **Expected:** History statuses are mapped through statusId (unknown ones dropped or reported as lost), changedAt is kept only when it is a valid time, and done is coerced to a boolean. **Actual:** Raw imported values reach the UI, and the import does not report anything as lost.
- **Fix hint:** In readJob/completeJob, map history entries with statusId(), drop unknown ones and set lost, keep changedAt only when Number.isFinite, and set done = done === true.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs with the real readJob and completeJob. The job status became 'rejected' and lost was false. The history was kept as [{"status":"Applied","changedAt":"yesterday"},{"status":"Rejected"},{"status":"ghosted","changedAt":5}], and todo.done stayed "false". STATUS_MAP['Rejected'] is undefined, so StatusHistory counts 0 rejections and never shows 'Current'. fmt('yesterday') returned 'Invalid Date', and Boolean('false') is true.
- **Fail-first test:** normalize-job.unit.mjs: completeJob maps history 'Rejected' to 'rejected', drops 'ghosted' with lost=true, drops changedAt 'yesterday', and turns done:'false' into false.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-20 · Low · bug · 🔴 Open · links **R2-101**
**Status history labels an On Hold that was later closed as Rejected or Withdrawn '→ reopened'**
- **Where:** `src/components/job/StatusHistory.jsx` : 3, 72-74
- **Repro:** 1. On a job's Overview, click Mark as: On Hold. 2. Click Close as: Rejected. 3. Application History reads 'On Hold → reopened'.
- **Expected:** '→ reopened' appears only when the next entry is an active pipeline status. **Actual:** A closed application is labelled as reopened.
- **Fix hint:** Show '→ reopened' only when history[i+1].status is in PIPELINE, and treat on_hold separately from rejected and withdrawn.
- **Verified (WF-1):** Read the code. TERMINAL includes 'on_hold' (3), and any terminal entry that is not the last gets '→ reopened' (72-74). Pipeline.jsx:86-105 offers Close as Rejected/Withdrawn from On Hold, which produces [.., on_hold, rejected].
- **Fail-first test:** Extract historyLabels(history). For [applied, on_hold, rejected] the on_hold label is not 'reopened'. For [rejected, applied] the rejected label is 'reopened'.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-21 · Low · bug · 🔴 Open · links **R2-100**
**After its résumé is deleted, a job shows 'Not linked yet' next to an Open-resume button that bounces to the dashboard**
- **Where:** `src/components/job/OverviewTab.jsx` : 118-135 (and src/pages/JobForm.jsx:139-142)
- **Repro:** 1. Link a job to a résumé. 2. Delete that résumé on the dashboard. 3. Open the job's Overview: it reads 'Not linked yet', with an open icon beside it. 4. Click the icon: you land on the dashboard.
- **Expected:** The link is shown as 'Résumé deleted' (or cleared), with no Open button. **Actual:** The UI contradicts itself and the button is a dead link. JobForm saves the dead id back.
- **Fix hint:** Look up the linked résumé with resumes.find(). When it is missing, render a 'deleted résumé' option and hide the button, or clear resumeId when a résumé is deleted. Use a non-external icon.
- **Verified (WF-1):** Read the code. The select's value is job.resumeId, which matches no option, so React selects the first option ('— Not linked yet —'). The button renders whenever job.resumeId is truthy (127) and navigates to /resume/<id>. useOpenResume.js:16 then redirects to '/' because that résumé does not exist. A grep shows nothing clears resumeId when a résumé is deleted.
- **Fail-first test:** Pure helper linkedResume(job, resumes) returns {state:'deleted'} for a dangling id. Cypress: the Open button is hidden for a dangling id.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-22 · Low · bug · 🔴 Open · links **R2-099**
**Clicking a kanban card's 'Open job posting' icon also navigates the tracker to the job page**
- **Where:** `src/components/job/KanbanView.jsx` : 23-35, 105
- **Repro:** 1. On the /jobs kanban, hover a card that has a URL. 2. Click the small external-link icon: the posting opens in a new tab, and the current tab also jumps to /jobs/:id.
- **Expected:** Only the posting opens. **Actual:** The posting opens and the tracker navigates away.
- **Fix hint:** Add onClick={e => e.stopPropagation()} to the anchor, as ListView.jsx:73 already does, or fix it structurally as in J-05.
- **Verified (WF-1):** Read the code. The anchor stops only onPointerDown (28). Its click bubbles to DraggableCard's onClick={() => !isDragging && onNavigate(job.id)} (105), and isDragging is false for a plain click.
- **Fail-first test:** Cypress: remove the anchor's target attribute, click the kanban posting icon, and assert the hash stays '#/jobs'.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-23 · Low · bug · 🔴 Open · links **R2-117**
**Job Tracker import shows no message when the browser cannot read the file**
- **Where:** `src/pages/JobTracker.jsx` : 38-56
- **Repro:** 1. Click Import and pick a file on a removable or network drive that is then unavailable, or revoke read access. 2. Nothing happens and no error is shown.
- **Expected:** 'Could not read that file.' **Actual:** No message.
- **Fix hint:** reader.onerror = reader.onabort = () => setImportError('Could not read that file.').
- **Verified (WF-1):** Read the code: only reader.onload is set (42-53). There is no onerror or onabort.
- **Fail-first test:** Extract readImportFile(file, {onText, onError}) and test it with a fake FileReader that fires 'error': onError is called.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-24 · Low · ux-defect · 🔴 Open
**The 'read-only' lock on Rejected/Withdrawn jobs is bypassed by the Edit form and by a kanban drag, and the reopen confirmation guards only one of three paths**
- **Where:** `src/components/job/OverviewTab.jsx` : 7, 26-34 (with src/pages/JobDetail.jsx:119-125, src/components/job/KanbanView.jsx:156-163, src/pages/JobForm.jsx:108-113, src/components/job/Pipeline.jsx:15-21)
- **Repro:** 1. Mark a job Rejected: Overview says the fields are read-only and tells you to restart from the pipeline. 2. Click the Edit pencil, change Company and set Status to Interview, then save: no reopen confirmation appears. 3. Or drag its card from Rejected to Applied on /jobs: it reopens with no confirmation.
- **Expected:** One consistent rule: either closed jobs are locked on every path and reopen through a single action, or there is no lock and no claim of one. **Actual:** The banner claims a lock that the pencil ignores, and it pushes users to reopen the job (which writes history) just to fix a typo.
- **Fix hint:** Remove the lock and keep closed jobs editable (recommended: rejection feedback belongs in the notes). Otherwise, send every status change out of a terminal state through the same confirm or undo.
- **Verified (WF-1):** Read the code. OverviewTab locks the fields for rejected and withdrawn jobs (7, 26-34). The header pencil always opens JobForm, where every field and the status select can be edited, and saving calls updateJob with no confirmation. KanbanView's onDragEnd calls updateJob directly (156-163). Pipeline.confirmReopen (15-21) is the only confirmation.
- **Fail-first test:** Cypress: reject a job, then check that the pencil and a drag follow the same rule as the Pipeline (the same confirm, or the same editable state).
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-25 · Low · ux-defect · 🔴 Open
**The list says 'No jobs tracked yet' when a search or filter matches nothing, and the kanban has no empty state**
- **Where:** `src/components/job/ListView.jsx` : 143-150 (and src/components/job/KanbanView.jsx:166-176, src/pages/JobTracker.jsx:231-233)
- **Repro:** 1. With several jobs, switch to List view. 2. Search 'zzz': the table says 'No jobs tracked yet / Click "+ Add Job"'. 3. In Kanban, the same search shows eight empty columns and no message. 4. Filter by a status, then drag its last card elsewhere: that status chip disappears while its filter stays on, and the board is blank.
- **Expected:** A 'No applications match "zzz"' state with Clear filters, and a separate onboarding state when there are no jobs. **Actual:** A message suggesting the data is gone.
- **Fix hint:** Pass the total job count and the active filters into both views and render a shared EmptyState of kind 'no-matches' or 'no-jobs'. Keep the active status chip visible while its filter is on.
- **Verified (WF-1):** Read the code. ListView receives filteredJobs (JobTracker.jsx:305-306) and shows 'No jobs tracked yet' whenever sorted.length is 0 (143-150). KanbanView has no empty state. JobTracker.jsx:233 returns null for a chip whose count is 0, even when it is the active filter.
- **Fail-first test:** Cypress: in List view, search 'zzz' and expect 'No applications match'.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-26 · Low · ux-defect · 🔴 Open
**Adding a task whose text matches any existing task, even a completed one, does nothing and says nothing**
- **Where:** `src/components/job/TasksTab.jsx` : 18-24
- **Repro:** 1. On a job's Tasks tab, add 'Send thank-you email' and tick it. 2. Type 'Send thank-you email' again and press Enter or click +: nothing happens, and the input keeps the text.
- **Expected:** The task is added (recurring follow-ups are normal), or an inline 'already in the list' message is shown. **Actual:** The input is ignored without any message. Renaming a task does allow duplicates, so the rule is also inconsistent.
- **Fix hint:** Remove the duplicate check, since ids already keep tasks distinct. Otherwise, limit it to pending tasks and announce the reason through aria-live.
- **Verified (WF-1):** Read the code: addTodo returns early when todos.some(td => td.text === t) (20). verify-jobs/v-pure.mjs showed the guard also matches a completed task's text (true).
- **Fail-first test:** Extract addTodo into a pure helper and test that adding the text of a completed task adds a new to-do, or returns a reason the UI shows.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-27 · Low · ux-defect · 🔴 Open
**With five or more completed tasks, the task just ticked disappears behind 'Show N more completed'**
- **Where:** `src/components/job/TasksTab.jsx` : 6, 13-15, 26, 102
- **Repro:** 1. Have a job with 5 completed tasks and 2 pending ones. 2. Tick the newest pending task: it vanishes from both lists.
- **Expected:** The most recently completed task is shown first (or stays visible), ideally with an undo. **Actual:** The task looks deleted.
- **Fix hint:** Store completedAt when a task is toggled, and sort done tasks by it, newest first, before slicing.
- **Verified (WF-1):** verify-jobs/v-pure.mjs replayed TasksTab.jsx:13-15 and 26 with 5 done tasks and 2 pending. After ticking Task 7, the visible done list was 'Task 1, Task 2, Task 3, Task 4, Task 5' and pending was 'Task 6', so Task 7 appears in neither.
- **Fail-first test:** Pure helper visibleDone(todos, 5), sorted by completedAt descending: the task just ticked is first.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-28 · Low · bug · 🔴 Open
**A custom stage that differs from an existing one only in case is not added, but the job still gets the text as typed**
- **Where:** `src/components/job/InterviewStageSelector.jsx` : 9-15 (with src/utils/jobStages.js:93-98)
- **Repro:** 1. Click Add Job, then under Interview Stage enter 'hr round' in Add Custom Stage and click Add. 2. The badge shows 'hr round', but neither 'HR Round' nor any custom stage is selected.
- **Expected:** The existing 'HR Round' is selected. **Actual:** The job gets a stage that differs in case and matches no item in either list.
- **Fix hint:** Have addCustomStage return the canonical label (the existing one, or the new one) and pass that to onStageChange.
- **Verified (WF-1):** Ran verify-jobs/v-stages.mjs with the real src/utils/jobStages.js, replaying handleAddStage. It printed custom stages [], job stage "hr round", predefined item active false, custom item active false.
- **Fail-first test:** job-stages.unit.mjs: addCustomStage('hr round') returns 'HR Round' and leaves the custom list unchanged.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-29 · Low · bug · 🔴 Open
**The demo job's dates contradict each other: history in June 2025, applied in June 2026, and a deadline already past**
- **Where:** `src/hooks/useJobStore.js` : 9-30
- **Repro:** 1. In a fresh browser, open /#/jobs. 2. The Google card shows 'Deadline passed 2026-06-30'. 3. Open it, then Overview: Application History is dated Jun 9-12, 2025, while the Applied Date is 2026-06-10.
- **Expected:** Demo data that is consistent and relative to today. **Actual:** Contradictory dates and an overdue alert on every user's first run.
- **Fix hint:** Build DEMO_JOBS from Date.now(), for example applied 10 days ago, the deadline in 5 days, and matching history timestamps.
- **Verified (WF-1):** Ran verify-jobs/v-store.mjs with empty storage. The demo history dates were 2025-06-09, 2025-06-10, 2025-06-11 and 2025-06-12, with appliedDate 2026-06-10 and deadline 2026-06-30. deadlineState(deadline, 2026-09-23) returned 'past'.
- **Fail-first test:** Unit test on a demoJobs(now) factory: the deadline is not 'past', and every history time lies between the applied date and now.
- **Owner:** JOBS-FIX · **Fix commit:** — · **Test:** —

### J-30 · Low · ux-defect · 🔴 Open
**The tracker's view, sort, search and filter reset every time the user opens a job and comes back**
- **Where:** `src/pages/JobTracker.jsx` : 23-25 (and src/components/job/ListView.jsx:13, src/pages/JobDetail.jsx:62)
- **Repro:** 1. On /jobs, switch to List view, sort by Deadline and search 'eng'. 2. Click a row, then the back arrow. 3. The Kanban view is back, unsorted, with the search cleared.
- **Expected:** View, filter, search and sort are kept in the URL (?view=list&q=eng&sort=deadline), and Back returns to that state. **Actual:** The user's working context is lost on every round trip.
- **Fix hint:** Use useSearchParams for view, status, q and sort, and navigate(-1) from the detail page when there is history. Optionally remember the preferred view in localStorage.
- **Verified (WF-1):** Read the code. view, search and filterStatus are component useState (JobTracker.jsx:23-25), and sort is useState in ListView (13). JobDetail's back arrow calls navigate('/jobs') (62), so the tracker remounts with its defaults.
- **Fail-first test:** Cypress: pick List, open a job, click back, and expect List view still selected. This fails today.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-31 · Low · a11y · 🔴 Open
**A task can be renamed only by double-clicking a span that is not focusable: impossible by keyboard and hard to discover on touch**
- **Where:** `src/components/job/TodoItem.jsx` : 43-48
- **Repro:** 1. Open a job's Tasks tab. 2. Tab through a task row: only the two unnamed buttons receive focus, so there is no way to edit the text. 3. On a phone, tapping the text does nothing visible.
- **Expected:** A visible, focusable Edit action, with Enter or F2 starting the edit. **Actual:** Keyboard users can only delete the task and add it again.
- **Fix hint:** Render the text as a button that enters edit mode on click or Enter, or add a pencil button next to Delete. Keep double-click as a shortcut.
- **Verified (WF-1):** Read the code: the only way into edit mode is onDoubleClick on a <span> with no tabIndex or role and a cursor-default class (43-48).
- **Fail-first test:** Cypress: Tab to the task's edit control, press Enter, and an input with the task text appears.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-32 · Low · a11y · 🔴 Open
**The job page's Overview, Tasks and Notes tabs have no tab semantics**
- **Where:** `src/pages/JobDetail.jsx` : 154-178, 185-197
- **Repro:** 1. Open a job with a screen reader. 2. Tab to 'Tasks': it is announced as 'Tasks 4, button', with no selected state and no position. 3. Activate Notes: nothing announces that the panel changed.
- **Expected:** The WAI-ARIA tabs pattern: tablist, tab with aria-selected and aria-controls, tabpanel, and arrow-key navigation. **Actual:** The current section is shown only by colour.
- **Fix hint:** Add role=tablist, role=tab with aria-selected and aria-controls, role=tabpanel with aria-labelledby, a roving tabindex and Left/Right arrow keys.
- **Verified (WF-1):** Read the code: the tabs are plain buttons in a div (154-178), and a grep finds no role="tab" or aria-selected in the job pages or components.
- **Fail-first test:** Cypress: the Tasks tab has role=tab and aria-selected=true, and ArrowRight moves focus to Notes.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-33 · Low · a11y · 🔴 Open
**Toggle and selection state is shown only visually: view toggle, status filter chips, stage choices, current pipeline step**
- **Where:** `src/pages/JobTracker.jsx` : 106-118, 125-137, 236-249 (and src/components/job/InterviewStageSelector.jsx:39-48, 65; src/components/job/Pipeline.jsx:122-147)
- **Repro:** 1. With a screen reader on /jobs, go to 'List view, button': no pressed state is announced. 2. Click the 'Interview 1' chip and Tab back to it: no 'pressed'. 3. On a job's Overview, the current pipeline step is not announced as current.
- **Expected:** aria-pressed on toggles, chips and stage buttons, and aria-current='step' on the active pipeline step. **Actual:** Screen-reader users cannot tell the active view, filter, stage or step. (The task checkbox state is covered by J-13.)
- **Fix hint:** Add aria-pressed={active} to the view toggles, status chips and stage buttons, and aria-current='step' to the active Pipeline button.
- **Verified (WF-1):** grep for aria-pressed, aria-current, aria-checked, aria-selected and aria-sort in src/pages/Job*.jsx and src/components/job/ returned no matches.
- **Fail-first test:** Cypress: after clicking List view, that button has aria-pressed=true, and the Kanban button has aria-pressed=false.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-34 · Low · a11y · 🔴 Open
**Focus is dropped to <body> after an inline field edit, a task toggle or a delete**
- **Where:** `src/components/job/Field.jsx` : 12-15, 34-62 (and src/components/job/TodoItem.jsx:11-16, src/components/job/TasksTab.jsx:78-121)
- **Repro:** 1. On Overview, Tab to the Company pencil and press Enter. Type something and press Enter. 2. Press Tab: focus starts again from the top of the page. 3. On Tasks, Tab to a task's toggle and press Space: focus is lost.
- **Expected:** Focus returns to the edit trigger after commit or cancel, stays on the moved task's checkbox, and moves to the next item after a delete. **Actual:** Keyboard users must Tab from the top of the page after every action.
- **Fix hint:** Keep a ref to the trigger and focus it when editing turns false. After a delete, focus the next row or the list heading. After a toggle, focus the moved task by its id.
- **Verified (WF-1):** Read the code. commit() calls setEditing(false), which unmounts the focused input, and nothing refocuses anything (Field.jsx:12-15, 34-62). A toggle moves the TodoItem from the pending list to the done list, two different parents in TasksTab.jsx:82-110, so it remounts. A delete removes the focused button.
- **Fail-first test:** Cypress: edit Company with Enter and assert document.activeElement is the Company pencil.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-35 · Low · a11y · 🔴 Open
**/jobs has no <h1>, no job page has a <main> landmark, and every tab is titled 'CPWT-CV'**
- **Where:** `src/pages/JobTracker.jsx` : 102 (and index.html:7)
- **Repro:** 1. Open /jobs with a screen reader and list the headings: there are none. 2. Open three jobs in three tabs: every tab is titled 'CPWT-CV'.
- **Expected:** An h1 on each page, a main landmark, and titles such as 'Acme — Engineer · Job Tracker' (WCAG 2.4.2). **Actual:** No heading or landmark navigation, and browser tabs cannot be told apart.
- **Fix hint:** Make 'Job Tracker' an <h1>, wrap each page body in <main>, and add a useDocumentTitle hook to JobTracker, JobDetail and JobForm.
- **Verified (WF-1):** Read the code: the title is a <span> (JobTracker.jsx:102). grep -rn document.title src finds nothing, and no job page renders <main>.
- **Fail-first test:** Cypress: /jobs has exactly one h1 and a main element, and on /jobs/demo_1 document.title contains 'Google'.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-36 · Low · ux-defect · 🔴 Open
**On the Add/Edit job form, Enter does not submit, and both Company and Role are marked required although one is enough**
- **Where:** `src/pages/JobForm.jsx` : 52, 55-59, 85-90
- **Repro:** 1. Click Add Job, type 'Acme' in Company and press Enter: nothing happens. 2. Role shows a red asterisk, yet saving without it works. 3. With both fields empty, Save is greyed out and no reason is given.
- **Expected:** A <form onSubmit> so that Enter saves, a helper text 'Enter a company or a role', and a reason when saving is blocked. **Actual:** No keyboard submit and misleading required cues.
- **Fix hint:** Wrap the page in <form onSubmit={handleSave}> with type=submit buttons. Replace the two asterisks with the helper text, announced through aria-live when a save is attempted.
- **Verified (WF-1):** Read the code. There is no <form> element. Both Fields pass required, which only draws the asterisk (85-90). canSave needs only one of the two (52).
- **Fail-first test:** Cypress: on /jobs/new, type Company and press Enter: the URL becomes /jobs/<new id>.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-37 · Low · mobile · 🔴 Open
**Touch targets on the tracker are about 15-21px: status chips, the card's posting link and delete, task delete, search clear**
- **Where:** `src/components/job/KanbanView.jsx` : 31, 89 (and src/pages/JobTracker.jsx:226, 239, 270; src/components/job/TodoItem.jsx:53; src/components/job/Field.jsx:57; src/components/job/InterviewStageSelector.jsx:73)
- **Repro:** 1. On a phone, open /jobs. 2. Try to tap a status chip, or the card's external-link icon without hitting the card: you often open the job instead.
- **Expected:** Targets of at least 24x24px (WCAG 2.5.8), ideally 44px on coarse pointers. **Actual:** Frequent mis-taps, including next to the always-visible Delete icon on touch devices.
- **Fix hint:** Add min-h-6 min-w-6 to icon buttons and chips, plus extra padding on coarse pointers (@media (pointer: coarse)).
- **Verified (WF-1):** Computed from the classes. The posting link is p-0.5 with an 11px icon (about 15px, KanbanView.jsx:31). The card delete is p-1 with an 11px icon (about 19px, :89). The chips are text-[10px] py-0.5 (about 20px tall, JobTracker.jsx:239). The search clear is an 11px icon with no padding (:270). The task delete is p-1 with a 13px icon (about 21px, TodoItem.jsx:53).
- **Fail-first test:** Cypress at 375px: every button's getBoundingClientRect() is at least 24x24.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-38 · Low · mobile · 🔴 Open
**iOS Safari zooms the page when any tracker input is focused, because the inputs use 12-14px text**
- **Where:** `src/pages/JobTracker.jsx` : 267 (and src/pages/JobForm.jsx:23, src/components/job/TasksTab.jsx:44, src/components/job/Field.jsx:46, src/components/job/InterviewStageSelector.jsx:94)
- **Repro:** 1. On an iPhone, open /jobs and tap Search: the page zooms in and stays zoomed. 2. Open Add Job and tap Company: the page zooms again.
- **Expected:** No zoom when a field is focused. **Actual:** Every field zooms the page, and the user must pinch out afterwards.
- **Fix hint:** Use text-base sm:text-sm (16px on mobile) for every text input, select and textarea.
- **Verified (WF-1):** Read the code. The index.html:6 viewport meta has no maximum-scale. The search input is text-xs (JobTracker.jsx:267). The form INPUT (JobForm.jsx:23), the task input, the inline Field input and the custom-stage input are text-sm. iOS Safari zooms on focus when an input's font size is below 16px.
- **Fail-first test:** Cypress at 375px: the computed font-size of every input, select and textarea is at least 16px.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-39 · Low · mobile · 🔴 Open
**On phones, the recovery notice's buttons, which do not wrap, squeeze the explanation into a sliver and overflow**
- **Where:** `src/components/RecoveryNotice.jsx` : 43-57
- **Repro:** 1. At 375px width, load /jobs with an unreadable cpwtcv_jobs_v1 so the recovery notice appears. 2. The red alert puts 'Download the copy' and Dismiss (and 'Download the earlier copy' if there is one) beside a message column only a few words wide, and the row overflows.
- **Expected:** The message on top, with the actions wrapped below it. **Actual:** On phones the notice explaining that data was left out is hard to read. The same component is used on the Dashboard and on Boards.
- **Fix hint:** Use flex-col sm:flex-row, and put the buttons in a flex-wrap gap-2 row.
- **Verified (WF-1):** Read the code. The notice is a flex row: a flex-1 span next to whitespace-nowrap buttons (43-57). The message contains the unbroken key “cpwtcv_jobs_v1_backup_<ms>” (storageBackup.js:124), about 38 characters. That key's min-content width plus the buttons exceeds the roughly 317px available at 375px.
- **Fail-first test:** Cypress at 375px with a corrupt job list: the alert's scrollWidth <= clientWidth.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-40 · Low · bug · 🔴 Open · links **R2-073**
**The scroll position is not reset on route change: a job page opens at the scroll offset of the list the user came from**
- **Where:** `src/main.jsx` : 9
- **Repro:** 1. With about 30 jobs, switch to List view and scroll to the bottom. 2. Click a row: the job page opens scrolled down, with the content partly off-screen.
- **Expected:** The new page opens at the top, and going back restores the previous position. **Actual:** The previous page's scroll offset is kept.
- **Fix hint:** Add a ScrollToTop effect on location.pathname in the app routes, or move to a data router with <ScrollRestoration/>.
- **Verified (WF-1):** Read the code. HashRouter at main.jsx:9, and a grep for ScrollRestoration or scrollTo( in src finds nothing.
- **Fail-first test:** Cypress: scroll /jobs to the bottom, click a row, and assert window.scrollY === 0.
- **Owner:** KIT (scroll reset in WorkspaceLayout) · **Fix commit:** — · **Test:** —

### J-41 · Low · bug · 🔴 Open · links **R2-156**
**The job tracker's Cypress specs are stale, two tests fail against the current markup, and the tracker UI has no component tests**
- **Where:** `cypress/e2e/06-job-tracker.cy.js` : 58, 104 (and cypress/e2e/21-a11y.cy.js:98; src/pages/JobTracker.jsx:105-139, 146)
- **Repro:** Run npx cypress run --spec cypress/e2e/06-job-tracker.cy.js: 'list view shows the same applications' fails because .click() matches 2 elements, and 'Export downloads the jobs as JSON' fails because there is no button labelled exactly 'Export'.
- **Expected:** Specs that match the UI, plus component-level coverage of drag, the pipeline, tasks and notes. **Actual:** The specs are stale and the tracker UI is verified only by hand.
- **Fix hint:** Render a single view toggle, repositioned with responsive classes instead of duplicated, and update the Export selector to 'Export JSON'. Add tests for Pipeline transitions, TasksTab add/toggle/rename and ListView sorting.
- **Verified (WF-1):** Read the code. JobTracker.jsx renders two buttons with title="List view" (113-118, 132-137), so cy.get('button[title="List view"]').click() at 06-job-tracker.cy.js:58 and 21-a11y.cy.js:98 gets two elements, and Cypress throws without {multiple:true}. 06-job-tracker.cy.js:104 looks for /^\s*Export\s*$/, but the button reads 'Export JSON' (JobTracker.jsx:146). Not run, because this is a read-only phase with no servers.
- **Fail-first test:** Fix the selectors and run 06-job-tracker.cy.js in the gate. Add node tests for the extracted helpers from J-18, J-20 and J-27.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —
