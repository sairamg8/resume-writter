# HANDOFF — pdf-pagination cluster (temporary: delete before the cluster report)

Second save, 2026-09-24. Read this first to pick the cluster up in a new session. Protocol:
`git show origin/claude/beautiful-heisenberg-x3bsvo:docs/tracking/CLUSTER-PROTOCOL.md`.

- Branch: `claude/wf-pdf-pagination` (push only here, never `--force`). Base: `504b313`. This save sits on
  top of `6368093`.
- Rows: R2-046, R2-047, R2-048, R2-049, R2-104, R2-109, R2-111. **All seven are fixed and pushed.**
- **Independent review: done.** A reviewer subagent finished and pushed four fix commits (`fa09eb1`,
  `e321801`, `9bb06bf`, `6368093`). Its written report never reached the parent session, so its findings
  below come from its commit messages. **The parent session has not checked those commits**: the user said
  to hold off.
- **`wf-reports/pdf-pagination.json` is not written**, so the coordinator does not yet count the cluster
  as done.

## Next steps, in order

1. **Check the reviewer's commits** (the protocol's "Check its fixes, push"): read `git log -p 4fd38ad..6368093`,
   run the regression batch below on HEAD, run `./node_modules/.bin/oxlint` on the changed files
   (`git diff --name-only 504b313..HEAD -- src tests`). Fix anything wrong, commit, push.
2. **Delete this file** in its own commit; push.
3. **Last:** write `wf-reports/pdf-pagination.json` from the draft at the end (update it after step 1),
   commit it as `chore(wf): pdf-pagination cluster report`, push. Its arrival tells the coordinator the
   cluster is done.

Commit style: `fix(<area>): <what now happens> (R2-0xx)`, ending with a blank line and
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: <the new session's URL>`.
Never edit `docs/tracking/`, never skip or delete a test, no pull request.

## Resume locally

```bash
git fetch origin claude/wf-pdf-pagination && git checkout claude/wf-pdf-pagination
git log --oneline 504b313..HEAD
corepack enable && yarn install --immutable
# pdftotext / mutool (Linux: apt-get install -y poppler-utils mupdf-tools; macOS: brew install poppler mupdf-tools)

# Regression batch for step 1 (takes a while: 84-keep-together alone sweeps over a thousand renders)
node --test --test-concurrency=4 tests/pdf/84-*.test.mjs tests/pdf/06-pagination.test.mjs \
  tests/pdf/13-sidebar.test.mjs tests/pdf/17-sidebar-background.test.mjs tests/pdf/33-sidebar-*.test.mjs \
  tests/pdf/16-saved-data-item-gaps.test.mjs tests/pdf/10-section-options.test.mjs tests/pdf/76-compact-look.test.mjs \
  tests/pdf/04-word-export.test.mjs tests/pdf/15-design-defaults.test.mjs tests/pdf/64-ats-entry-date.test.mjs \
  tests/pdf/67-timeline-ats.test.mjs tests/pdf/67-timeline-look.test.mjs
```

A failing test that is not this cluster's: re-run it on the base code (`git stash -u; node --test <file>;
git stash pop`) before blaming the branch; CI runs Poppler 26.01 and a local Poppler can differ.

## Commits (base..HEAD)

| sha | by | row | what |
|---|---|---|---|
| 143abef | author | R2-046 | Header block breakable in Classic, Modern, Minimal, Executive, Academic, Compact, Timeline (and the Sidebar's single column = Classic); only the name/photo/contact row keeps `wrap={false}`. |
| 3a9a087 | author | R2-109 | `resolveSection` puts the Grids a type is created with under template + user settings, so the Grids control shows the 2 that Languages/References print. |
| e72166f | author | R2-111 | `ItemHeader`, `TimelineHead` and the Sidebar card promote the next field when the leading one is empty; Word's Experience/Custom make it the bold first run. |
| 5bd239c | author | R2-047, R2-048 | `RenderColGrid`: each 2+-column row in a View `{SPACER, zero-height mark with minPresenceAhead 8 lines (+2 on the first row), [title], row}`; sections pass their title via `title`. |
| 4cec649 | author | R2-049 | Certification `wrap={false}`; award title/issuer/date one `wrap={false}` block kept with 2 lines. |
| f6cb390 | author | R2-049 | Award keep only over a description; `16-saved-data-item-gaps`' `gapsOf` renders at `fontSizeBase 8, marginV 6` (see notes). |
| 99d3dbb | author | R2-104 | Dark column: `SideSectionTitle` unbreakable after SPACER with a presence; education head, certification, reference `wrap={false}`. |
| 249cf3f | author | — | Removed the stopped agent's `tests/pdf/tmp84/`. |
| 1d8b96c, 4fd38ad | author | — | First handoff. |
| fa09eb1 | reviewer | R2-109 | A stored type named like an Object member resolves as custom instead of throwing. |
| e321801 | reviewer | R2-047, R2-049 | Every section's title keeps its first entry's header (`headPresence`, `itemHeadPresence` in PdfItemHeader.jsx; the cards' own); sweeps must cross the page foot. |
| 9bb06bf | reviewer | R2-047, R2-048 | A 2-column section with no visible entry keeps its title; the Timeline's own grid (`TimelineEntries`) uses the same `gridRows`. |
| 6368093 | reviewer | R2-104 | The dark column's keep measures each field's lines (`sideLines`); a new test slides References across the page foot. |

## What the reviewer found (from its commit messages; check in step 1)

1. **R2-109, `fa09eb1`:** `resolveSection` threw for a stored section type named like an Object member
   (`constructor`, `toString`, `__proto__`). The lookup 3a9a087 added found the prototype member, and the PDF,
   the Word export and the section's options all failed for that résumé.
2. **R2-047, `e321801`:** a title's three-line keep (50 pt at 11 pt) was shorter than the first entry's header
   plus its two kept lines (63 pt). The title stayed alone in one-column Experience, Education, Volunteering,
   Projects and custom sections (Classic: 16 of 207 layouts) and above the Sidebar's cards (11 of 161).
   **The author's "Sidebar cards did not reproduce" was wrong:** that sweep stopped at 32–33 filler bullets,
   and the Sidebar's page 1 holds 38, so the cards never reached the page foot.
3. **R2-049, `e321801`:** the new award block left a first award's section title alone (36 of 161 layouts).
4. **Tests, `e321801`:** the Compact grid sweep never crossed the page foot, so it passed without the fix. "sidebar:
   Education in two columns" printed in the dark column, never a grid, and now prints the Sidebar's single-column page.
   Every sweep now ends where the title is first pushed to page 2, and fails if it never gets there.
5. **R2-047, `9bb06bf`, a regression from 5bd239c:** a 2-column section with no visible entry printed nothing, not even its title.
6. **R2-048, `9bb06bf`:** the Timeline lays out its own grid (`TimelineEntries`), which 5bd239c missed. Rows still split cell
   by cell there, printing the right entry first (58 layouts).
7. **R2-104, `6368093`:** a first reference whose job title and company wrap outgrew the counted keep (6 of 84
   layouts). The R2-104 test never brought References to the page foot.

## Author's evidence (before the review)

- Fail-first seen: R2-046 (8 of 10 cases), R2-109, R2-111 (classic, modern, minimal, executive; others not
  shown), R2-047/048 (classic/modern Education grid, classic Experience and Education order, sidebar
  Experience order), R2-049 (awards; centred certification), R2-104 (titles and entries, not References; see item 7 above).
- Regression runs before the review, all green but for the author's own fixed issues: 200/0 (header and sidebar
  suites after R2-046); 143/0 + 11/0 + 11/0 (section options, ATS entry date, design defaults, Compact look);
  967/0 (50 timeline/entry/header/word/sidebar files); 432/1 (28 grid/pagination files; the 1 was the new
  test's own regex, fixed); 328/2 (sidebar batch; both in 16-saved-data-item-gaps, fixed in f6cb390).
- No baseline failures found. Nothing has been run on HEAD since the reviewer's commits (by the parent).

## Notes for the coordinator

- `tests/pdf/16-saved-data-item-gaps.test.mjs` changed (f6cb390): its Classic fixture measured two awards
  across page 1's foot and passed only because the second award's title stayed alone there (R2-049's defect).
  `gapsOf` now renders in smaller type and margins so every pair is on one page. Assertions are unchanged, and it
  passes before and after.
- `PdfItemHeader.jsx` now carries R2-111's 4 lines and the reviewer's `headPresence`/`itemHeadPresence`
  (~45 lines). The pdf-text cluster (R3-002) works on the same file, so expect a merge conflict there.
  `PdfTimeline.jsx`/`PdfTimelineSections.jsx` changed too (R2-111, 9bb06bf).
- A short grid row that does not fit moves whole, and can leave up to 8–10 lines of space at a page foot.
- Commit trailers carry `session_013Hg3VSwaVkaQmNCkotTNsb` (the cloud session), not the protocol's id.
- A react-pdf layout patch (`wrap={false}` splitting when taller than a page) was considered, but not done:
  editing `node_modules` was refused.

## Draft `wf-reports/pdf-pagination.json` (update after step 1)

```json
{
  "cluster": "pdf-pagination",
  "branch": "claude/wf-pdf-pagination",
  "base": "504b313",
  "rows": [
    { "id": "R2-046", "outcome": "fixed", "commits": ["143abef"], "tests": ["tests/pdf/84-long-summary.test.mjs"],
      "summary": "A summary longer than a page continues on the next page: the header block breaks in Classic, Modern, Minimal, Executive, Academic, Compact, Timeline and the Sidebar's single column, only its name, photo and contact row staying whole, so no sentence is cut off or printed into the bottom margin. A header that fits prints as before.",
      "remaining": "" },
    { "id": "R2-047", "outcome": "fixed", "commits": ["5bd239c", "e321801", "9bb06bf"], "tests": ["tests/pdf/84-keep-together.test.mjs"],
      "summary": "A section's title moves to the next page with its first entry's header: in one column it keeps that header's height (its lines, one more for a field that wraps, and the two lines it keeps), the Sidebar's cards included; in a 2-column grid each row is led by a zero-height mark keeping eight lines (ten with the title) on its page, so a row that does not fit moves whole, title and all. A grid section with no visible entry still prints its title. References cards already kept theirs (9a41661, pinned by the test).",
      "remaining": "" },
    { "id": "R2-048", "outcome": "fixed", "commits": ["5bd239c", "9bb06bf"], "tests": ["tests/pdf/84-keep-together.test.mjs"],
      "summary": "A 2-column grid row that does not fit moves to the next page whole, in every template and the Timeline's rail grid too, so its left entry never prints after its right one; a taller row splits where every cell's header fits, and a cell taller than a page still continues (FIDA-38).",
      "remaining": "" },
    { "id": "R2-049", "outcome": "fixed", "commits": ["4cec649", "f6cb390", "e321801"], "tests": ["tests/pdf/84-keep-together.test.mjs", "tests/pdf/16-saved-data-item-gaps.test.mjs"],
      "summary": "A certification prints unbreakable, so its date (on a line of its own when centred) stays on its name's page; an award's title, issuer and date are one unbreakable block kept with two lines of its description, and a first award keeps its section's title with it. A left-aligned certification already kept its date (it shares the name's last line).",
      "remaining": "" },
    { "id": "R2-104", "outcome": "fixed", "commits": ["99d3dbb", "6368093"], "tests": ["tests/pdf/84-sidebar-column-breaks.test.mjs"],
      "summary": "The Sidebar's dark-column titles are unbreakable and keep their first entry's head under them, measured as the column sets each field's lines (a reference whose job title and company wrap included); an education's head, a certification and a reference print unbreakable, so no title ends a page alone and no entry splits across pages.",
      "remaining": "An education's description may still continue on the next page, under its head." },
    { "id": "R2-109", "outcome": "fixed", "commits": ["3a9a087", "fa09eb1"], "tests": ["tests/pdf/84-default-columns.test.mjs"],
      "summary": "Languages and References that store no Grids show 2 in Section Options → Grids, which is what they print: resolveSection puts the Grids a type is created with under the template's and the user's. A stored type named like an Object member ('constructor', 'toString') resolves as a custom section. Nothing prints differently.",
      "remaining": "" },
    { "id": "R2-111", "outcome": "fixed", "commits": ["e72166f"], "tests": ["tests/pdf/84-empty-leading-field.test.mjs"],
      "summary": "An entry whose leading field is empty (a job with no company) leads with the next field, bold, on the date's line in every template (Timeline's under its date), and Word prints it as the entry's bold first run.",
      "remaining": "" }
  ],
  "review": {
    "issues": [
      "resolveSection threw for a stored section type named like an Object member ('constructor', 'toString', '__proto__'): 3a9a087's lookup found the prototype member, failing the PDF, the Word export and the section's options.",
      "A section title's three-line keep was shorter than the first entry's header plus the two lines it keeps: the title stayed alone in one-column sections (Classic 16 of 207 layouts) and above the Sidebar's cards (11 of 161); the author's 'did not reproduce' came from a sweep that never reached the Sidebar's page foot.",
      "R2-049's award block left a first award's section title alone (36 of 161 layouts).",
      "84-keep-together's Compact grid sweep never crossed the page foot, and its 'sidebar: Education in two columns' printed in the dark column: both passed without the fix.",
      "5bd239c dropped the title of a 2-column section with no visible entry.",
      "The Timeline's own grid (TimelineEntries) still split rows cell by cell, printing the right entry first (58 layouts).",
      "A first reference whose fields wrap in the dark column outgrew the counted keep (6 of 84 layouts); the R2-104 test never brought References to the page foot."
    ],
    "fixedByReviewer": [
      "fa09eb1 resolveSection: an Object-member type resolves as custom (R2-109)",
      "e321801 titles keep their first entry's header in every section; sweeps must cross the page foot (R2-047, R2-049)",
      "9bb06bf empty grid keeps its title; Timeline grid keeps its reading order (R2-047, R2-048)",
      "6368093 dark-column keep measures wrapped fields; References swept across the page foot (R2-104)"
    ]
  },
  "baselineFailures": [],
  "notes": "tests/pdf/16-saved-data-item-gaps.test.mjs changed (f6cb390): its Classic fixture measured two awards across page 1's foot and passed only because the second award's title stayed alone there (R2-049's defect); gapsOf now renders in smaller type and margins so every pair is on one page, assertions unchanged, passes before and after. PdfItemHeader.jsx carries R2-111's change and the reviewer's headPresence/itemHeadPresence (~45 lines): the pdf-text cluster (R3-002) edits the same file. Grid rows keep up to 8–10 lines together: a short row that does not fit moves whole and can leave that much space at a page foot. Commit trailers carry session_013Hg3VSwaVkaQmNCkotTNsb, not the protocol's session id. A react-pdf layout patch was considered and not done."
}
```
