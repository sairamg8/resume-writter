# Brief: simplified design of CPWT-CV, all screens (read fully before you start)

You are one of several agents each drawing a group of **artboards** (static hi-fi screens) for ONE design canvas
that shows a simplified redesign of the whole app. The owner's words: "browse the existing UI, there is a lot of
things there, we need a simplified design in all those cases". Your job: for the screens you are given, look at what
the live app does today, decide what a person actually needs on that screen, and draw the simplified version.

Everything you need is on this machine. Do not touch the git repo, do not publish anything, do not edit
`canvas.json` or any artboard you were not given. Only write your own files.

Paths (use absolute paths):
- ROOT   = /tmp/claude-0/-home-user-resume-writter/fff98bec-6159-50fa-a779-aa914a079746/scratchpad
- Your artboards go in `ROOT/cv-canvas/project/<Name>.dc.html`
- Live-app screenshots (today's UI, 1440x900 unless noted): `ROOT/live/*.png`  (list below)
- App source, read-only, for what each screen really contains: /home/user/resume-writter/src (pages/, components/)
- Finished reference artboards to copy patterns from: `ROOT/cv-canvas/project/Main.dc.html` (Documents, global top bar,
  cards, chips, buttons), `Editor.dc.html` (editor: left panel, preview stage, right design drawer),
  `EditorSection.dc.html` (popover), `Jobs.dc.html` (board + right drawer + scrim), `MobileEdit.dc.html` (phone),
  `Paper.dc.html` (résumé paper component), `Letter.dc.html`.

## What the app is today (so you know the cases)
One product, three apps in one shell, with two different navigation shells:
1. CV builder: Documents (résumé cards, cover-letter list, career-history panel), New résumé (template gallery with 28
   looks), Editor (Resume / Design / Cover letter / ATS check; export menu with 7 formats; share link; template gallery;
   header-icon picker; STAR bullet optimizer; cover-letter generator; photo upload; import PDF/Word/JSON).
2. Job tracker: Summary (5 charts), Board, List, job detail (Overview / Tasks / Notes), long Add-job form, import/export CSV+JSON.
3. Projects: a full Jira-style task manager: Your work, project list, per project Summary / Timeline / Backlog (sprints) /
   Board / Calendar / List / Settings, issue dialog (details, checklist, comments, history), create dialogs, epics, labels.
Plus: Google sign-in + cloud sync, public résumé links (#/r/id), Terms and Privacy pages, global search.

Live screenshots in ROOT/live: 01-dashboard, 02-new, 03-editor-resume, 04-editor-design, 05-editor-letter, 06-editor-ats,
07-jobs (board), 08-jobs-new (long form), 09-boards (project list), 10-work (Your work), 11-terms, 12-privacy,
20-board, 21-backlog, 22-summary, 23-timeline, 24-calendar, 25-list, 26-settings, 27-issue (dialog), 28-create-issue,
30-job-detail, 31-job-summary, 32-job-list, 33-dash-import, 35-export-menu, 40-mobile-dash, 41-mobile-editor,
42-mobile-jobs (390x844). Some may be missing; read the matching source file instead.

## Simplification rules (this is the design brief; every artboard must follow them)
1. ONE shell. A single top bar on every screen: logo "CV" mark + CPWT-CV, nav `Documents · Applications · Projects`
   (active one has the sunken pill), flexible space, global search ("Search everything", "/" key hint), avatar. No left
   sidebar anywhere. Copy the bar markup from Main.dc.html exactly; only change which nav link is active.
2. ONE primary action per screen, in the page header (Documents: New résumé, Applications: Add job, Projects: New task).
   Secondary actions live in a `...` menu or a quiet secondary button. Never more than 3 buttons in a header.
3. Progressive disclosure. Show the 5 fields a person needs; put the rest under "More details" (a visible, collapsed row).
4. Fewer views, same power: a view switcher shows only the views people use daily; rarely used ones sit in the same
   switcher without extra chrome. Settings are a small page or popover, not a long form.
5. Plain words: "task" not "issue", "group" not "epic", "plan" not "backlog", "Download" not "Export". Label by what a person
   recognises. Buttons say exactly what happens.
6. State at a glance: chips and one accent colour; due dates relative ("Tomorrow"); empty states say what goes here and
   offer ONE action.
7. A thing that is a property of another thing lives inside it (a cover letter lives inside its résumé; a job's tasks live
   in the job). No duplicate lists.
8. Keep every real capability reachable, just not all at once. Do not invent features. Real content only, no lorem ipsum.
   The user is Alex Johnson (alex@example.com); data in the live screenshots (Google job, LIFE project: "Take out the
   recycling", "Fix the dripping kitchen tap", ...) is fine to reuse.

## Visual system (match the finished artboards exactly)
Font: 'Instrument Sans', system-ui, sans-serif, loaded with the Google link shown below. Body 14px. Sizes in use: 11-13px meta,
14px body, 15-16px titles, 20px section title (600, -0.01em), 32px page title (600, -0.02em).
Colours (literal hex, inline styles, no CSS variables):
- ground #F5F6F8, surface #FFFFFF, sunken #EEF0F4, stage #E9ECF1, hairline #E2E5EB, field border #D5DAE3
- ink #151922, body #2A303C, muted #4F586A, faint #6B7385 (the lightest allowed for text; never lighter)
- brand #2B59FF (fills), #1E45D6 (brand text on soft fills), soft fills #E8EEFF / #EEF3FF / #F3F6FF, soft border #C9D3F5
- good #0B7A55 on #E1F5EC; warn #8F5200 on #FFF0D6; bad #B3261E on #FDE7E5; scrim rgba(21,25,34,0.28)
Shapes: cards radius 14-16 with 1px #E2E5EB border and NO shadow; controls radius 8-10; chips fully round; inputs 34-38px high
(44px on phone); shadows only on popovers, drawers and modals: `0 4px 8px rgba(20,30,50,0.06), 0 18px 44px rgba(20,30,50,0.20)`.
Icons: inline stroke SVG, viewBox 0 0 24 24, stroke currentColor, stroke-width 2, round caps. No emoji anywhere. Icon-only
buttons get `aria-label`. Use real `<button>`, `<a href>`, `<input>` with `<label>`; text contrast >= 4.5:1.
Project colours for tiles: indigo #6366F1, sky #0EA5E9, green #10B981, amber #F59E0B, red #EF4444, purple #A855F7.

## Artboard file format (rules that fail silently if broken)
Start from this skeleton (keep the support.js line EXACTLY; one file = one artboard; the whole source in one file):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Short screen name</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{margin:0}
a{text-decoration:none}
</style>
</helmet>
<div style="...root...">
...markup, inline styles...
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1440,"height":900}}'>
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}
</script>
</body>
</html>
```
- Desktop screens are PAGES: root has NO fixed px width (fluid), a fixed px `height` (900 or what the content needs; over-tall beats
  clipped), `display:flex; flex-direction:column` etc. Phone screens are FIXED 390x844 (root width/height in px, `position:relative; overflow:hidden`).
  Modal/menu/popover screens: draw the page behind (simplified but recognisable) with the scrim and the layer on top.
- Inline `style="..."` for everything. `<helmet>` only for the font link, `body{margin:0}` and `a{text-decoration:none}`.
- Lay out with flex/grid and `gap`. Grid columns: `repeat(N, minmax(0, 1fr))`.
- `{{hole}}` is a dotted lookup only (no expressions). Prefer plain literal markup; use `renderVals()` + `<sc-for list="{{rows}}" as="r"
  hint-placeholder-count="3">` / `<sc-if value="{{flag}}" hint-placeholder-val="{{ true }}">` only to avoid long repetition, always with the hint
  attributes. Never self-close or capitalise custom tags. No iframe/object/embed, no external images, no `<svg>` diagrams drawn as one block for charts
  (draw charts with divs).
- Link between artboards with `<a href="Name.dc.html">` styled as the button/tab (never a button inside an anchor).
- Reuse the résumé paper: `<dc-import name="Paper" layout="single|banner|center|side" font="sans|serif" heading="rule|plain|caps" accent="#2B59FF" hint-size="794px,1123px"></dc-import>`
  inside a scaled wrapper (see Main.dc.html); `Letter` takes `accent`.
- Artboard names that will exist, for links: Main (Documents), New, Editor, EditorSection, EditorLetter, EditorAts, Jobs, MobileHome, MobileEdit,
  MobilePreview, MobileDesign, Paper, Letter, Projects, ProjectBoard, ProjectList, ProjectCalendar, ProjectTimeline, ProjectSummary,
  ProjectBacklog, ProjectIssue, ProjectSettings, MobileProject, JobsList, JobAdd, JobsInsights, MobileJobs, EditorPersonal, EditorDownload,
  EditorShare, EditorTemplates, EditorImprove, EditorDraft, ShellMenus, Empty, ImportModal, Public, Legal, States.

## Render and look at your work (REQUIRED, you can do this here)
A local rig serves the canvas runtime. After writing a file, expose it to the rig and render it:
```
ln -sf ROOT/cv-canvas/project/Name.dc.html ROOT/rig/Name.dc.html
cd ROOT && node rshot.mjs Name.dc.html shots/Name.png 1440 900
```
(rig server is already running on port 5302; the width/height are the artboard's w and h). It prints console errors and the document's real
scrollWidth x scrollHeight: if scrollHeight > the height you declared, the frame is clipped: raise the root height and `$preview` height. Then LOOK at
the PNG (Read tool). Fix overlaps, clipped or wrapped text, misaligned rows, wrong colours, anything that looks off, and render again. Do at least one
render per artboard and one fix round. The Google font may not load offline: judge layout with the fallback face (slightly different widths); leave
margin so text still fits with Instrument Sans.

## Deliverable
Write each file, render it, fix it. Finally return (StructuredOutput) the list of artboards with file name, title (short, "N · ..." not needed),
w, h (the frame size on the canvas; for pages w=1440 and h = real content height, rounded up), `page` true for fluid desktop pages and false for fixed
phone frames, and a one-sentence note per artboard on what was simplified and why, plus anything you could not do.
