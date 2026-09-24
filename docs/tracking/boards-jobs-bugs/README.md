---
title: Boards + Job Tracker bug tracker (Lane C)
---

# Boards + Job Tracker — bug tracker (Lane C, branch `boards-jobs-ui`)

Found by WF-1 (`wf_a523cc8e-2ca`, 2026-09-23, at master `8409472`): 4 finders (boards-logic, boards-UX, jobs-logic,
jobs-UX) reported 108 raw findings; one adversarial verifier per area merged duplicates, re-read every cited line,
ran throwaway node scripts where decisive, and refuted what did not hold. **Nothing here is padded.**

| Area | Confirmed | Refuted |
|---|---|---|
| Boards | 31 (1 High · 12 Medium · 18 Low) | 3 |
| Jobs | 41 (1 High · 14 Medium · 26 Low) | 6 |
| **Total** | **72 (2 High · 26 Medium · 44 Low)** | **9** |

Status legend: 🔴 open · ⏸ fixed on `boards-jobs-ui` (not merged) · ✅ merged to master · ✖ not a bug.

| File | Rows |
|---|---|
| [01-boards-high-medium.md](01-boards-high-medium.md) | B-01 … B-13 |
| [01b-boards-low.md](01b-boards-low.md) | B-14 … B-31 |
| [02-jobs-high-medium.md](02-jobs-high-medium.md) | J-01 … J-15 |
| [03-jobs-low.md](03-jobs-low.md) | J-16 … J-41 |
| [04-refuted-and-proposals.md](04-refuted-and-proposals.md) | 9 refuted + the merged proposals |

## Links to the master tracker (`bug-status-r2/`)

These R2 rows are the same defects; Lane C fixes them here. If Lane A lands one on master first, take master into
this branch and mark the row ✅ with Lane A's commit.

| R2 | Here |
|---|---|
| R2-041 | B-02 |
| R2-037 | B-03 |
| R2-140 | B-04 |
| R2-039 | B-06 |
| R2-039 | B-07 |
| R2-098 | B-15 |
| R2-040 | J-02 |
| R2-035 | J-03 |
| R2-039 | J-05 |
| R2-038 | J-06 |
| R2-145 | J-07 |
| R2-036 | J-08 |
| R2-042 | J-09 |
| R2-075 | J-16 |
| R2-102 | J-17 |
| R2-101 | J-20 |
| R2-100 | J-21 |
| R2-099 | J-22 |
| R2-117 | J-23 |
| R2-073 | J-40 |
| R2-156 | J-41 |

## Summary by owner (WF-2)

| Owner | Rows |
|---|---|
| BOARDS-MODEL | B-01, B-02, B-14, B-15, B-23 |
| BOARDS-MODEL (moveIssue maths) + BOARDS-UI-A (drop handling) | B-05 |
| BOARDS-MODEL (export/import fns) + BOARDS-UI-B (UI + PrivacyPage.jsx) | B-04 |
| BOARDS-UI-A | B-03, B-06, B-07, B-09, B-10, B-11, B-12, B-13, B-16, B-17, B-18, B-19, B-20, B-21, B-22, B-24, B-25, B-26, B-28, B-29, B-30, B-31 |
| BOARDS-UI-B | B-08 |
| BOARDS-UI-A (board view) + BOARDS-UI-B (projects page) | B-27 |
| JOBS-FIX | J-01, J-02, J-03, J-04, J-08, J-09, J-10, J-16, J-17, J-18, J-19, J-20, J-21, J-23, J-24, J-26, J-27, J-28, J-29 |
| JOBS-UI | J-05, J-06, J-11, J-12, J-13, J-14, J-15, J-22, J-25, J-30, J-31, J-32, J-33, J-34, J-35, J-36, J-37, J-38, J-39, J-41 |
| KIT (scroll reset in WorkspaceLayout) | J-40 |
| BOARDS-UI-B (PrivacyPage.jsx wording, both features) | J-07 |
