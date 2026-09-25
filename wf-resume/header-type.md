# header-type cluster: resume point (2026-09-25; delete this file once wf-reports/header-type.json lands)

Branch `claude/wf-header-type`, base 334b454 (origin/master). Everything below is pushed.

## Done
- R2-137 fixed: 7d175c3 (summaryGap, headerRuleGap, headerPadY/X, headerGapBelow rows; Modern and Sidebar
  read the keys; letterhead gapBelow and Modern band padding; Word summaryGap/headerGapBelow) and 7aa467a
  (contactsSideGap: CoverLetterHeaderPDF, plus a stepper under Right of Name in CoverLetterPanel; no parity
  entry because the walker does not walk the Cover Letter panel). Tests: tests/pdf/92-header-spacing-rows,
  27-header-spacing, 73-typed-number-fields, parity/registry-header.mjs, parity/01-offered.
  CI: 36087994740 green, failfirst 7d175c3 ok (21 fail without); 36088109698 green, failfirst 7aa467a ok (2 fail without).
  Word has no Modern band or side-by-side letter contacts, so headerPadX/Y and contactsSideGap don't reach Word.
- R2-146 partial: 6f04c7d font-fallback notice (src/utils/fontFallback.js, FontFallbackNotice.jsx), 2fda3bc test fix,
  b5b0b2f Title Spacing (sectionLetterSpacing), f3b31ef Job Title size (fontSizeTitleDelta). Tests:
  tests/pdf/92-font-fallback-notice, 92-title-spacing, 92-job-title-size, parity/registry-design.mjs.
  CI: 36088466885 and 36088621258 green, failfirst ok. Remaining: name font, per-section font,
  Title Spacing on the Sidebar's side-column titles.
- Independent reviewer (running when this note was written) pushed 17e2c70, f35e664, 4f3f386.

## Next (a cold start)
1. Check whether the reviewer finished: find the latest ci.yml workflow_dispatch run on this branch and make sure
   it ran on the branch head and is green. If not, dispatch it: `tests` = every file above plus
   parity/00-registry, 11-type, 15-design-defaults, 21-header-gaps, 05-fonts-scripts, 41-word-gaps, 04-word-export,
   12-cover-letter, unit/letterhead; `failfirst` = each reviewer fix commit with its test; playwright
   tests/playwright/pdf-cover-letter.spec.mjs, cypress cypress/e2e/05-cover-letter.cy.js.
2. Write wf-reports/header-type.json (CLUSTER-PROTOCOL "Finish"), with the reviewer's issues in "review".
   notes: a11y, the notice is a plain <p> with no live region; letterhead.js's unused `templateId` import is
   already on master. Commit it as `chore(wf): header-type cluster report` and push. Delete this file in the same commit.
