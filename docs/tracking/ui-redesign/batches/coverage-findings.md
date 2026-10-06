# Coverage critic: findings on the revised 24-batch plan (2026-10-06, second pass)

Method: `coverage-check.mjs` (this folder) parses every table row of the 7 parity files, resolves each batch's `parityOwned` ranges against them, and checks tests, boards, files, parked lists and the doneCriteria negative-twin lists. It now reads `plan-work/final.json` (the plan plus rejected list) and accepts sub-batch ids such as B5a. Nothing was run except this script.

## Verdict

Row-level coverage is CLEAN after the split of seven batches into pairs (B5a/B5b, B8a/B8b, B9a/B9b, B10a/B10b, B12a/B12b, B13a/B13b, B14a/B14b): 1,223 distinct row IDs, every one owned by exactly one batch, every one listed by ID (each catch-all resolves to zero rows today), no range matches no rows, no range has a numbering gap, no row is owned twice, no table row lacks an ID, all 524 CHANGED/MISSING rows have an owner, all test names in `testsToUpdate` exist, every cluster path exists or is declared new, no two clusters of one batch own the same file, all 39 canvas boards are named by some batch (Paper in B8b, Letter in B9a).

The catch-all rules now point at the FIRST sub-batch of a split area: editor-content B6, editor-design-templates B8a, editor-letter-ats-export B10a, shell-docs B5a, applications B13a, projects B15, mobile B17.

## First-pass findings and how the plan answers them

1. Negative-twin lists in `doneCriteria`: fixed. B4 now names EDIT-005/025/150 and MOBI-074; B15 names PROJ-225; B3 no longer cites EDIT-025; B7 words EDIT-169 as a RESTYLED row pinned by a test; B17 names SHEL-114. Section 10d of the report shows every batch's list equal to the CHANGED rows it owns.
2. `parkedForOwner` digest: nine items added (ELAE NEW-06 and NEW-19, mobile D-09, projects D-07, D-13 and D-14, shell-docs D-11, D-14 and D-17); mobile D-09 is also in B8b's parked list. Section 10c reports no PARK item uncited by its owning batch.
3. B3 owns editor-content NEW-001: now in B3's parked list.
4. Fix cells that are canvas instructions (137 rows starting 'Draw', 22 rows of only 'Same.'/'Keep.'/'Draw.'): `tools/brief.mjs` (B1) prints them as 'Build from the live behaviour; no board, or the board differs: design from tokens' beside the live-behaviour cell; the plan's canvasCorrections says so.
5. EDIT-089: listed in B3's layout-deltas table as 'live rule kept, owner call', with a negative twin on the Resume switch.
6. Boards Paper and Letter: named in B8b and B9a render checks.
7. New in this pass: the brief tool also computes each batch's 'tests that go red' by grepping touched files and labels across tests/ and cypress/; MOBI-160 (hover-only hints) has one verifying owner (B8b) and the brief lists which batch builds which part (B3, B6, B8b, B10b).

Informational (unchanged): B14a parks projects D-02 (key chip, display-only); B6 parks mobile D-12, B7 mobile D-21 and B5b shell-docs D-11, which the audit marks 'BUILD if the owner agrees'; they follow the single 'display-only additions' owner call.
