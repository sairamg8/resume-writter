# section-style cluster — cold-start note (2026-09-25 ~03:10 UTC)

Branch `claude/wf-section-style`, base origin/master 334b454. Row R2-147 (3 tasks). NO report yet
(`wf-reports/section-style.json` is still to write, last, after a green CI on the final head).

## State
| Commit | What | CI |
|---|---|---|
| c017a8b | Bullet marker: Design → Lists (bullet/dash/circle/none), PDF via BulletStyle context in PdfRichText, Word numbering; parity `setting.bulletStyle` + parity/17-lists; test 94-bullet-style | tests pass (run 36088741695); failfirst job in run 36088243126 — check its result |
| 14e212c | Skills separator Pipe ' \| ' (skills.js, SectionEditorCustomizer); parity `section.separator` measure; test 94-skills-pipe | pass, failfirst ok |
| 19ce8d1 | Page numbers footer: settings.pageNumbers, PdfPageNumbers + bottomMarginMm (PdfPage.jsx) in all 9 templates, cover letter forced off, Word footer (wordExport.js), DesignPanelPageNumbers.jsx; parity `setting.pageNumbers` family 'footer' + parity/18-page-numbers; test 94-page-numbers | **FAILS**: "Page n of N" never found in the PDF on any template; Sidebar also reports "the content moved". Word-footer and cover-letter tests pass. |
| 39f4a60 | Reviewer fixes: skillSeparator uses Object.hasOwn; panel shows `pageNumbers === true`; bullet test skips Circle offline | pipe test pass; failfirst 39f4a60 in run 36088741695 — check |
| 893aa53 | Footer gets left:0 + right + textAlign right (width-0 theory) | **did not fix it** (run 36088741695 still 12 fails) |

## Next step (page numbers)
- Diagnose on CI only: add a temporary debug assertion printing the page items near the bottom (or allText) of a pageNumbers:true render, to see whether the text prints split into several items (the tests match one item `^Page \d+ of \d+$`), prints nowhere, or prints off-page.
- Suspects: (1) pdf.js splits "Page 1 of 3" into several items → match on the page's joined text instead; (2) react-pdf dynamic `render` Text on the custom Text wrapper (PdfText adds hyphenationPenalty) — try react-pdf's own Text or a `<View fixed>` wrapper with an inner `<Text render>`; (3) the Sidebar's "content moved" means the footer takes flow space there (page flexDirection 'row') — wrapping in an absolute fixed View should fix it.
- Then re-run: tests "tests/pdf/94-page-numbers.test.mjs tests/pdf/parity/18-page-numbers.test.mjs" + failfirst for the final fix commit; then the full set from run 36088243126 (22 files + cypress/e2e/17-section-options.cy.js) on the final head; then write the report.

## Review (done)
Independent reviewer: no blocking issues. Fixed in 39f4a60: prototype-key separator, panel `=== true`, offline Circle skip.
Notes for the report: Skills' own bullets (Skills style Bullet, Sidebar stacked skills, Word buildSkills) still print • whatever
Design → Lists says; "Page n of N" is English only and is PDF text an ATS may read; 10 mm min margin puts the number ~3 mm from the edge;
a no-break space before the pipe would stop a Sidebar wrap before '|'; JSON Resume does not carry bulletStyle/pageNumbers.
a11y (deferred, note only): SegmentControl buttons lack aria-pressed/type=button.
Remaining for R2-147: section icons, link styling, level visuals, grouped roles, column layout, photo greyscale/position.
