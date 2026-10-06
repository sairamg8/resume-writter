# B1 report: Foundation (tokens, test hooks, start-up headroom, lead tools)

Branch `claude/wonderful-maxwell-vu8xqw`. Code head `8eaf3cd` (src identical to `170cb62`); docs-only commits and a reverted mutation pair on top. Parity rows owned: shell-docs SHEL-107 (no theme: SAME), SHEL-134 (tab title / start page: SAME), SHEL-135 (build-time switches: SAME); none of them changed by this batch.

## What changed (src: 9 commits, 6 files)
| commit | change | proof test (fails without it) |
|---|---|---|
| 2deecf7 | additive `cv-*` design tokens, radii, shadow, font stack and component classes in `src/index.css` | `tests/unit/ui-b1-design-tokens.unit.mjs` |
| 13696fe | legacy kit colour tokens re-pointed to the canvas values (CSS values only, class names unchanged) | `tests/unit/ui-b1-token-repoint.unit.mjs` |
| ce9378a | `data-testid` hooks: section cards and title inputs, entry headers and titles, resume card and rename, editor tab buttons | `tests/pdf/178-ui-b1-test-hooks.test.mjs` |
| fcba71e | New Cover picker and Career History load on demand (start-up headroom), each in its own boundary with an in-entry fallback | `178-ui-b1-startup-headroom`, `178-ui-b1-lazy-fallbacks` |
| 190d2ff | brand pressed token gets its own darker step (hunt H1-9) | `tests/unit/ui-b1-brand-pressed.unit.mjs` |
| 55d3ea9 | each lazy piece is made once at module level, so a remount shows a loaded Career History in its first commit (H2-12/18) | `179-ui-b1-lazy-remount` |
| bfcd7a6 | a second failed Try again on Career History offers Reload page (H2-13/14) | `179-ui-b1-lazy-reload-notice` |
| 538469c | an abandoned New Cover click whose picker fails long after makes no letter (H2-15); judged by a 10 s window, replaced by dc8856e | `179-ui-b1-letter-stale-fallback` |
| dc8856e | round-3 finding (B1-H3-1-2, H3-2-8): the New Cover request is judged by what the person did (a pointerdown, key, hashchange or popstate after the click closes it with no letter), not by a 10 s window: a patient wait on a stalled chunk still makes the letter | `179-ui-b1-letter-intent`, `179-ui-b1-letter-stale-fallback` |

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
| dc8856e | # fail 6 | yes | 37478719023 |

55d3ea9 and fcba71e both touched `Dashboard.jsx`, so 55d3ea9 reverses to its parent's version of the whole file (a valid fail, a weaker proof than a pure diff reversal).

### Tests-only commits: proven by a throwaway mutation of Dashboard.jsx (failfirst needs a src diff; these have none)
The mutation commit was pushed, dispatched as `tests`, and reverted at once (the pairs `ff4bdf2`/`ac64c50`, `fa68e60`/`e55f566`, `b746f8a`/`68d791c`; src at the head equals the pre-mutation src, checked with git diff). Read from the logs:
| mutation | tests that went red (and only those) | run |
|---|---|---|
| M1: no eviction of a rejected lazy view | 178-ui-b1-lazy-fallbacks: 'the same loader fails once: Try again then shows the panel', '... a later visit (remount) shows the panel' | 37478776511 |
| M2: no idle/timer cleanup on unmount | 178-ui-b1-startup-headroom: 'leaving the page before idle cancels the pending callback or timer' | 37478776511 |
| M3: the picker opens for any résumé count | 96-dashboard: 'New Cover with no résumé', 'New Cover with one résumé' (the 'no picker' lines) | 37478776511 |
| M4: no popstate listener | 179-ui-b1-letter-intent (b3) only; (b), (b2), (c) stay green | 37478776511 |
| M5: a wall-clock guard again | 179-ui-b1-letter-intent (a) 'a wait of 30 s' | 37480645990 |
| M6: no hashchange listener | 179-ui-b1-letter-intent (b2) and the first 179-ui-b1-letter-stale-fallback test; (b), (b3), (c), (d), (d2), the second stale test stay green | 37480645990 |
Correct code (runs 37478719023, 37480623377): 63/63 and 42/42 pass. The first proof run of dc8856e (37477723059) read RED on its own new tests with the fix applied: two unsound tests of the carry-on session (a fixed 300 ms settle where React throttles the retry that shows a failed lazy piece; a cancelled idle callback run by hand). Both fixed (170cb62, 8eaf3cd) and re-proved; they are recorded here because a failfirst that reads only 'fail without' would have passed them.

## Start-up ledger (tests/pdf/71-startup-chunks, cap 1,100 kB of minified JS)
| point | run | start-up path | spare |
|---|---|---|---|
| baseline (head 65521a0) | 37466562090 | 1099.8 kB | 0.2 kB |
| after the lazy pieces (ab62745) | 37470711621 | 1082.0 kB | 18.0 kB |
| after the hunt fixes (6633014) | 37472785130 | 1082.4 kB | 17.6 kB |
| after the round-3 fix (170cb62 / 8eaf3cd) | 37478719023 | 1082.7 kB | 17.3 kB |

Gain +17.1 kB net (the fixes cost 0.7 kB for module-level caches, the Reload page notice and the intent listener). The reserve offset (lazy jsonResumeImport) was NOT needed. gzip and largest-chunk margins (tests/perf budgets) were not read in this batch.

## Other CI reads
- Related tests (head 6633014, run 37472785130): `# tests 1748 / # pass 1748 / # fail 0`. On c9dbac9 (run 37468551893) the same family had 4 test-side reds (a wrong expectation in lazy-fallbacks; picker timing in 96-dashboard and 99-cover-letters); fixed in ab62745 by polling, never by weakening.
- Playwright (run 37468551893): `phone-reach` 11 passed, including the negative check that a hover-only control goes red. Cypress 4 shards all passed (30, 20, 13, 23 tests; 01-dashboard New Cover picker in a real browser). Lint and build green.
- phone-reach proves tap-only reachability of the listed testids in a touch-mode browser; Cypress `26-mobile-layout` proves the phone layout. Later batches append testids to phone-reach.

## Bug hunt (5 rounds in all)
- Rounds 1-2 (`wf_497f144d-673`, 48 agents): 19 reported, 7 confirmed (H1-6 test expectation, H1-9 pressed colour, H2-12/18 remount, H2-13/14 Reload page, H2-15 stale picker), all fixed.
- Round 3 (`wf_61308c2a-91c`, 32 agents, three lenses): 13 reported, 5 confirmed: the 10 s wall-clock guard was wrong both ways (a patient wait dropped the letter, a quick failure after the person moved on made a stray one), and three tests that could not fail (eviction, idle cleanup, 96-dashboard 'no picker'). Fixed: dc8856e plus tests-only commits, proven above.
- Round 4 (`wf_72cefdc5-bcc`, 30 agents): 12 reported, 5 confirmed, all test strength of the round-3 tests ((a) simulated no wait, (d) never sent the gesture's own pointerdown/keydown, the stale-fallback check used a fixed 300 ms). Fixed in 8eaf3cd, proven by M5/M6 above. One blocker-labelled finding (the unmount test failing on correct code) had already been fixed in 170cb62 when the finder read it.
- Round 5 (`wf_0d4af8d8-3ad`, 12 agents, two lenses on the final head): 5 reported, 0 confirmed (every finding was refuted by at least one skeptic): the hunt is DRY. The five minor test-strength remarks stay as known limits: test (a) catches a Date.now / performance.now guard but not a setTimeout-based one; the listener cleanup is asserted for pointerdown only (the fake registry ignores the capture flag); (d)/(d2) prove the reset at New Cover, not the listener ordering; the 'no picker' poll in 178-lazy-fallbacks test 1 cannot fail (its loader is offline: the check that can is in 96-dashboard).

## Known limits (documented, not fixed; skeptics split)
- After one failed picker import New Cover keeps the letter fallback for that visit (a retry would loop on a still-failing import).
- Career History's chunk is requested at first render (blank until it arrives).
- A render crash inside a lazy piece shows the connection notice.
- `tests/helpers.js` still selects cards by Tailwind classes: moved to testids in B5a (card restyle).
- Any keydown (a modifier included, such as Ctrl+Tab) or tap while the picker is slow drops the pending New Cover request with nothing shown; the next New Cover makes the letter at once (the request is judged by what the person did).
- A picker that arrives long after the click, when the person has moved on, still opens over what they do (split verdict, H3-1-3).
- Hard-coded old blue `#0c66e4` and track grey `#f1f2f4` remain in CreateProjectDialog, CreateIssueDialog, IssueChecklist, Charts and three more files, and the Jobs list progress track equals the hovered row colour: for the batches that restyle those screens (B13-B16).
- A Reload page button is offered after a second failed Career History retry even while a save is failing (split verdict).
- tests/pdf/178's web-font test reads only index.css; the new Cypress reach helpers have no callers yet (B3 swaps their bodies).

## Owner calls taken (defaults)
Start-up fallback order (reserve offset, lazy Dashboard parts, cap last): not needed. `ci.yml` unchanged (failfirst names read from logs). No master push or deploy until B17's gate is green and the owner says so.

## Not proven / parked
- No visual screen was rebuilt: nothing to screenshot against the canvas yet (the legacy kit now uses the canvas colours).
- Parked items untouched (PLAN-SUMMARY "Drawn but not in the live app").
- Accessibility: deferred.

## Full gate (GREEN)
Run 37481412359 on `68d791c` (code identical to `8eaf3cd`; the run before it, 37479206849, was cancelled by the lead for this one). Read from the logs: 15 jobs all green (lint, build, suite 1-6, Playwright 1-3, Cypress 1-4). Suite shards: 1593, 1788, 2399, 2242, 1854, 1975 tests (11,851 in all: 11,846 pass, 5 skipped by design, 0 fail); Playwright 46 + 55 + 22 passed (+ 1 skipped); Cypress 70 + 90 + 71 + 50 = 281 passed; 71-startup-chunks: `start-up path 1082.7 kB of the 1,100 kB cap: 17.3 kB to spare`. An earlier full gate (37473796309 on `a98053e`, before the round-3 fixes) was also green.
Owner calls: all taken at their defaults (see above); none needed an answer. Nothing visible changed except the legacy kit colours (the canvas palette); the owner already has the B1 before/after screenshots from the first session. B2 follows.
