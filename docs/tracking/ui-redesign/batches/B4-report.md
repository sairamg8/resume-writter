# B4 report: Editor frame B (stage toolbar, preview states, alert cards, panel clamp, phone notices, browser geometry proof)

**STATUS: DONE. Code and hunt are finished and proven; the final full gate is GREEN: run 37535123642 on `a1040d1c` (read in the job logs 2026-10-07).**

Branch `claude/wonderful-maxwell-vu8xqw`. Base `8056a8ea` (B3 done). Code head `a1040d1c` (src identical to `2d12594b`; later commits are docs). UI only: every live function stays (PARITY-RULE). Owned parity rows: editor-content, editor-design-templates and mobile rows listed in `batches/B4.md`; the drawn-but-not-live items are PARKED (below).

## What changed (src: 11 commits, 8 files)
| commit | change | proof test |
|---|---|---|
| ca6d5e9f | alert strips (import notice with Dismiss, export / import error, red Not saved with the live full / blocked texts) as soft amber and red cards with an icon (`cv-notice-warn`, `cv-notice-bad`); the live texts and the PERF-4 memo contract of `EditorAlerts` stay | 181-ui-b4-editor-alerts |
| 0e82c9f6 | stage toolbar in the canvas look: zoom stepper (50-150 in steps of 25, remembered while the editor stays mounted), paper label, the layout toggle, the Terms / Privacy footer; sticky inside the preview scroll box | 181-ui-b4-stage-toolbar |
| 88e4644c | preview states: Rendering placeholder, the Updating chip, Preview failed with Retry, the font fallback note (both live wordings); `data-preview-status` / `data-preview-pages` untouched | 181-ui-b4-preview-states |
| 5c8aa41a, 5082d812, c2d513be | `usePanelResize({ dockOpen })`: with a dock open FROM 1100 px the panel is drawn no wider than window - 360 (dock) - 320 (the stage's floor); the remembered width (240-640, `cpwtcv-panel-width`) is never changed by the clamp and is drawn again when the dock closes; the drag and the keys start from the DRAWN width | 181-ui-b4-stage-toolbar, panel-resize unit files |
| 823b064b | the Editor calls the hook with its dock; the 4 px resize handle is in the cv tokens (hairline, brand on hover, pressed on press), title, hit area and separator props unchanged; a notice (portalled to the body) is lifted above the phone's Edit / Preview / Design pill by an unlayered rule | 181-ui-b4-editor-wiring |
| 2b064c2a | hunt: a press on the handle that changes nothing (a click, a drag at the dock's limit, an arrow at the limit) remembers nothing; a drag is held to the limit | 181-ui-b4-hunt-resize |
| e08899bb | hunt: the Updating chip leaves the corner only where the dock sits BESIDE the stage (from 1100 px); the notice lift's media query is the exact complement of the pill's (`not (min-width: 768px)`) | 181-ui-b4-preview-states, editor-wiring |
| 3025f8c1 | hunt: a gap below the alert cards (`pb-2 empty:hidden`); the stage toolbar bleeds to the preview box edges | 181-ui-b4-hunt-layout |
| 2d12594b | hunt round 2: the card messages (import notice, export / import error, Not saved, Preview failed) break long words (`break-words`: a file name with no spaces ran under Dismiss on a phone); the resize handle is `z-20` above the `z-10` sticky stage toolbar (its widened hit area lay under the toolbar's strip); the toolbar keeps only `sticky top-0` (a `left-0` could not act: see Known limits) | 181-ui-b4-hunt-layout, 181-ui-b4-editor-wiring |
| 97c69316 | hunt round 2: an arrow step past the dock's limit remembers the width it DREW, not the one it asked for (closing the dock then drew a width never seen) | 181-ui-b4-hunt-resize |

Files: EditorHeader.jsx (EditorAlerts), EditorPreviewPane.jsx, LayoutToggle.jsx, PdfPreview.jsx (state markup only), FontFallbackNotice.jsx, usePanelResize.js, Editor.jsx (7 lines), index.css (two unlayered rules). Tests added: 181-ui-b4-{stage-toolbar, preview-states, editor-alerts, editor-wiring, hunt-resize, hunt-layout}.test.mjs and `tests/playwright/ui-b4-editor-layout.spec.mjs` (19 tests: six widths 1440, 1280, 1100, 1024, 768, 390 with and without a dock; a stored 640 px panel at 1100 / 1180 / 1280 with each dock, asserted at 420 / 500 / 600 px; the Updating chip against the dock and the pill; the 390 px dock fills the screen).

## Fail-first proofs (the job's own "fails without / passes with")
| commit | tests | fails without | passes with | run |
|---|---|---|---|---|
| 2b064c2a | 181-ui-b4-hunt-resize | # fail 4 | yes | 37532085891 |
| e08899bb | 181-ui-b4-preview-states, 181-ui-b4-editor-wiring | # fail 2 | yes | 37532085891 |
| 3025f8c1 | 181-ui-b4-hunt-layout | # fail 2 | yes | 37532085891 |
| 97c69316 | 181-ui-b4-hunt-resize | # fail 1 | yes | 37533486479 |
| 2d12594b | 181-ui-b4-hunt-layout, 181-ui-b4-editor-wiring | # fail 3 | yes | 37534569429 (its tests job and the geometry spec, 19 of 19, green) |
The earlier build commits were proven in runs 37528143027 (red, read and fixed) and 37528612848 (green).

### Geometry spec, mutation pair (throwaway commits, reverted at once; src after each revert identical, checked with git diff)
| mutation | commit / revert | run | red |
|---|---|---|---|
| M1: the dock is a flex sibling below 1100 px (the five `max-[1099px]:` utilities removed, `overlay={false}`) | f34bf825 / 04275d9b | 37532126208 | the 1024, 768 and 390 px frame tests (dock `static` where it must overlay; the stage 44 px at 768; the sidebar 30 px at 390) and "390 px: the dock is the whole screen"; the six stored-640 tests stay green (they run from 1100 px) |
| M2: the clamp off (`usePanelResize({ dockOpen: false })`) | d781dce3 / cbd8dbb4 | 37532195382 | all six stored-640 browser tests (panel 640 where 420 / 500 / 600 is required) and 3 of the 5 cases of 181-ui-b4-editor-wiring; the six-width tests stay green |
| M3: the Updating chip above the dock (`z-50` on the chip span) | c33ef9b1 / a1040d1c | 37535078126 | READ: `2 failed, 17 passed` in ui-b4-editor-layout: exactly "1024 px, dock open: an edit shows the chip behind the dock" and "768 px, dock open: ..."; the 1440, 1100 and both 390 px chip cases stayed green (lint, build and the named node tests green) |
The two chip tests at 1024 and 768 px were red in both runs and in the first proof run: not the mutations' doing but a real mismatch of mine (below), fixed in `d39ccd83`.

## Proof runs read RED, fixed without weakening
- Run 37528143027: the wiring test's brace check sliced through the `@media` opening brace (58 != 57): fixed by cutting at the rule's own `@media`; the geometry spec at 768 / 1024: the clamp narrowed the panel where the dock OVERLAYS, widening the stage by up to 120 px as the dock opened: the clamp now applies only from 1100 px (`c2d513be`).
- Run 37532085891: the chip tests at 1024 and 768 px. After e08899bb the chip stays in the corner below 1100 px, where the overlay dock (z-30) is drawn on top of it (as on a phone); the spec compared rectangles. The spec now asks what is on top at the chip's centre (the dock's own content) below 1100 px and keeps "clear of the dock" from 1100 px (`d39ccd83`, run 37532938197 green). The CSS comment says so.

## Start-up ledger (tests/pdf/71-startup-chunks, cap 1,100 kB)
| point | run | start-up path | spare |
|---|---|---|---|
| B3 final | 37525795158 | 1083.8 kB | 16.2 kB |
| B4, perf run (head 19d6201b, src identical to 97c69316) | 37534281527 | 1,084 kB (gzipped 340 kB, largest chunk 457 kB) | about 16 kB |
B4 imports nothing new from a start-up file (the editor chunk is lazy). The 71 test passed in runs 37532085891, 37532938197 and 37534569429. The exact line of the final head is in the final gate (not read).

## Performance (run 37534281527, `perf: all`, head 19d6201b, src identical to 97c69316)
PASS, 17 of 17 budgets met (CI ceilings): PDF build Classic 1 page median 46.8-62 ms, large résumé 198-251 ms, keystroke edit to painted pages 269 ms (build 198, open 27, paint 43), browser last key to the pages 408 ms (404 ms with every entry open), longest main-thread task while typing 0 ms. Gate B (information): PDF worker 0 long tasks; main thread 3, longest 110 ms. B3's run was 482-587 ms for the last key on a different runner; the PDF build code is untouched by B4, so this is runner variance, not a gain from B4.

## Bug hunt
- Round 1 (`wf_` of the build-time hunt, 3 lenses: functions, render cost and layout, tests): 9 confirmed, all fixed or restated: the panel clamp applied below 1100 px (c2d513be); a click / a drag past the limit / an arrow at the limit rewrote the remembered width (2b064c2a); the chip scope and the toast media (e08899bb); no gap under the alert cards and a toolbar that did not bleed (3025f8c1); the geometry spec's weak expectations (explicit 420 / 500 / 600 and a separate red for each mutation); the ATS-dock case of the clamp (181-ui-b4-editor-wiring).
- Round 2 (`wf_6ee2360d-690`): confirmed by both skeptics: an arrow step past the limit stored the asked width (97c69316). Refuted: the chip findings (the spec was already fixed in d39ccd83 when the skeptics read it); the Editor re-rendering on every resize while a dock is open (one skeptic: the children are memo and a resize event fires at most once a frame; not a defect); the zoom state not covered by a node test (pre-existing, covered by Cypress 23).
- Round 3 (`wf_3d683b43-dd8`, the round-2 fixes plus a fresh sweep of the whole B4 diff): 2 reported, 0 confirmed: the hunt is DRY. Not confirmed: End remembering 640 while the drawn width stays (the design: Home and End always remember, tested in 181-ui-b4-hunt-resize); a class-pinned z-index test (strengthened anyway in `e31fe372`: the handle's z-index is compared with the toolbar's and kept under the dock's z-30).

## What still differs from the canvas (honest list)
- **Stage caption**: the canvas draws "1 page · A4" and zoom values 76 / 86 / 90 (default 90 %); live: "Résumé · A4" and 25 % steps from 100 % (PARKED: NEW-008, NEW-011).
- **Pinch to zoom and a page count on the phone preview**, the storage-full new wording with "Open Documents": PARKED (NEW-009, NEW-010, D-07). The live alert texts stay (the canvas wording is not built).
- **Alert cards**: soft amber / red with an icon and Dismiss in the canvas look; the strip spans the editor's width under the bar; the canvas's separate "Open Documents" button is parked.
- **Resize handle**: still 4 px, hairline at rest; the canvas draws a rail without a handle (the drag stays a live function).
- **A stored 640 px panel** is drawn at window - 680 px while a dock is open from 1100 px (the stage keeps its floor); the canvas draws one fixed panel width.
- **Updating chip**: below 1100 px with a dock open it is behind the overlay dock (as on a phone), not moved onto the editor panel.
- **Toast stack on a phone** is lifted above the Edit | Preview | Design pill (built because B4's phone requirement asks for it; the canvas does not draw a toast).

## Known limits / not proven
- The geometry spec runs in Chromium at six widths; no real phone and no WebKit / Firefox.
- A skeptic confirmed the Editor re-renders on every resize event while a dock is open (the memo children skip it, a resize fires once a frame); it is not a wrong result, and the snapshot could be the drawn width instead of the raw viewport if this ever shows in a profile.
- The stage toolbar sticks to the TOP only. At 150 % zoom, scrolled sideways, the zoom buttons scroll away with the page (as the toolbar did before B4); a sideways stick needs the toolbar narrower than its parent and was not built.
- Accessibility is deferred (no aria / focus / contrast work; nothing added, nothing removed).

## Parked (untouched)
"1 page" count, zoom values 76 / 86 / 90, a 90 % default, the storage-full wording and the Open Documents link, paper layout / font / heading / accent options, pinch to zoom.

## Owner calls taken (defaults)
None needed an answer. `ci.yml` unchanged. No master push, no deploy.

## Full gate
**GREEN, read 2026-10-07.** Run 37535123642 on `a1040d1c` (no inputs): all 15 jobs succeeded (lint, build, suite 1-6, Playwright 1-3, Cypress 1-4; the failfirst, tests and perf jobs are skipped by design). Node suite `# tests` / `# pass` / `# fail` per shard: 1927/1927/0, 2147/2145/0, 2420/2420/0, 2178/2177/0, 1548/1548/0, 1891/1889/0 = 12,111 tests, 12,106 pass, 0 fail (the 5 not passed are skips or todos, not failures). Playwright 66 + 39 + 49 = 154 passed. Cypress 74 + 50 + 90 + 72 = 286 passed (all specs passed on each shard). Start-up line (71-startup-chunks): `start-up path 1083.8 kB of the 1,100 kB cap: 16.2 kB to spare`, unchanged since B2.
Earlier gates were cancelled on purpose because the source changed after them (37534278003 on 19d6201b, 37535008227 on 2d12594b). The owner's summary uses the screenshots `shots/b4-pair-1..4` (built at `cbd8dbb4`; the later source changes are class tweaks with no visible change on those screens).
Status of the re-verification (Phase 1 of AGENT-PROMPT.md): done 2026-10-07, section below.


## Re-verification 2026-10-07 (Phase 1 of AGENT-PROMPT.md, covers B1-B4)
Four read-only reviewers (parity, render cost, layout, test strength) went over B1-B4; the lead re-traced every finding before fixing it. Fixed, each with a test in the same commit:
- R1 + P-1 `69273245`: the Design dock is drawn from id / template / settings / coverLetter, its buttons read the latest résumé through `getLatest`, no `useDeferredValue`.
- R2 `13e2c5f3`: the template gallery is memoised and a pick reads the latest résumé.
- P-2 + T7 `c8a40bba`, then `60a6a2ab`: the account menu's swallowed click uses no timer; Escape is guarded with `isImeKey`; the ime-enter-guard allow-list entry is gone.
- L7 `3d66e6e1`: the preview column holds one display utility. T4 `d6c49dfd`: a guard that no element of the editor's files holds two display utilities of one variant. T5 `6c5d3e55`: a real-Editor scroll-box test.
- The new tests of this round had three bugs of their own (the 180 harness never mounted the gallery; a lazy dock was read before it arrived; a probe counted the wrong function), fixed in `4db5cf3e` and `ab91abff`. The full gate on `ab91abff` is run 37631383439: GREEN.
Fail-first counts read: `c8a40bba` fail 4 without / pass with; `3d66e6e1` fail 1 without / pass with; `69273245` fail 3, `13e2c5f3` fail 2, `c8a40bba` fail 4 (run 37616026360, fails read).
Known limits, not fixed, with the reason: L1 a stored 640 px panel leaves the stage 124-220 px at 768-964 px with no dock (tests pin "no dock: no clamp"; a design call, the owner's); P-3 the lazy New Cover / Career History chunks change offline behaviour (pinned as intended by tests/pdf/178-ui-b1-lazy-fallbacks; the owner's call under PARITY-RULE); L2 the `overlay` prop, `dockBesideFrom` and the Editor's `useMediaQuery` are dead at real widths; L3 the Updating chip sits under the toast stack on desktop; L4 rem breakpoints mixed with px ones; L5 old colours (`bg-[#f5f3ef]`, `bg-gray-*`, `bg-blue-*`, `shadow-xl`) remain in AtsCheckerPanel, EditorResumeTab, ExportDropdown (Dashboard and ResumeCard were restyled in B5a); L6 the alert stack has no height cap on a phone; R3 the preview toolbar renders per key (tiny, by design); R4 the router-hook source scan covers 5 files; T2, T3, T6, T8, T9 test-strength gaps (phone switch truncation guard deleted, class-text pins instead of geometry for alerts / toolbar / toast, useEditorExports letter branches and Share not run, sign-in sizing invariant dropped, some fail-first rows without a read count).
