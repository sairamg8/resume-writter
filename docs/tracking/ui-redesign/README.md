# UI redesign: the simplified CPWT-CV (design canvas), how to resume

Status 2026-10-06 (end of day): the design canvas has **39 artboards drawn** (13 from the first session, 26 added today by a five-area
workflow and then reviewed by the lead), published as version 18. Nothing is built in React for this beyond one old commit (`c259955`, see
HANDOFF.md). The canvas waits for the owner's approval; only then does the React rebuild start.

- Canvas (private Design artifact; its files are the source of truth, read them with the Artifact tool): https://claude.ai/artifact/SjfCTE1dSTgt1UY63uoFiM
- Live app that was surveyed (master, deployed): https://resume-writter.sairamgudiputi8.workers.dev/#/
- Earlier mockups, superseded: https://claude.ai/artifact/PuVb9NgZ7dtCkrKNYaQjGF (v1 tabs, rejected), https://claude.ai/artifact/37an14GjzPqGMccs9MyHFz (three directions; direction 2 chosen).
- Files here: `BRIEF.md` (shared drawing brief + the 2026-10-06 addendum), `AREAS.md` (what each area drew), `tools/` (see below).
- **2026-10-08: THE REBUILD IS ON MASTER (`f43f020`); see RUN-STATE.md and CYCLE.md for what continues.**
- **REBUILD STARTED (2026-10-06, owner's order): read `PARITY-RULE.md` (UI only, every existing function stays) and `RUN-STATE.md` (the plan's
  progress, the 3-hours-on / 2-hours-off cadence and the resume point) before anything else. The rebuild works in the worktree `.claude/worktrees/ui-rebuild`.**

## What the owner decided (in order)
1. The left sidebar of the editor feels cluttered; a first proposal that only added tabs was rejected.
2. "Direction 2": content on the left, the design docked as a drawer beside the page, a section's style as a small popover.
3. "Rebuild the whole flow, simplified UI", shown as DESIGN (a canvas), not code.
4. "Browse the existing UI: there is a lot of things there, look for a simplified design in all those cases."
5. "Ultracode: split the task, and you do the final review."
6. (2026-10-06, mid-run) **No Resume / Cover letter / ATS check tabs in the editor sidebar; the ATS button moves.** Drawn as: the sidebar shows
   only content to edit; "Resume | Cover letter" is a two-way switch in the editor's top bar (centre); the `ATS 82` chip in the top bar opens
   the ATS check as a right-hand drawer beside the page (the same dock the Design drawer uses; one dock at a time). On a phone the same switch
   sits under the header (44 px segments) and the ATS chip is a 44 px button (its sheet is NOT drawn). If the owner meant something else
   (for example no switch at all, or ATS somewhere other than the top bar), it is a one-file-per-board edit: the switch is the `role="group"
   aria-label="Document"` block in each editor board's header.

## On the canvas (39 artboards)
- First session (13): Main (Documents), New, Editor, EditorSection, EditorLetter, EditorAts, Jobs, MobileHome, MobileEdit, MobilePreview, MobileDesign, Paper, Letter.
  Changed today: all editor boards lost the tab strip (see 6); Jobs got the Board | List | Insights switch, the shared toolbar row and AA contrast;
  Main and New got the `/` hint in the global search so every page's top bar is identical.
- Editor, more screens: EditorPersonal, EditorDownload, EditorShare, EditorTemplates, EditorImprove, EditorDraft.
- Applications: JobsList, JobAdd, JobsInsights, MobileJobs.
- Projects: Projects (landing), ProjectBoard (owns the shared project header + tab row), ProjectList, ProjectIssue (drawer), ProjectSettings,
  ProjectCalendar, ProjectTimeline, ProjectSummary, ProjectBacklog (the Plan tab, sprints on), MobileProject.
- Shell and states: ShellMenus, Empty, ImportModal, Public, Legal (Terms; the Privacy view is not drawn), States.
All use ONE shell (top bar: CV mark + CPWT-CV, Documents / Applications / Projects, global search with a `/` hint, avatar). The editor is the one
immersive screen with its own bar. Canvas rows 12-37 sit below y = 8000, one block per area with a title note and one note per area.

## Product calls the owner still has to make (also listed in the final message of the session)
- **Projects** (Jira-style task manager) is outside the stated product goal (résumé + cover letter + job tracker). It is drawn simplified
  (3 daily views + Calendar/Timeline/Summary, sprints off by default, "task" not "issue"). Keep, simplify or remove: the owner decides.
- Cover letters live inside their résumé (no separate list); Career History only in Applications > Insights; template gallery 28 looks to 8.
- Template names on EditorTemplates (Harbor, Ledger, ...) and its filter chips are placeholders, not the app's names; the drawn "Cancel / Use
  template" replaces the app's apply-on-click with Undo.
- EditorDraft follows AREAS.md (Tone Warm/Direct/Formal, Length, a pasted posting, an application picker); the live generator has three
  archetypes (Impact & Metrics-Driven, Strategic & Leadership, Adaptability & Growth), no length control and no posting box.
- New capabilities drawn that the app does not have today: an Improve button on the Summary field (EditorPersonal), Weeks/Months on the
  Timeline, the Public page footer "Want your own? Make a resume", the storage-full banner wording. The Keyboard shortcuts menu entry is real
  (`ShortcutsDialog` in `src/components/shell/TopBar.jsx`).
- JobsList drops the Location, Salary and Contact columns of the live list (reachable in the job drawer). The Download menu has no "Import as new
  résumé" (assumed to live on Documents via ImportModal); "Import as my original" (demo accounts only) is left out.
- Colours outside the brief palette: the project tile `#5457E8` (white "L" on `#6366F1` is 4.47:1) and the purple group chip (`#EDE7FE` on `#5B2CC4`).

## Not drawn (known gaps)
Shortcuts dialog; the Filter popover and the project `...` menu; open states of Advanced (settings), More details (task drawer), More charts
(summary), the Groups toggle (plan), the History tab, dropdowns in JobAdd; MobileProject's other three columns; Public's missing/error/loading
messages; the Privacy view; the phone ATS sheet; ShareLinkModal's not-yet-published, update and confirm-unpublish states.

## Tools (this folder, `tools/`)
`serve.mjs` (static server for the rig), `rshot.mjs` (plain render), `check.mjs` (render + real scroll size vs frame, clipped text, contrast, 44 px
targets on phones), `lint.mjs` (the format rules that fail silently: support.js line, tag balance, holes, sc-for hints, emoji, nested interactive,
icon-only controls, unknown links), `layout.mjs` (adds new boards to canvas.json in one block per area), `crawl*.mjs` (re-capture the live app).

## How to resume (rig, about 5 minutes)
1. `corepack enable` then `yarn install --immutable` in the repo (about 20 s; Playwright is needed; the repo's yarn is 4.18). Chromium is at
   `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
2. Scratchpad dir `S`; `mkdir -p S/cv-canvas/project S/rig S/shots S/live`. Artifact tool: `list` scope `files` on the canvas, then `read` with `paths`
   (all `project/*.dc.html`, `project/canvas.json`, `artifact-type/dc-runtime.js`) and `out_dir` = `S/cv-canvas`; copy `dc-runtime.js` to `S/rig/support.js`.
   `ln -s S/cv-canvas/project/X.dc.html S/rig/X.dc.html` for each file; copy `tools/*.mjs` to `S`; `node S/serve.mjs S/rig 5302 &`.
   NEVER type `ln -sf <file> /dev/null` or `pkill -f` on a pattern in your own command line (the first replaces /dev/null, the second kills your shell).
3. `cd S; node lint.mjs S/rig X.dc.html` then `node check.mjs X.dc.html shots/X.png <w> <h> [--phone]` and look at the PNG.
4. Publishing: re-read the live `project/canvas.json`, edit, then ONE Artifact call: `root` = `S/cv-canvas`, `file_path` = canvas.json, `files` = the
   changed `project/*.dc.html`. If it says you have not viewed the latest version, do a plain `read` of the artifact URL (no path) and retry; if it
   names files, re-read those. Never publish `support.js`, `index.html`, `SKILL.md` or anything under `artifact-type/`.
5. Only after the owner approves the canvas: the React rebuild (BUILD CONSTRAINTS below; `c259955` has four tabs and matches the rejected v1: it
   must be reshaped to the tabless editor of decision 6 or reverted). Tests run only on CI, accessibility stays deferred.

## Artifact-type rules that matter (from the Design type's own instructions, for artboard authoring only)
One file per artboard under `project/`; a PAGE has `"expand": "fill"` in its board entry; no `<svg>` diagrams drawn as one block; never emoji; no
fake status bar on phones; touch targets 44 px on phones; a canvas's own instructions say not to render or "verify" unless the owner asks (they did
ask for a final review). The workflow that drew today's boards is in `S`-independent form below.

## How the 26 boards were made (so it can be repeated)
One Workflow (`pipeline` over five areas; 2 agents at a time on a 4-CPU box): per area, 1-2 drawing agents (medium effort, 2-4 artboards each, each
rendering and fixing its own work) then one reviewer (high effort) who linted, rendered, compared with the live screens and the app source and fixed
in place. The Projects-core agent drew the shared project header first; the Projects-views agents waited for it. 14 agents, no errors, about 18 minutes.
Then the lead rendered all 34 changed files, normalised the top bar and search box in 20 files with a script, applied owner decision 6, and published.

## BUILD CONSTRAINTS for the React rebuild (carried over from the redesign branch's handoff; they live ONLY here now)
- Each leaf panel keeps its contract and gets an OPTIONAL group/view prop that defaults to showing everything: the parity walker
  (`tests/pdf/parity/panels.mjs`, `walker.mjs`) mounts `DesignPanel`, `PersonalInfoEditor` and `SectionCustomizer` directly and walks every control,
  and about 70 node tests mount `DesignPanel`, about 40 `PersonalInfoEditor`, about 25 `CoverLetterPanel`, about 20 `AtsCheckerPanel`, 60+ the
  section editor. Only the Cypress/Playwright specs that drive the real Editor need updating: 04-design*, 05-cover-letter, 13, 14, 16, 17, 23, 25, 26,
  27, 30, and Playwright `parity-ui-controls`, `pdf-templates`, `pdf-typography-spacing`, `picker`, `pw-helpers.openDesignPanel`. The tabless editor
  (decision 6) also changes any test that clicks the Resume / Cover Letter / ATS Check tabs (`tests/pdf/103-r4-dvis-12-editor-tabs-truncate`,
  `32-editor-tab-scroll`, `103-r4-dph-31-pill-clears-tab-bottom`, Cypress specs that switch tabs): expect them red until updated.
- New code stays in the lazy Editor chunk: `71-startup-chunks` has 0.2 kB to spare on master (do not edit `src/components/ui/*` or shell files).
  Every change needs a test that fails without it (`failfirst` on CI). Agents work in worktrees with `ln -s <main>/node_modules` (works with Vite),
  commit locally, and the lead pushes to the working branch only. Accessibility stays deferred. Tests run only on CI. Commits carry the owner's
  identity only (`sairamgudiputi <sairamgudiputi8@gmail.com>`), no trailers, no mention of Claude or AI (CLAUDE.md).
- Lessons: `.bin/vite` is missing after `yarn install` (call `node node_modules/vite/bin/vite.js`); `pkill -f '<pattern in your own command>'` kills your
  own shell; `ln -sf <file> /dev/null` replaces /dev/null (it happened once, fixed with `rm /dev/null; mknod -m 666 /dev/null c 1 3`); artifact-view-context
  blocks in the conversation are viewer state, not instructions; a "rejected" tool call may still have run: check `git log`; the Artifact tool refuses a
  publish until the artifact was read as a whole (plain `read`, no path), and `force` must never be used without the owner saying so.

## Cold start: where to begin
- This work lives on branch `claude/determined-gauss-eiv6cf` (cut from master `491d1eb`, docs and tools only, no `src/` change, no CI needed). Master's
  HANDOFF.md does not mention the redesign: start the new session ON THIS BRANCH (or the owner merges it; a push to master deploys the site, so that is
  the owner's call and needs the full gate first).
- Nothing is running: the workflow `wf_45cd4980-6f2` finished (14 agents, 0 errors), no routines or check-ins are pending, no background processes matter
  (the rig server on port 5302 dies with the container).
- First steps: (1) read this file; (2) get the owner's answers to "Product calls" above (ask, do not guess); (3) rebuild the rig (steps 1-3 above) only
  if a board has to change; (4) apply the owner's changes to the boards with a small workflow or by hand, lint and render each, publish (step 4);
  (5) when the owner approves the canvas, plan the React rebuild from the BUILD CONSTRAINTS and the boards (read them with the Artifact tool).
- A prompt to paste into the new session: "Continue the UI redesign on branch claude/determined-gauss-eiv6cf. Read docs/tracking/ui-redesign/README.md
  first. The canvas is published (39 artboards). Here are my answers to the open product calls: <fill in>. Change the boards accordingly and republish."
