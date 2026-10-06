# UI redesign: the simplified CPWT-CV (design canvas), how to resume

Status 2026-10-06: a design canvas of 13 artboards is published; the other ~25 artboards that cover the rest of the
app are PLANNED here and NOT drawn. No React code was written for this beyond one commit (`c259955`, see HANDOFF.md).

- Canvas (private Design artifact; its files are the source of truth, read them with the Artifact tool): https://claude.ai/artifact/SjfCTE1dSTgt1UY63uoFiM
- Live app that was surveyed (this is master, deployed): https://resume-writter.sairamgudiputi8.workers.dev/#/
- Earlier mockups, superseded: https://claude.ai/artifact/PuVb9NgZ7dtCkrKNYaQjGF (v1 tabs, rejected: "same as before with little tweaks"),
  https://claude.ai/artifact/37an14GjzPqGMccs9MyHFz (three directions; the owner chose direction 2).
- Files here: `BRIEF.md` (the shared design brief for drawing agents: inventory, simplification rules, visual system, `.dc.html` format,
  render loop), `AREAS.md` (what each of the five agents draws), `tools/` (live-app crawlers, local render rig).

## What the owner decided (in order)
1. The left sidebar of the editor feels cluttered; a first proposal that only added tabs was rejected.
2. "Direction 2": content on the left, the design docked as a drawer beside the page, a section's style as a small popover.
3. "Rebuild the whole flow, simplified UI", shown as DESIGN (a canvas), not code ("coding HTML/Tailwind is too costly compared to a prototype").
4. "Browse the existing UI: there is a lot of things there, look for a simplified design in all those cases."
5. "Ultracode: split the task, and you do the final review." The workflow below was about to be launched when the session ended
   (its context was over 60%).

## Done (published on the canvas)
Main (Documents), New (new résumé), Editor (Résumé tab + Design drawer), EditorSection (section-style popover), EditorLetter, EditorAts,
Jobs (board + detail drawer), MobileHome, MobileEdit, MobilePreview, MobileDesign, and the two shared components Paper (4 layouts, 2 fonts,
3 heading styles) and Letter. All use ONE shell: top bar = CV mark + CPWT-CV, nav Documents / Applications / Projects, global search,
avatar; the page's primary action sits in its page header. The Editor is the one immersive screen with its own bar (back, name, ATS chip,
Share, Download PDF split button). The nav links to `Projects.dc.html`, which does not exist yet.

## Product calls the owner still has to make (flag them in the final message)
- The Projects area is a Jira-style task manager (6 views per project, sprints, epics, labels). The knowledge docs name the product goal as
  "résumé + cover letter + job tracker"; Projects is outside it. The plan draws it simplified (3 daily views + optional ones, sprints off by
  default, "task" not "issue") rather than dropping it. Keep, simplify, or remove is the owner's decision.
- Cover letters become a tab inside their résumé (no separate list, no "New Cover" button); the Career History panel is shown only in
  Applications > Insights (it is duplicated on the dashboard today).
- Template gallery: 28 looks + "designs" + saved designs become ~8 templates (+ "My designs").

## Next steps (in order)
1. Set up the rig (needs this repo's node_modules for Playwright: `yarn install --immutable`, about 17 s; `.bin/vite` is missing, call vite through node):
   - scratchpad dir `S`; `mkdir -p S/cv-canvas/project S/rig S/shots`.
   - Artifact tool: `list` scope `files` on the canvas, then `read` with `paths` (all `project/*.dc.html`, `project/canvas.json`) and
     `out_dir` = `S/cv-canvas`; `read` path `artifact-type/dc-runtime.js` and copy it to `S/rig/support.js` (the artboards load `./support.js`).
   - `ln -s S/cv-canvas/project/X.dc.html S/rig/X.dc.html` for each file; `cp docs/tracking/ui-redesign/tools/{rshot,serve}.mjs S/`;
     `node S/serve.mjs S/rig 5302 &` (do NOT `pkill -f` a pattern that appears in your own command line: it kills your shell);
     `node S/rshot.mjs Main.dc.html S/shots/main.png 1440 900` renders an artboard and prints its real scroll size.
   - `tools/crawl.mjs` and `crawl2.mjs` re-capture the live app (paths inside point at the old scratchpad: edit `live/`), they seed résumés
     through localStorage key `cpwtcv_v1` using `tests/helpers.js` `buildTestState`.
2. Copy `BRIEF.md` to `S/cv-canvas/BRIEF.md` and replace `ROOT` in it with `S`. Re-run the crawl so `S/live/*.png` exist.
3. Launch ONE Workflow (the cap is 2 agents at a time on this 4-CPU box): `pipeline` over the five areas in `AREAS.md`; stage 1 an agent that
   reads BRIEF.md and draws its artboards, renders each with `rshot.mjs`, looks at the PNG and fixes (returns a manifest: file, title, w, h,
   page); stage 2 a second agent per area (effort high) that renders the manifest again, reviews against the brief and fixes in place.
4. Final review by the lead: render every new artboard, view them, fix; then write `project/canvas.json` rows (one row per area, a `title1` note
   above each row, 80 px between frames in a row, 380 px between rows, existing boards keep their keys) and publish the new files to the
   canvas in batches (Artifact tool, `root` = `S/cv-canvas`, `file_path` = canvas.json, `files` = the new `project/*.dc.html`). Never publish
   `support.js`, `index.html`, `SKILL.md` or anything under `artifact-type/`.
5. Only after the owner approves the canvas: the React rebuild (BUILD CONSTRAINTS in HANDOFF.md still apply; `c259955` matches the rejected v1
   and must be reshaped or reverted). Tests run only on CI, accessibility stays deferred.

## Artifact-type rules that matter (from the Design type's own instructions, for artboard authoring only)
One file per artboard under `project/`; `canvas.json` first, then artboards; write ONE file, publish it, then the next; first artboard is
`Main.dc.html`; a PAGE has `"expand": "fill"` in its board entry; no `<svg>` diagrams drawn as one block; never emoji; no fake status bar on
phones; touch targets 44 px on phones; do not render or "verify" unless the owner asks (they did ask for a final review this time).
