# Typing freeze hunt — what was reproduced, what is fixed, what is open (2026-10-05, master fa9c6ba4)

Sources: three finder agents (webfreeze = Website field, pipeline = the keystroke pipeline, richtext = rich text and
other typing surfaces) plus the coordinator's own checks. Their scratch scripts were not kept; the numbers and file:line
are below. Status: findings 1 and 2 are FIXED on `claude/typing-freeze-fixes` (= `claude/fix-dev-worker-refresh` + `claude/fix-preview-build-backlog`;
not merged to master); the rest is OPEN.

## Verdict
The owner's "freeze while typing in Personal Info → Website" is REPRODUCED in effect, on the dev server (`yarn dev`), where it
happens on ANY field, not just Website. It is not a hang, loop or regex in the Website code: contacts.js / safeHref are linear
(50 adversarial inputs x 7 functions, n=1e3..1e5, worst 3.8 ms). The owner uses `yarn dev` for the private résumé
(docs/knowledge/05-state-auth-sync.md), which is why they saw it.

## Findings, in priority order

### 1. DEV: the PDF worker cannot start, so every preview build blocks the main thread — HIGH (dev), 100 % — FIXED
- **Fixed in `13733061` on `claude/fix-dev-worker-refresh`** (vite.config.js `react({ exclude })` with an anchored `PDF_WORKER_JSX`; test
  tests/pdf/110-dev-pdf-worker-no-refresh.test.mjs; the CI `failfirst` job now also reverts vite.config.js). CI: fail-first 37258868807 green (a real
  one: without the config change the test fails on "42 module(s) the PDF worker loads import /@react-refresh"); 110 + dead-code + knowledge-docs
  unit tests 37258878675 green. Dev, same 46-key run before -> after: worst stall 1165 -> 284 ms, longest key delay 1241 -> 184 ms.
- A first version (branch `claude/fix-dev-pdf-worker`, `657db166`, with the pattern in a new `src/utils/pdfWorkerModules.js`) was REJECTED in review:
  tests/unit/dead-code.unit.mjs would fail (a src/ module only vite.config.js imports), and its failfirst "proof" failed for the wrong reason
  (the revert deleted the module and the config no longer loaded). That branch and `claude/tmp-dev-worker-unfixed` are superseded: the owner may delete both.
- The finders' suggested fix (drop react() from `worker.plugins`) was WRONG: `worker.plugins` only applies to production worker bundles; on the dev
  server the main plugins also transform the worker's modules. The fix excludes the worker's JSX from Fast Refresh instead (plugin-react's `exclude`).
- Still on dev after the fix: ~100-280 ms long tasks per key on a 14-job résumé = React's dev-mode re-render of the whole editor (PERF-4; 14-16 ms/key on prod).
- One unexplained observation (not reproduced in the clean re-run): after a synthetic burst while the pane flipped hidden/visible, the preview stayed 'rendering'
  for minutes although a direct build through the app's own queue took 1.8 s; a reload recovered. A clean 46-key run settles 2.2 s after the last key.
- Confirmed by 3 agents and by the coordinator: `new Worker('/src/utils/pdfWorker.js?worker_file&type=module', {type:'module'})`
  -> onerror "Uncaught ReferenceError: window is not defined" at /@react-refresh:599.
- Cause: on the dev server the main plugins (`worker.plugins` is build-only) wrap every JSX module the worker loads with plugin-react's Fast Refresh
  wrapper, which starts with `import "/@react-refresh"`; that runtime's line 599 assigns to `window`. pdfBuild.js `giveUp()` (:43-51) then runs every
  build on the main thread (`runHere`). Production builds carry no wrapper and CI tests ./dist, so nothing caught it.
- Evidence: 9-page Sidebar résumé + photo, 46-char URL typed one char per key into Website: 200 ms/key -> 20 long tasks, 7.75 s blocked of
  10 s, worst 1.0 s, key lateness ~1 s; 120 ms/key -> 91 % blocked. 7 pages / 40 chars: 54 long tasks, 11.9 s blocked, typing took 18 s
  instead of 8. Real key events: one keydown->input took 1.23 s. Same keys on prod: 0 long tasks.

### 2. PROD: stale builds pile up in the worker queue (preview looks frozen for ~10 s) — MEDIUM-HIGH, 2/2 — FIXED
- **Fixed in `dd572528` + `9782f300` on `claude/fix-preview-build-backlog`** (src/components/PdfPreview.jsx; tests/pdf/111-preview-one-build-at-a-time.test.mjs;
  90-preview-newer-render, 90-preview-mechanics, 90-preview-canvas-memory and 97-preview-steady-typing updated: they held two builds in flight at once).
  A pause while a build runs now queues ONE build, of the latest change (a newer change replaces it; hidden or unmounted drops it) and it starts the moment the
  running one finishes. CI: fail-first 37259106000 green. Coordinator's own run on the prod bundle, 12-page Sidebar résumé, 72 keys (2 keys, 420 ms pause, repeat),
  before -> after: jobs posted 25 -> 6, queued at once 15 -> 1, oldest job waited 19.4 s -> 1.45 s, preview settled after the last key 21.6 s -> 5.1 s.
- A build that never settles holds back the queued one: on the worker path the FIFO already blocked behind it, and on the main-thread fallback it is new (before, builds there
  ran side by side). The watchdog of finding 3 ends both with an error and Retry.
- Steps: 9-page Sidebar résumé (21 entries + photo); Personal Info → Website; type 73 chars as 2 quick keys, 420 ms pause, repeat.
  Script: repro-backlog.js. Result: 25 build jobs for 73 keys, 11-12 queued at once, oldest waited 9.7-10.7 s, preview settled
  10-11 s after the last key. Steady 160 ms typing: 1.5 s lag. 4-page Classic: no backlog. Page stays responsive (worker).
- Cause (coordinator read the code): PdfPreview.jsx:139-141 — with a build in flight `due = DEBOUNCE_MS`, `delay = min(DEBOUNCE_MS, due)`,
  so any pause >= 350 ms posts another build without waiting for the running one (the comment at :134-136 says it should not).
  pdfWorkerJobs.js:36-42 `runJobs` is a FIFO chain with no cancel/supersede; `unwanted()` is checked only after a job returns.

### 3. PROD: a worker job that never replies kills the preview for the session — MEDIUM, 2/2 (open row R2-142 "no watchdog") — FIXED
- **Fixed on `claude/fix-worker-watchdog`** (built on `claude/typing-freeze-fixes`): two layers. (a) `src/utils/pdfBuild.js`: the job the worker is on (the
  oldest pending; a job waiting its turn is not timed) gets 60 s; past it the worker is terminated, that build fails with "building took more than 60 s — a font
  may not be reachable" (the preview shows it with Retry), and the jobs behind it are re-posted, in order, to a fresh worker. The main-thread
  fallback (`runHere`) has the same limit, which also releases the preview's queued build behind a never-settling one. (b) `src/templates/pdf/shared/pdfFontLoader.js`:
  a face's FIRST fetch is waited for 10 s (react-pdf's own fetch has no timeout and no signal), then the face counts as not loaded and the font prints in Noto Sans
  with the usual notice; the wait is paid once a minute (not every build), and data that arrives late is used by the next build,
  and the preview builds again when it lands (faceFetched), so the notice does not wait for the next edit.
  Tests: tests/pdf/112-pdf-worker-watchdog (9) and tests/pdf/113-font-load-stall (2).
- Coordinator's own run on the prod bundle (stand-in blob worker, fonts from the CDN never answer): the first build came back after ~12 s with `fallback=Literata`, the preview
  was ready at ~14 s with "Literata could not be loaded — the PDF uses Noto Sans in its place", the worker not restarted (before: 'rendering' for ever). A worker that
  swallows every job: the alert and Retry appeared exactly 60.0 s after the job was posted, the worker was terminated, Retry started a fresh worker and the preview was ready.
- Accepted, from the second-agent review: (a) with a dead CDN, a build that chains several distinct CDN fonts (body, name, heading, script fallbacks) waits 10 s per family, so
  past 60 s it fails with Retry rather than falling back, and the fresh worker has no memory of what stalled; (b) a face that stalls while others of its family load borrows
  a donor's data, and if its own data lands during that same build's layout the build may lay out with an unprimed font (it heals at the next prepareFonts); (c) a
  browser whose worker hangs silently from the very first job would loop on Retry instead of falling back to the main thread (the 'not proven' fallback is for worker errors only).
- Caveat of any finite limit: a build that is only slow (a very poor connection, a huge résumé) fails at 60 s with Retry rather than waiting; Retry restarts it, and
  fonts that finished downloading meanwhile come from the browser's cache.
- Steps (simulated stalled CDN font fetch inside the worker; pipeline-repro-snippets.md): big résumé, Design -> "Ledger" (PT Serif).
  Result: "Updating preview…" forever (60+ s), no error, no Retry; all later builds, Export PDF, 1-Page Fit, ATS view and thumbnails queue
  behind it; only a reload recovers. A real stall is only hinted at (first Lato load took 6.6 s).
- Cause: react-pdf fetchFont has no timeout (@react-pdf/font/lib/index.js:209); pdfFontLoader.js:496 awaits all faces; pdfWorkerJobs.js:38 serial
  queue; pdfBuild.js:91 `pending` has no timer; PdfPreview.jsx:144/178 `building.current` never decrements while hung, so MAX_WAIT is lost too.
- Fix direction: watchdog in pdfBuild.run (restart worker, reject job -> error + Retry) + timeouts on font fetches.

### 4. PROD: React error #185 on >= 51 back-to-back input events; the keystroke is dropped — MEDIUM-LOW, 4/4 + 5/5
- Found independently by pipeline and richtext. Focus Full Name (or Location / Summary), `key x repeat 100`: uncaught "Minified React error
  #185" at input #52-53, one character lost (99 of 100); page survives. Dev stack: dispatchSetState <- patchActive (useResumeStore.js:257)
  <- updatePersonal (:414) <- PersonalInfoEditor.jsx. Not seen at 30 ms/key (150 inserts) or 80 ms/key, nor in the ATS textarea (no résumé-store write).
- Why it matters: after a main-thread stall (finding 1) queued keystrokes replay as one burst, so on dev characters can be dropped too.
- Root cause NOT pinned. Suspect: a per-keystroke sync-lane update from an effect keyed on appState, e.g. `setSaving(...)` at
  useResumeStore.js:163-185 (React 19 nested-update limit is 50). Needs a bisect.

### 5. Cross-tab: concurrent typing in two tabs of the same résumé loses edits — MEDIUM, 2/2 (webfreeze + pipeline)
- Tab A types Website (or Full Name) while tab B edits a DIFFERENT field once/with 4 chars: B's edit (or A's later characters) vanish in both tabs.
  No ping-pong write loop; an idle second tab is fine. (richtext's same-field insert test converged: loss needs both tabs typing inside the save window.)
- Cause: whole-résumé merge — keepUnsaved (unsavedJobs.js:14-21) via withOtherTabsSave (useResumeStore.js:71-89, :78; onStorage :205-226).
- Fix direction: field-level 3-way merge.

### 6. Quadratic regex on every keystroke in the ATS job-description box — LOW-MEDIUM
- atsChecker.js:450-457 POSTING_ADDRESS, e-mail alternative `\S*[^\s@]@[^\s@]\S*` (used :470, :509 via blankPostingAddresses); AtsCheckerPanel.jsx:128 recomputes
  on each key. Coordinator timing of the alternative alone on 'a'*n: 5k 19 ms, 10k 76 ms, 20k 302 ms, 40k 1.2 s (4x per doubling).
  A normal 20 kB posting costs 17-117 ms/key; a 10 kB unbroken token inside it ~1 s/key. Sibling of the fixed displayUrl bug.

### 7. Lower-severity / reach-limited
- richText.js:111 buildTree: `'<p'*n` cubic (n=1000 -> 1.9 s, 1500 -> 6.2 s); `'<!'`, `'<?'`, `'<a '`, `'</p'` x n quadratic. Only via pasted/imported HTML
  (typing escapes '<'). Pasting `'<p'*800` froze the editor 1.19 s. Nesting > ~25 000 tags throws RangeError.
- bulletOptimizer.js trailing-run regexes (`[^a-zA-Z]+$`...): 'http://' + '/'*1e5 + 'x' = 7.5 s. Not reachable by normal typing.
- Sidebar template: build time grows ~0.5 ms per char of an unbreakable contact/label (pdfMeasure.js:191/202 breakToFit/runsThatFit, textWidth :49): 2 000 chars +1.2 s, 20 000 chars ~9 s.
- Huge paste in non-sidebar templates: Classic 1.3 s at 50 k chars, 12.7 s at 200 k (superlinear above 50 k); later previews queue behind it.
- RichTextEditor.jsx:17, :92-96, :268-270: a compositionstart with no compositionend (synthetic, no real IME tried) stops saving until compositionend; a reload loses the text. Clear isComposing on blur.
- Job Tracker with 3000 jobs: first search keystroke = one 696 ms long task. 5.7 MB plain paste: 6.8 s + 6.9 s stall.
- Per-keystroke cost on prod grows with expanded entries (1 page ~9 ms, 7-9 pages 14-20 ms; whole editor re-renders — PERF-4). Dev 50-60 ms/key.
- Nit (a11y/markup, deferred per owner rule): `<button>` nested in `<button>` in PhotoSection header (console error on load).

## Ruled out (with coverage)
- contacts.js (contactItems/contactHref/displayUrl), safeHref and 79 other input families in decodeEntities, plainTextToHtml, atsPlainText, markdownExport,
  coverLetterText, parserText, jobFields, workspaceSearch, jobQuery: linear.
- Every intermediate Website state typed on prod (h, https:, https://, www., //, ., .., /, mailto:, javascript:, upper case, spaces, trailing slashes, %-encoding,
  CJK / Arabic / Hebrew / Hindi / emoji / combining / zero-width / RTL override, <>"'): all build; no error, loop or worker death.
- 18 templates x link style / contact style / layout / header align / photo hidden with Website, Display label, Link URL of 20 000 chars and 20 000 slashes:
  no hang (non-sidebar max 2.3 s). All 19 templates on 7 pages: worker build 0.84-1.17 s, 0 long tasks.
- 1-Page Fit is not on the typing path (click only, finite ladder). Link annotations with odd hrefs, photo conversion: not stalls.
- Single-tab dropped/duplicated/reordered characters and caret jumps (20+ runs), undo/redo/format keys, RichTextEditor at 100k-char line and 5000 bullets (no per-key stall),
  hidden preview, typing during first build, reload mid-typing (pagehide flush works), memory/canvas/worker leaks over 167 s, store writes (coalesced, no loop).

## Caveats
- The shared browser pane was often occluded: rAF throttled (~1 fps), tabs flip to `hidden` when another agent fronts one. Agents relied on longtask / drift / worker timings,
  re-fronted before each run, and quote only numbers with a zero `hidden` counter. Most timing runs used synthetic input events with real timers; a few used real key events.
- Several dev vs prod numbers were taken while three agents shared the CPU; surprising ones were re-run.
- A real network stall (finding 3) was only simulated. Real IME, drag-and-drop, the link dialog, template switching mid-typing and the font-search box were not covered.
- Coordinator-verified: finding 1 (own Worker test), the code paths of findings 1-3, and finding 6's timing. Agent-reported, not re-checked by the coordinator: findings 4, 5, 7.
- The hunt itself changed nothing in the repo (only the git-ignored .claude/launch.json got a `flowcv-prod` entry); the fix for finding 1 is the one commit above. No tests were run on this machine.
- CI gap, closed: the `failfirst` job reverted only `src/`, the yarn patch and yarn.lock, so a fix in vite.config.js could not be proven by it; it now reverts vite.config.js too (ci.yml, `13733061`).
