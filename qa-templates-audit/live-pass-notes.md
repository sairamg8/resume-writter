# Templates UI — live-app pass (launching session, 2026-09-23)

Worktree `/mnt/Storage/Projects/flowcv-templates-ui` @ `9ee2768`, dev server on :5174, signed out,
one fictional résumé from the "Software Engineer (Full Stack)" starter. The 4 audit agents were kept
off the browser; these are the observations only the live app can give.

## Setup note — NOT a finding
Symlinking the worktree's `node_modules` to the main checkout broke Vite's `?url` asset resolution
(`Invalid workerSrc type`, `PdfPreview.jsx:130`) because the real path resolves outside the worktree
root. A real `yarn install` in the worktree (3s, warm cache) fixed it. This is a harness artifact —
do NOT report it as an app bug.

## Confirmed against the running app

1. **Identical row icons — A1 CONFIRMED.** `DesignPanel.jsx:52-60` hardcodes one 4-white-bar block for
   every template; only `backgroundColor` (accent when selected, `#94a3b8` otherwise) and opacity
   (100 / 40) change. On screen the five rows are indistinguishable as pictures. There is no picture
   of any template anywhere in the picker.

2. **Starters set a template silently — agent 3's item 2 CONFIRMED with stored data.** Creating from
   the "Software Engineer (Full Stack)" starter wrote `template: "classic"` into
   `localStorage.cpwtcv_v1.resumes[0]`. Nothing in the starter modal names a template.

3. **Dashboard card — C1 premise CONFIRMED, C2 premise CORRECTED.** The card draws a generic mock
   (dark band + grey bars), identical per template. But the card DOES already print the template name
   ("Classic · Just Now"). So C2 is only "add page count", not "add the template name" — rewrite it.

4. **🔴 Sidebar's ATS-safe mode is undiscoverable (NOT in the plan).** The Sidebar row carries no ATS
   badge, and the "Layout: Two columns / Single · ATS-safe" toggle renders only when
   `current === 'sidebar'` (`DesignPanel.jsx:70`). A user comparing templates for ATS safety sees
   Sidebar as the one template without an ATS badge and skips it — never learning it has a mode that
   IS ATS-safe (AUD-17 made the rest of the app honour it). The fix is cheap: badge the Sidebar row
   "ATS in single column" and surface the mode in the list.

5. **🔴 Name collision in one panel (NOT in the plan).** The Design panel shows "Classic", "Modern",
   "Minimal" as TEMPLATE rows and again as CONTACT ICON pack rows, ~800px apart in the same scroll.
   Same words, different meaning, no qualifier on either.

6. **Switch is instant and total, with no warning and no undo — A4 CONFIRMED.** Clicking Sidebar
   redrew the whole preview at once. Nothing on screen said what would be kept or overwritten.

## Measured at 375x812 (mobile emulation, getBoundingClientRect)

| Control | Measured | 44x44 |
|---|---|---|
| Template rows (5) | 309 x 62 | pass |
| Sidebar Layout toggle | 153 x 30 | **FAIL** |
| Floating Edit / Preview pill | 71 x 28, 95 x 28 | **FAIL** |
| "Design & Customize" button | **33 x 33** | **FAIL** |

- `Design & Customize` has `title` only; **`aria-label` is null**. It is the ONLY way into the picker.
- At 375px the Design panel is a full-width sheet and **Template renders first, at the top** — the
  plan's "must scroll past other sections" hypothesis is WRONG today. E1 survives on crowding
  (5 rows at 62px already fill the sheet), not on scroll depth.
- The floating Edit/Preview pill is `fixed bottom-4` and `elementsFromPoint` shows it stacked over the
  "CONTACT ICONS" section header — it occludes whichever Design section sits at the viewport bottom.
- The five template buttons come back from the accessibility tree as bare `button` with no accessible
  name; the labels live in child `<p>`s. Needs code confirmation (sent to agent 4).

## Sent to agent 4
All of the 375px measurements and the three corrections above, so its report is grounded in measured
values rather than Tailwind arithmetic.

## Verification of agent 1's F10 (checked directly, 2026-09-23)

Agent 1 reported `ResumeCard.jsx:89` "prints the raw lowercase id — 'classic'". **Partly right, and the
nuance changes its priority.** The line is:

```jsx
<p className="text-[11px] text-gray-400 mt-0.5 capitalize">
  {resume.template || 'classic'} · {timeAgo(resume.updatedAt)}
```

It does bypass `templateLabel()`, but a CSS `capitalize` class renders it as "Classic" — which is what
my live screenshot showed. So there is **no user-visible defect today**, because for all 5 templates the
id equals the lowercased label.

It becomes visible the moment a label differs from its id — exactly what the 10 designed templates bring
("Source Serif 4" → id `sourceserif` → renders "Sourceserif"). So: **latent, zero impact now, certain to
bite when B2 lands.** Fix it in the same commit as the first added template, not before.
