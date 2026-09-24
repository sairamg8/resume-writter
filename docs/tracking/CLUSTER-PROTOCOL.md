# Cluster protocol — how a bug cluster is fixed (2026-09-24)

The open rows in this folder's trackers are split into **clusters**, one per subsystem. Each cluster is
fixed by one cloud session on its own branch `claude/wf-<cluster>`; a coordinator session merges every
branch into the work branch `claude/confident-goldberg-2uig8b` (it was `claude/beautiful-heisenberg-x3bsvo` in
Round 1, until `859c3c7`), updates the tracker rows and totals, runs the full CI on
GitHub (Actions → ci → Run workflow on that branch), and deletes the `claude/wf-*` branch once merged.
The cluster list and its state: [HANDOFF.md](HANDOFF.md).

## Set-up

```bash
corepack enable && yarn install --immutable     # for oxlint and reading node_modules — not for running tests
```

- **Tests run only on the CI pipeline (the owner, 2026-09-24): never on your machine or in a subagent's
  worktree.** Push your branch, then dispatch `ci.yml` on it with the GitHub MCP tool
  `actions_run_trigger` (method `run_workflow`, workflow_id `ci.yml`, ref `claude/wf-<cluster>`) and read
  the result with `actions_list` (`list_workflow_runs` / `list_workflow_jobs`) and `get_job_logs`:
  - `inputs: { tests: "tests/pdf/xx-a.test.mjs tests/unit/b.unit.mjs" }` runs just those files on one
    machine (Ubuntu 26.04, Poppler 26.01 — the versions the suite is measured on) in a few minutes;
  - `inputs: { failfirst: "<sha>:tests/pdf/xx-a.test.mjs,tests/unit/b.unit.mjs <sha2>:…" }` proves each fix
    commit's tests fail without its src/ changes and pass with them;
  - `inputs: { playwright: "tests/playwright/x.spec.mjs", cypress: "cypress/e2e/y.cy.js" }` for browser
    specs (`none` skips them; left empty with no tests/failfirst they all run, as does the whole suite).
  Batch what you need into one dispatch where you can; runs on one branch no longer cancel one another.
- Push after every commit: `git push -u origin claude/wf-<cluster>`, so nothing is lost if the container
  restarts. Push only to your own branch — never master, never another branch, never `--force`.

## For each row

The rows live in `docs/tracking/bug-status-r2/01-high-medium.md` (High/Medium), `02-low.md` (Low) and
`03-features-and-test-gaps.md`. `grep` each ID and read its row in full: the Defect column names
`file:line` and a Repro; line numbers may have drifted. How the app works: `docs/knowledge/`
(`09-file-map.md` maps the files). Contributor rules: `CONTRIBUTING.md`.

1. **Confirm it still reproduces at HEAD**, by a test or by reading the code. Rows were filed on
   2026-09-23; some were fixed since, and some duplicate one another or a row already marked ✅ Fixed (read
   the ✅ rows in the same files, and `git log --oneline -- <file>`).
2. **If it does not reproduce**, is a duplicate, is not a bug, or is a known limit that cannot be fixed:
   no code change; record the outcome with concrete proof (the commit that fixed it, the row it duplicates,
   the reason).
3. **Otherwise a test that fails first**, then the fix, then watch the test pass. Tests go where the repo
   puts them: `tests/unit/<name>.unit.mjs` for modules node imports directly; `tests/pdf/<prefix>-<name>.test.mjs`
   when you need the PDF harness (`tests/pdf/harness.mjs` renders résumés with the app's own react-pdf code
   through Vite's SSR loader and reads them back) or Vite's loader for JSX and `@/` imports. Reuse the
   neighbouring helpers (`tests/pdf/harness.mjs`, `extractors.mjs`, `fake-dom.mjs`, `fake-firestore.mjs`,
   `tests/unit/ui-dom-harness.mjs`). Use your cluster's prefix for new `tests/pdf` files. Open each test
   file with a short comment naming the row and the behaviour it pins, as the existing tests do.
4. **Fix the root cause, minimally,** in the style of the surrounding code: its naming, idiom and comment
   voice (comments say why, in plain words). Don't refactor beyond what the row needs; keep behaviour for
   everything the row doesn't cover. The preview is the PDF, so a change to what prints usually needs the
   PDF, Word, Markdown and ATS-text exporters to agree — check them.
5. **Test on CI**: your new tests plus the existing test files that exercise the code you changed (`grep -rl`
   the module name in `tests/`) go in one dispatch's `tests` input, and each fix commit with its tests in
   `failfirst`. Everything you touch must pass, except proven baseline failures (a failure the same run
   shows on the base commit too: dispatch on the base with the same `tests`).
6. **Commit** one commit per row, or one per group of rows with a single root cause. Style (see `git log`):
   `fix(<area>): <what now happens, in plain words> (R2-0xx)`, or `test(<area>): …` / `feat(<area>): …`.
   End every message with these two trailer lines after a blank line:

   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/<your own session id>
   ```

   Use the Claude-Session line your own session's instructions give you; if they give none, use the
   coordinator's, `https://claude.ai/code/session_01UaZc6yUjHdoanpnUfTnzFF`.

## Rules

- Do **not** edit anything under `docs/tracking/`: the coordinator updates the tracker from your report.
- Never skip, disable or delete a test to make it pass. If an existing test pins the behaviour a row calls
  a bug, change that assertion only when the row clearly says so, and say so in your report.
- No private data: fixtures are fictional people.
- Run `./node_modules/.bin/oxlint <changed files>` and fix what it reports in your changes.
- A row that is really a feature-sized job: do the safe core that fixes the user-visible defect, report
  the rest as remaining.
- Don't open a pull request.

## Review before you finish

When every row is handled, spawn **one independent reviewer subagent** (the Agent tool) and give it your
branch, your base commit, your per-row report, and this brief:

> Adversarially review this branch; assume each claim is wrong until you see it hold. For each fixed row:
> read the row (grep its ID in docs/tracking/bug-status-r2/) and the diff (`git log -p <base>..HEAD`). Does
> the change fix the defect at the root for every case the Repro names, without breaking other templates,
> other exporters, other callers of a changed function, or older stored data? Fail-first, on CI only (the
> ci workflow's `failfirst` input, see Set-up): each fix commit's tests must fail without its src/ changes;
> strengthen any test that passes without its fix. Run every added or changed test file plus the existing
> tests of the changed modules on CI (the `tests` input) — never locally. Check that each
> closed row's proof is true. Run oxlint on the changed files. Fix every real problem you find (commit with
> the same style and trailers), and report the issues and any row whose outcome should change.

Check its fixes, push.

## Finish

Last of all — after the review, with everything committed and pushed — write `wf-reports/<cluster>.json`:

```json
{
  "cluster": "<cluster>",
  "branch": "claude/wf-<cluster>",
  "base": "<base sha>",
  "rows": [
    { "id": "R2-0xx", "outcome": "fixed | partial | already-fixed | duplicate | not-a-bug | known-limit | not-fixed",
      "commits": ["<short sha>"], "tests": ["tests/..."],
      "summary": "1–3 sentences in the tracker's **Now:** voice: what now happens, or the proof for a closed row",
      "remaining": "what is left, for partial / not-fixed" }
  ],
  "review": { "issues": ["…"], "fixedByReviewer": ["…"] },
  "baselineFailures": ["tests that also fail on the base code"],
  "notes": "anything the coordinator must know (new bugs found, risky spots)"
}
```

commit it as `chore(wf): <cluster> cluster report`, and push. That file's arrival on the branch is how the
coordinator knows the cluster is done, so write it only when everything else is committed and pushed.
