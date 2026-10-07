# B5a report: Documents page, card menu, Cover Letters group and notices

**STATUS: code pushed on `revamp-ui`; the full gate is GREEN (run 37636926781 on `01653718`, 19 of 19 jobs, read 2026-10-07); the fail-first proof is run 37646546844 (see below); bug-hunt rounds NOT run (see "Not proven").**

Base `0140d0f6`'s parent chain: B4 done. UI only; every live function stays (PARITY-RULE).

## What changed (per commit)
- `2ac49220` feat(documents): `Dashboard.jsx` rebuilt in the canvas style (Documents heading, header actions Import / New Cover / New Resume, four-up grid of cards, New Resume tile first, Cover Letters group, Career History as a section below, footer Terms/Privacy); `ResumeCard.jsx` (stage with the page, two-line name kept, "template · age" meta kept, ⋯ More button); `CardMenu.jsx` NEW (kit Menu: Edit, Rename, Copy, Keep as my original / Stop keeping, Delete with the last original's hint) loaded lazily; `lazyPiece.jsx` NEW (the lazy machinery moved out of Dashboard: letter picker, Career History, card menu; Dashboard still exports `_lazyForTest`); `constants/cardHints.js` NEW; `RecoveryNotice.jsx` restyled (same texts and actions). Plain Edit / Copy / Keep / Delete buttons are the card's fallback when the menu's code cannot load.
- Tests with it: `tests/pdf/182-ui-b5a-{documents-cards,letters-group,notices,lazy-fallbacks,startup-ledger}.test.mjs` (+ `182-ui-b5a-mount.mjs`), about 30 older dashboard / card / Cypress / Playwright specs updated to the new markup (`card-menu.mjs`, `cypress/support/cardMenu.js`).
- `74296171`, `80a7aa11`, `01653718` test fixes: the new tests loaded the menu with plain Node (no `@/` alias), a count assumed one fetch where warm + lazy make two, a text match ran into the next word; the helper's `closeMenu` typed Escape into the menu, which clicks its middle (pressed "Stop keeping"); the double-press helper read an item after its menu had closed.

## Proofs read in the logs
- Full gate 37636926781 on `01653718`: all 19 jobs green.
- Start-up path (run 37633034798, tests 71): 1083.3 kB of 1,100 kB, 16.7 kB to spare (was 15.8 before B5a: the page rewrite in place and the lazy menu cost less than the code they replaced). Target of 5 kB spare met.
- B5a tests alone: run 37634380884 green.
- Fail-first (src of `2ac49220` undone, the five 182 files must fail, then pass): run 37646546844, counts to be written here when read.

## What still differs from the canvas
- ATS score chips, the Recently edited sort, the Applications strip, the three-option first-run page, the "stays in this browser" sentence, "Its cover letter goes too", the cover letter chip and the storage-full "Open Documents" advice are drawn but not in the live app: PARKED, not built (PARITY-RULE).
- The canvas has no Career History; it stays as a section under Cover Letters (live function). The canvas subtitle counts cover letters (parked); the page says "N resumes".
- Cards keep their live meta line (template · age) and the inline name and rename pencil; the canvas draws "Edited 2 hours ago".
- The New Cover Letter picker (`NewLetterModal.jsx`) and the Career History panel keep their older colours (purple, indigo): not restyled in this batch.

## Known limits (not fixed)
- Career History has no height cap, so a long history does not scroll inside its panel (R4-DVIS-29's comment in Dashboard.jsx is stale).
- The menu opens in the fake DOM only through the paths the tests drive; a real-browser geometry check of the card menu on a phone is in `tests/playwright/phone-reach.spec.mjs` (updated, run in the gate).
- `NewResume.jsx` still used a wider column than Documents before B5b; B5b aligns it.

## Not proven
- The bug-hunt rounds of AGENT-PROMPT section 7 (parity / render cost / layout / test strength lenses, repeated until dry) were not run for B5a: only the gate, the fail-first run and the start-up ledger. The owner asked for speed and low agent cost; a hunt should be run before B17.
- No screenshots yet of the real page next to the canvas boards.
