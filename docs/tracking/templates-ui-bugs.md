# Bugs found by the Templates UI audit — for `bug-status.md`

> Phase 1 of `templates-ui-plan.md` was a read-only UI audit. It surfaced **six correctness bugs**,
> which do not belong in a suggestions file. They are written here in `bug-status.md`'s row format so
> the bug lane can paste them in. Found 2026-09-23 against `9ee2768` in the worktree
> `flowcv-templates-ui`; every one is re-checked against the code, and TUI-1 against a real render.
>
> 🔴 **TUI-1 is High and ships today.** The others are Medium.

## TUI-1 · Sidebar "Single · ATS-safe" exports a résumé with **no name on it**

**Severity High · verified by render.**

`headerGround()` (`src/templates/pdf/shared/headerColors.js:29-31`) resolves with `templateId(template)`
instead of `headerTemplateId(template, settings)`. In Single·ATS-safe mode the page is Classic's — white —
but `headerGround` still returns the Sidebar's dark band `#1e40af`, so:

- the name is drawn `#ffffff` on white: **contrast 1.00:1**, invisible (`HEADER_SEEN` floor is 2);
- the job title is `#bfdbfe` on white: 1.42:1, barely legible;
- `withHeaderColorsBack`'s rescue never fires, because it believes the header is still dark.

Two things compound it: `resolveTemplateSettings` short-circuits on a stored colour
(`templateSettings.js:113`), so `DEFAULTS.sidebar.nameColor`'s own correct single-column branch (`:77-81`)
never runs; and the Layout toggle is a plain `updateSetting('sidebarSingleColumn', v)`
(`DesignPanel.jsx:82`), not a template switch, so `headerColorsOnSwitch` (`useResumeStore.js:237-243`)
never gets a chance either.

`headerGround` is **the only one of seven call sites** that is not single-column aware — compare
`templateSettings.js:162`, `headerSpacingRows.js:56`, `templates.js:186`, `:209`, `:220`, `:269`.

Evidence: `/tmp/templates-audit/renders/sidebar-single-ats.png` — page 1 opens at the job title; the
name is absent.

**Fix:** `headerGround` → `headerTemplateId(template, settings)`; run `withHeaderColorsBack(…, {below: HEADER_READS})`
when `sidebarSingleColumn` flips, as a switch does.
**Test (fails today):** for every template × `sidebarSingleColumn`, the drawn name's fill reaches
`HEADER_SEEN` against the ground it is actually drawn on.

## TUI-2 · Sidebar "Single · ATS-safe" prints an ATS-hostile cover letter

**Severity Medium · verified by code.**

Same root cause, second site. `letterheadLook()` (`src/templates/pdf/shared/letterhead.js:155`) resolves
with `templateId(template)`, so a Sidebar résumé in single-column mode renders Classic's page but keeps
`LOOKS.sidebar` for the letter — a dark, full-bleed band to the paper edge. The same function resolves the
template four different ways: `:155` `templateId` (not aware), `:160` via `hasHeaderControls` (aware),
`:161` `inlineLayout(look, s)` with no settings arg (not aware), `:172` `headerBorderOn` (aware). Net for
Sidebar-single: Classic's centring and rule defaults, Inline silently disabled, Sidebar's band anyway.

Meanwhile `DesignPanel.jsx:83` sells the mode as "reads cleanly in every applicant-tracking system".
`sidebarSingleColumn` appears in **none** of `tests/unit/letterhead.unit.mjs`,
`tests/pdf/21-cover-letter-looks*.mjs`, `tests/pdf/23-cover-letter-looks-word.test.mjs`.

**Fix:** one resolver — `letterheadLook` takes `headerTemplateId(template, s)`, and `inlineLayout` is passed `s`.

## TUI-3 · The ATS panel's fix button is mislabelled and destructive

**Severity Medium · verified by code.**

`AtsCheckerPanel.jsx:180` reads **"Switch to Single-Column ATS Layout"** — the name of the Sidebar's own
toggle (`DesignPanel.jsx:77`, `sidebarSingleColumn`) — but `handleSwitchToClassic()` (`:54-57`) calls
`store.setTemplate('classic')`. A Sidebar user clicking it to become ATS-safe instead loses the Sidebar
entirely, plus its heading style and title case (`useResumeStore.js:237-243` overwrites both), with no undo
anywhere in the app. `:342` labels the same handler honestly ("Switch to Classic ATS Layout"), hardcoding
`"Classic"` rather than `templateLabel('classic')`.

**Fix:** for a Sidebar résumé offer the non-destructive fix first — `updateSetting('sidebarSingleColumn', true)`
under a label that matches — and keep "Switch to Classic" as a separate, clearly destructive action.

## TUI-4 · JSON Resume round trip silently loses the template

**Severity Medium · verified by code.**

`src/utils/jsonResume.js:243-244` hardcodes `template: 'classic'` and `getStarterSettings('classic')` for
every import, and `cpwtResumeToJsonResume` (`:282`) never writes the template out — the schema's `meta`
field is unused. Export → import turns any Modern/Sidebar/Executive/Minimal résumé into Classic with design
settings reset, silently. `tests/unit/json-resume-roundtrip.unit.mjs:19` only ever uses `template: 'classic'`,
so the fixture cannot catch it.

**Fix:** write `meta.template` on export, read it back (falling back to Classic when absent or unknown), and
surface a dismissible notice when an import changed the template.

## TUI-5 · The ATS checker hardcodes the ATS template list and contradicts the picker

**Severity Medium · verified by code.** A live survivor of `FIDB-51-VF7-NB1`.

`src/utils/atsChecker.js:1059` — `currentTemplate === 'classic' || … 'minimal' || … 'executive' || isSidebarSingle`.
`TEMPLATES[id].ats` is never read; `:1077` hardcodes the names again in prose. Two contradictions visible
today, same résumé, two tabs one button apart:

| Résumé | Design panel badge | ATS Check says |
|---|---|---|
| Modern | no ATS badge (`templates.js:66`, `ats: false`) | **pass**, 4/5, "Modern Single-Column Layout" (`atsChecker.js:1066-1071`) |
| Sidebar + Single·ATS-safe | no badge (`ats` is static, takes no `settings`) | **pass**, 5/5, `ATS-Certified Template: "SIDEBAR (SINGLE · ATS-SAFE)"` (`:1058-1063`) |

Four hand-maintained copies of the trio exist and none cross-checks the others:
`templates.js` (the flags), `15-design-defaults.test.mjs:150`, `ats-checker.unit.mjs:306`, `ats-validate.mjs:66`.

**Fix:** one `atsFriendly(template, settings)` read by both the picker and the checker; replace the four
literals with the derivation. **Do this before adding any template** — a 6th ATS-safe template scores 2/5
today and is told to switch away.

## TUI-6 · A page break glues the last line of page N to the first of page N+1 (`pdftotext -raw`)

**Severity Medium · verified by extraction.** Distinct from ATS-4 (intra-line squeeze); this is an
inter-page boundary defect, and it is latent in **every template**.

`-raw` emits no newline around the `\f`, so a section heading that lands first on a new page stops being a
heading: `"Tooling: Vite, Cypress, Jest, GitHub Actions, Docker, Figma\fPROJECTS"`. Not font-specific —
sweeping `sectionGap` 10→24 on default Classic produced a glued boundary at *every* value. Whether it
costs a section header is a lottery on résumé length, and any new template or preset re-rolls it.

**Suggest filing as ATS-7.** **Fix:** emit a line break at the page boundary (the `BREAK_MARK` machinery in
`pdfFontLoader.js:93` is the likely place), or normalise `\f` → `\n\f\n` in the extractors, plus a test that
no `-raw` line contains `\f` with text on both sides.

---

## Also worth a row, lower value

- **Dashboard cards are pixel-identical, not merely similar.** `ResumeCard.jsx:30-50` parameterises the mock
  on `accent` alone, and all five creation paths write the same `#374151` (`defaultData.js:16`,
  `starterTemplates.js:16`, `jsonResume.js:244`). The `#2563eb` fallback at `:19` is unreachable.
- **The .docx drops Modern's and Sidebar's header band** (`wordExportHeader.js:106-107`) with nothing saying
  so — and the .docx is the file that reaches the ATS.
- **The starter modal claims "pre-filled, ATS-optimized role templates"** (`StarterTemplateModal.jsx:19`)
  while the Product Manager starter sets Modern (`starterTemplates.js:153`), which the app's own table marks
  `ats: false`. Untrue for one of three cards.
- **`ResumeCard.jsx:88-89`** prints `resume.template` under a CSS `capitalize` instead of `templateLabel()`.
  No visible defect today (id === lowercased label for all five); breaks the moment a label differs from its
  id, which every preset and every new template will do.
