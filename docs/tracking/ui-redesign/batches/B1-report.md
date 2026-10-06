# B1 report: Foundation (tokens, test hooks, start-up headroom, lead tools)

Branch `claude/wonderful-maxwell-vu8xqw`. Code head `6633014`; docs-only commits on top. Parity rows owned: shell-docs SHEL-107 (no theme: SAME), SHEL-134 (tab title / start page: SAME), SHEL-135 (build-time switches: SAME); none of them changed by this batch.

## What changed (src: 8 commits, 6 files, +190 / -28)
| commit | change | proof test (fails without it) |
|---|---|---|
| 2deecf7 | additive `cv-*` design tokens, radii, shadow, font stack and component classes in `src/index.css` | `tests/unit/ui-b1-design-tokens.unit.mjs` |
| 13696fe | legacy kit colour tokens re-pointed to the canvas values (CSS values only, class names unchanged) | `tests/unit/ui-b1-token-repoint.unit.mjs` |
| ce9378a | `data-testid` hooks: section cards and title inputs, entry headers and titles, resume card and rename, editor tab buttons | `tests/pdf/178-ui-b1-test-hooks.test.mjs` |
| fcba71e | New Cover picker and Career History load on demand (start-up headroom), each in its own boundary with an in-entry fallback | `178-ui-b1-startup-headroom`, `178-ui-b1-lazy-fallbacks` |
| 190d2ff | brand pressed token gets its own darker step (hunt H1-9) | `tests/unit/ui-b1-brand-pressed.unit.mjs` |
| 55d3ea9 | each lazy piece is made once at module level, so a remount shows a loaded Career History in its first commit (H2-12/18) | `179-ui-b1-lazy-remount` |
| bfcd7a6 | a second failed Try again on Career History offers Reload page (H2-13/14) | `179-ui-b1-lazy-reload-notice` |
| 538469c | an abandoned New Cover click whose picker fails long after makes no letter (H2-15) | `179-ui-b1-letter-stale-fallback` |

Test side: `tests/pdf/resume-tab.mjs`, test 165 and the Cypress / Playwright helpers moved onto the testids (one open-helper per runner for B3); `tests/playwright/phone-reach.spec.mjs` (touch mode, no hover); the 96-dashboard / 99-cover-letters / 59-career-history family waits for the lazy picker by polling (`dialogUp`). Tools: `tools/brief.mjs` (briefs B2..B17 in `batches/`), `related-tests.mjs`, `batch-hunt.workflow.js`, `b1-build.workflow.js`, `b1-fix.workflow.js`, `label-inventory.mjs`. Nothing visibly changes yet beyond the colours of the legacy kit (the re-point).

## Fail-first proofs (read from the job logs)
| commit | fails without the fix | passes with it | run |
|---|---|---|---|
| 2deecf7 | # fail 3 | yes | 37468551893 |
| 13696fe | # fail 1 | yes | 37468551893 |
| ce9378a | # fail 5 | yes | 37468551893 |
| fcba71e | # fail 8 | yes (after test fix ab62745) | 37470711621 |
| 190d2ff | # fail 2 | yes | 37472785130 |
| 55d3ea9 | # fail 1 (parent's files) | yes | 37472785130 |
| bfcd7a6 | # fail 2 | yes | 37472785130 |
| 538469c | # fail 1 | yes | 37472785130 |

55d3ea9 and fcba71e both touched `Dashboard.jsx`, so 55d3ea9 reverses to its parent's version of the whole file (a valid fail, a weaker proof than a pure diff reversal).

## Start-up ledger (tests/pdf/71-startup-chunks, cap 1,100 kB of minified JS)
| point | run | start-up path | spare |
|---|---|---|---|
| baseline (head 65521a0) | 37466562090 | 1099.8 kB | 0.2 kB |
| after the lazy pieces (ab62745) | 37470711621 | 1082.0 kB | 18.0 kB |
| after the hunt fixes (6633014) | 37472785130 | 1082.4 kB | 17.6 kB |

Gain +17.4 kB net (the fixes cost 0.4 kB for module-level caches, the Reload page notice and the stale guard). The reserve offset (lazy jsonResumeImport) was NOT needed. gzip and largest-chunk margins (tests/perf budgets) were not read in this batch.

## Other CI reads
- Related tests (head 6633014, run 37472785130): `# tests 1748 / # pass 1748 / # fail 0`. On c9dbac9 (run 37468551893) the same family had 4 test-side reds (a wrong expectation in lazy-fallbacks; picker timing in 96-dashboard and 99-cover-letters); fixed in ab62745 by polling, never by weakening.
- Playwright (run 37468551893): `phone-reach` 11 passed, including the negative check that a hover-only control goes red. Cypress 4 shards all passed (30, 20, 13, 23 tests; 01-dashboard New Cover picker in a real browser). Lint and build green.
- phone-reach proves tap-only reachability of the listed testids in a touch-mode browser; Cypress `26-mobile-layout` proves the phone layout. Later batches append testids to phone-reach.

## Bug hunt (wf_497f144d-673: 2 rounds, 48 agents)
19 reported, 7 confirmed by both skeptics, all fixed (H1-6 test expectation, H1-9, H2-12/18, H2-13/14, H2-15). Hunt round after the fixes: the fix workflow's reviewers read each fix; no further finder round was run on the four fix commits beyond the gate (the hunt loop ended when round 2 confirmed nothing outside those seven).

## Known limits (documented, not fixed; skeptics split)
- After one failed picker import New Cover keeps the letter fallback for that visit (a retry would loop on a still-failing import).
- Career History's chunk is requested at first render (blank until it arrives).
- A render crash inside a lazy piece shows the connection notice.
- `tests/helpers.js` still selects cards by Tailwind classes: moved to testids in B5a (card restyle).

## Owner calls taken (defaults)
Start-up fallback order (reserve offset, lazy Dashboard parts, cap last): not needed. `ci.yml` unchanged (failfirst names read from logs). No master push or deploy until B17's gate is green and the owner says so.

## Not proven / parked
- No visual screen was rebuilt: nothing to screenshot against the canvas yet (the legacy kit now uses the canvas colours).
- Parked items untouched (PLAN-SUMMARY "Drawn but not in the live app").
- Accessibility: deferred.

## Full gate
Run 37473796309 on `a98053e` (code identical to 6633014): see the line appended below when read.
