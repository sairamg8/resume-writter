# HANDOFF — pdf-pagination cluster (temporary: delete before the cluster report)

Written 2026-09-24 when the cloud session neared its limit. Read this first to pick the cluster up on
another machine. The cluster protocol is `docs/tracking/CLUSTER-PROTOCOL.md` on
`origin/claude/beautiful-heisenberg-x3bsvo`
(`git show origin/claude/beautiful-heisenberg-x3bsvo:docs/tracking/CLUSTER-PROTOCOL.md`).

- Branch: `claude/wf-pdf-pagination` (push only here, never `--force`). Base: `504b313`.
- Rows: R2-046, R2-047, R2-048, R2-049, R2-104, R2-109, R2-111. **All seven are fixed, committed and pushed.**
- Left to do: **(1)** the independent reviewer pass (the protocol's "Review before you finish"). It was
  started in the cloud session and did not finish; nothing from it was committed. Run it again.
  **(2)** Delete this file in its own commit. **(3)** As the very last commit, write
  `wf-reports/pdf-pagination.json` (draft below; fill in `review`), commit it as
  `chore(wf): pdf-pagination cluster report`, and push.

## Resume locally

```bash
git fetch origin claude/wf-pdf-pagination && git checkout claude/wf-pdf-pagination
git log --oneline 249cf3f..HEAD        # anything after 249cf3f came from the unfinished reviewer: check it
corepack enable && yarn install --immutable
# pdftotext / mutool (Linux: apt-get install -y poppler-utils mupdf-tools; macOS: brew install poppler mupdf-tools)
node --test --test-concurrency=4 tests/pdf/84-*.test.mjs        # a few minutes: 84-keep-together sweeps ~1000 renders
```

## Commits (base..HEAD)

| sha | row | what |
|---|---|---|
| 143abef | R2-046 | Header block breakable in Classic, Modern, Minimal, Executive, Academic, Compact, Timeline (and Sidebar single column = Classic); only the name/photo/contact row keeps `wrap={false}`. |
| 3a9a087 | R2-109 | `resolveSection` (templateSectionDefaults.js) puts the Grids a type is created with (`createdColumns`) under template + user settings: the Grids control shows the 2 that Languages/References print. |
| e72166f | R2-111 | `ItemHeader`, `TimelineHead` and the Sidebar Experience card promote the next field when the leading one is empty; Word's Experience/Custom make it the bold first run. |
| 5bd239c | R2-047, R2-048 | `RenderColGrid` (PdfSections.jsx): each 2+-column row sits in a View `{SPACER, zero-height mark with minPresenceAhead = 8 lines (+2 on the first row), [title on row 0], row}`; sections pass their title via a `title` prop (+ `settings`). Single column unchanged. |
| 4cec649 | R2-049 | Certification entry `wrap={false}` (centred and left); award title/issuer/date one `wrap={false}` block kept with 2 lines. |
| f6cb390 | R2-049 | Award keep only when a description follows (react-pdf keeps minPresenceAhead room even with nothing after). Also `tests/pdf/16-saved-data-item-gaps.test.mjs`: `gapsOf` renders with `fontSizeBase: 8, marginV: 6` — see notes. |
| 99d3dbb | R2-104 | `SideSectionTitle` (PdfSidebarColumn.jsx) = fragment `{SPACER, View wrap={false} minPresenceAhead=presence}`; Education/Certifications/References pass a presence from the first entry's fields; education head, certification, reference entries `wrap={false}`. |
| 249cf3f | — | Removed the stopped agent's `tests/pdf/tmp84/` scripts. |

Commit trailers use this cloud session's URL (`session_013Hg3VSwaVkaQmNCkotTNsb`), not the one printed in the protocol.

## Fail-first evidence (seen in the cloud session)

- R2-046: 8 of 10 cases failed before (sidebar two-column and banner already passed); all 10 pass after.
- R2-109: failed before ("prints 2, Grids shows 1" for classic/modern/compact × languages/references × undefined/null/''); passes after.
- R2-111: failed before for classic, modern, minimal, executive (the output shown was cut after those four);
  all 10 cases (9 templates + Word) pass after. **The reviewer should confirm the other templates' and Word's fail-first.**
- R2-047/048: failed before for classic/modern two-column Education (title alone), classic two-column
  Experience and Education (order) and sidebar two-column Experience (order); compact Education grid, classic References and
  the sidebar's single-column Experience/Projects cards already passed (kept as guards). All pass after.
- R2-049: award title alone (classic, executive) and centred certification split failed before; left-aligned
  certification already passed (its date shares the name's last line). All pass after.
- R2-104: failed before (titles alone and entries split across ~30 layouts); passes after.

## Regression runs done (all green except as noted)

- After R2-046: 06, 08, 11-headers, 13, 16-saved-data-header-border, 17, 27-header-spacing, 33-sidebar-*, 34-modern-banner-text: 200/0.
- After R2-109: 10-section-options + 64-ats-entry-date 143/0; 15-design-defaults 11/0; 76-compact-look 11/0.
- 50 files matching timeline|entry|header|word|sidebar|10-section + unit word tests: 967/0.
- 28 files (84-*, every test using `columns: 2–4` / pagination / `pages.length`, 06, 13, 17, 33-sidebar, 76-compact, 10-section) after the grid + R2-049 commits: 432/1 — the 1 was the new test's own regex (fixed before commit).
- Sidebar batch (13, 17, 33-sidebar-*, 84-sidebar + 12 more files mentioning sidebar) with R2-104: 328/2 — both
  in 16-saved-data-item-gaps, fixed in f6cb390 (6/0, also 6/0 against the base code).
- 06-pagination sidebar cases after R2-104: 3/0.
- **Not yet run on the final HEAD in one batch.** Run it before the report:
  `node --test --test-concurrency=4 tests/pdf/84-*.test.mjs tests/pdf/06-pagination.test.mjs tests/pdf/13-sidebar.test.mjs tests/pdf/17-sidebar-background.test.mjs tests/pdf/33-sidebar-*.test.mjs tests/pdf/16-saved-data-item-gaps.test.mjs tests/pdf/10-section-options.test.mjs tests/pdf/76-compact-look.test.mjs tests/pdf/04-word-export.test.mjs`
- Baseline failures: none found.

## Reviewer brief (protocol text, plus the points to probe)

> Adversarially review this branch; assume each claim is wrong until you see it hold. For each fixed row:
> read the row (grep its ID in docs/tracking/bug-status-r2/) and the diff (`git log -p 504b313..HEAD`). Does
> the change fix the defect at the root for every case the Repro names, without breaking other templates,
> other exporters, other callers of a changed function, or older stored data? Fail-first: restore each fix
> commit's src/ files to its parent (`git checkout <sha>^ -- <files>`), run the row's new tests and confirm
> they FAIL, then restore (`git checkout HEAD -- <files>`); strengthen any test that passes without its fix.
> Run every added or changed test file plus the existing tests of the changed modules. Check that each
> closed row's proof is true. Run oxlint on the changed files. Fix every real problem you find (commit with
> the same style and trailers), and report the issues and any row whose outcome should change.

Points to probe: (1) `RenderColGrid` now returns a Fragment for one column and wrapper Views for grids —
check every caller; (2) the grid mark when a grid section starts a page or a row is taller than a page
(blank page? FIDA-38 in 06-pagination); (3) `resolveSection`'s new `columns` for sectionGridOnSwitch,
atsChecker, SectionEditorCustomizer, Word, Markdown, JSON Resume; (4) R2-111 Word/PDF agreement under
centred, Inline and Side-by-side titles; (5) `wrap={false}` on a block that could exceed a page (a huge
certification name, a reference) is clipped by react-pdf. Editing `node_modules` (a react-pdf layout patch)
was refused in the cloud session; the fixes stay in app code.

## Draft `wf-reports/pdf-pagination.json` (fill `review`, update shas if the review adds commits)

```json
{
  "cluster": "pdf-pagination",
  "branch": "claude/wf-pdf-pagination",
  "base": "504b313",
  "rows": [
    { "id": "R2-046", "outcome": "fixed", "commits": ["143abef"], "tests": ["tests/pdf/84-long-summary.test.mjs"],
      "summary": "A summary longer than a page continues on the next page: the header block breaks in Classic, Modern, Minimal, Executive, Academic, Compact, Timeline and the Sidebar's single column, only its name, photo and contact row staying whole, so no sentence is cut off or printed into the bottom margin. A header that fits prints as before.",
      "remaining": "" },
    { "id": "R2-047", "outcome": "fixed", "commits": ["5bd239c"], "tests": ["tests/pdf/84-keep-together.test.mjs"],
      "summary": "A grid section's title moves to the next page with its first row: each grid row is led by a zero-height mark keeping eight lines (ten with the title) on its page, so a row that does not fit in less room moves whole, title and all. References cards already kept their title (9a41661, pinned by the test); the Sidebar's single-column cards did not reproduce (0 of 368 layouts at 0.75 pt steps).",
      "remaining": "" },
    { "id": "R2-048", "outcome": "fixed", "commits": ["5bd239c"], "tests": ["tests/pdf/84-keep-together.test.mjs"],
      "summary": "A 2-column grid row that does not fit moves to the next page whole, so its left entry never prints after its right one; a row taller than that room splits where every cell's header fits, and a cell taller than a page still continues (FIDA-38).",
      "remaining": "" },
    { "id": "R2-049", "outcome": "fixed", "commits": ["4cec649", "f6cb390"], "tests": ["tests/pdf/84-keep-together.test.mjs", "tests/pdf/16-saved-data-item-gaps.test.mjs"],
      "summary": "A certification prints unbreakable, so its date (on a line of its own when centred) stays on its name's page; an award's title, issuer and date are one unbreakable block kept with two lines of its description. A left-aligned certification already kept its date (it shares the name's last line).",
      "remaining": "" },
    { "id": "R2-104", "outcome": "fixed", "commits": ["99d3dbb"], "tests": ["tests/pdf/84-sidebar-column-breaks.test.mjs"],
      "summary": "The Sidebar's dark-column titles are unbreakable and keep their first entry's head (or three lines) under them; an education's head, a certification and a reference print unbreakable, so no title ends a page alone and no entry splits across pages.",
      "remaining": "An education's description may still continue on the next page, under its head." },
    { "id": "R2-109", "outcome": "fixed", "commits": ["3a9a087"], "tests": ["tests/pdf/84-default-columns.test.mjs"],
      "summary": "Languages and References that store no Grids show 2 in Section Options → Grids, which is what they print: resolveSection puts the Grids a type is created with under the template's and the user's. Nothing prints differently.",
      "remaining": "" },
    { "id": "R2-111", "outcome": "fixed", "commits": ["e72166f"], "tests": ["tests/pdf/84-empty-leading-field.test.mjs"],
      "summary": "An entry whose leading field is empty (a job with no company) leads with the next field, bold, on the date's line in every template (Timeline's under its date), and Word prints it as the entry's bold first run.",
      "remaining": "" }
  ],
  "review": { "issues": ["PENDING: fill in from the reviewer"], "fixedByReviewer": [] },
  "baselineFailures": [],
  "notes": "tests/pdf/16-saved-data-item-gaps.test.mjs changed (f6cb390): its Classic fixture measured two awards across page 1's foot and passed only because the second award's title stayed alone there (R2-049's defect); gapsOf now renders in smaller type and margins so every pair is on one page, assertions unchanged, passes before and after. Grid rows keep up to 8–10 lines together: a short row that does not fit moves whole and can leave that much space at a page foot. PdfItemHeader.jsx (pdf-text cluster, R3-002) got a 4-line change at ItemHeader's top (R2-111). Commit trailers carry session_013Hg3VSwaVkaQmNCkotTNsb, not the protocol's session id. A react-pdf layout patch (wrap={false} splitting when taller than a page) was considered and not done."
}
```
