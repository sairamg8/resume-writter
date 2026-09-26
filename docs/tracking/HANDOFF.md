# Session Handoff — Resume Here

## ⏩ COLD START HERE — 2026-09-26 (laptop session 26b8b31a) — owner: "merge everything to master, deploy, report pending bugs"

The owner's hold is lifted. **Cloudflare branch builds are OFF** (verified: pushes 1aa18ee, 444cf33, e827952, 91c91c9 have
no "Workers Builds" check run; 618c6c1 had one). Only a master push deploys.

🔴 **Owner, 2026-09-26: English only for now.** `claude/wf-locale` (R2-148 language + right-to-left) is **parked at
`ac50cf4`, not merged** — no language/RTL work until the owner reopens it. (It has the work branch merged in, `faf2c71`,
and fixes `cd0fbc9` `3da8a07` `a33e548` `ac50cf4`, never gated; its runs were cancelled.)

**Deployed: `master` = `e6b1a4a`** = batch 5 (layouts R2-138 ✅, R3-008 ✅; gate 36218934694) on batch 4 (owner-ui, R3-009…012 ✅; gate 36217649197 15/15) on batch 3 (`91c91c9`): perf2 (`dcc0392`, report `1aa18ee`, R2-142 partial) + section-look (`91c91c9`,
report `444cf33`, R2-147 partial); full gate 36216686987 15/15 green, fail-first 36216688486 (cf3ad0e) green.

**Batch 4 deployed** (`f20a62d`: owner-ui, review fixes `d861584` `c9f400b`). **Batch 5, gating:** full gate **36218934694**
on `e6b1a4a` = R3-008 `c6eb880` (fail-first 36218191333 ✅; known limit in its row) + layouts merged (`e6b1a4a`, report
`05381c4`, R2-138 ⏸): its gate 36217880697 on fa0e777 failed only two test-side checks, fixed in `abed7ce`; parity/31
page-break measure `fa0e777` + `f0575a3`. Green → `git push origin e6b1a4a:refs/heads/master`, deploy_rows, recount.
Then: the rest of the checklist (English only), accessibility last.
**Bug fixes, streaming (owner: "start fixing the pending bugs"):** workflow `flowcv-bugfix-stream` (7 clusters: boards-dnd,
boards-text, jobs, sync-public, sync-collections, pdf-word, data; English only, no a11y) writes each fix as a patch +
manifest in the session scratch `fixes/<ID>.patch|.done.json` (base `4d32890`); the coordinator reviews and lands each as
its own commit here (`scratchpad/land.sh <ID>`), then fail-first per commit and one gate per batch. Landed: B-20 `617f24f`
✅ff, J-30 `5f86d40` ✅ff, B-29 `4345a13` ✅ff, RES-R2-140-b `5fc8925` (ff 36219546057; under review), R2-148-a `9af32ac`, J-36 `62f024a`, B-05 `ff7e89a` (ff 36219677444), R2-041 `ba0a938`, RES-R2-126 `29fb954` (ff 36219729075), B-17 `f568ac3`, J-38 `ca13cdb`, R2-148-d `53ee844` (firestore.rules — OWNER publishes), B-13; J-39, RES-R2-135 `ead4f93`, RES-R2-045 `2b12f38`; R2-041/J-38 fail-first were red WITH their fixes — causes: B-05's MeasuringStrategy.Always measured at render (fixed 9e20f77), DatePill's hidden date box under 16 px (fixed be5dffa); RES-R2-104 `785b34a`, R2-148-c `95afab8`; the J-38 test read the hidden file input as a text field (test fix after 95afab8). All 21 handed off; workflow done. Full gate 36220057010 on ebcaab4 (before R2-148-c); a final gate follows on the head; RES-R2-043 already fixed (28b15c6). Needs the owner:
RES-R2-140-a (offline reorder lost to the cloud's order — needs a stored base order), RES-R2-140-c (a sync icon for jobs and
boards — where and what it says). If the session dies: the patches are in scratch; re-run the stopped clusters from the store
checklist (`flowcv/wip/execution-2026-09-26/pending-bugs.md`).
Scout notes (diagnoses, R3-008 design, pending bugs): store `flowcv/wip/execution-2026-09-26/`.

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
