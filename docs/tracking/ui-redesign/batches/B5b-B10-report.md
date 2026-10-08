# B5b to B16 report: Import dialog and New page, editor content, Design, letter, ATS, export and share, Applications, Boards and Projects, Section style popover

**STATUS (2026-10-08): code pushed on `revamp-ui` (head `d4ca9c4`). FULL GATE GREEN on `9d8bd27` (run 37722106416, 19 of 19 jobs: editor, Design, letter, ATS, export/share work). Full gate on `70d732a` (run 37723659495): node suite 6/6 (0 failures), Playwright 3/3 (160 tests), Cypress 3/4; its one red (21-a11y: the Add Section click closed the options popover) was fixed in `d4ca9c4` and read green in run 37725149165; a final full gate on `d4ca9c4` is dispatched (result below when read). B5b, B6, B7 (steps 1 and 2), B8, B9, B10, B12, B13, B14, B15 and B16 are restyles onto the `cv-*` design tokens with every live function kept, plus the lazy Section style popover; B11 (workspace shell redesign), the new Applications/Projects drawers and B17 (integration sweep) are NOT built.**

UI only: every label, aria name, `data-testid`, prop contract and `memo` stays (PARITY-RULE). Tokens are in `src/index.css`; the class mapping used throughout is in `git show 1299f35`.

## What changed (per commit)
- B5b: `98fd034` Import dialog (`ImportDialog.jsx`, lazy) and New page; test fixes `9e59d0d` (file input found by `el.type`), `9f2045a` (the kit Portal's `contents` wrapper), `c6f4e18` (docs name `ImportDialog`, not `ImportMenu`).
- B6 editor content: `1299f35` section card, entry card, field styles, tab controls (Collapse all, Personal Info card, Add Section); `e1ae415` rich text field and toolbar; `90773a7` entry-form leaf rows, skill levels, current box (the Language and Interest delete buttons now carry the name "Delete entry"). Tests: `184-ui-b6-{section-card,add-section,entry-actions,entry-forms,rich-toolbar}`.
- B7 step 1: `5b397ce` Personal Info card, photo, header sections, icon library, spacing steppers; `5e092a3` section customizer. Tests: `184-ui-b7-{personal-info,section-options}`.
- B8: `b3f241a` + `e69de48` Design drawer (`DesignPanel*.jsx`) and `TemplateGallery.jsx`. Test: `184-ui-b8-design`.
- B9 and B10: `bf633dc` export menu, share dialog, ATS drawer, cover letter panel, optimizer, draft and new-letter dialogs. Tests: `184-ui-b9-letter`, `184-ui-b10-ats`, `184-ui-b10-export-share`.
- Repair `ba4f06d` (see the incident below), pin fixes `48b958c`, `9d8bd27`.

## Proofs read in the logs
- B5a fail-first (src of `2ac49220` undone, the five 182 files must fail, then pass): run 37717365466 on `ad342de`, job succeeded. (The earlier red 37646546844 ran at `0140d0f`, before `ImportDialog.jsx` existed, which the 182 helper loads: stale, not a defect.)
- Targeted: 37717476957 (103, 183-import-dialog, knowledge-docs) green; 37718776909 (all three B6 test files) green; 37718597020 (entry actions) green; 37719740833 and 37719694238 (B8, B9/B10 related sets) green.
- Full gate on the repaired head `ba4f06d`, run 37720016702: RED on class pins only (13 node tests in shards 2, 4, 5, 6; Cypress shards 1 to 3), all read in the logs and fixed in `48b958c` and `9d8bd27`: selected-chip checks for `bg-blue-600` / `border-blue-500`, the ATS badge `rounded-2xl`, the skill-levels label colour, Cypress cover-letter and contact chip specs, the ATS checker spec. Targeted re-run 37721271325 on `48b958c`: 87 of 88, the one red (R4-DVIS-24) fixed in `9d8bd27`.
- Full gate on `9d8bd27`: run 37722106416 (see STATUS).

## INCIDENT 2026-10-08: a stale base reverted other work (lesson)
`b3f241a` (the B8 agent's commit) was built on a stale base: a plain `git fetch origin revamp-ui` in a shallow clone does not update `origin/revamp-ui`. It reverted the B6/B7/B9/B10 source files and deleted ten new test files, while the history still showed the other commits. Repaired by `ba4f06d` (42 files restored from `b3f241a^`, the Design files kept, Cypress/Playwright card lookups moved to `[data-testid^="section-card-"]`). RULES NOW: fetch with `git fetch origin +revamp-ui:refs/remotes/origin/revamp-ui`; compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/revamp-ui` before editing; before every push `git diff --stat origin/revamp-ui~1..HEAD` must list only files the author owns.

## What still differs / not built
- B7 step 2: the lazy `SectionStylePopover.jsx` around the unchanged `SectionCustomizer` (the customizer is restyled; it still opens inline).
- The B6 brief's display-only additions (entry counts, one-line card summaries) and wording renames stay PARKED (live labels are walker and test contracts).
- B8: `TemplateThumb`, `LayoutToggle`, `DesignDock`, `StarterTemplateModal` had no old colour classes and were not touched.
- B11 to B17 (workspace shell, Applications, Projects, integration sweep) are not started.

## Known limits (not fixed)
- `AtsCheckerPanel.jsx` (about 600 lines) and `CoverLetterPanel.jsx` (about 370) were already over 300 lines; only restyled.
- Playwright and Cypress specs whose class pins were edited were run only inside the full gates, not alone.
- No bug-hunt rounds and no screenshots next to the canvas boards for B5b to B10.

## Added 2026-10-08 (later): B7 step 2, B12 to B16
- B7 step 2: `5e421c1` + `70d732a` Section style opens in a lazy popover (`SectionStylePopover.jsx`) around the unchanged `SectionCustomizer`, with Done, outside-press and Escape closing; the inline customizer stays as the fallback when the chunk cannot load. Start-up spare after it: 17.7 kB (run 37723239628, 71-startup-chunks). Test: `184-ui-b7-section-style-popover`. One popover is open at a time (the old inline panels could be open together); `21-a11y.cy.js` now opens the Add Section picker first (`d4ca9c4`).
- B12/B13 Applications (the Job Tracker): `a9dd0db`, `ec1d966` pages `Job*.jsx`, `components/job/*`, `components/tracker/*`, `CareerHistoryPanel`, `PublicResume` on the tokens; test `184-ui-b12-applications`; pins updated in 103-r4-dvis-01/09/32 and 103-r4-dph-20. Runs read: 37722474227 (one red: the Notes card pin), 37722711598 green.
- B14 to B16 Boards/Projects: `ab2c98e`, `88f3154` pages `Board*`, `Backlog`, `BoardSettings`, `YourWork` and `components/board/*` on the tokens; test `184-ui-b14-boards`; pins updated in 103-r4-dvis-06/11 and 103-r4-dph-06. Runs read: 37722391177 (671 of 673; the two reds fixed), 37722943348 green.
- The shared kit (`components/ui`) and shell still use the older token NAMES (`text-ink`, `bg-brand`, `border-line`) whose colours are the SAME as the `cv-*` ones (`#151922`, `#2b59ff`, `#e2e5eb`): there is no visible difference, so they were left (renaming only churns kit tests).

## Process notes
- A shared git branch name between two agent worktrees mixed their commits (no content was lost: the diff was checked against the owned file lists). Each agent now uses its own branch name (`work-<area>`).
- Failing in the first full gate on the repaired head were only old-class pins (selected chips, `rounded-2xl`, `rounded-xl`, label colours): always match WHOLE class names (`bg-cv-brand-soft` contains `bg-cv-brand`).
