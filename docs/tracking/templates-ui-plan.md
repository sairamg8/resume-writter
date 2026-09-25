# Templates UI — improvement plan

> Written 2026-09-22 ~21:50. Code facts are from `4ee5ede`; no template or picker file has changed since.
> **Status: PLAN. Nothing is built yet. It waits on the owner's decisions in §7.**
> Ask (owner, 2026-09-22): *"templates UI improvement suggestions needed. For this first please prepare plan"*.
> Earlier orders on templates: 2026-09-15 *"we need multiple templates for user to select between the layouts,
> create at least 10+ more, should be ATS friendly with clear view"*. 2026-09-22 ~17:40 *"i need templates at least 10
> variations"*.

## 1 · Goal

Someone choosing how their résumé looks can:

- **see** every template before picking one;
- tell templates apart at a glance: layout, columns, photo, ATS safety;
- switch without losing their own choices, and undo a switch;
- do all of this on a phone too;
- choose from at least 10 looks.

## 2 · Where we are (code at `4ee5ede`)

| Surface | Today | Where |
|---|---|---|
| Finding the picker | Behind an icon-only palette button in the editor header; its only label is the tooltip "Design & Customize" | `src/components/EditorHeader.jsx:107-113` |
| Design → Template | A vertical list of 5 text buttons. Every row has the **same** tiny 4-bar icon tinted with the accent colour, so there is no picture of any template. Each row has a one-line description, and 3 have an "ATS" badge | `src/components/DesignPanel.jsx:42-88`, the icon at `:52-60` |
| Picking | Applies at once. It writes `template` plus the template's heading style and title case, and moves header colours that would not read on the new header (`headerColorsOnSwitch`). Font, colours and spacing are kept. There is no preview before and no undo after | `src/hooks/useResumeStore.js:237-243` |
| Sidebar layout | A "Two columns / Single · ATS-safe" toggle under the list. The Sidebar row has no ATS badge in either mode | `DesignPanel.jsx:71-86`, `src/constants/templates.js:80-84` |
| The templates | 5 layout engines: Classic, Modern, Minimal, Executive and Sidebar, listed with Executive first | `src/constants/templates.js:59-85`, order `:91` |
| Descriptions | "ATS-friendly · Two-column header" (Classic), "Bold accent header · Full-width layout" (Modern), "Colored left sidebar layout" (Sidebar)… | `src/constants/templates.js:59-85` |
| Dashboard cards | A drawn mock: an accent band over grey bars, the same shape for every template. It is not the résumé's page | `src/components/ResumeCard.jsx:30-50` |
| New résumé | "Choose a Resume Starter": Blank plus 3 text-only cards. They are content starters, and each one quietly sets a template (Classic, Modern, Executive) | `src/components/StarterTemplateModal.jsx`, `src/utils/starterTemplates.js:59`, `:153`, `:229` |
| Cover letter | Its header takes the template's look; one line of text says so | `DesignPanel.jsx:87` |

**FlowCV** (research 2026-09-22; sources in the store's `research__flowcv-features.json`):

- a templates page of 105 named templates in 7 categories: Popular, Simple, Modern, Creative, Photo, Compact and First Job;
- every template is a **preset over one design object**, not separate layout code;
- users can share their own design as a public template.

**Earlier plans (none started):**

- 2026-09-15, `qa-visual-compare/wf3/templates_plan*.md`:
  - 10 new single-column templates as new layout code: Gridline, Registry, Bookend, Lectern, Chronicle, Keystone,
    Banded, Keel, Linen, Broadsheet;
  - a gallery picker with thumbnails and filters (A8);
  - thumbnails built as images, with a test that fails when one is stale (A9);
  - Design controls driven by what each template can do (A7).
  - Batches T1a–T6, three of them large.
- 2026-09-22 parity recommendation: *"Design presets: ship 10 or more named templates over the 5 engines"* — impact
  medium, effort M, no new layout code.

## 3 · Phase 1 — the audit (read-only; its output is the suggestions file)

1. **Screens.** Run the dev server (`flowcv-dev` in `.claude/launch.json`) in the built-in browser, **signed out**,
   with the fictional sample résumés only. Screenshot at 1440 px and at 375 px:
   - Design → Template with each template picked, plus Sidebar in Single · ATS-safe;
   - the dashboard with one résumé per template;
   - the starter modal;
   - the editor just after a template switch;
   - the cover letter header.
2. **Side-by-side sheet.** Render page 1 of every template's sample résumé (`DEMO_RESUMES`,
   `tests/fixtures/sampleResumes.js`) through the PDF harness to PNG, and put all six on one sheet. Judge them as a set:
   which ones look alike, and what is missing (serif, compact, photo-first, creative, first job).
3. **Check every surface for:**
   1. telling templates apart before picking;
   2. what a switch changes and keeps, and whether the screen says so;
   3. whether the ATS badges and descriptions are true, checked against the ATS test battery;
   4. keyboard only, and what a screen reader announces;
   5. phone: reach, tap targets of at least 44 px, no hover-only controls;
   6. crowding: 15 templates, long names.
4. **FlowCV comparison.** Their public templates page only: read it, with no sign-in and no upload.
5. **Write `templates-ui-suggestions.md`** at the repo root. Each suggestion gives:
   - the problem, with a screenshot or `file:line`;
   - the proposal, with a wireframe;
   - its effort (S / M / L), its tests and its risk.

   They are ranked by impact × effort, and the owner picks.

Size M, solo, about one session. Nothing in the repo changes except the new suggestions file.

## 4 · Candidate suggestions (hypotheses: Phase 1 confirms or drops each one)

### A · The picker

| # | Suggestion | Why (evidence) | Effort |
|---|---|---|---|
| A1 | **Real thumbnails**: a picture of each template's page 1 in place of the generic icon | Every row has the same icon (`DesignPanel.jsx:52-60`), so a user has to pick a template to see it | M |
| A2 | **A gallery dialog**, "Browse templates (N)": a 2–4 column grid of cards. The Design panel keeps the current template's card and a Change button | A list suits 5 templates; at 10–15 it becomes a long scroll in front of every other Design section (09-15 plan A8) | M |
| A3 | **Filter chips**: ATS-safe · One column · Two columns · Photo · Serif · Compact · Colour | FlowCV sorts its 105 into 7 categories, and ours will grow past 10 | S, after A2 |
| A4 | **Try before applying**: hovering or tapping a card shows your own résumé in it, and Apply commits. Or: apply at once and show an **Undo** toast | A pick overwrites heading style and title case at once (`useResumeStore.js:237-243`), and the app has no undo anywhere (parity research) | M |
| A5 | **Say what a switch keeps**: "Your content, font and colours stay; the heading style changes" | The screen says nothing about what a switch does to the user's own choices | S |
| A6 | **Honest badges and descriptions**: "ATS-safe" only where the ATS battery passes; Sidebar shows "ATS-safe" while Single column is on; each description says what the template prints | Sidebar gets no badge even in its single-column mode. "Two-column header" on an ATS-safe template reads like the two-column warning | S |
| A7 | **Label the Design button** ("Design") on wide screens, and put a "Template: Classic ▾" chip by the preview | The picker sits behind an unlabelled icon (`EditorHeader.jsx:107-113`) | S |

### B · More templates (the "at least 10" order)

| # | Suggestion | Why (evidence) | Effort |
|---|---|---|---|
| B1 | **Design presets**: at least 10 named looks over the 5 engines. Each sets font, colours, heading style, header layout, entry layout and spacing, and they show in the gallery beside the engines | That is how FlowCV builds its templates. It needs no new layout code, and every preset goes into the ATS battery automatically (parity recommendation) | M |
| B2 | **The 10 designed single-column templates** from the 09-15 catalogue, as new layout code | Real layout variety, but batches T1a–T6, three of them large | L |
| B3 | **Categories** like FlowCV's: Simple, Modern, Creative, Photo, Compact, First job | Makes 15+ templates browsable | S, with A3 |
| B4 | **Save my design as a preset** (sharing one could come later) | FlowCV lets users share designs; ours can only export the whole résumé as JSON | M |

### C · Dashboard

| # | Suggestion | Why (evidence) | Effort |
|---|---|---|---|
| C1 | **The real page 1** as each résumé card's picture, cached, and rendered after a save rather than on every visit | Every card shows the same drawn mock (`ResumeCard.jsx:30-50`) | M |
| C2 | The template's name and the page count on the card | The card shows the template and a time only | S |

### D · New résumé, E · Phone, F · Cover letter

| # | Suggestion | Why (evidence) | Effort |
|---|---|---|---|
| D1 | **Pick the content and the look in one flow**: starter cards with a thumbnail, then "Choose a template" (the gallery, skippable) before the editor opens | Starter cards are text only, and each one sets a template without saying so (`starterTemplates.js:59`, `:153`, `:229`) | S–M |
| E1 | On a phone, the gallery is a full-screen sheet: two thumbnails per row, with Apply always visible | Phase 1 measures today's list on a 375 px screen | S, with A2 |
| F1 | The letterhead's thumbnail beside the résumé's, in the gallery and on the card | The letter follows the template, but a user sees that only on the letter tab | S |

## 5 · How the thumbnails would work (decision 4)

- **Option 1: images built ahead of time** (09-15 plan A9).
  - A script, `scripts/template-thumbs.mjs`, renders page 1 of each template's sample and writes
    `public/templates/<id>.webp` plus a `manifest.json`. The route is PDF harness → pdf.js → `@napi-rs/canvas`.
  - Each image is about 17–20 KB (measured 2026-09-15).
  - A test fails when a thumbnail no longer matches its template.
  - Fast to show, and the same for everyone.
  - Needs `@napi-rs/canvas`, which is used but not declared (R3-9, the owner's call), or `pdftoppm`.
- **Option 2: live thumbnails** of the user's own résumé in every template.
  - Rendered in the browser: react-pdf → pdf.js → canvas.
  - Costs 5–15 renders, so it has to be lazy, cached and cancelable.
  - The best "see it on my résumé" experience.
- **Recommended:** Option 1 for the gallery (A1, A2). Option 2 only for the one card under the cursor or finger (the A4
  preview) and for the dashboard cards (C1, rendered once per save and cached).

## 6 · Build phases (after the owner picks)

| Phase | Contents | Size |
|---|---|---|
| P1 | The audit → `templates-ui-suggestions.md` (§3) | M |
| P2 | Wireframes of the picked items as a static mock, desktop and phone → the owner approves | S |
| P3a | Thumbnails (Option 1) and the gallery: A1, A2, A3, A5, A6, plus the current-template card in the Design panel | M |
| P3b | Try before applying / Undo (A4) and the labelled Design button (A7) | M |
| P3c | Presets (B1): `src/constants/designPresets.js`; the gallery lists presets and engines together | M |
| P3d | Dashboard pictures (C1, C2) | M |
| P3e | The new-résumé flow (D1), phone polish (E1), letterheads (F1) | S–M |
| Later | B2 (the 10 new layouts, per the 09-15 batches) and B4 (save or share presets) | L |

**Every item** gets a test that fails before it is built, lands as one item per commit, and is proven with a desktop and
a phone screenshot. Progress is ticked in §9.

**Tests per item:**

- **Gallery:**
  - a unit test that the cards are built from `TEMPLATES` and the presets, never listed by hand;
  - a Playwright or Cypress test that opens it, filters, picks, closes with Esc or Done, returns focus and sets
    `aria-pressed`;
  - cards carry `data-testid="template-card"`.
- **Thumbnails:** every template and preset has an image, and the stale-image test passes.
- **Presets:** every preset renders, and every single-column preset passes the exact ATS field scorer
  (`tests/pdf/42-ats-fields`).
- **Undo:** a store test that a switch followed by Undo restores the exact settings object.
- **Dashboard pictures:** no re-render when only `updatedAt` changes, and no private data in any image.

## 7 · Decisions for the owner

1. **Audit scope.** All surfaces: picker, variety, dashboard, new résumé, phone and letter? *Recommended: yes.*
2. **"At least 10 templates".** Presets over the 5 engines first (B1, M), and the 10 new layouts later (B2, L)?
   *Recommended: presets first.*
3. **Picking.** Preview, then Apply? Or apply at once with Undo? *Recommended: apply at once plus Undo, as today, with a
   hover preview on desktop.*
4. **Thumbnails.** Built as images (Option 1)? And may `@napi-rs/canvas` become a declared dev dependency (R3-9)?
   *Recommended: yes to both.*
5. **When.** Start the read-only audit now, alongside the 22 open bugs, or after them?

## 8 · Rules for this work

- Work lands on `claude/wf-*` branches, one item per commit, explicit `git add` paths; the coordinator merges them.
- The gate is `.github/workflows/ci.yml` (CLAUDE.md): `master` is fast-forwarded only when the full gate on that
  commit is green, and a push to `master` deploys.
- Screens, thumbnails and samples use fictional résumés only (`tests/fixtures/sampleResumes.js`):
  - never `private/`;
  - never `qa-visual-compare/seed-*`, which is the owner's real résumé;
  - the browser stays signed out.
- Solo: the agent cap of 2026-09-22 ~17:40 stands until the owner lifts it.
- Files stay at 300 lines or fewer, split on a concept boundary.
- Nothing is published (artifact, upload) without the owner's yes.

## 9 · Progress

| Phase | State |
|---|---|
| Plan | ✅ this file, 2026-09-22 |
| P1 audit | ✅ `45f4acc`, 2026-09-23 — templates-ui-suggestions.md, templates-ui-bugs.md |
| P2 wireframes | ☐ — continues as R2-138 / R2-139 (bug-status-r2) |
| P3a–P3e build | ☐ — continues as R2-138 (presets) and R2-139 (picker; its a11y part deferred, owner 2026-09-25) |
