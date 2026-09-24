# word cluster: cold-start handoff (delete this file in the commit that adds wf-reports/word.json)

Branch `claude/wf-word`, base `504b313`. Protocol: `git show origin/claude/beautiful-heisenberg-x3bsvo:docs/tracking/CLUSTER-PROTOCOL.md`.
Trailers used: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
`Claude-Session: https://claude.ai/code/session_01Kms1vF1NWaaH7yWz6e2UWr`.

## State at handoff
- All rows handled and pushed. An independent reviewer subagent was running and had pushed
  f545a0a, 3d16977 and c707bd8 (photo base64 and plain-URL/WebP handling, Grids > 4). Its final report was
  not collected yet.
- **Left to do:** (1) read `git log -p b17a64b..HEAD` and check the reviewer's commits; run the tests below.
  (2) Write `wf-reports/word.json` (format in the protocol), delete this file in the same commit,
  `chore(wf): word cluster report`, push. Put the reviewer's commits in `review.fixedByReviewer`.

## Set-up for a cold start
`corepack enable && yarn install --immutable`; `apt-get update && apt-get install -y poppler-utils mupdf-tools`
(and `libreoffice-writer` to open a .docx: `HOME=/tmp soffice --headless --convert-to pdf x.docx`).

## Tests to run
`node --test --test-concurrency=2 tests/pdf/87-*.test.mjs tests/pdf/46-header-photo-text-gap.test.mjs tests/pdf/35-word-skill-category-case.test.mjs tests/pdf/04-word-export.test.mjs tests/pdf/10-section-*.test.mjs tests/pdf/26-dates.test.mjs tests/pdf/29-date-format.test.mjs tests/pdf/69-word-*.test.mjs`
Before the reviewer, every test file that uses renderDocx/wordExport passed (1217 of 1217 + 2 accepted TODOs); no baseline failures seen.

## Draft row outcomes
| Row | Outcome | Commits | Tests | Summary |
|---|---|---|---|---|
| R2-061 | fixed | 0b708c8, 0cd1767 (+21d64d1 earlier) | 87-word-title-layout, 87-word-grids, 69-word-spacing | Margins, Line Height, section/item gaps and Spacing Override were fixed by 21d64d1; Title (0b708c8) and Grids (0cd1767) now reach Word too. |
| R2-065 | already-fixed | d92c1ec | 69-word-text-colour | Entry text takes the Text colour's shades, skill categories the Text colour (the accent only on Modern and in Tags/Bars), as the PDF. |
| R2-066 | duplicate | 21d64d1 | 69-word-spacing | Duplicate of R2-062 (Design → Spacing in Word), fixed by 21d64d1. |
| R2-070 | fixed | 0b708c8, 0cd1767, 2769446, c707bd8 (+21d64d1) | 87-word-title-layout, 87-word-grids, 87-word-skills-stacked | Title Stacked/Inline/Side by side as ItemHeader; Grids as a borderless table (cells at the PDF's 48/31/23 %, Languages/References 2 when unset, the Sidebar's side column 1, dates at the cell's right edge); Stacked skills: the category on its own line over a thin rule, the side column one skill per line. |
| R2-114 | already-fixed | 21d64d1 | 69-word-spacing ("the entry dates' right tab…") | The right tab = paper width − 2 × Left/Right margin (wordContentTwips), on A4 and US Letter; in a grid the cell's width. |
| R2-125 | duplicate | 21d64d1 | 69-word-spacing | Duplicate of R2-114. |
| R2-132 | duplicate | 21d64d1 | 69-word-spacing | Duplicate of R2-114. |
| R2-118 | fixed | 6d802b9 | 87-word-entry-sizes | Descriptions follow Entry Header, second field/location/dates Base, as the PDF. |
| R2-124 | fixed | 6d802b9 (+4203257) | 87-word-entry-sizes, 38-word-contact-size | Entry text as R2-118; the contact line follows Base since 4203257 (R2-067). |
| R2-126 | fixed | b17a64b, f545a0a, 3d16977 | 87-word-photo, 46-header-photo-text-gap | Word prints the photo: the PDF's box, a Circle as an ellipse, Rounded/Square with its corners, "cover" crop (srcRect), Thin/Accent ring as outline; beside the name in a borderless table row (Photo ↔ Text, Text Position), above it when centred (Academic) and on the Sidebar; none when hidden or undrawable. Remaining: an SVG photo (Word needs a PNG copy); check what 3d16977 changed. |
| R2-128 | fixed | 0ad38dc | 87-word-name-weight | Minimal's light name prints regular, as its PDF and Word letter. |

Changed assertions in existing tests (all justified by R2-070 or R2-126): 04-word-export, 10-section-options,
10-section-alignment-word, 26-dates, 29-date-format (Stacked title), 35-word-skill-category-case (Stacked
skills), 46-header-photo-text-gap (Word prints the photo), 69-word-spacing (6d802b9, the Sidebar job's own size).
History: 7a751d5 (the stopped agent's wip) was reverted by 3d51158 and re-landed as 0b708c8 + 0cd1767.
