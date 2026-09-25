# Session Handoff — Resume Here

## 2026-09-25 ~06:40 — Round 2's gate fixed and deployed (in progress)

**Coordinator:** session_01XeVJDQKh78wxFo4dTK6ZpW. **Work branch: `claude/busy-darwin-yjb13t`**, fast-forwarded from
`claude/sweet-feynman-ro5q2g` (`5086b0a`, frozen). The previous coordinator (session_01YBTHhwV9xeHy7YGaebJnhY) and the
Jira-revamp lane (session_01ASmJ6BQpqJE5fifosw4z8y) both stopped at 04:18–04:22 UTC on the usage limit. **Owner,
06:40:** fix the gate and deploy; agents allowed (fast and efficient); fix everything as one batch, gated by one CI run.

The full gate on `6c11484` (run 36092446651) had 7 failures, all where Round 2 clusters' changes meet:

| Failure | Cause | Fix |
|---|---|---|
| suite 2: `31-contact-fields` one contact table | ats-view's comment at `src/utils/atsChecker.js:670` spelled `"LinkedIn"` in quotes | `4444898` rewords the comment; the guard is unchanged |
| suite 2: `91-design-resets` (R2-157) | header-type added `sectionLetterSpacing` and `fontSizeTitleDelta` to the Typography ↺; section-style added the Lists ↺ | `34afa71`: the test moves them off default and expects them back (seven ↺s) |
| suite 5: `knowledge-docs` (R2-169) | letters-import moved `DATA_VERSION` to 13 | `556d0fc`: docs 03 and 05 say 13 |
| Playwright 3: `pdf-templates` Banner | templates-core's Modern card reads "…in an accent banner"; `:has-text("Banner")` clicked it | `1760224`: cards by `data-testid` (`template-<id>`) |
| suite 1: `96-dashboard` (R2-167) ×2 | letters-import: New Cover Letter makes a letter; Import JSON renamed | test updated to the letter flow (no / one / several résumés) and the new label |
| Playwright 2: `parity-ui-controls` classic Design panel | the walk's résumé had no bulleted list (only Classic walks Design → Lists); the app is right | `85d9994`: the first job gets a two-item list |
| Cypress 2: `23-editor-panels` zoom across the letter | header-type's Name ↔ Contacts stepper puts a "+" in the letter panel before the zoom's | `34416d2`: the zoom's "+" is read in the preview column |

Next: **one** full gate on the head (all seven fixed; the Jira lane's two failures are being fixed in the worktree `/home/user/jira-revamp`, pushed to `claude/jira-revamp`, gated separately) → on green, `git push origin <sha>:master`,
then the tracker (every ⏸ row whose commits are on master → ✅; ATS-7 ✖ → ✅, `38f35b5`) and this file, docs only.
**Owner, ~07:00: "finish this project"; merge the Jira revamp too once green.** Round 3 — the 7 open rows, one cloud
session per cluster, each from `c5acb93` on `claude/wf-<cluster>`, per CLUSTER-PROTOCOL.md (its report
`wf-reports/<cluster>.json` last); the coordinator merges each into the work branch, gates, deploys. Accessibility last.

| Cluster | Rows | Session |
|---|---|---|
| page-numbers | R2-147 page numbers | session_01PL4e5MkwcqPVF1pzRc4tAg |
| typography | R2-146 rest: name font, per-section font, Sidebar title spacing, Word font fallback | session_01VrpBFXbHBAp8Aow3YbjvwA |
| locale | R2-148: résumé language for dates, RTL | session_01DjbrY7hHtJmKD6GJcXHFx7 |
| perf2 | R2-142: PERF-1, 4, 5, 6 | session_017oTZg6ZNCXoJwpKhSURxST |
| section-look | R2-147 rest: section icons, links, levels, grouped roles, columns, photo | session_01A8Pc1gVNQNk225roXUbEns |
| public-link | R2-148: public web link; two-column / scanned PDF import | session_01H7o4mAMVufFnaL8mMiYhCJ |
| layouts | R2-138 B2: the designed layouts as new engines | session_018uk2NM3EkjexkRoDkRHEEz |
| picker | R2-139 non-a11y (A1–A4, A9, A12, B3, C1, D1, E1, F1), R2-138 B4 | session_01MkCArZxvT5mbX1ELBQKrAu |

Jira revamp: its two failures are with agents in `/home/user/jira-revamp`; a trial merge onto `c5acb93` conflicts only
in `src/pages/JobTracker.jsx` (resolved: the revamp's page plus Round 2's SyncHeldNotice; rerere recorded) and this file.
Order: Round 2 green → `master` = `c5acb93`; then the revamp merged into the work branch, one gate, `master` again.

Still open after the deploy: 7 rows (R2-138, 139, 142, 143, 146, 147, 148 — each partly done); `claude/jira-revamp`
(its gate run 36092746492: `82-your-work-page` and Cypress `20-regressions-job-unsaved` left; the owner decides when it
merges); `claude/wf-templates` parked for the a11y pass.

## 2026-09-25 — Round 2 relaunched: 10 cloud sessions (in progress)

**Coordinator:** session_01YBTHhwV9xeHy7YGaebJnhY. **Work branch:** `claude/sweet-feynman-ro5q2g` (= master `334b454`
at the start). The Round 2 worker of 2026-09-24 (session_01KDXZzZfUEUyKqzYyULQbRi) was stopped by the session limit;
its resume kit is on `claude/wf-round2-resume` (`wf-resume/`: `args.json` briefs, `state.md`, `wip/*.patch`).

**Owner, 2026-09-25:** (1) accessibility is deferred — no a11y bug or feature until no other bug or feature is left;
(2) up to 10 fast, top-level agents; finish the pending rows.

Each cluster runs in its own cloud session on its own branch, per [CLUSTER-PROTOCOL.md](CLUSTER-PROTOCOL.md), based
on `origin/master`; its `wf-reports/<cluster>.json`, pushed last, means it is done. The coordinator merges each
report with `tools/merge_cluster.sh` into the work branch, sets the rows (`tools/update_tracker.py`), gates the batch
with one full CI run and fast-forwards `master` on green.

| Cluster | Rows | Session | State |
|---|---|---|---|
| perf | R2-142 + Round 1 leftovers: f6cb390's missing fail-first test, hidden end date ignored by PDF/Word on imported education/projects/volunteering, a review of pdf-pagination's merged work | session_017EuPN3kida3Yn1AMTDH8qQ | **merged** — R2-142 partial (max-wait preview, no-op edits, sign-out write, other-tab saves; PERF-1/4/5/6 left); R1-LEFT-a, b, c fixed |
| ats-view | R2-141 (its 39c7925 was red on CI) + the ATS checker counting an all-hidden section | session_01LEdydPcqD7vQvaL88189M2 | **merged** — R2-141 fixed (parser view, per-job fields, honest claims); R1-LEFT-d fixed (7580def) |
| design-page | R2-136 (done), 149, 157 | session_01PeCTicKUMnAJYJhVSLsUfV | **merged** — R2-136, 149, 157 fixed (page size, 1-Page Fit that measures, Design panel tests); session archived |
| header-type | R2-137, 146 | session_01SfVdGGL7YohgirYbPRni3X | **merged** (session limit hit before its final CI; the full gate checks it) — R2-137 fixed, R2-146 partial |
| templates-core | R2-139 (non-a11y part), 138 — branch `claude/wf-templates-core` | session_01RJGwPXpTmeycSSs3P4AScW | **merged** — R2-138 partial (8 designs: 17 choices; B2, B4 left), R2-139 partial (a11y part deferred) |
| section-style | R2-147 | session_01NqoaVxqWn89c2oi9DMyehg | **stalled 03:03 → taken over by the coordinator** — merged as left (328b9fe); page-number fix f0f9784 (explicit height), Word footer on the title page; CI pending |
| cloud-sync | R2-159 (done), 145, 140 | session_017BB79LpEbU9c3zT2CccWDV | **merged** — R2-159, 145, 140 fixed (jobs + boards sync on one shared engine; Privacy page true) |
| structure-tests | R2-158, 167, 171 | session_015xkXZJXdNDrdPoNy6Nusob | **merged** — R2-158, 167, 171 fixed (c1f085d: a section dropped off the list no longer throws) |
| letters-import | R2-135, 148 | session_01C9EUo2kre8QeqViw2sAKkx | **merged** — R2-135 fixed (several letters per résumé), R2-148 partial (import PDF/Word/Markdown/text; language, RTL, public link left) |
| release | R2-169 (done), 143, 154, 168 | session_012ktnCPxsipt5gQWuGvDdjh | **merged** — R2-169, 154, 168 fixed; R2-143 partial (owner: v0.1.0 tag, Terms/Privacy domain) |

**Parked for the a11y pass at the end:** `claude/wf-templates` (`67c88c5`, R2-139's picker accessibility — its Cypress
shards 3 and 4 were red); R2-139's A7, A8, A11, A13, A14; A11Y-1…6.

**Owner, 2026-09-25, later:** (3) ATS-7 option A approved: a running "Name · Page 2" header on pages 2+ — built by
the coordinator itself on the work branch; (4) **no new agents, sessions or workflows** once these 10 are running (to
protect usage): they finish, and the coordinator does everything else itself; a failed session is reported to the
owner, not restarted.

**ATS-7 (coordinator, on the work branch):** `38f35b5` — "Name · Page N" on every résumé page after the first, drawn
first in the top margin (`constants/runningHeader.js`, `PdfRunningHeader`, all nine templates, Word's header with
titlePage); no Design control (always on, left out where the margin has no room). Its own tests pass with fail-first
(run 36088672238: 60/60). `24bf996`: the harness's `runningHeaderItems` / `bodyItems` / `withoutRunningHeaders`, and
06-pagination, 29-page-size, 68-banner-look, 65-ats-text-parity, 70-markdown-parity read the page's own text — green
in run 36089666144. Left: the "timeline" and "academic" suites of parity 15-template-resets or 31-section-overrides
(runs dispatched one file each, 03:30). `3b63310`: 98-ats-claims (from ats-view) no longer sets ATS-7 aside. When
green: ATS-7's row in `bug-status.md` goes ✖ → ✅.

**section-style (taken over):** its session went idle at 03:03 waiting on CI run 36088741695 (failed: no page number
on any template), with nothing to wake it. No new agents (owner), so the coordinator merged its branch as left
(`328b9fe`: imports beside PdfRunningHeader; Word keeps the header and the footer, the footer given for the title page
too), fixed the footer (`f0f9784`: its box had no height), added a Word test (`87cd9d3`). CI run with fail-first
dispatched ~03:28. Then: the report rows for R2-147 by hand (update_tracker from a hand-written report).

**State at 04:05 UTC — deploy in progress (owner: "fix what you wish, deploy everything, then delete every other branch"):**
- Work branch head `6c11484`. The page-number footer (R2-147 part) is **withdrawn** — four fixes failed; removed with its
  tests; R2-147's page-number task is open again.
- Full gate on `6c11484` dispatched ~04:05. The previous gate (run 36092025661, on 63d1b42) also failed: Cypress
  `23-editor-panels.cy.js` (1 of 90 in shard 2), Cypress shard 4 and Playwright shard 3 (specs not read yet), plus the
  page-number tests now removed. Read the new gate; fix what is real (a test updated only to intended behaviour).
- On green: update_tracker ⏸ → ✅ for rows whose commits are on the head, record the run, `git push origin <sha>:master`.
- **Branch deletion is blocked for Claude** (auto-mode classifier: "Git Destructive"). The owner deletes them on GitHub,
  or allows `git push origin --delete` in settings. Safe to delete once master = the work branch: every `claude/wf-*`
  branch merged into master or the work branch, `claude/beautiful-heisenberg-x3bsvo`, `claude/confident-goldberg-2uig8b`,
  `claude/wf-round2-resume` (its patches are applied). **Keep / ask first:** `claude/jira-revamp` (another live session's
  unmerged work), `claude/wf-templates` (the parked a11y work, 67c88c5), `claude/wf-pdf-pagination` (a handoff note only;
  its code is on master).

**✅ Owner confirmed 2026-09-25 ~03:55: the Cloudflare build env has VITE_DEMO_ACCOUNTS and VITE_CONTACT_EMAIL.** Was:
**Before `master` moves (R2-143, merged from release):** the owner's e-mail, uid and name now come from the build's
env (`src/utils/siteOwner.js`, `.env.example`). The live site's Cloudflare build must set
`VITE_DEMO_ACCOUNTS` and `VITE_CONTACT_EMAIL` (the owner's address) first, or the live site loses its demo account (the
"Keep as my original" résumés stop coming back) and Terms/Privacy name no contact address. The owner's `.env.local`
(dev server only): `VITE_DEV_USER_UID=dev_sairam`, `VITE_DEV_USER_EMAIL`, `VITE_DEV_USER_NAME=Sairam`, and the same
`VITE_DEMO_ACCOUNTS`. Hold `master` until the owner confirms.

**Needs the owner:** the Cloudflare env vars above; deleting the merged `claude/wf-*` branches on GitHub (the git proxy
refuses branch deletion); tag v0.1.0 when ready.

> **Updated 2026-09-24 (cloud session, branch `claude/confident-goldberg-2uig8b`).** This section is the
> live resume cursor for the "fix every open row" session. After the owner's reboot a new coordinator
> (session_01UaZc6yUjHdoanpnUfTnzFF) took over from session_01PdF933BaDvYDh7KFAJpkKi: its work branch
> `claude/beautiful-heisenberg-x3bsvo` was fast-forwarded into `claude/confident-goldberg-2uig8b`, which is now
> the work branch; the old one is frozen at `859c3c7`. Older handoffs follow below.

## 2026-09-24 — fix every open tracker row (in progress)

**Goal (owner):** fix every open bug in `docs/tracking/` (149 open at `504b313`), then improve the app.
**Base:** `504b313` (master, CI green). **Work branch:** `claude/confident-goldberg-2uig8b` (was
`claude/beautiful-heisenberg-x3bsvo` until `859c3c7`; pushed; CI runs on master only, so nothing deploys from here).
**Owner, after the reboot:** merge every cloud agent's work into master.

### How the work is split

Round 1 — defects, 14 clusters, each fixed by **its own cloud session** (its own machine) on branch
`claude/wf-<cluster>`, following [CLUSTER-PROTOCOL.md](CLUSTER-PROTOCOL.md): fail-first test → fix → commit
→ push, an independent reviewer subagent, then `wf-reports/<cluster>.json` as the last push (its arrival
means the cluster is done). Sessions do not edit `docs/tracking/`; the coordinator (now
session_01UaZc6yUjHdoanpnUfTnzFF) merges each branch into the work branch, updates the tracker rows and
totals, runs CI on GitHub (workflow_dispatch on the work branch), and deletes the `claude/wf-*` branch.
The owner approved the temporary `claude/wf-*` branches on 2026-09-24 12:47.

| Cluster | Rows | Session | State |
|---|---|---|---|
| ats | R2-020 021 022 023 024 025 027 078 079 080 081 163 166 | session_01GG1ULRf3BEFijyNRzXNJoT | **merged** |
| pdf-pagination | R2-046 047 048 049 104 109 111 | session_013Hg3VSwaVkaQmNCkotTNsb | **merged** (a933db1 + its reviewer's 4 fixes, a982b26) and **deployed**; the coordinator's read-only review and CI fail-first were still running at the deploy — their findings are fixed forward |
| design-sidebar | R2-013 051 059 082 083 087 088 089 090 096 119 120 121 123 | session_014y3tSMD21g1ji9Ct73pZQh | **merged** (with the JSON Resume / Backup follow-up) |
| word | R2-061 065 066 070 114 118 124 125 126 128 132 | session_01Kms1vF1NWaaH7yWz6e2UWr | **merged** |
| text-exports | R2-026 034 052 053 054 058 060 064 122 129 131 | session_01YUpaiGLx34s4T8huDzmJNW | **merged** (with follow-up: the letter's text export) |
| jobs | R2-035 036 038 039 040 042 075 099 100 101 102 156 | session_01TxTRPE1CXJu54unwVCNutZ | **merged** (with follow-ups: page tests, salary sort, re-import) |
| app-shell | R2-050 071 072 073 074 076 077 084 086 144 | session_01S681bgs4qE2ric3C7MivaC | **merged** (8c60c6c) |
| boards | R2-037 041 098 155 159 | session_01AeqejztN2Vs4b4cpnBNrnU | **merged** (with follow-ups: Backlog, Settings, Your work pages, epics) |
| preview | R2-106 107 170 165, R3-005 | session_01JqQBbPVCVC4WNbFTi77bQ2 | **merged** |
| import-data | R2-031 055 056 110 085 091 117 093 094 095 097 | session_01174H7ZETLrGKWfVVXQdWmd | **merged** (e6ebbd4) |
| sections | R2-057 069 127 108 112 113 115 116 150 151 | session_01WXhjKL5tbvAFuBeRpZ6c4d | **merged** |
| sync | R2-028 029 030 | session_01CkkXUYrb8NXsPv4VYVH4MX | **merged** |
| letter | R2-043 044 092 103 130 134 068 133 | session_019D9Rn4N2nqJnTSeZgxodBg | **merged** (with follow-ups: v12 placeholder migration, dashboard thumbnails) |
| pdf-text | R2-045 105, R3-002 003 004 | session_01SUaj4fLPe8rVZ9g2kGSu6H | **merged** |
| cypress | R2-152 161 162 | coordinator's own machine (workflow wf_f5efdc0c-440, local branch `wf/cypress`) | **merged**, reviewed (02a6ab8: six findings fixed, Cypress 63/63) |

The git proxy refuses branch deletion (HTTP 403), so merged `claude/wf-*` branches stay on GitHub until the
owner deletes them there; each one's work is in the work branch once its row reads **merged**.

Done outside the clusters: `12c2a71` — LICENSE, CONTRIBUTING, README, knowledge docs (R2-143, R2-169, partial);
`e6796ec` — CI gains lint and Cypress jobs, and a working branch is gated by workflow_dispatch (R2-152, R2-154).

Round 2 — features and test gaps not in a cluster: R2-135 136 137 138 139 140 141 142 145 146 147 148
149, R2-152 154 157 158 161 162 167 168 171; plus a lint step in CI and the 21 oxlint warnings.

**Owner, 2026-09-24 12:35:** once the running clusters finish, start nothing new — the owner restarts the
session first. Round 2 begins only after that restart.

### State now (2026-09-24 ~15:35 UTC, coordinator session_01UaZc6yUjHdoanpnUfTnzFF)

**Round 1 is deployed.** `master` = `9a49f83` (fast-forwarded from `504b313`, 250 commits): all 15 clusters, the
coordinator's merge fixes and the CI work. Gate on that exact commit: CI run 36018983145, every job green (suite on 6
machines, Playwright on 3, Cypress on 4, build, lint). Tracker: **215 fixed · 22 ✖ · 22 open** — the 22 open rows are
all Round 2 (features and test gaps, R2-135…171). Every ✅ row's commits were checked to be on `master`.

Rules since the owner's reboot (also in the repo's `CLAUDE.md`, which every session reads first):
- Tests run **only on CI** — dispatch `ci.yml` with `tests` / `failfirst` / `playwright` / `cypress` inputs
  (CLUSTER-PROTOCOL.md "Set-up"). Nothing runs locally.
- `master` moves only on a green full gate on that exact commit.
- Work in parallel (cloud sessions, several small workflows); keep this machine under 80% CPU/memory.
- A Stop hook (`.claude/hooks/handoff-fresh.sh`) refuses to end a turn while this file is behind the code.

Still open from Round 1, none blocking:
1. pdf-pagination's review by the coordinator (read-only reviewers + skeptics, two workflows) was running at the
   deploy; confirmed findings get fixed forward. Known already: `f6cb390` (an award without a description is not
   moved) has no test that fails without it — add one.
2. ATS-7 (a heading that opens a page is glued to the page before under `pdftotext -raw`, accepted as a known limit)
   now hits the demo résumés on Modern, Minimal and Banner, because R2-047 moves a title with its entry; the field
   test reports it as an ATS-7 diagnostic (9a49f83). The owner may want to revisit ATS-7's option A (a running
   "Name · Page 2" header).
3. Two small defects seen by the sections cluster, not yet filed: the ATS checker still counts a section whose
   entries are all hidden; the PDF and Word ignore a hidden end date on imported education/projects/volunteering.

Round 2 (the 22 open rows) is handed to a separate session by the owner (the prompt the owner was given names this
branch, the CI-only rule, `claude/wf-<cluster>` branches and `wf-reports/<cluster>.json`). This coordinator merges
each reported branch, sets the rows, gates on CI and fast-forwards `master`. A scoping workflow's cluster plan goes to
`docs/tracking/ROUND2-PLAN.md` when it lands.

### If this session was cut off

1. `git fetch origin claude/confident-goldberg-2uig8b && git checkout claude/confident-goldberg-2uig8b`.
   The merge tools are in `docs/tracking/tools/`: `merge_cluster.sh <cluster>` (fetch, merge without committing,
   drop `wf-reports/`, print the report), `update_tracker.py <report.json>` (set the rows, re-total; `--recount`
   alone re-totals) and `handoff_state.py '<cluster>=<state>'` (this file's table).
2. Read the table above: a cluster marked **merged** is on the branch and in the tracker. The others are
   on GitHub as `claude/wf-<cluster>`; their sessions run on their own machines and survive this one's
   restart. A branch with `wf-reports/<cluster>.json` is finished and ready to merge.
3. Local set-up: `corepack enable && yarn install --immutable` (for lint and reading code). Tests: CI only.

---

## Earlier handoffs

> **Updated 2026-09-14.** Checkout moved to **`/mnt/Storage/Projects/flowcv`**, branch
> **`audit/e2e-fidelity`**. The authoritative resume cursor lives outside the repo:
> `/mnt/Storage/my-learning/claude/flowcv/START-HERE.md`.

## 2026-09-14 — audit + Cypress (in progress)

Goal (owner): free open-source FlowCV rival — FlowCV parity plus extras; fix canvas-vs-PDF drift;
Cypress E2E suite.

- `scripts/visual-compare.mjs` — canvas vs PDF composites (`qa-visual-compare/`, git-ignored).
  Run against a build: `vite build --outDir <tmp>` → `vite preview --outDir <tmp> --port 5199`.
- `cypress.config.js`, `cypress/support/*`, `cypress/e2e/00-smoke.cy.js` — scaffold; install
  `cypress` (yarn) before running.
- `.env` is git-ignored now; `.env.example` documents the optional Firebase keys.
- Known mismatches (unverified list): page counts (Modern 4 vs 3, Sidebar 5 vs 4), bullet
  indent, `,` vs `·` separators, date placement, pagination of lists, cover-letter recipient
  fields not rendered, silent export failure.
- The multi-agent audit hit the usage limit and returned nothing — re-run in small stages.

---

## Earlier handoff (2026-07-14)


> **For the next human or AI session:** read this file first, then `AGENT_MEMORY.md`.  
> **Saved:** 2026-07-14  
> **Status:** React-PDF fidelity work **merged into `master`**.

---

## Where the active work lives

| Item | Value |
|------|--------|
| **Active code** | `/home/sairam/Documents/flowcv` |
| **Branch** | `master` (includes `fix/react-pdf-fidelity`) |
| **Product** | CPWT-CV (FlowCV-inspired free resume builder) |
| **Owner goal** | Share free with fellow developers (open source) |

```bash
cd /home/sairam/Documents/flowcv
git status
npm install   # if needed
npm run dev
```

Optional worktree (historical; no longer required for PDF work):

```bash
# /home/sairam/Documents/flowcv-pdf-worktree · branch fix/react-pdf-fidelity
git worktree list
```

---

## What was just finished (do not redo)

### Problem
Canvas preview (HTML) ≠ “Export PDF” (react-pdf). Two export paths (print legacy + react-pdf). Goal: improve react-pdf to match canvas and perform better for open-source / FlowCV-competitive quality.

### Delivered
1. **Branch** `fix/react-pdf-fidelity` (was developed in worktree `../flowcv-pdf-worktree`)
2. **Fidelity layer**
   - `src/templates/pdf/shared/pdfUnits.js` — CSS px → PDF pt (`× 0.75`)
   - `src/templates/pdf/shared/pdfPhoto.js` — photo sizes match canvas `templateShared`
   - `PdfPage.jsx` — `resolveTemplateSettings`, `getPageStyle`, `getDocumentProps` (CPWT-CV branding)
   - All template PDFs: Classic, Modern, Minimal, Executive, Sidebar + Cover letter
   - `PdfContact`, `PdfRichText`, `PdfSections` / spacing fixes
   - Classic HTML template now applies `lineHeightValue` on root
3. **Performance**
   - Template chunk cache, font prefetch, hyphenation off
   - `warmPdfExport()` from `Editor.jsx` on template/font change
4. **Docs**
   - `SESSION_LOG.md`, `PROGRESS.md`, `AGENT_MEMORY.md` updated
5. **Verified**
   - `npm run build` OK
   - Playwright `08-pdf-design-fidelity.spec.js` → **8/8**
   - `07-export` + `02-templates` → **63/63**
6. **Merged** into `master` (2026-07-14)

### Not done / next choices for owner
- [ ] Manual visual QA of multi-page long resumes / all templates side-by-side
- [ ] Optionally hide or remove “Export PDF (Legacy)” once happy
- [ ] Dark template still orphaned (seed has `dark`, no `TEMPLATE_MAP` entry)
- [ ] Open-source packaging: LICENSE, `.env.example`, README accuracy
- [ ] Job tracker still localStorage-only (no cloud sync)

---

## Key files touched (PDF work)

```
src/utils/pdfExportReactPDF.js
src/pages/Editor.jsx
src/templates/ClassicTemplate.jsx
src/templates/pdf/*
src/templates/pdf/shared/pdfUnits.js      (new)
src/templates/pdf/shared/pdfPhoto.js      (new)
src/templates/pdf/shared/PdfPage.jsx
src/templates/pdf/shared/pdfFontLoader.js
src/templates/pdf/shared/PdfContact.jsx
src/templates/pdf/shared/PdfRichText.jsx
src/templates/pdf/shared/PdfSections.jsx
src/templates/pdf/shared/PdfSectionsOne.jsx
.gitignore  (playwright-report/, test-results/)
docs/knowledge/*
```

---

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
