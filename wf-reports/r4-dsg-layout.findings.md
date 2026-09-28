# r4-dsg-layout — status (work in progress, NOT the cluster report)

Updated 2026-09-28 ~03:00 UTC at 93% of the owner's usage; the owner stopped lanes E/F. Branch `claude/wf-r4-dsg-layout`.
Every row below was confirmed by a second agent before its fix; fixes carry a fail-first test (tests/pdf/103-r4-*).

## Fixed rows and their commits

| Row | Commits | Second-agent review |
|---|---|---|
| R4-DPH-01 | 686f435 | reviewed |
| R4-DPH-02 | c69c42c | reviewed |
| R4-DPH-03 | 914463f | reviewed |
| R4-DPH-04 | 60b2f6e 7a0afd8 | reviewed |
| R4-DPH-05 | f2d9466 | reviewed |
| R4-DPH-06 | 9d87fb3 | reviewed |
| R4-DPH-07 | 64b255d | reviewed |
| R4-DPH-08 | 3ef9d2e | reviewed |
| R4-DPH-09 | 613cc75 | reviewed |
| R4-DPH-10 | 584097c | reviewed |
| R4-DPH-11 | 88143ab 1bb7765 322a9bb 489eabf 6ef9736 b1645f1 70b167e | reviewed |
| R4-DPH-12 | 5274fde | reviewed |
| R4-DPH-13 | 845a9ea | reviewed |
| R4-DPH-14 | 5c9bc63 | reviewed |
| R4-DPH-16 | 86b5ad5 b7c4b3d | reviewed |
| R4-DPH-17 | a697381 | reviewed |
| R4-DPH-18 | 4c56bd0 63db813 | reviewed |
| R4-DPH-19 | 3d1fc23 67e9bec | reviewed |
| R4-DPH-20 | e94c880 96441a6 | reviewed |
| R4-DPH-21 | 7c9e01e | reviewed |
| R4-DPH-22 | 69f129f | reviewed |
| R4-DPH-23 | 0ae1bf0 | reviewed |
| R4-DPH-24 | 88981ae | reviewed |
| R4-DPH-25 | 9da9218 | **not reviewed** (stopped at usage limit) |
| R4-DPH-26 | 3dc10e8 | **not reviewed** (stopped at usage limit) |
| R4-DPH-27 | 7b51259 | reviewed |
| R4-DPH-28 | da47697 | reviewed |
| R4-DPH-29 | f22ec1b 8c0f787 | reviewed |
| R4-DPH-30 | 8e97533 | **not reviewed** (stopped at usage limit) |
| R4-DPH-31 | d7b3175 | reviewed |
| R4-DPH-33 | 7242eea | **not reviewed** (stopped at usage limit) |
| R4-DPH-34 | ad01d3c | **not reviewed** (stopped at usage limit) |
| R4-DPH-35 | 3495e55 | **not reviewed** (stopped at usage limit) |
| R4-DPH-37 | e3b2030 | **not reviewed** (stopped at usage limit) |
| R4-DPH-38 | e3b2030 | **not reviewed** (stopped at usage limit) |
| R4-DPH-39 | 10dc2a5 | **not reviewed** (stopped at usage limit) |
| R4-DPH-40 | d9d39ec | reviewed |
| R4-DPH-41 | d529431 | **not reviewed** (stopped at usage limit) |
| R4-DPH-42 | e4cc82f | **not reviewed** (stopped at usage limit) |
| R4-DVIS-01 | b7c4b3d | reviewed |
| R4-DVIS-02 | d646c6a | reviewed |
| R4-DVIS-03 | 986f90c | reviewed |
| R4-DVIS-04 | 322a9bb e921e90 | reviewed |
| R4-DVIS-05 | f6dd3ba | reviewed |
| R4-DVIS-06 | 489eabf | reviewed |
| R4-DVIS-07 | e3b2030 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-08 | d6116ef | reviewed |
| R4-DVIS-09 | f912de6 62aaf0e | reviewed |
| R4-DVIS-10 | cde38e8 | reviewed |
| R4-DVIS-11 | ef569a5 | reviewed |
| R4-DVIS-12 | 5af9251 aded64d | reviewed |
| R4-DVIS-13 | 38f03da | reviewed |
| R4-DVIS-14 | 806c1c8 | reviewed |
| R4-DVIS-15 | 85c6232 | reviewed |
| R4-DVIS-16 | 29a3d5c | reviewed |
| R4-DVIS-17 | b5112b6 | reviewed |
| R4-DVIS-18 | 7e93c95 | reviewed |
| R4-DVIS-19 | 7d975a3 | reviewed |
| R4-DVIS-20 | 8b708ec | reviewed |
| R4-DVIS-21 | 37315dd | reviewed |
| R4-DVIS-22 | 1595086 | reviewed |
| R4-DVIS-23 | 5f52d43 | reviewed |
| R4-DVIS-24 | e8afbaa | **not reviewed** (stopped at usage limit) |
| R4-DVIS-26 | 3a8770c | **not reviewed** (stopped at usage limit) |
| R4-DVIS-27 | 36d26c0 | reviewed |
| R4-DVIS-28 | 8a17031 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-29 | b02da95 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-30 | abd55dd 7597980 | reviewed |
| R4-DVIS-31 | cae5cc4 b434a9f | reviewed |
| R4-DVIS-32 | b514074 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-33 | 82905e3 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-34 | 24b78d1 | **not reviewed** (stopped at usage limit) |
| R4-DVIS-35 | 3347bca | **not reviewed** (stopped at usage limit) |

## Closed without a change
- R4-DPH-15 (kit Select long option): not a bug — the select is w-full inside a stretched flex column; a long option is clipped inside the native control (second agent's proof).
- R4-DPH-32: same defect as R4-DPH-31 (the Edit | Preview pill over the tabs' bottom); fixed once.

## Not done
- R6b dialogs: R4-DVIS-07 (NewLetterModal, ShareLinkModal on the kit Dialog), R4-DVIS-25 (Cover Letter Generator, Header Icon picker on the kit Dialog) and those dialogs' parts of R4-DPH-30/36/37/38 (16px fields, taller than the screen, footer wrap). The fixer had committed nothing when the lane was stopped.
- Second-agent review of groups R3 (dashboard), R5 (Design/Cover Letter/ATS panels), R6a (Bullet Optimizer) — their fixes are merged with tests; CI fail-first is the check.
- Low extras noted by confirmers, not rowed: the Overview's click-to-edit input is hand-rolled (job/Field.jsx); JobForm's 'Job not found' is a text link, not EmptyState; Quick-search results have no max height on short screens; the Projects table's Name cell cannot truncate.

## Merged in
- `claude/wf-r4-dsg-flow` (finished cluster) at 1761511, so the JobForm and dialog rows build on its final files.

## CI
- Lanes A, B, C: all fail-first checks proven (three test bugs fixed: 322a9bb, 1bb7765, 88143ab).
- Pending: full gate and fail-first of lanes D, E, F on the current head.

## Next
1. Read the CI runs; fix what fails.
2. Merge the latest claude/awesome-cerf-t3sh88, re-run the gate.
3. Write wf-reports/r4-dsg-layout.json (the coordinator's done signal).
