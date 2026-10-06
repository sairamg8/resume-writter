# B3 report: Editor frame A (tabless bar, Resume | Cover Letter switch, ATS chip, one right dock, URL contract, phone frame)

Branch `claude/wonderful-maxwell-vu8xqw`. Base `9470795` (B2 done). Code head `7da17de8` (the gate head; docs-only commits follow it). 68 parity rows owned (56 live-function rows: SAME 23, MOVED 12, RESTYLED 10, CHANGED 4, MISSING 7; 12 drawn-but-not-live items). The four CHANGED rows are built as the live function, not the drawing, each with a negative twin: EDIT-019 the sync dot keeps all its states (the editor header's own account mount, `EditorAccount`); EDIT-026 Export, Share and Import stay in the bar on every width, a phone included (the Export menu holds Share and Import there); EDIT-141 any pick of a document, Edit or Preview on a phone returns the phone to Edit and closes the dock (180-ui-b3-phone-frame); EDIT-171 the preview and Export follow the open document, and the Design button opened from the letter switches to the Résumé (180-ui-b3-letter-doc).

## What changed (src: 12 commits that stay, 1 replaced, 12 files)
| commit | change | proof test |
|---|---|---|
| 8665daa2 | the save status is its own memo leaf (`EditorSaveStatus`: four states, the 30 s tick, red Not saved), given by the Editor as an element, never through the header; `editor-bar` and `editor-sidebar` testids | 180-ui-b3-save-chip |
| 9e6470af | the address: `?tab=resume|coverletter` is the document, `?dock=design|ats` the dock; old `?tab=design` / `?tab=ats` links open their dock and are rewritten with replace, the import notice kept | 180-ui-b3-editor-url |
| ebdbd797 | ONE right dock (null, design, ats) hosting the live DesignPanel or AtsCheckerPanel whole, a Resume | Cover Letter switch, a content-only editor panel; `useEditorTab` now returns `{ doc, dock, setDoc, setDock }` | 180-ui-b3-editor-dock, dock-typing, no-tabs |
| c301e8ad | the full-width bar of memo leaves (back, rename with pencil, switch, ATS chip, save chip, Design, Export, Share, sync dot, account) and the phone frame (the switch and a 44 px ATS chip under the header, the Edit / Preview / Design pill) | 180-ui-b3-editor-bar, phone-frame, letter-doc |
| 2e699c0c | the bar by width: one row from 1280 px, two below, and on a phone the save chip on a row of its own | 180-ui-b3-bar-layout |
| 0b228dd3 | the bar is a layer above the dock, so the Export menu is not drawn under the overlay | 180-ui-b3-bar-layout |
| d1e932de | hunt H1-1: the alerts (export and import errors, import notice, storage full) are a row under the bar, visible in every layout (they sat in the editor panel, hidden in the preview-only layout and on the phone's Preview, where Export is still reachable) | 181-ui-b3-hunt-alerts |
| 162de2c2 → fcc30e81 → 3b9ca017 | hunt H1-2/3, round 3 H1-1/H1-3, round 4 H1-1: the ATS panel is drawn from the résumé after the 250 ms pause, but its buttons (+ on a missing keyword, the three section fixes, Copy / download, the Classic switch and its Undo snapshot) act on the LATEST résumé through `getLatest` (a stable function over a ref). The first attempt (162de2c2) re-drew the panel on pointerdown, which moved the chips under the finger; replaced | 181-ui-b3-hunt-ats-latest |
| d3017b09 | hunt H1-7, H2-14: the switch's buttons are 44 px tall on a phone (the 44 was on the frame around them: each button was 36), and the Design button hides by the Editor's own phone flag, the one that draws the pill (it was `max-md:hidden`, a rem breakpoint: with a larger browser text size neither showed between 768 px and the rem width) | 181-ui-b3-hunt-bar |
| c7391ba1 | the Design button is `hidden` or `flex` by the flag, never both display utilities (found by the bar-layout mirror) | 180-ui-b3-bar-layout |
| d02692c0 | hunt H2-11/12: with the editor panel dragged wide (up to 640 px) the dock overlays the preview instead of leaving it a sliver (96 px at 1100 px; 276 px at 1280 px): `dockBesideFrom(panelWidth)`, a width query in the Editor | 181-ui-b3-hunt-dock-room, 180-ui-b3-dock-overlay-classes |

Files: Editor.jsx, EditorHeader.jsx, EditorTabContent.jsx, EditorPreviewPane.jsx (the chip extracted), useEditorTab.js, useEditorExports.js; new EditorDock, EditorDocSwitch, EditorSaveStatus, EditorMobilePill, DesignDock, AtsDock; AtsCheckerPanel.jsx and usePickCard.js (the latest-résumé reads; `pickCard` is the hook's logic without the hook).

Tests landed: 11 new files (180-ui-b3-{save-chip, editor-url, editor-dock, dock-typing, dock-overlay-classes, letter-doc, no-tabs, editor-bar, phone-frame, bar-layout} and the helper 180-ui-b3-editor-mount.mjs; 181-ui-b3-hunt-{alerts, ats-latest, bar, dock-room}); rewritten with the same intent on the new parts: 173 (the render-count net), 32-editor-tab-scroll, 89-editor-tab-link, 105-r5-hunt2, 178-ui-b1-test-hooks, 103-r4-dvis-12 (the narrow-panel rule restated for the switch, the chip and the Design button), the waits of 180/173 (by what the screen shows, never a fixed settle); e2e: the Cypress and Playwright helpers and 02, 04 x2, 05, 21, 22, 23, 26, 27, picker, typography, phone-reach moved onto the new testids (`doc-switch-*`, `ats-chip`, `design-button`, `dock-design`, `dock-ats`, `pill-*`, `editor-bar`, `save-status`).

## Fail-first proofs (read from the job logs; "fails without / passes with" is the job's own pass)
| commit | tests | fails without | passes with | run |
|---|---|---|---|---|
| 8665daa2 | 180-ui-b3-save-chip | # fail 11 | yes | 37519323495 |
| 9e6470af | 180-ui-b3-editor-url | # fail 14 | yes | 37519323495 |
| ebdbd797 | 180-ui-b3-editor-dock, dock-typing, no-tabs | yes (count not read) | yes | 37519323495 |
| c301e8ad | 180-ui-b3-editor-bar, phone-frame, letter-doc | yes (count not read) | yes | 37519323495 |
| d1e932de | 181-ui-b3-hunt-alerts | yes | yes | 37519323495 |
| d3017b09 | 181-ui-b3-hunt-bar | yes | yes | 37519323495 |
| d02692c0 | 181-ui-b3-hunt-dock-room | yes | yes | 37519323495 |
| 2e699c0c | 180-ui-b3-bar-layout | yes (parent's files) | yes | 37519961910 (the first proof run read RED with the fix: the bar mirror and the Design button, below) |
| 0b228dd3 | 180-ui-b3-bar-layout | yes | yes | 37519961910 |
| c7391ba1 | 180-ui-b3-bar-layout | yes | yes | 37519961910 |
| fcc30e81 | 181-ui-b3-hunt-ats-latest | yes | yes | 37522197837 |
| 3b9ca017 | 181-ui-b3-hunt-ats-latest | yes | yes | 37523255819 (the first run, 37522818145, read RED with the fix: the test looked for the Undo inside the page; the notices are drawn in the body) |
Proof runs read RED on tests I wrote and fixed test-side, never by weakening: `window is not defined` from a 2 s timer that outlived the page (the ATS test now keeps the page mounted until the panel's own tick ran); the bar-layout mirror read the Design button `hidden flex` as visible (two display utilities decided by stylesheet order: the src now has one); the Undo lookup. The first proof run also showed 3 test-side reds in the old-API tests and 2 Cypress 26 failures (the spec clicked the Design button, hidden on a phone, instead of the pill's Design): fixed in the tests (7106f9e4, e2a464e6, bcbc9639, ffbc77e0).

### The 173 sabotage pair (a router hook in a leaf; the save state through the header)
Throwaway commits, reverted at once (src at the head is identical to before, checked with git diff):
| mutation | commit / revert | run | red tests (and only these files) |
|---|---|---|---|
| M1: `useNavigate()` in the ATS chip leaf | f97336e6 / b7fee4bf | 37522857095 | 6 tests: 5 of 173 (a key renders none of the switch, chip, Design button, alerts or pill; the same with a dock open; the save chip's budget; the sensitivity twins; what the leaves show still updates) and 180-ui-b3-dock-typing (one keystroke with a dock open) |
| M2: `saving={store.saving}` given to `EditorHeader` | 5656c445 / c3a0d276 | 37522904016 | at least 7 (the log tail was read): the same 173 family, 180-ui-b3-dock-typing, and two suites of 180-ui-b3-save-chip (where the chip sits; a keystroke and the write that follows it) |
The correct code passes all of them (run 37519961910, 37523255819).

## Start-up ledger (tests/pdf/71-startup-chunks, cap 1,100 kB)
| point | run | start-up path | spare |
|---|---|---|---|
| B2 final | 37491778368 | 1083.8 kB | 16.2 kB |
| B3 (head bcbc9639) | 37519323495 | 1083.8 kB | 16.2 kB |
| B3 final | GATE_RUN | GATE_STARTUP | GATE_SPARE |
B3 adds NO bytes to the start-up path: the Editor and all its new parts are in the lazy editor chunk (nothing new is imported from a start-up file).

## Other CI reads
- Related node tests (137 files, run 37519961910 at c7391ba1): 136 pass; the one red was 103-r4-dvis-12 (the stale tab-strip test, restated in d4e7a89e and green in run 37521101254's neighbours and the gate).
- Playwright: phone-reach + picker (run 37521101254) all passed; pdf-typography-spacing + parity-ui-controls (run 37521105081, 16 min: parity-ui-controls walks every design control of every template) passed. Cypress 02, 04 x2, 05, 21, 22, 23, 26 (after e2a464e6), 27, 30 passed (runs 37519323495 shards 1-3, 37519961910, 37522197837).
- Performance: PERF_RUN
- Lessons: a layout test that mirrors Tailwind variants must treat `hidden` plus `flex` as one display (the stylesheet decides, not the class order); a `setTimeout` inside a panel keeps a page alive in tests (wait for its tick before unmounting); the fake DOM mounts notices in `document.body`, not in the page; `get_job_logs` of a multi-file job is ~25k tokens a call: filter the saved file with python.

## Bug hunt (5 rounds)
- Round 1-2 (`wf_68b58d50-312`, 36 agents, 3 lenses: functions, render cost, layout and tests): 15 reported, 7 confirmed (alerts hidden with the sidebar; the ATS dock acting on a stale résumé x2; the old-API 178 test; the switch's 36 px buttons; the dock crushing the preview; the rem-vs-px Design button), all fixed or restated. Refuted by skeptics: ATS analysis not paused while the sidebar has focus; the Design panel rendering once per spaced key (deferred, interruptible: a known cost); a stale REACH map in cypress/support/selectors.js; the letter-hides-Share test (the node harness has no Firebase: the rule is pinned by a source test and Cypress).
- Round 3 (`wf_ce273237-bba`, 30 agents, fix regressions + test strength): 13 reported, 2 confirmed: the pointerdown flush re-laid the chips under the pointer (replaced by `getLatest`, fcc30e81) and the test could not see it (the test now runs the pointer-down handlers on the path, and checks the list follows the résumé after the pause).
- Round 4 (`wf_2dae0b21-2e9`, the ATS commit): 3 reported, 2 confirmed: the Classic switch's Undo snapshot read the drawn résumé (3b9ca017), and the third test could pass vacuously (fixed).
- Round 5 (`wf_d92ed8ac-d75`, 3b9ca017 and its test): 1 reported, 0 confirmed: the hunt is DRY.

## What still differs from the canvas (honest list)
- **ATS chip**: the canvas draws "ATS 82" (a score); the live chip says "ATS check" and opens the dock (the score is parked: it would run the scan on every keystroke).
- **Download PDF split button**: the canvas draws a primary "Download PDF" with a chevron; the live Export menu (all formats, Share, Import) stays as the live function (CHANGED row EDIT-026).
- **Share**: the canvas draws Share on every board; the live rule (signed in, cloud, not a letter) stays.
- **Save chip**: the canvas draws a static "Saved"; the live four states stay ("Saved Just now", "Saving…", "Auto-saved to your browser", red "Not saved").
- **Back**: an arrow and "Back" (a word on touch), not "Back to documents".
- **Design dock**: a frame with the live DesignPanel whole; the canvas's rail (Template, Color, Type, Spacing, Headings, More) is B8a. The ATS dock hosts the live panel whole (the canvas draws a custom drawer body; frame only here).
- **Stage toolbar** (zoom 76% / "1 page · A4", the Design button on the stage), the **sidebar cards** (Personal info, Experience cards) and the **letter form**: still the live ones (B4, B5b, B6, B7).
- **Tablet (768 to 1279 px)**: two bar rows (the canvas draws 1440 only).
- **Phone**: the pill and the 44 px rows match; the header carries Export, the sync dot and the account (the canvas draws one Download icon).

## Known limits / not proven
- The bar's rows and the dock's widths are proven by node mirrors of the Tailwind classes and by screenshots at 390, 820, 1280 and 1440 px read by eye; the six-width browser geometry proof (including the 768-1100 band) is B4's Playwright spec.
- The sidebar-focus pause of ATS analysis (in the plan's dock rules) is not built as a separate rule: the 250 ms settle already keeps the scan off the key's own commit (tests 165, 173, 180-dock-typing); a skeptic judged the extra rule not a defect.
- A keyword chip may move when the 250 ms pause ends between a press and its release (as in the old tab).
- Accessibility deferred (no dock Escape or focus handling; nothing added, nothing removed).
- Cypress runs in Chromium only; no real phone.

## Parked (untouched)
Score number on the ATS chip and Documents cards; a letter-specific Design; Share on every board; the static "Saved" line and "Back to documents"; the "1 page" count in the caption; Escape and focus handling of the dock.

## Owner calls taken (defaults)
None needed an answer. `ci.yml` unchanged. No master push, no deploy.

## Full gate
GATE_LINE
