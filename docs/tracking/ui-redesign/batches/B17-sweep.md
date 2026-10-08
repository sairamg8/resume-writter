# B17 cross-width sweep

Screens captured at 1440, 1280, 1100, 1024, 768, 390 px (ci.yml `shots`, run 37782680965): dashboard, editor with the ATS dock, new resume, Applications board/list/detail, Projects list/board/list view, Your work.

## Fixed (test: tests/pdf/190-ui-b17-width-sweep.test.mjs)
- PageHeader actions were shrink-0, so they never wrapped: at 768 px the Job Tracker's Add job button ran off the right edge. Now max-w-full.
- Projects table "8 open · 10 total" wrapped to two lines at 1440; project list Key (LIFE-1) wrapped at every width. Both whitespace-nowrap.
- Your work at 390: the status lozenge (`hidden sm:inline-flex`) still showed (it sets its own display) and squeezed titles to three letters. Now max-sm:hidden.
- Job Tracker search placeholder was cut at "locat": sm:w-72.
- Spec: editor and jobs shots at 390 had timed out (waits for a preview / text not present on a phone); now tolerant.

## Not fixed (not in this batch's files)
- src/components/job/ListView.jsx: Salary ($150k - $190k) and Applied date wrap onto 2-3 lines at 1100 and below; needs whitespace-nowrap on those cells.
- src/components/EditorHeader.jsx: at 1100 and below the toolbar wraps to two rows (Export alone top right, tabs/ATS/Design below).
- src/components/board/ProjectTabs.jsx: at 768 the project tabs are cut (Calendar half shown, List hidden) with no visible scroll cue.
- Project board filter bar wraps to 2-3 rows at 1100 and below (Group by drops down).
- Projects table at 768: Issues/Updated columns are off-screen and Name truncates to "Person..." while room remains.
- New resume cards: long template names/descriptions end in ellipsis (by design).
