# FlowCV — Pending checklist, all time

> Location: `/mnt/Storage/Projects/flowcv/PENDING-ALL.md` · Written 2026-09-23 · master = `60c6954`
> Every feature the owner asked for, every open bug, every gap — from 2026-06-29 to today.
> **Bugs live in [bug-status.md](bug-status.md)** and are not duplicated here; this file is everything else.
>
> Sources: `bug-status.md` · memory store `/mnt/Storage/my-learning/claude/flowcv/`
> (`MISSED-2026-09-22`, `CHECKLIST-2026-09-22`, `PENDING-2026-09-16`, `START-HERE`, `TRACKER`) ·
> repo `templates-ui-plan.md`, `boards-plan.md`, `docs/knowledge/10-open-source-goals.md`.
> ✅ = verified against the code at `60c6954` on 2026-09-23 · ❓ = from a doc, not re-checked.

---

## 0 · 🔴 Decisions waiting on the owner — these block work

| # | Decision | Asked | Blocks |
|---|---|---|---|
| D1 | **Push policy.** Keep pushing after each finished bug (each push deploys the site), or push only on your word? The gate = all node tests + production build + private-data scan, then `git push` of exactly that commit. | Owed since 2026-09-22 22:20, when you stopped a push: *"Kill existing agenet i am not in hurry to gate ( i am not sure what it is ) and for push"* | **19 unpushed commits, 12 bug fixes, none deployed** |
| D2 | **Templates UI — 5 decisions** (`templates-ui-plan.md` §7): audit scope · presets-first vs the 10 new layouts · preview-then-Apply vs apply+Undo · thumbnails as built images + declare `@napi-rs/canvas` · start now or after the bugs | 2026-09-22 ~21:50 | All 16 templates-UI suggestions (A1–F1) |
| D3 | ✅ **Closed 2026-09-23** — ~~**ATS-6** — should Word section headings become real Word Heading styles? Microsoft advises it; not proven to matter to any ATS.~~ Yes, Heading styles, look unchanged (owner away, ordered the recommended action): built only because the .docx is measured identical — see ATS-6 in `bug-status.md`. | 2026-09-22 | — |
| D4 | **Accessibility** — excluded by you on 2026-09-16 (A11Y-1…6). Still excluded? | 2026-09-16 | 6 tasks + every `a11y:` finding |
| D5 | **Housekeeping calls** — declare `@napi-rs/canvas` (used by 11-photo tests, undeclared); drop unused `file-saver`. | 2026-09-21 | Trivial, but yours |

---

## 1 · Open bugs — 18

See **[bug-status.md](bug-status.md)**. Summary only:

- **12 AUD** — AUD-23, AUD-24 (Medium) then AUD-25…AUD-34 (Low). Next in queue: **AUD-23**.
- **6 ATS** — ATS-1…ATS-6, no order set. ATS-3 has no fix in react-pdf v4; ATS-6 is fixed (D3 closed).
- **12 fixed but unpushed** (AUD-09…AUD-22) — waits on **D1**.

---

## 2 · Features you asked for, not built

### 2.1 Header spacing controls — your ask of 2026-09-22 19:10

*"i want to have custom spacing between header items name and title and after that user can adjust space for that feature was not there"*

✅ The engine has **13 gap keys** (`src/constants/headerSpacing.js`), all clamped. **7 now have UI rows**
(`src/utils/headerSpacingRows.js`): `nameTitleGap`, `headerInlineGap`, `titleContactsGap`, `contactGapX`,
`contactGapY`, `iconTextGap`, `photoTextGap`.

**6 keys still have no control anywhere** — a user cannot set them:

- [ ] `summaryGap` — gap above the summary
- [ ] `headerGapBelow` — header ↔ first section
- [ ] `headerRuleGap` — text ↔ header border
- [ ] `headerPadY` / `headerPadX` — header padding
- [ ] `contactsSideGap` — contacts side gap

Each needs the same wiring the done rows got: Modern + Sidebar + cover letter + Word.
Spec: `qa-visual-compare/wf3/header_spacing_spec.md` (batch HEADER-GAP).

### 2.2 Page size control (A4 / US Letter)

- [ ] ✅ The PDF and Word both honour `settings.pageSize`, and `PdfPreview.jsx` / `EditorPreviewPane.jsx` read it —
      but **no control writes it**. FlowCV has one. Small, self-contained.

### 2.3 Typography gaps ❓

- [ ] A separate **name font** (today one font for the whole résumé)
- [ ] A **job-title size** control
- [ ] Heading **letter-spacing**
- [ ] **Per-section font**
- [ ] Offline fallback: non-default fonts load from jsDelivr at render time; offline the PDF silently
      falls back to Noto Sans (project-map risk 5) — no warning

### 2.4 Per-section styling ❓

- [ ] Section-heading **icons** (FlowCV: none / outline / filled, per section)
- [ ] **Bullet marker** choice (fixed at • – · today; FlowCV: bullet, dash, circle, none)
- [ ] **Link styling** (icon / underline / blue)
- [ ] **Language level visuals** (bars, dots, bubbles — text only today)
- [ ] **Skills** level visuals + pipe separator
- [ ] **Group roles at one employer**
- [ ] **Footer** with page numbers / name

### 2.5 Layout · colour · photo ❓

- [ ] Column layout is fixed per engine (FlowCV: details top/left/right, 1/2/mix columns, adjustable widths)
- [ ] Colour modes are basic only
- [ ] Photo lacks greyscale, position left/right/centre, more shapes/sizes

### 2.6 Templates — "i need templates at least 10 variations" (2026-09-17 17:40)

You expected to **see** them; they were only **designed** on 2026-09-15, never built.

- [ ] **B1 · Design presets** (recommended first): ≥10 named looks over the existing 5 engines — font, colours,
      heading style, header + entry layout, spacing. No new layout code; every preset joins the ATS battery.
- [ ] **B2 · The 10 designed single-column templates** as real layout code — Gridline, Registry, Bookend, Lectern,
      Chronicle, Keystone, Banded, Keel, Linen, Broadsheet. Specs: `qa-visual-compare/wf3/templates_plan*.md`,
      batches `templates-batches.json` (T1a–T6). **Build after ATS-1**, so each prints entries parser-safe.
- [ ] **B4 · Save my design as a preset** (sharing later)

### 2.7 Templates UI improvements — 16 suggestions, all blocked on **D2**

Plan: `templates-ui-plan.md`. Phase 1 is a read-only audit → `templates-ui-suggestions.md`.

- [ ] A1 real thumbnails · A2 gallery dialog · A3 filter chips · A4 try-before-applying / Undo ·
      A5 say what a switch keeps · A6 honest badges · A7 label the Design button
- [ ] B3 categories · C1 real page-1 résumé card · C2 template name + page count on card
- [ ] D1 pick content and look in one flow · E1 phone full-screen sheet · F1 letterhead thumbnail

### 2.8 Boards (Trello-style) — Phases 1–2 shipped, 3–4 pending

✅ `src/pages/Boards.jsx`, `Board.jsx`, `src/components/board/*`, `useBoardStore.js` all exist.

- [ ] **Phase 3 · Google sync** — `boardSyncIo.js`, `boardSyncMerge.js` (per-board LWW), `boardSyncEngine.js`
      (first sync + debounced queue + offline/retry + size guard), `useBoardSync.js`, wire into `App.jsx`
- [ ] **Phase 4 · tests** — mirror `tests/pdf/18-cloud-sync-*` against `fake-firestore.mjs`; unit tests for
      store + merge + `normalizeBoard`

### 2.9 Beyond design ❓

- [ ] **Import from PDF / DOCX / text** (ranked high in the parity research)
- [ ] **Résumé language** — month names, "Present", headings — and **RTL**
- [ ] **Several cover letters per résumé**
- [ ] **Public web link** to a résumé
- [ ] **An honest ATS checker** + a "what a parser reads" view
- [ ] AI writing (FlowCV Pro only — probably out of scope)
- [ ] Job tracker ↔ résumé sync ❓ (30 parity gaps: `qa-visual-compare/audit2/PAR/NOTES.md`)

---

## 3 · Test gaps — your order of 2026-09-22 17:30

*"Tests cover every customization control"*

- [ ] **Re-run the lost audit — part A** (page, layout, typography, colour, spacing, page-fit, starters). It was
      lost when the workflow was stopped; only part B survives
      (`wip/research-2026-09-22/coverage__header-sections-entries.json`).
- [ ] **64 controls audited: 33 full, 21 partial, 4 weak, 6 none.** Write the tests per gap.
  - **None:** photo hide eye · section and entry reorder (drag/keyboard) · section Reset style ·
    Spacing Override before/after · rich-text underline (PDF + Word) · ~~Word header/section sizes~~ ✅ **closed by AUD-22**
  - **Weak:** Section Options → Grids geometry · Show location (main-column experience/education/volunteering, Word) ·
    cover-letter signature space
  - **Partial (21):** contact icon size · photo shape/size/height/text position · section alignment · item-gap
    override · skills style + separator · entry title layout · show dates per section · entry field eye toggles ·
    entry links in Word · bold/italic/lists/justify in Word · legacy `bullets[]` · Sidebar ATS-safe geometry ·
    Design section resets
- [ ] **A registry of controls + a meta-test** that fails when a new control ships with no test
- [ ] **Cypress has never run** on the 2026-09-17…20 work. The 09-20 features (ATS checker, mobile layout, bullet
      optimiser, page-fit, Markdown, starters, JSON Resume, letter generator, jobs CSV, icon picker) have unit tests
      at most. Expect failures. Runner: `pdf-harness/e2e-wt.sh … 4174 --spec …`
- [ ] **53 verifier unit groups, 0 verified** ❓ (`waves.py status`) — may be moot now

---

## 4 · ATS exactness — your main order of 2026-09-22 17:30

*"Experience section parses EXACTLY in every portal"* — the defects are ATS-1…ATS-6 in `bug-status.md`. What is
left **besides** the fixes:

- [ ] Re-run the lost field-level measurement across options × fuzz seeds 2 and 7
      (`tests/pdf/ats-fields.mjs`, `ats-fuzz.mjs`) and the scorer-leniency audit
- [ ] Score **every field of every entry**, not just title / company / start year
- [ ] **Real-parser check is blocked**: scripted upload to Affinda is refused by the auto-mode classifier.
      **You** drag the fixtures in (`qa-visual-compare/ats-real/pdf/*.pdf`, fictional) and I read the result.
      🔴 `qa-visual-compare/seed-*/export.pdf` is your **real** résumé — never upload it.
- [ ] Turn `synth__parity-recommendations.json` (22 ranked recommendations) into
      `reference_flowcv-parity-2026-09-22.md` and show you

---

## 5 · Performance — PERF-1…6, never started ❓

Plan: `qa-visual-compare/wf3/perf_plan.md`. WIP for PERF-1 in clone `qa-visual-compare/lanes/PERF-1`.

- [ ] PERF-1 harness + WOFF cache · PERF-2 render scheduling + debounce · PERF-3 deferred save + skip no-op renders
- [ ] PERF-4 editor commits + colour pickers · PERF-5 pdf.js paint + chunk split · PERF-6 PDF in a Web Worker

---

## 6 · Open-source release — your standing order #1

*"Build a fully free, open-source rival to FlowCV"* (2026-09-14). Repo is live at
`git@github.com:sairamg8/resume-writter.git`.

- [ ] ✅ **`LICENSE` is MISSING** — the README claims MIT. Add the file.
- [ ] ✅ **`CONTRIBUTING.md` is MISSING** — dev setup, PR expectations, coding style
- [ ] Refresh README: structure, job tracker routes, test scripts; link `docs/knowledge/`
- [ ] Clarify the product name (CPWT-CV) vs the folder name (`flowcv`)
- [ ] Replace the personal demo résumé seed with a neutral placeholder for public forks
- [ ] Confirm Terms/Privacy match the hosting domain
- [ ] Ensure the app works fully offline with no Firebase env (auth disabled gracefully)
- [ ] Tag `v0.1.0` when stable
- [x] ✅ `.gitignore`, `.env.example` exist; `.env` is git-ignored

---

## 7 · Housekeeping

- [ ] ✅ **`TODO_RESOLVE_CONFLICTS.md` is stale — delete it.** It describes merging
      `gemma_feature/react-pdf-export` into `origin/main`; only `master` exists now and the work landed long ago.
      Last touched 2026-07-14.
- [ ] `docs/knowledge/*.md` still name the old path `/home/sairam/Documents/flowcv`
- [ ] `docs/knowledge/05-state-auth-sync.md` has a stale `DATA_VERSION`; the knowledge docs pre-date per-résumé migrations
- [ ] `graphify-out/` still names the deleted `CareerTimeline.jsx`
- [ ] Memory store: add a `.gitignore` for `__pycache__/*.pyc` under `flowcv/prompts/_generator/`, `flowcv/pdf-harness/`, `shared/scripts/`
- [ ] VS Code holds ~59k of 65,536 inotify watches — raising `fs.inotify.max_user_watches` is **your** system call

---

## 8 · Suggested order

1. **Answer D1** — 19 commits and 12 bug fixes are undeployed; everything else is downstream of that.
2. **ATS-1 + ATS-2** — highest-value open defect: the work location is glued to the job title on every template,
   so a real ATS misreads the single most important field. Must land **before** B2 (the 10 templates).
3. AUD-23 → AUD-24 → the Low rows (AUD-25…AUD-34).
4. **Answer D2**, then the templates-UI Phase 1 audit.
5. Page size control (§2.2) — small, visible, self-contained.
6. The 6 remaining header-spacing rows (§2.1) — finishes the feature you asked for.
7. Test-gap registry + meta-test (§3), then Cypress.
8. `LICENSE` + `CONTRIBUTING.md` (§6) — one commit, unblocks the open-source goal.
