---
title: Job Tracker — verified bugs, High and Medium (J-01…J-15)
---

# Job Tracker — verified bugs, High and Medium (J-01…J-15)

> Part of [README.md](README.md). Status: 🔴 open · ⏸ fixed on the work branch, not yet on master (not deployed) · ✅ on master (deployed) · ✖ not a bug.
> Set the row (status + commit + test) in the SAME commit as the fix. Found by WF-1 `wf_a523cc8e-2ca` at `8409472`, 2026-09-23.

### J-01 · High · data-loss · ✅ Fixed
**The job store stops listening to other tabs once the user leaves the job pages, then writes its stale list over theirs**
- **Where:** `src/hooks/useJobStore.js` : 98-106, 134-153, 160-166
- **Repro:** 1. Tab A: open /#/jobs. 2. Tab A: click the back arrow to the dashboard. 3. Tab B: open /#/jobs, click Add Job and save 'Stripe'. 4. Tab A: click 'Job Tracker'. Stripe is missing. 5. Tab A: add a job or drag any card to another column. 6. Tab B: Stripe disappears. Reload either tab: Stripe is gone for good.
- **Expected:** When the user returns to a job page, it shows the list currently saved in storage. An action in Tab A never erases a job Tab B saved. **Actual:** Tab A shows the list from its first visit. Its next write replaces every change other tabs made in the meantime.
- **Fix hint:** In subscribe(), when wasEmpty && initialized, call takeOtherTabsList() before returning. It already merges with keepUnsaved. Alternatively, register the storage listener once in init() and never remove it. src/hooks/useBoardStore.js:101-120 has the same subscribe/unsubscribe code and needs the same fix (Boards area).
- **Verified (WF-1):** Read the code. init() runs once, guarded by `initialized` (99). subscribe() adds the listener again at 143-145 but never reads storage again. The unsubscribe removes the listener at 147-151. A grep shows that only JobTracker, JobDetail and JobForm call useJobStore. Ran verify-jobs/v-store.mjs, which loads the real store with a localStorage/window stub. It printed 'listeners after leaving job pages 0'. After the other tab saved Stripe it printed 'A back on /jobs sees [ 'Acme' ]', and after A added Meta, 'storage after A adds Meta [ 'Acme', 'Meta' ]'. Refutation attempt: Tab B's keepUnsaved cannot keep Stripe. B had saved it, so B's stored list === current, and B takes the incoming list as it is.
- **Fail-first test:** tests/unit/job-store-resync.unit.mjs: stub localStorage and window, then _resetJobStoreForTest(). Seed [Acme]. Run unsub = subscribe(); unsub(). Write [Acme, Stripe] to storage (no listener is registered to fire). subscribe() again and assert snapshot().jobs contains Stripe. Then addJob({company:'Meta'}) and assert storage holds Acme, Stripe and Meta. The first assert fails today.
- **Now:** subscribe() reads storage again (takeOtherTabsList, which still keeps what this tab could not save) when the first job page opens after none was open, and tells the page. The store also exports its actions as plain functions so node tests drive it without React. Fail-first: all four tests failed at HEAD (`# fail 4`), pass now.
- **Owner:** JOBS-FIX · **Fix commit:** `a7048b1` (`fix(jobs): a job page opened again reads what other tabs saved meanwhile (J-01)`) · **Test:** tests/unit/job-store-resync.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-02 · Medium · data-loss · ✅ Fixed · links **R2-040**
**Save Changes writes back a stale copy of the whole job: another tab's tasks are deleted, its status is reverted and a false history entry is added**
- **Where:** `src/pages/JobForm.jsx` : 37-49, 57 (with src/hooks/useJobStore.js:190-199)
- **Repro:** 1. Open the same job in two tabs. 2. Tab A: click the Edit pencil. 3. Tab B: on the Tasks tab add 'Prep system design', then on Overview click Move to Phone Screen (or any status). 4. Tab A: change Role and click Save Changes. 5. In either tab the task is gone, the status is back to the old one, and Application History shows an extra entry for the old status.
- **Expected:** Only the fields the user changed in the form are written. Tasks, history and a status changed elsewhere are kept. **Actual:** The whole form object, which includes todos, statusHistory and status as they were when the form opened, overwrites the job. Because the stale status differs from the new one, updateJob also records it as a new transition.
- **Fix hint:** Keep the initial form values. On save, pass updateJob only the editable keys whose value changed. Never send id, todos, statusHistory, createdAt or updatedAt from the form. If the job no longer exists at save time, see J-16.
- **Verified (WF-1):** Read the code: the form state is {...defaults, ...existing} (43) and save calls updateJob(id, form) (57). updateJob spreads every key and adds a history entry when updates.status !== j.status (193-197). Ran verify-jobs/v-store.mjs. After Tab B's write, A's store held '["Prep system design"] interview', so the store had the change but the form did not. Saving the stale form printed 'role Senior Dev \| status applied \| todos 0 \| history applied,interview,applied'.
- **Fail-first test:** Extract a pure formPatch(initial, form) from JobForm and assert it returns only the changed editable keys (e.g. {role}) and never todos, statusHistory or status when those were not edited. Store test: after an external write adds a to-do, updateJob(id, {role:'X'}) keeps the to-do and the status.
- **Now:** The form keeps its values as it opened (`jobFormValues`) and saves `formPatch(start, form)` — only the form fields whose value changed; to-dos, history, id and an unedited status are never sent. `updateJob` goes through `applyEdits`, which never takes id/createdAt/statusHistory from an edit and routes a status through `applyStatusChange` (one history entry). Fail-first: tests/pdf/67-job-form-save.test.mjs (real JobForm + store, fake DOM) saved status 'applied' over the other tab's 'interview' at HEAD; job-edits.unit.mjs could not load. Both pass now.
- **Owner:** JOBS-FIX · **Fix commit:** `7f4a3f8` (`fix(jobs): the job form saves only what it edited, keeps input for a deleted job, and dates follow the status (J-02, J-10, J-16)`) · **Test:** tests/pdf/67-job-form-save.test.mjs, tests/unit/job-edits.unit.mjs, tests/unit/job-store-edits.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-03 · Medium · data-loss · ✅ Fixed · links **R2-035**
**Job notes have two incompatible editors: text typed in the form is merged and stripped, then saved that way from the Notes tab. The form shows raw HTML.**
- **Where:** `src/pages/JobForm.jsx` : 149 (with src/components/job/NotesTab.jsx:7-13, src/components/RichTextEditor.jsx:28-37, src/components/job/KanbanView.jsx:59-63)
- **Repro:** 1. Click Add Job and type two lines in Notes, the second containing '<tbd>'. Save. 2. On /jobs the card preview shows the lines merged, and '<tbd>' is gone. 3. Open the job's Notes tab and type one character: the stripped version is saved over the original text. 4. Or: bold a word in the Notes tab, then click the Edit pencil: the Notes textarea shows <p> and <strong> tags.
- **Expected:** One notes format, edited the same way in both places, with the text kept exactly as typed. **Actual:** Line breaks and anything that looks like a tag are lost, and the loss is saved on the first edit in the Notes tab. The form shows HTML source.
- **Fix hint:** Use RichTextEditor in JobForm, or remove Notes from the form and link to the Notes tab. When loading a job whose notes contain no tags, migrate them once with plainTextToHtml.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs against the real src/utils/richText.js. richTextToPlain('Round 1: recruiter call\nSalary <tbd> & equity') returned 'Round 1: recruiter call Salary & equity' (this is the card preview). sanitizeRichText of the same text returned '<p>Round 1: recruiter call Salary &amp; equity</p>'. RichTextEditor.jsx:28-33 puts that HTML into the editor, and emit() (36) saves innerHTML on the first keystroke.
- **Fail-first test:** Node test for a new notesToHtml(notes) migration helper: a plain text with a newline and '<tbd>' becomes HTML with <br> and &lt;tbd&gt;, and richTextToPlain of the result returns the original text.
- **Now:** Notes are rich-text HTML everywhere. The job form edits them with the Notes tab's RichTextEditor instead of a textarea, and `completeJob` (every load and import) converts plain notes once with `notesToHtml` → `plainTextToHtml` (escaped, a <br> per line), so `richTextToPlain` reads the original text back and nothing tag-like is lost. HTML and blank notes are untouched. Fail-first: the three J-03 tests in normalize-job.unit.mjs failed at HEAD (`# fail 3`), pass now.
- **Owner:** JOBS-FIX · **Fix commit:** `671e064` (`fix(jobs): one notes format — the form uses the rich-text editor, plain notes convert once (J-03)`) · **Test:** tests/unit/normalize-job.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-04 · Medium · bug · ✅ Fixed
**Importing the tracker's own JSON backup duplicates every job, and a successful import shows no message**
- **Where:** `src/hooks/useJobStore.js` : 211-225 (newId at 219); src/pages/JobTracker.jsx:48-52
- **Repro:** 1. On /jobs click Export JSON (its title is 'Export as JSON backup'). 2. Click Import and choose that file. 3. Every job now appears twice, and nothing says an import happened. Import again and the list triples.
- **Expected:** Restoring a backup does not duplicate jobs: entries whose id already exists are skipped or replaced, or the user chooses Merge or Replace. A success message gives the counts. **Actual:** Every job is duplicated without any message.
- **Fix hint:** Keep an incoming id when it is not taken. For ids already present, skip identical entries and ask about entries that differ, or offer a 'Replace all' restore. Show 'Imported N, skipped M duplicates' in a status region that is not an error.
- **Verified (WF-1):** Ran verify-jobs/v-store.mjs: importJobs() on its own export printed { added: 1, lossy: false }, and the list became [Acme:j, Acme:job_bf6f]. JobTracker.jsx:52 only calls setImportError(null) on success.
- **Fail-first test:** Store unit test: seed [A with id 'j'], then importJobs([{...A}]). Assert jobs.length stays 1 and the result reports skipped: 1.
- **Now:** `importJobs` merges through `mergeImport` (src/utils/jobImport.js): an incoming id that is free is kept; the same job already here is skipped; a newer copy (`updatedAt`) replaces it in place; an older copy is skipped (a backup never overwrites a later edit); a different job with no time to compare is added as a copy with a new id (nothing dropped). It returns `{ added, updated, skipped, lossy }` and the tracker shows `importMessage` — e.g. 'Nothing new: the 3 job applications in that file are already in the tracker.' — in a role=status notice (errors stay role=alert). Fail-first: the two J-04 store tests failed at HEAD (the list doubled), the pure ones could not load; all pass now.
- **Owner:** JOBS-FIX · **Fix commit:** `e9c48c3` (`fix(jobs): re-importing a backup never duplicates jobs, an import reports its counts, a read error says so (J-04, J-23)`) · **Test:** tests/unit/job-store-edits.unit.mjs, tests/unit/job-import.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-05 · Medium · a11y · 🔴 Open · links **R2-039**
**The tracker is mouse-only: focusable role=button cards ignore Enter and Space, and list rows and sort headers cannot be reached by keyboard**
- **Where:** `src/components/job/KanbanView.jsx` : 98-111, 142 (and src/components/job/ListView.jsx:42-49, 60-64)
- **Repro:** 1. On /jobs press Tab until a kanban card is focused. The screen reader announces 'draggable' and the press-space-to-pick-up instructions. 2. Press Enter, then Space: nothing happens. 3. Switch to List view and press Tab: the rows and sort headers are skipped, so there is no way to open a job or sort from the keyboard. 4. Middle-click or Ctrl-click a card or row: no new tab opens, because neither is a link.
- **Expected:** Each card and row is a link to /jobs/:id (Enter, Ctrl-click and middle-click work). Drag works from the keyboard (KeyboardSensor) or is not announced. Sort headers are buttons with aria-sort. **Actual:** There is no keyboard path from the board or the list to a job. The drag instructions read out are false, and the drag announcements read the internal job id.
- **Fix hint:** Render the company/role as <Link to=/jobs/:id> with a stretched ::after, and move the drag listeners to a separate handle button. Add KeyboardSensor with announcements that use job.company and column labels. In ListView, make the company cell a Link and wrap each header label in a <button> inside <th aria-sort>.
- **Verified (WF-1):** Read the code. useDraggable's attributes set role=button, tabIndex=0 and aria-roledescription 'draggable' (node_modules/@dnd-kit/core/dist/core.esm.js:3406-3437). The listeners contain only PointerSensor's onPointerDown, because it is the only sensor registered (142). A div's onClick (105) does not fire on Enter or Space. ListView uses <tr onClick> with no tabIndex or link (60-64) and <th onClick> with no button or aria-sort (42-49). dnd-kit's default announcement is 'Picked up draggable item ' + active.id.
- **Fail-first test:** Cypress: on /jobs, Tab to the first card and press Enter: the URL becomes #/jobs/demo_1. In List view, Tab reaches a row link and a sort button whose <th> has aria-sort.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-06 · Medium · mobile · 🔴 Open · links **R2-038**
**Job kanban drag-and-drop does not work on touch screens, and the board offers no other way to change status**
- **Where:** `src/components/job/KanbanView.jsx` : 101-107, 142, 166
- **Repro:** 1. On a phone, open /#/jobs (Kanban). 2. Press a card and drag it to the next column: the board scrolls sideways or nothing happens, and the status does not change.
- **Expected:** Long-press then drag moves the card, or each card has a tap-friendly 'Move to…' menu. **Actual:** On touch devices the status can be changed only from the job's own page.
- **Fix hint:** Add TouchSensor (delay 200, tolerance 5-6) alongside MouseSensor, or put touch-none on a dedicated drag handle so the card body still scrolls. Add a per-card 'Move to…' menu.
- **Verified (WF-1):** Read the code. PointerSensor is the only sensor (142). The draggable div (101-107) has no touch-none class, and index.css has no touch-action rule (grep). The card sits in an overflow-x-auto container (166). dnd-kit's PointerSensor does not block touchmove, so with touch-action:auto the browser takes the gesture as a pan and sends pointercancel before the 8px activation distance.
- **Fail-first test:** Cypress or component test: the drag handle's computed touch-action is 'none', and the sensors include TouchSensor. Confirm manually on a phone.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-07 · Medium · data-loss · 🔴 Open · links **R2-145**
**Jobs never leave localStorage, but the Privacy page says all content syncs and is restored after local storage is cleared**
- **Where:** `src/hooks/useJobStore.js` : 7, 58-65 (vs src/pages/PrivacyPage.jsx:50, 60)
- **Repro:** 1. Sign in with Google and add some jobs. 2. Clear site data, or open another device, and sign in again. 3. The résumés come back, but the jobs do not.
- **Expected:** Jobs sync the way résumés do, or the Privacy page and the tracker say plainly that jobs are stored only in this browser and prompt the user to export. **Actual:** Users who rely on the sync the Privacy page describes lose their tracker.
- **Fix hint:** Add Firestore sync for jobs (and boards), or correct the Privacy copy and show a 'Stored only in this browser' note with an Export shortcut on /jobs. R2-140 is the same issue.
- **Verified (WF-1):** Read the code. persist() writes only the localStorage key cpwtcv_jobs_v1 (58-65). A grep for 'job' in src/utils/cloudSync*.js and src/hooks/useCloudSync.js finds nothing. PrivacyPage.jsx:50 says 'all content you enter into CPWT-CV, synced to Firebase Firestore', and :60 says 'To restore your data if you clear your browser's local storage.'
- **Fail-first test:** If jobs stay local-only: a Cypress assertion that /jobs shows the 'stored only in this browser' note. If they sync: a node test on the cloud sync plan that includes the job list.
- **Owner:** BOARDS-UI-B (PrivacyPage.jsx wording, both features) · **Fix commit:** — · **Test:** —

### J-08 · Medium · bug · ✅ Fixed · links **R2-036**
**CSV export writes the Notes column as raw HTML with entities**
- **Where:** `src/utils/jobCsv.js` : 31
- **Repro:** 1. In a job's Notes tab, write two lines and bold one word. 2. On /jobs click Export CSV. 3. Open the file: the Notes cell contains <p>, <strong> and &amp;.
- **Expected:** Plain text with line breaks. **Actual:** HTML markup in the spreadsheet.
- **Fix hint:** Change the column to ['Notes', (j) => richTextToPlain(j.notes)]. richText.js has no aliases, so it also loads under node --test.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs: jobsToCsv with notes '<p>Round <strong>1</strong> &amp; HR</p><p>Next: 2nd</p>' wrote that exact string into the Notes cell.
- **Fail-first test:** job-csv.unit.mjs: notes '<p>a <strong>b</strong> &amp; c</p><p>d</p>' export as the cell "a b & c\nd".
- **Now:** The Notes column is `richTextToPlain(notesToHtml(notes))`: the text with its line breaks, no tags or entities (legacy plain notes keep '<tbd>'). Fail-first: the J-08 test failed at HEAD, passes now.
- **Owner:** JOBS-FIX · **Fix commit:** `7e49d33` (`fix(jobs): the CSV export opens clean in Excel — plain-text notes, a BOM, formulas as text (J-08, J-09, J-17)`) · **Test:** tests/unit/job-csv.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-09 · Medium · bug · ✅ Fixed · links **R2-042**
**CSV export has no UTF-8 BOM, so Excel shows mojibake for non-ASCII text, including the demo job's salary and contact**
- **Where:** `src/utils/jobCsv.js` : 34-42 (with src/pages/JobTracker.jsx:33-36)
- **Repro:** 1. With the demo job, click Export CSV. 2. Double-click the file in Excel on Windows: the salary shows 'â€“' and the contact 'Â·'.
- **Expected:** Non-ASCII characters display correctly in Excel. **Actual:** Every non-ASCII character is garbled.
- **Fix hint:** Prefix '﻿' in handleExportCsv or in jobsToCsv, and update job-csv.unit.mjs.
- **Verified (WF-1):** Ran verify-jobs/v-pure.mjs: the output's first character code is 0x22, not 0xfeff, and the row contains '–' and '·'.
- **Fail-first test:** job-csv.unit.mjs, or a csvFileText() helper: assert the output starts with '﻿'.
- **Now:** `jobsToCsv` starts the file with U+FEFF, so Excel reads it as UTF-8 (the existing tests strip it). Fail-first: the J-09 test failed at HEAD, passes now.
- **Owner:** JOBS-FIX · **Fix commit:** `7e49d33` (`fix(jobs): the CSV export opens clean in Excel — plain-text notes, a BOM, formulas as text (J-08, J-09, J-17)`) · **Test:** tests/unit/job-csv.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-10 · Medium · bug · ✅ Fixed
**Applied Date is prefilled with today even for a Saved job, and is never set when the job actually moves to Applied**
- **Where:** `src/pages/JobForm.jsx` : 39-42 (with src/hooks/useJobStore.js:190-199, src/components/job/KanbanView.jsx:49-51, src/utils/jobCsv.js:27)
- **Repro:** 1. Click Add Job, set Status to '1. Saved' and save. 2. On the /jobs kanban, the card in the Saved column reads 'Applied <today>'. 3. Later, drag it to Applied (or click Move to Applied): the date still shows the day the job was saved. 4. Export CSV: Applied Date is the save day.
- **Expected:** A Saved job has no applied date. The first move to Applied or a later status fills appliedDate with that day when it is blank. The field stays editable. **Actual:** Every job saved before applying gets a wrong applied date, and moving it to Applied never corrects it.
- **Fix hint:** Default appliedDate to '' when the status is 'saved', and clear the prefill when the user picks Saved. In updateJob, when the status moves from saved to any later pipeline status and appliedDate is empty, set todayLocalISO().
- **Verified (WF-1):** Read the code. base.appliedDate = todayLocalISO() is set whatever the status (42), and the status select only calls set('status'). updateJob (190-199) changes only statusHistory on a status change. KanbanCard prints 'Applied {appliedDate}' in any column (49-51).
- **Fail-first test:** Extract applyStatusChange(job, status, today) from the store. Test that saved→applied with a blank appliedDate sets today, and that newJobDefaults('saved').appliedDate === ''.
- **Now:** `newJobDefaults(status)` gives an applied date only past Saved (the store's `addJob` uses it; a date the caller clears stays clear). `applyStatusChange` fills a blank applied date with that day when a job moves past Saved. On a new job's form the untouched date follows the status picked (`withFormStatus`: blank for Saved). Fail-first: the J-10 store tests failed at HEAD (added-as-Applied had no date; saved→applied left it blank), and the pure ones could not load; all pass now.
- **Owner:** JOBS-FIX · **Fix commit:** `7f4a3f8` (`fix(jobs): the job form saves only what it edited, keeps input for a deleted job, and dates follow the status (J-02, J-10, J-16)`) · **Test:** tests/unit/job-edits.unit.mjs, tests/unit/job-store-edits.unit.mjs · **On master:** Lane C's merge `de0911f` (an ancestor of master `e6b1a4a`, deployed)

### J-11 · Medium · mobile · 🔴 Open
**On phones the list view is clipped: columns after about Status, including Delete, cannot be reached**
- **Where:** `src/components/job/ListView.jsx` : 37-38 (with src/pages/JobTracker.jsx:295)
- **Repro:** 1. Open /#/jobs at 375px width. 2. Tap the List view toggle. 3. Try to see Deadline, Contact, Tasks or Resume, or tap Delete: they are cut off, and swiping sideways does nothing.
- **Expected:** A stacked card list on phones, or at least a table that scrolls horizontally. **Actual:** Several columns and each row's Delete button cannot be reached on phones.
- **Fix hint:** Below md, render a card list instead of the table. At md and up, wrap the table in overflow-x-auto with a sticky Company column. Remove overflow-hidden from JobTracker.jsx:295.
- **Verified (WF-1):** Read the code. The table wrapper is 'overflow-hidden' (ListView.jsx:37), and its parent is 'flex-1 min-w-0 w-full overflow-hidden' (JobTracker.jsx:295). The table has 11 columns with px-4 cells, which is 352px of padding alone, plus whitespace-nowrap headers. That exceeds the 343px content width at 375px, and no ancestor scrolls horizontally.
- **Fail-first test:** Cypress at viewport 375x812: switch to List and assert the first row's Delete button is visible and can be clicked. This fails today.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-12 · Medium · mobile · 🔴 Open
**Job detail and form layouts do not collapse on phones: fixed 2-column grids, a 'Mark as' row that does not wrap, and long values overflow**
- **Where:** `src/components/job/OverviewTab.jsx` : 17 (and src/components/job/Pipeline.jsx:169, src/components/job/InterviewStageSelector.jsx:32, 88-104, src/components/job/Field.jsx:52, src/pages/JobDetail.jsx:182-185)
- **Repro:** 1. Open /#/jobs/demo_1 at 375px width and go to the Overview tab. 2. The Pipeline's 'Mark as:' chips run past the card edge, and the page scrolls sideways. 3. Role Info and Timeline are squeezed into two columns about 113px wide. 4. On Add Job, the Interview Stage 'Add Custom Stage' input and button do not fit. 5. On desktop, set a 120-character posting URL: it spills out of its card.
- **Expected:** A single column below sm, action chips that wrap, and long URLs that wrap or truncate. **Actual:** Horizontal page scroll and crushed fields on the job page's main tab.
- **Fix hint:** Use grid-cols-1 md:grid-cols-2 (with md:col-span-2) in OverviewTab, and grid-cols-1 sm:grid-cols-2 in InterviewStageSelector. Add flex-wrap to Pipeline.jsx:169. Give Field's value span min-w-0 break-all, or truncate with a title. Use px-4 sm:px-6 in JobDetail.
- **Verified (WF-1):** Read the code and did the width arithmetic. At 375px the JobDetail content is 327px (px-6). OverviewTab's 'grid grid-cols-2 gap-5' has no breakpoint, which leaves about 113px inside the p-5 cards. Pipeline.jsx:169 is a flex row that does not wrap: the label plus three chips need about 360px inside a 287px card. index.css sets no overflow-x clip on body or #root, so the page scrolls sideways.
- **Fail-first test:** Cypress at 375px on /#/jobs/demo_1, Overview tab: assert document.documentElement.scrollWidth <= 375.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-13 · Medium · a11y · 🔴 Open
**Icon-only buttons have no accessible name: task checkbox and delete, back arrows, search clear, add-task '+'**
- **Where:** `src/components/job/TodoItem.jsx` : 22-27, 51-56 (and src/pages/JobDetail.jsx:61-66, src/pages/JobForm.jsx:65-67, src/pages/JobTracker.jsx:269-273, src/components/job/TasksTab.jsx:46-52)
- **Repro:** 1. Open a job's Tasks tab with NVDA or VoiceOver. 2. Tab through a task: 'button', then 'button'. The checkbox is also not announced as checked or unchecked. 3. Tab to the header back arrow: 'button'. 4. On /jobs, type in Search and Tab to the X: 'button'.
- **Expected:** Names such as 'Mark "Prepare" done' (a real checkbox with a checked state), 'Delete task "Prepare"', 'Back to Job Tracker', 'Clear search', 'Add task', 'Edit Company'. **Actual:** Unnamed buttons, so a screen-reader user cannot complete or delete tasks with confidence. Field's pencil is 'Edit' on every field, and the stage X is 'Remove' on every stage.
- **Fix hint:** Add an aria-label to each button. Make the task toggle an <input type=checkbox>, or role=checkbox with aria-checked, labelled by the task text. Name Field's pencil `Edit ${label}` and the stage X `Remove stage ${s}`.
- **Verified (WF-1):** Read the code. Each listed button holds only a lucide icon and has no aria-label or title. lucide adds aria-hidden="true" to icons that have no a11y props (node_modules/lucide-react/dist/esm/Icon.mjs:36). grep finds no aria-checked in the job components. Field.jsx:58 uses title 'Edit' and InterviewStageSelector.jsx:74 uses 'Remove'.
- **Fail-first test:** Extend cypress/e2e/21-a11y.cy.js: on /jobs, /jobs/demo_1 (Tasks) and /jobs/new, assert every button has a non-empty accessible name (aria-label, title or text).
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-14 · Medium · a11y · 🔴 Open
**Keyboard focus is invisible on hover-revealed buttons and on several inputs and chips that remove the outline**
- **Where:** `src/components/job/KanbanView.jsx` : 82 (and src/components/job/ListView.jsx:76, 128; src/components/job/Field.jsx:57; src/components/job/TodoItem.jsx:53; src/components/job/OverviewTab.jsx:87, 122; src/pages/JobTracker.jsx:244)
- **Repro:** 1. On a desktop with a mouse, open /jobs in List view. 2. Press Tab past the search field: focus lands on the posting link and Delete buttons, which stay invisible. Pressing Enter then asks to delete a job. 3. Tab onto a status chip: no focus ring. 4. On a job's Overview, Tab to Deadline or Resume Used: no focus ring.
- **Expected:** Every focusable control is visible and has a clear focus indicator (WCAG 2.4.7). **Actual:** Focus disappears for several Tab stops, and destructive buttons can be reached while invisible.
- **Fix hint:** Add focus-visible:opacity-100 and group-focus-within:opacity-100 wherever group-hover reveals a control. Replace focus:outline-none with focus-visible:ring-2. Remove the inline outline:'none' and show the active chip with its border or background.
- **Verified (WF-1):** Read the code. These controls use 'opacity-0 group-hover:opacity-100 no-hover:opacity-100' with no focus variant. index.css:9 defines no-hover as @media (hover: none), so on a desktop with a mouse they stay at opacity 0 while focused. OverviewTab.jsx:87 and :122 use focus:outline-none with no ring. JobTracker.jsx:244 sets an inline outline:'none' on inactive chips, which overrides the browser's focus outline.
- **Fail-first test:** Cypress: Tab to the list view Delete button and assert its computed opacity is '1'. Tab to a status chip and assert its outline-style is not 'none' (or it has a ring box-shadow).
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —

### J-15 · Medium · a11y · 🔴 Open
**Most secondary text is gray-400 or gray-300 at 10-12px, with contrast of 2.6:1 and 1.47:1, below WCAG AA**
- **Where:** `src/components/job/KanbanView.jsx` : 40, 46, 50, 54-55, 60, 69 (and src/components/job/Field.jsx:20, 23, 33, 52-53; src/pages/JobTracker.jsx:164, 201; src/components/job/ListView.jsx:146-147; src/components/job/StatusHistory.jsx:78; src/components/job/TasksTab.jsx:34, 80, 98)
- **Repro:** 1. Open /jobs with the demo job. 2. Read the card's location, salary and 'Applied' lines (10px gray-400) or a 'Due soon' deadline (amber-500). 3. Mark a job Rejected and open Overview: the locked field labels are gray-300.
- **Expected:** Text contrast of at least 4.5:1 (gray-500 or darker), and no data text below 12px. **Actual:** Most card metadata is at 2.6:1, 'Due soon' at 2.15:1, and the locked labels at 1.47:1.
- **Fix hint:** Define semantic text tokens (muted = gray-600, subtle = gray-500) and stop using gray-300/400 for text. Raise text-[10px] data to text-xs. Use amber-700 or red-600 for deadline states.
- **Verified (WF-1):** Ran verify-jobs/v-contrast.mjs. It converts Tailwind v4's oklch tokens (node_modules/tailwindcss/theme.css:229-231, 39, 146) to WCAG contrast against white. gray-300 1.47:1, gray-400 2.60:1, amber-500 2.15:1, indigo-400 3.12:1, gray-500 4.84:1.
- **Fail-first test:** Run the cypress-axe color-contrast rule on /jobs and /jobs/demo_1. Alternatively, a node test over the new token file asserting every text token is at least 4.5:1 on its surface.
- **Owner:** JOBS-UI · **Fix commit:** — · **Test:** —
