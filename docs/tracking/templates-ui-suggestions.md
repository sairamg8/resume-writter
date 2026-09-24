# Templates UI — suggestions

> **Phase 1 of [templates-ui-plan.md](templates-ui-plan.md), complete.** Read-only audit, 2026-09-23,
> against `9ee2768`. Nothing was built. **The owner picks from §5 before any code is written.**
>
> Method: four parallel read-only agents (picker · visual variety · surrounds · phone & a11y) plus a
> live-app pass by the launching session at 1440 and 375 px. Renders and measurements:
> `/tmp/templates-audit/renders/` (six-up sheet `_sheet.png`, header crops `_headers.png`, preset proofs
> `_presets.png`, per-render text geometry `geometry.json`).
>
> 🔴 **Six correctness bugs came out of this audit. They are NOT suggestions** — they are in
> [templates-ui-bugs.md](templates-ui-bugs.md) for the bug lane. One of them, TUI-1, ships today and
> **exports a résumé with no name on it**. Read that file first.

## 1 · What the audit changes about the plan

Five of the plan's premises were wrong or incomplete. Each cost is now known:

| Plan said | Audit found |
|---|---|
| "5 templates" | **3 layouts.** Executive is Classic + one hardcoded prop (`italicSubs`, `ExecutiveTemplatePDF.jsx:127`); Minimal is Classic + two hardcoded style choices (`MinimalTemplatePDF.jsx:53`, `:103-115`); Sidebar-single **is** Classic (`SidebarTemplatePDF.jsx:54-56`). Measured, the four single-column looks differ by ≤2.0 pt header height and ≤0.74 pp ink. |
| A6 "honest badges" = the picker | The badge already **contradicts the app's own ATS Check** for two of five templates, via four hand-maintained lists (TUI-5). Fix the source of truth before rewording anything. |
| A4 Undo = M | **No toast/snackbar primitive exists in `src`**, and no undo of any kind. Undo must restore `{template, settings}` **as a pair** — restoring settings alone does not reproduce the page, because unset `textColor` and entry `titleOrder` resolve per template. |
| A3 filter chips = S | **Nothing to filter on.** `TEMPLATES` has no columns/photo/serif/density field; `desc` is free prose. Typed descriptors must land first (shared with A6). |
| E1 = fix today's phone list | **Not a defect today.** At 5 templates the list needs zero scrolling (last row at 407 px of a 708 px box), rows are 62 px, and the picker has **no hover-only controls**. E1 is a *precondition for more templates*, not a current fix. |
| B1 presets = "no new layout code" | Right on the count, wrong on the code: needs 3 new knobs, a preset-aware `resolveSection`, and a battery change. See §3. |

## 2 · The picker

Ranked within the section. `file:line` are in this worktree.

| # | Suggestion | Evidence | Effort | Impact |
|---|---|---|---|---|
| **A10** | **One `atsRating(template, settings)`** read by both `TEMPLATE_PICKER` and `atsChecker`, normalised through `templateId()`. Re-pin `15-design-defaults.test.mjs:150` to the derived set, not a literal. | TUI-5. Also `atsChecker.js:589` reads the raw id, skipping `templateId()` — latent today, inherited by any badge derived from the checker. | S | **High — do this before A6** |
| **A6** | **Honest badges and descriptions.** Modern earns a badge it does not have; Sidebar is wrong in both modes; every description is untrue, undistinctive or silent. | `classic`'s "Two-column header" is false (default contact layout is `justify`, `defaultData.js:33`) and collides with the app's own "Multi-column contact header" warning (`atsChecker.js:1093`). "Executive · Vibrant" omits the single most visible difference in the set: role-first **inline** entries (`templateSectionDefaults.js:16-21`). | S | High |
| **A5** | **Say what a switch keeps** — and say it correctly. The plan's proposed line is itself untrue. | `setTemplate` (`useResumeStore.js:237-243`) unconditionally overwrites `headingStyle` **and `sectionTitleCase`**, conditionally blanks `nameColor`/`jobTitleColor`, and silently changes unset `textColor`, entry `titleOrder`, `showHeaderBorder` and header spacing — all resolved per template. | S | High |
| **A7** | **Label the Design button at every width**, + `min-h-11 min-w-11` + `aria-pressed`. Keep the `title` attribute (three Cypress specs select by it). | **33×33 px** on a phone, 37×37 on desktop (`EditorHeader.jsx:110`, `p-2` + icon 15 + border). It is the only door to the picker. ⚠️ The plan's premise "tooltip is NOT an accessible name" is **wrong** — `title` is the accname last resort and this repo's own `cypress/support/a11y.js:38` honours it. Justify on size, `aria-pressed`, and tooltips never firing on touch. | S | High |
| **A9** | **Promote Sidebar's two modes to two picker entries.** The ATS-safe mode is undiscoverable: no badge on the row, and the toggle renders only once you are already on Sidebar (`DesignPanel.jsx:71`). | The app's own checker calls that state `ATS-Certified`, 10/10 (`atsChecker.js:1058-1065`), and the battery proves it parses whole under pdf.js and every Poppler mode. | S–M | High |
| **A8** | **`role="radiogroup"` + `aria-checked`** on the cards and on `SegmentControl`, with a visible "Selected" marker. | Selection is conveyed by **colour alone** (`DesignPanel.jsx:48-50`, `:63`) — no `aria-pressed`, `aria-current` or `role=radio`. The Contact-icons list *directly below in the same file* renders a "Selected" word (`:119`). | S | High |
| **A13** | **Fix the description contrast.** `text-gray-400` on white ≈ **2.5:1** against WCAG's 4.5:1 (`DesignPanel.jsx:66`, `:82-84`, `:87`) — and since every row draws the same icon, that 10 px line is the *entire* basis for choosing. → `text-gray-600`, `text-[11px]`. Row height is unchanged (the 40 px icon dominates). | Measured. | S | **High — cheapest real win** |
| **A1** | **Real thumbnails.** Every row draws the same 4-bar div, tinted by accent (`DesignPanel.jsx:52-60`). | Cheaper than the plan assumes: `DEMO_RESUMES` already holds one sample per template (`sampleResumes.js:123-135`), and `15-design-defaults.test.mjs:129-151` already loops every per-template table against `TEMPLATE_IDS`, so "every template has a thumbnail" is one added line. Needs `@napi-rs/canvas` declared (R3-9, owner's call). | M | High |
| **A2** | **Gallery dialog** — the panel keeps one current-template card + "Browse templates (N)"; the grid moves into a dialog. | See §4. | M | High at 10+ |
| **A11** | `data-testid="template-card"` now; ≥44 px on `SegmentControl` (30 px today, `DesignPanelShared.jsx:93`). | Cypress currently selects templates **by prose** (`04-design.cy.js:20`, `:37`, `:51-52`), so A6's rewording breaks three specs unless this lands first. | S | Medium — **unblocks A6** |
| **A4** | **Undo a switch.** | Build the toast primitive first; restore `{template, settings}` as a pair. | M–L | Medium |
| **A3** | Filter chips — **after** typed descriptor fields. | Nothing to filter on today. | S+S | Medium |
| **A12** | Lift `DesignSection`'s `open` into `Editor` state so a collapsed Template stays collapsed. | Local `useState` (`DesignPanelShared.jsx:107`) + `DesignPanel` unmounts on tab change (`Editor.jsx:120-124`). | S | Medium — cheap hedge if A2 slips |
| **A14** | `aria-expanded` + `aria-controls` on `DesignSection` (`DesignPanelShared.jsx:111-117`); `useId` is already imported there. | — | S | Low–medium |

## 3 · Variety — can ">=10 templates" ship as presets?

**Yes for the count and for real variety — but not over "5 engines", and not at effort S.**

**Proven.** Three settings-only presets over the *unmodified* Classic engine (`renders/_presets.png`) are
more distinguishable from each other — header heights **101.6 / 138.2 / 208.3 pt** — than the four real
engines are from each other (**133–135 pt**). Two of the three came out clean on all four ATS readers first
try. ~45 knobs already exist (type, colour, headings, header, photo, spacing incl. 13 header gaps, dates).

**Of the five named gaps:** serif ✅ (4 serif faces already ship) and compact ✅ (fits a 2-page résumé onto
1 page, all within the panel's own ranges) are **pure settings, today**. photo-first is mostly settings.
**first-job** needs a section-order apply (order is content, not settings). **creative** needs new layout
code — the engines can draw exactly two decorative grounds.

**Four things stop it being cheap:**

1. **Entry layout is not in `resume.settings`** — `titleStyle`/`titleOrder` live in `section.settings` with
   per-template defaults keyed by template id (`templateSectionDefaults.js:39-53`). A preset is not a
   template id. Give `resolveSection` a preset-keyed lookup; **do not write into `section.settings`** or you
   destroy the user's own per-section choices with no undo. **M, and the single largest blocker.**
2. **Minimal and Executive are not expressible as presets today** — needs `settings.italicSubs`,
   `settings.nameWeight` (+ tracking) and `settings.summaryStyle`. Three small knobs, and every preset gains
   them. Deleting `ExecutiveTemplatePDF.jsx` is −134 lines. **S–M, behind goldens.**
3. **Presets do not enter the ATS battery** — `42-ats-fields.test.mjs:28` enumerates `TEMPLATE_IDS` and looks
   fixtures up by `DEMO_RESUMES.find(x => x.template === …)`. And presets **can** fail: one of the three
   proofs hit `pdftotext -raw: 1/6 section header(s) undetected`. **S once presets exist — and non-optional.**
4. **TUI-1 is the preset trap in miniature.** A stored header colour surviving onto a ground it cannot read
   is exactly what a preset does. Fix it before shipping any preset.

**Honest effort:** *"10 named looks, each demonstrably different and ATS-scored"* = **M**. *"10 templates a
user can browse, preview, pick and undo"* = **L** — that is the 09-15 plan's T1a+T1b (goldens → spec-engine
refactor → `base + templateVariant` storage → `applyTemplate` with untouched-tracking → gallery →
thumbnails). **B1 is not an alternative to B2: B1 done properly *is* T1a+T1b**, which is most of B2's
foundation.

**Of the 10 designed layouts**, six are largely preset-able (Banded ~90%, Keel ~85%, Broadsheet ~80%,
Gridline ~70%, Linen ~70%, Registry ~60%) and four are genuinely new code (Lectern ~30%, Bookend ~25%,
Keystone ~20%, Chronicle ~0%, already gated on an extraction test).

🔴 **Fix ATS-1 before T2.** The `" · "` location glue is in the **shared** renderers
(`PdfSections.jsx:130`, `:132`; `PdfSidebarSections.jsx:103`), so every new template inherits it free.
Four of the ten designs actively add new location/organisation pairing (Banded, Gridline, Lectern,
Keystone); Linen is the safest ("nothing right-aligned"). Add "no ` · ` between title/company and location"
to the ATS gate so all ten are checked by construction.

## 4 · Crowding — the case for the gallery

Row pitch 68 px; scroll box 708 px at 375×812, of which the bottom 54 px sits under the floating
Edit/Preview pill (`Editor.jsx:157`, `fixed bottom-4`).

| Templates | Last row bottom | Colors section starts at |
|---|---|---|
| 5 (today) | **407 px — fits** | 464 px |
| 10 (B1) | 747 px | **804 px ≈ 1.14 screens** |
| 15 (B1+B2) | 1087 px | **1144 px ≈ 1.6 screens** |
| 15, long names | 1237 px | **1294 px ≈ 1.8 screens** |

"Long names" is not hypothetical — the text column has no `min-w-0`/`truncate`, so a two-line description
grows the row to 72 px, and the catalogue's names plus B3 category suffixes will do it.

**The cost compounds:** `EditorTabContent.jsx:12-14` resets `scrollTop = 0` on **every** tab change
(deliberately — "Design at Template"). So that 1.6-screen scroll is paid on *every visit* to Design, not
once per session. At 15 templates, Colors, Typography, Spacing, Headings, Dates and Reset are all
practically unreachable on a phone.

```
┌ TEMPLATE ───────────────────────────────────────────────┐
│ ┌──────┐  Executive                          [ATS]      │
│ │ thumb│  One column · Accent headings ·                 │
│ └──────┘  Role-first inline entries                      │
│                             [ Browse templates (12) ]    │
│  Switching keeps your content, font, colours and         │
│  spacing. It changes heading style and capitalisation.   │
└──────────────────────────────────────────────────────────┘
        ↓ one screen instead of three — Colors back above the fold
```

**E1 (phone sheet) carries two riders:** "Apply always visible" is incoherent until A4 exists (picking
applies instantly today — there is nothing to Apply), so until then the footer needs a **Done** control at
≥44 px plus a `role="status"` announcement — on a phone the preview is on the *other tab*, so a switch
gives **no feedback at all** today. And the Sidebar single-column toggle must move into the sheet with the
list, or the two halves of one decision end up on different surfaces.

## 5 · What the owner decides

**Recommended order.** Bugs first — they are cheap, and two of them block the rest.

1. 🔴 **[templates-ui-bugs.md](templates-ui-bugs.md) TUI-1** — a résumé exports with no name. Ship today.
2. **TUI-5 → A10** — one `atsRating`. Everything about badges is downstream, and any new template lands
   wrong without it.
3. **A13 + A7 + A8** — contrast, the 33 px door, `aria-checked`. Three small commits, immediately felt.
4. **A11 → A6 + A5** — testids first, then honest badges and honest switch copy.
5. **A9** — surface Sidebar's ATS-safe mode in the list. Cheap, and it stops users skipping the one
   template that is provably ATS-clean.
6. **ATS-1 (bug-status.md)** — before any new template or preset.
7. **A1 thumbnails → A2 gallery → E1 sheet** — in that order; the gallery is pointless without pictures,
   and the sheet is premature below ~10 templates.
8. **Presets (B1)** — the three knobs, the `resolveSection` lookup, the battery extension. Goldens first.
9. **The 10 layouts (B2)** — on T1a+T1b, six of them largely as presets.

**Still open, and yours:**

- **`@napi-rs/canvas` as a declared dev dependency** (R3-9) — A1 needs it. It is installed but absent from
  `package.json`.
- **Modern's ATS badge** — A10 makes the picker and the checker agree; *which* of them is right is a
  product call, not a code one.
- **Retiring Executive and Minimal as engines** (§3.2). Net −134 lines and a wider preset range, but every
  saved résumé must print byte-identically — goldens are the gate.
- **C1 thumbnail cache placement.** It cannot live on the résumé: `useResumeStore.js:111` stringifies the
  whole app state into one localStorage key, and each résumé syncs as a Firestore doc capped at 1 MiB with
  100 KB headroom (`cloudSyncHeld.js:13-18`) — an over-cap résumé is held out of sync entirely. And there is
  **no save event**: `updatedAt` moves on every keystroke. Proposal: a separate per-résumé key, never
  synced, first to be evicted by `setItemWithRoom`, generated lazily on dashboard scroll.
