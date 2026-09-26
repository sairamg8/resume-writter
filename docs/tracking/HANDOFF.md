# Session Handoff — Resume Here

## ⏩ COLD START HERE — 2026-09-26 13:50 UTC (coordinator session_013BXDvmy7T9XQ7CsZWdofVX; the owner's usage is spent)

**State:** every Round 4 bug is fixed on the work branch `claude/awesome-cerf-t3sh88`, and **gate 36235083234 on
`94b4d9b` is GREEN** (full suite, build, lint, Playwright, Cypress). `master` is still `843dded` — nothing of Round 4 is
live. The coordinator's push to master was refused by the session's auto-mode check ("Production Deploy"), so:

1. **Owner: deploy** — `git push origin 94b4d9b:refs/heads/master` (a fast-forward; the commits after it are docs only),
   or merge the work branch on GitHub at that commit. Then `python3 docs/tracking/tools/r4_tracker.py --deployed 94b4d9b`,
   commit, push. No firestore.rules change in Round 4: nothing to publish.
2. **Wave 2 (design) is paused, nothing fixed:** both sessions resumed after the 13:20 UTC reset and saved their
   findings, not yet confirmed, before stopping again. dsg-flow (session_01AmmKmEdcQjMsXCr6cxbAXZ) has 48 rows in
   `wf-reports/r4-dsg-flow-findings.md`. dsg-layout (session_01K2dRPYe8fZU5xwrczhag7U) has 36 rows from 3 of 4 finders in
   `wf-reports/r4-dsg-layout.findings.md`. Both are idle, waiting for a message to carry on. The whole done/pending list
   is in [STATUS.md](STATUS.md).
3. **Wave 3 (final sweep):** the small leftovers the clusters saw and left, listed in R4-CLUSTERS.md "Wave 3".
4. Tracker rows R2-137 and R2-133 (bug-status-r2) still describe the old Word band: set them from
   `fixes3/reports/r4-exp.json` (RES-R2-137, commits `39b3bf7` `a96cebb`).

**Round 4 by cluster** (row lists in R4-CLUSTERS.md, outcomes in [fixes3/R4-TRACKER.md](fixes3/R4-TRACKER.md), reports in
`fixes3/reports/`): the six fixes3 patches (6/6, fail-first 36230047589) · imp 14/14 · brd 13/13 · cl 10/11 (CL-05 not a
bug) · exp 7/8 + RES-R2-137 (EXP-05 already fixed by it) · ed 7/7 (incl. R4-ED-01) · dsn-pdf 10/11 + PDF-02 partly (its
other half is LO-17, fixed) · sync-job 10/10 · app 9/9 (found by the session) · lo-imp 9/9 · lo-cl 7/7 · lo-misc 9/9 —
108 rows: 106 fixed, 1 already fixed, 1 not a bug; every fix fail-first on CI and reviewed by a second agent.
Merges: `bb200f4` (seven clusters; Dashboard.jsx conflict kept R4-IMP-12 and R4-APP-09), `d1af2c5` (the first gate's
three test-only failures), `17c6af2` (brd, lo-cl), `f049af8` (lo-imp, lo-misc). Cluster branches `claude/wf-r4-*` are
merged; the owner may delete them on GitHub (the git proxy refuses deletes).

## ⏩ 2026-09-26 10:15 UTC (cloud coordinator session_013BXDvmy7T9XQ7CsZWdofVX)

**Gate 36233934185 on `5f94749` is GREEN** (eight wave-1 clusters + lo-cl + the six fixes3 fixes + the gate's test fixes
`d1af2c5`). The coordinator's `git push origin 5f94749:refs/heads/master` was refused by the session's auto-mode
permission check ("Production Deploy"): **the owner deploys** — push `5f94749` (or the newer head once its gate is green)
to master, or allow the push in the session. Then `python3 docs/tracking/tools/r4_tracker.py --deployed <sha>`.
All eleven Round 4 clusters are merged on the work branch (lo-imp `4a09893`, lo-misc `f049af8`); 108 rows; a full gate
on the new head was dispatched at 10:15 UTC. No firestore.rules change in Round 4.
Wave 2 (design) sessions from `94b4d9b` (10:13 UTC): dsg-layout session_01K2dRPYe8fZU5xwrczhag7U · dsg-flow
session_01AmmKmEdcQjMsXCr6cxbAXZ (branches `claude/wf-r4-dsg-*`, reports `wf-reports/r4-dsg-*.json`).


**Work branch now `claude/awesome-cerf-t3sh88`** (master `843dded` + the six reviewed fixes of `fixes3/`: R2-148-c
`50b9566`, R2-148-b `9af536c`, RES-R2-140-a `746afa7`, RES-R2-140-c `00b6d78`, R2-147-pn `b58b87f`, PERF-1 `c036c8d`;
oxlint clean). Their fail-first and tests runs were dispatched on the branch (read the two newest `ci.yml`
workflow_dispatch runs on it). The owner is resetting the laptop: nothing depends on it any more; its store's
checklist and pending-bugs.md were not copied up, so work goes on from `fixes3/` alone.
**Round 4 clusters** — the brief and the row lists: [fixes3/R4-CLUSTERS.md](fixes3/R4-CLUSTERS.md). Wave 1 (bugs): eight
cloud sessions on `claude/wf-r4-<cluster>` (imp, brd, cl, exp, ed, dsn-pdf, sync-job, app); each is done when
`wf-reports/r4-<cluster>.json` is on its branch. Then: merge each into the work branch → one full gate → master →
tracker rows; wave 2 (design: dsg-layout, dsg-flow) from the merged branch.
Sessions (08:34 UTC): imp session_016ehqgYvX9wwgL1x6gEQyZz · brd session_019hpMafzJsJDtWkUkC8kn1A · cl
session_01LpUCmQtmevxSyTxCJCWFzT · exp session_01T22uErGMhDgQM2AoHvteUv · ed session_01RmULbsAQNiRSHXyGfvj1ut · dsn-pdf
session_015jr7EiFHdBDX2DFKBB3yU7 · sync-job session_018ykA8zSVUR3WwqSd69zRP6 · app session_014snET2MtPBA5AvN32tmnF7.
**09:20 UTC:** seven clusters reported and merged into the work branch (`bb200f4`; Dashboard.jsx conflict kept both
R4-IMP-12 and R4-APP-09); full gate dispatched on `bb200f4`; brd still working (nudged by trigger at 09:24). Reports kept
in `fixes3/reports/`, tracker `fixes3/R4-TRACKER.md` (`python3 docs/tracking/tools/r4_tracker.py [--deployed <sha>]`).
Wave 1b leftovers (R4-LO-01…25, clusters lo-imp, lo-cl, lo-misc) in R4-CLUSTERS.md.
Wave 1b sessions (09:20 UTC, from `e6edfc4`): lo-imp session_01SgWdHjxzSS97CRbYHJW6Wj · lo-cl session_01CefnMCJBUjNUyADrJ4H76X ·
lo-misc session_01VnvtdsZ8V9QekYoa8wYrEF. Wave 2 (design) starts once wave 1 + 1b are merged and gated.
**09:55 UTC:** gate 36232347364 on `bb200f4` red on 3 test-only causes, fixed in `d1af2c5` (contact guard comments, job-form
stages below the fold, Thickness box counted); brd + lo-cl merged (`17c6af2`); full gate dispatched on `5f94749`. Still
working: lo-imp, lo-misc. Small pre-existing leftovers named in the brd/lo-cl reports' notes go to the final sweep.
Check: `for c in imp brd cl exp ed dsn-pdf sync-job app; do git fetch -q origin claude/wf-r4-$c && git cat-file -e
FETCH_HEAD:wf-reports/r4-$c.json && echo "$c REPORTED"; done`.

## ⏩ COLD START HERE — 2026-09-26 ~14:10 IST (cloud session; only `master` exists)

**Live: `master` = this commit** = wave 3 (B-20c, J-12; full gate 36223045204 ✅ on `1daf0f0`) + docs. Every other branch was
deleted on the owner's order; the unmerged ones are kept as tags `archive/<branch>` (wf-locale = English-only parked,
wf-templates = a11y parked, sweet-turing, wf-pdf-pagination, wf-round2-resume).
**Owner's order:** every bug first, then design bugs; zero pending (Claude makes the product calls); every fix reviewed by a
second agent; no accessibility; English only; tests only on CI; master only on a green full gate.
**Next, in order:** (1) land the six reviewed fixes in `docs/tracking/fixes3/` (`bash docs/tracking/fixes3/land.sh <ID>`):
R2-148-c, R2-148-b, RES-R2-140-a, RES-R2-140-c, R2-147-pn, PERF-1-woff → fail-first on CI (each manifest's `failfirst_tests`)
→ (2) review, then land RES-R2-137 and R4-ED-01 (`.fix.json` only, unreviewed) → (3) fix the 73 findings in
`fixes3/findings-R4.json` (9 areas; each: fix + node test + independent review) → (4) sweep the areas never run: APP
(dashboard, routing, shell, kit) and design (phone layout, visual consistency, UX flows, printed output) → one full gate →
master → tracker rows. The workflow that made them: `fixes3/workflow.js`.

## ⏩ COLD START HERE — 2026-09-26 ~13:00 IST (session 26b8b31a ended; owner starts a new session)

**▶ FIRST, a new session does exactly this:** read CI run **36223045204** (full gate on `1daf0f0` = wave 3):
`gh run view 36223045204 -R sairamg8/resume-writter --json conclusion,jobs`. Green → `git push origin 1daf0f0:refs/heads/master`
(deploys B-20c `5b5c048` + `edbca14` and J-12 `1daf0f0`; fail-first 36223043609 ✅) → in `docs/tracking/boards-jobs-bugs/`
mark J-12 ✅ (deployed in 1daf0f0) → bug-status.md header "deployed = 1daf0f0" → this block → commit, push. Red → read
`gh run view 36223045204 --log-failed`, fix on the work branch, one gate, deploy. Then: R2-148-c (below), the checklist.
Laptop rules: no local tests/builds (CI only), no worktrees, stage explicit paths, ≤5 agents (owner may say none).

**Owner's orders today:** merge everything to master + deploy; fix the pending bugs; **English only** (locale parked);
**no new agents** from here (owner, 11:10). Tests only on CI; master only on a green full gate of that exact commit.
Cloudflare branch builds are OFF (only a master push deploys). Accessibility last.

**Live: `master` = `cb58695`** (waves 1–2 of the bug fixes, combined gate 36221896125, deployed 2026-09-26; before it `e6b1a4a`) — batches 3–5: perf2 + section-look (`91c91c9`), owner-ui R3-009…012 (`f20a62d`), the ten
designed layouts R2-138 + R3-008 (`e6b1a4a`, gate 36218934694). Parked, not merged: `claude/wf-locale` `ac50cf4` (English
only), `claude/wf-templates` (a11y).

**✅ DEPLOYED in `cb58695` — Wave 1 (16 bug fixes, R2-148-c reverted) + wave 2** (36221038666 on `45b6b60` failed only suite 3, R2-148-c) (its previous gate 36220057010
on ebcaab4 failed only the J-38 test, fixed since). Every fix's fail-first is green except the reverted DatePill change.
- B-20 `617f24f` · J-30 `5f86d40` · B-29 `4345a13` · RES-R2-140-b `5fc8925` · R2-148-a `9af32ac` · J-36 `62f024a` ·
  B-05 `ff7e89a` + `9e20f77` · R2-041 `ba0a938` · RES-R2-126 `29fb954` · B-17 `f568ac3` · J-38 `ca13cdb` (+ test fix) ·
  R2-148-d `53ee844` (firestore.rules — ✅ the owner published them, 2026-09-26) · B-13
  `702fb61` · J-39 `d524d97` · RES-R2-135 `ead4f93` · RES-R2-045 `2b12f38` · RES-R2-104 `785b34a` · ~~R2-148-c `95afab8`~~ **reverted** (gate 36221038666: 99-import-roundtrip-columns sidebar read the education's field of study into its description; R2-148-c open again — patch in the store `fixes/R2-148-c.patch`, fix its sidebar-education regression, then re-land).
  RES-R2-043 was already fixed (28b15c6). Owner decides: RES-R2-140-a (offline reorder lost to the cloud's order),
  RES-R2-140-c (a sync icon for jobs/boards — where, what it says), RES-R2-137 (Word Modern banner: reverses R2-133).
- **Next:** 36221038666 green → `git push origin 45b6b60:refs/heads/master` → `python3 docs/tracking/tools/deploy_rows.py
  45b6b60` → set the fixed rows (tracker rows for the RES-* leftovers and Lane C B-/J- rows by hand; `update_tracker.py
  --recount`) → bug-status.md header → this file. Red → read `gh run view <id> --log-failed`, fix, re-gate.

**Wave 2 — landing on the work branch after 45b6b60** (workflow `flowcv-bugfix-wave2`, may still be running; patches in the
store `flowcv/wip/execution-2026-09-26/fixes2/` + the session scratch; land one with
`FIXDIR=<dir> bash /mnt/Storage/my-learning/claude/flowcv/wip/execution-2026-09-26/land.sh <ID>`, then push and dispatch
`gh workflow run ci.yml --ref claude/busy-darwin-yjb13t -f failfirst="<sha>:<tests>"`; `landed.txt` lists what landed).
Landed: RES-R2-151 `68f5d56`, J-38b `2ece50b`, RES-R2-131 note `b8e84eb` (already shipped ab74277), B-29b `b9805bb`,
RES-R2-126b `052b4c0`, RES-R2-137 note `977c89b`, R2-041b `cdd0dd7`, LC-FLIP `395f5e5`, B-20b `e8c0e67` (ff 36221510003), LC-TWINS `2ccd722`, LC-WAVE1 `a1396a7`, H-02 `bf8c750`, H-03 `37e2f31`, H-06 `994e550`, H-07 `d818f80`, H-09 `0aea790`, H-11 `102ee1c`, H-13 — **wave 2 complete**. Then one full gate → deploy.
**Wave 3 (coordinator alone — owner: no new agents), on the work branch after `d67e32f`:** B-20c `5b5c048` (IME Enter in the
11 fields outside the board + a source guard test, tests/unit/ime-enter-guard.unit.mjs), B-20c `edbca14` (the kit's Dialog
and Popover ignore an input method's Escape), J-12 `1daf0f0` (job page one column on phones, long values wrap).
Fail-first 36223043609, full gate 36223045204 on `1daf0f0` → green → `git push origin 1daf0f0:refs/heads/master`, rows.
Still open for the next wave: R2-148-c (re-land its patch after fixing the Sidebar-education import regression), then
the checklist. (The RES-row notes for today's fixes are in the rows.)
**After that:** the checklist's rest (store `flowcv/CHECKLIST-2026-09-25*.md`), accessibility last.
Pending-bug list: store `flowcv/wip/execution-2026-09-26/pending-bugs.md`.

## ⏩ COLD START HERE — 2026-09-25 17:00 UTC (laptop session, owner's execution brief of 21:45 IST)

🔴 **A push to ANY branch deploys the live site** (found 16:40 UTC by the revision session, confirmed here): Cloudflare
Workers Builds builds and deploys every branch, not only master — the live bundle carried claude/wf-owner-ui's /new
page. Until the owner turns off non-production deploys in the Cloudflare dashboard (Settings → Builds), **every branch
must carry `4e68e6a`** (`claude/deploy-guard`: vite.config.js refuses a Workers build of any branch but master,
vite-deploy-guard.js) **before it is pushed**. This docs push to the work branch (code = master `6e19667`) is what
puts master's code back on the live site. The owner was asked to roll back to version 7d1efb15 (6e19667's build).

**Deployed:** `master` = `6e19667` = Round 3 batches 1–2: typography, public link (`e006835`, gate 36109292470; the owner
published the new `firestore.rules`), page numbers and the picker (gate 36158213786 green on `6e19667`). R2-146 ✅.
**Work branch:** `claude/busy-darwin-yjb13t` = master + docs.

**In progress (each on its own branch, the work branch merged into it, reviewed by an agent, fixes committed):**
- perf2 `claude/wf-perf2`: merge `8dbf7f7`, reload-once on a stale page file `580923e`, worker first-build fallback
  `bd3ff9a` (fail-first 36161417165 ✅), lazy workspace shell `cf3ad0e` (start-up path was 1,133 kB > 1.1 MB).
- section-look `claude/wf-section-look`: merge `9fe4865`, Underline colour `1d1b95a`, guard narrowed `e3ff5bc`,
  review fixes `e87aa95` `761696d` `0c0ef29` `a11e174`, `e62647b` reverted (Word already right).
- owner-ui `claude/wf-owner-ui` (R3-009 cursor, R3-010 modals, R3-011/012 the /new page): fail-firsts ✅; its gate
  36161763933 failed only 91-starter-modal (fixed `bf62e48`).
Next per branch: guard merged in → push → full gate → `wf-reports/<cluster>.json` → merge here → gate → deploy.
Then layouts (an agent is diagnosing its failures) → locale (its RTL test fails with its own fix) → R3-008.

**Picker's product calls** (owner left them to Claude): (1) leaving a saved design resets what still holds its values —
kept, Undo covers it; (2) deleting a saved design must hold on every device — **R3-008**; (3) a design saved from an
older résumé keeps only the keys it had — kept.
**New rows R3-009…012 = the owner's four asks of 09-24:** hand cursor, modals close on an outside click, a new résumé
from the account's own data, a `/new` page of template pictures.

**Next, in order:** perf2 (`7a768b4`, gate green, no report; conflicts in `src/AppRoutes.jsx`) → section-look
(`f0fe67f`, red) → layouts (`3e2ed65`, red) → locale (`2f5d9d0`, red) — one at a time, each on its own branch to a
green gate and a `wf-reports/<cluster>.json`, then merged here. Then R3-008…012, the rest of the checklist,
accessibility last.

## ⏩ COLD START HERE — 2026-09-25 07:47 UTC (coordinator session_01XeVJDQKh78wxFo4dTK6ZpW, about to run out)

**Deployed:** `master` = `0a79974` = Round 2 (ten clusters, ATS-7) + the Jira-style revamp of Boards and the Job Tracker.
**Work branch:** `claude/busy-darwin-yjb13t` (head = this commit). Owner's orders: finish the project, fast, agents allowed;
tests only on CI; `master` moves only on a green full gate on that exact commit; accessibility last.

**Do next, in order:**
1. **Gate run 36109292470 on `e006835`** (batch 1: typography + public-link merged, the revamp-merge gaps `a09f005`,
   `3d50022`, and `e006835` — publicLink.js used its own copy of the contact table; the previous gate on `3d50022`, run
   36108339083, failed only `31-contact-fields` for that; its fail-first run 36108340868 is green). Read it with
   `actions_get get_workflow_run 36109292470`; failures with `get_job_logs run_id=… failed_only=true`. On green:
   `git push origin e006835:refs/heads/master`, then `python3 docs/tracking/tools/deploy_rows.py e006835 &&
   python3 docs/tracking/tools/update_tracker.py --recount` (R2-146 ⏸ → ✅), update bug-status.md's "Updated" line,
   commit, push.
2. **Round 3 cluster sessions** (each from `c5acb93`, branch `claude/wf-<cluster>`, done when
   `wf-reports/<cluster>.json` is on its branch). Check: `for c in page-numbers locale perf2 section-look layouts picker;
   do git fetch -q origin claude/wf-$c && git cat-file -e FETCH_HEAD:wf-reports/$c.json && echo "$c REPORTED"; done`.
   Merge each: `REPORTS=/tmp/wf-reports bash docs/tracking/tools/merge_cluster.sh <c>` → resolve → `python3
   docs/tracking/tools/update_tracker.py /tmp/wf-reports/<c>.json` → commit (only the merge + tracker files) → push →
   batch → one full gate (`actions_run_trigger run_workflow ci.yml ref=claude/busy-darwin-yjb13t inputs={}`) → deploy
   as in 1. At 07:45: typography ✅ reported+merged (`323991e`), public-link ✅ reported+merged (`091f00c`);
   **07:55: page-numbers ✅ reported+merged (`3a70d91`**, R2-147 part; conflicts in importFile.js — page furniture is
   now dropped from a page's items before its column split — and wordExport.js — font table + footer, both kept;
   rerere recorded). Not yet gated: batch 2 = `3a70d91` + the next merges. Still working: locale, perf2,
   section-look, layouts, picker.
   Sessions: page-numbers session_01PL4e5MkwcqPVF1pzRc4tAg · typography session_01VrpBFXbHBAp8Aow3YbjvwA ·
   locale session_01DjbrY7hHtJmKD6GJcXHFx7 · perf2 session_017oTZg6ZNCXoJwpKhSURxST · section-look
   session_01A8Pc1gVNQNk225roXUbEns · public-link session_01H7o4mAMVufFnaL8mMiYhCJ · layouts
   session_018uk2NM3EkjexkRoDkRHEEz · picker session_01MkCArZxvT5mbX1ELBQKrAu.
   Watch in merges: the guard `tests/pdf/31-contact-fields` (no second contact table: use `CONTACT_FIELDS`), the
   Design ↺ test `91-design-resets` (new Design keys belong in a section's ↺ list), `tests/unit/knowledge-docs`
   (docs must state the current `DATA_VERSION`), the Playwright parity walk (every new control must repaint).
   **R2-148** is split: public-link did the link and import (partial); set the row fixed when locale's report lands.
3. **After all eight:** the a11y pass (R2-139's A7, A8, A11, A13, A14; A11Y-1…6; parked branch `claude/wf-templates`,
   `67c88c5`) — last, by the owner's rule.

**Owner actions:** publish the new `firestore.rules` to the Firebase project (Share a public link fails permission-denied
until then); tag v0.1.0 when ready; delete merged branches on GitHub (the git proxy refuses deletes): every
`claude/wf-*` of Rounds 1–2, `claude/beautiful-heisenberg-x3bsvo`, `claude/confident-goldberg-2uig8b`,
`claude/sweet-feynman-ro5q2g`, `claude/wf-round2-resume`, `claude/jira-revamp` (all merged); keep `claude/wf-templates`.

## Older handoffs (moved verbatim 2026-09-26, the 300-line cap)

- 2026-09-24 … 2026-09-25 rounds (Round 2 relaunch, its gate and deploy, fix-every-row): [HANDOFF-HISTORY-2026-09.md](HANDOFF-HISTORY-2026-09.md)
- Earlier (2026-07-14, 2026-09-14; where the work lives, what was finished, key PDF files): [HANDOFF-HISTORY-EARLIER.md](HANDOFF-HISTORY-EARLIER.md)

## Conventions established (keep using)

1. Design-panel **spacing is CSS px** → convert **once** to PDF points via `CSS_PX_TO_PT` / `pxToPt`.
2. **Font sizes** are already pt numbers on canvas — **do not** multiply by 0.75.
3. Photos: use `getPdfPhotoStyle(settings, accent, 'classic'|'modern')` — never hardcode sm/md/lg to 40/50/65.
4. Document metadata: creator/producer **CPWT-CV**, not FlowCV.
5. Primary export path: react-pdf; legacy print is fallback only.

---

## Suggested next session prompts

1. “Visually compare canvas vs Export PDF for all 5 templates.”
2. “Prepare repo for free public release (LICENSE, env example, README).”
3. “Continue improving multi-page PDF / sidebar edge cases.”

---

## Quick mental model

```
master (this folder)  = includes React-PDF fidelity + warm export  ← CONTINUE HERE
fix/react-pdf-fidelity = historical feature branch (merged)
```
