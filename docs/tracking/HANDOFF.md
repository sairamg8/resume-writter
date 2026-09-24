# Session Handoff — Resume Here

> **Updated 2026-09-24 (cloud session, branch `claude/beautiful-heisenberg-x3bsvo`).** This section is the
> live resume cursor for the "fix every open row" session. It is rewritten and pushed after every merge,
> so a cold start reads the state here and carries on. Older handoffs follow below.

## 2026-09-24 — fix every open tracker row (in progress)

**Goal (owner):** fix every open bug in `docs/tracking/` (149 open at `504b313`), then improve the app.
**Base:** `504b313` (master, CI green). **Work branch:** `claude/beautiful-heisenberg-x3bsvo` (pushed; CI
runs on master only, so nothing deploys from here).

### How the work is split

Round 1 — defects, 14 clusters, each fixed by **its own cloud session** (its own machine) on branch
`claude/wf-<cluster>`, following [CLUSTER-PROTOCOL.md](CLUSTER-PROTOCOL.md): fail-first test → fix → commit
→ push, an independent reviewer subagent, then `wf-reports/<cluster>.json` as the last push (its arrival
means the cluster is done). Sessions do not edit `docs/tracking/`; the coordinator
(session_01PdF933BaDvYDh7KFAJpkKi) merges each branch into the work branch, updates the tracker rows and
totals, runs CI on GitHub (workflow_dispatch on the work branch), and deletes the `claude/wf-*` branch.
The owner approved the temporary `claude/wf-*` branches on 2026-09-24 12:47.

| Cluster | Rows | Session | State |
|---|---|---|---|
| ats | R2-020 021 022 023 024 025 027 078 079 080 081 163 166 | session_01GG1ULRf3BEFijyNRzXNJoT | running (5 fixes carried over) |
| pdf-pagination | R2-046 047 048 049 104 109 111 | session_013Hg3VSwaVkaQmNCkotTNsb | running |
| design-sidebar | R2-013 051 059 082 083 087 088 089 090 096 119 120 121 123 | session_014y3tSMD21g1ji9Ct73pZQh | running (4 fixes carried over) |
| word | R2-061 065 066 070 114 118 124 125 126 128 132 | session_01Kms1vF1NWaaH7yWz6e2UWr | running (2 fixes carried over) |
| text-exports | R2-026 034 052 053 054 058 060 064 122 129 131 | session_01YUpaiGLx34s4T8huDzmJNW | running |
| jobs | R2-035 036 038 039 040 042 075 099 100 101 102 156 | session_01TxTRPE1CXJu54unwVCNutZ | running |
| app-shell | R2-050 071 072 073 074 076 077 084 086 144 | session_01S681bgs4qE2ric3C7MivaC | running |
| boards | R2-037 041 098 155 159 | session_01AeqejztN2Vs4b4cpnBNrnU | running |
| preview | R2-106 107 170 165, R3-005 | session_01JqQBbPVCVC4WNbFTi77bQ2 | running |
| import-data | R2-031 055 056 110 085 091 117 093 094 095 097 | session_01174H7ZETLrGKWfVVXQdWmd | running |
| sections | R2-057 069 127 108 112 113 115 116 150 151 | session_01WXhjKL5tbvAFuBeRpZ6c4d | running |
| sync | R2-028 029 030 | session_01CkkXUYrb8NXsPv4VYVH4MX | running |
| letter | R2-043 044 092 103 130 134 068 133 | session_019D9Rn4N2nqJnTSeZgxodBg | running |
| pdf-text | R2-045 105, R3-002 003 004 | session_01SUaj4fLPe8rVZ9g2kGSu6H | running |
| cypress | R2-152 161 162 | coordinator's own machine (workflow wf_f5efdc0c-440, local branch `wf/cypress`) | running |

Done outside the clusters: `12c2a71` — LICENSE, CONTRIBUTING, README, knowledge docs (R2-143, R2-169, partial);
`e6796ec` — CI gains lint and Cypress jobs, and a working branch is gated by workflow_dispatch (R2-152, R2-154).

Round 2 — features and test gaps not in a cluster: R2-135 136 137 138 139 140 141 142 145 146 147 148
149, R2-152 154 157 158 161 162 167 168 171; plus a lint step in CI and the 21 oxlint warnings.

**Owner, 2026-09-24 12:35:** once the running clusters finish, start nothing new — the owner restarts the
session first. Round 2 begins only after that restart.

### If this session was cut off

1. `git fetch origin claude/beautiful-heisenberg-x3bsvo && git checkout claude/beautiful-heisenberg-x3bsvo`.
2. Read the table above: a cluster marked **merged** is on the branch and in the tracker. The others are
   on GitHub as `claude/wf-<cluster>`; their sessions run on their own machines and survive this one's
   restart. A branch with `wf-reports/<cluster>.json` is finished and ready to merge.
3. Local set-up: `corepack enable && yarn install --immutable`; `apt-get install poppler-utils mupdf-tools`.
   Local Poppler is 24.02 (CI: 26.01), so a few word-gap tests can differ locally; CI on master is the judge.

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
