# Contributing to CPWT-CV

Thanks for helping. CPWT-CV is a free, open-source résumé and cover-letter builder; everything runs
in the browser, and cloud sync is optional.

## Set up

```bash
corepack enable
yarn install
yarn dev            # http://localhost:5173
```

Firebase keys are optional (see the README). The PDF test suites need Poppler and MuPDF:
`sudo apt install poppler-utils mupdf-tools` on Debian or Ubuntu.

Read [`docs/knowledge/INDEX.md`](docs/knowledge/INDEX.md) first: it maps the architecture, the data
model and where each feature lives.

## How a change is made here

1. **A failing test first.** Every bug fix starts with a test that fails on the current code and
   passes with the fix. Tests that render a PDF or need Vite's loader go in `tests/pdf/`
   (`NN-topic.test.mjs`, using `tests/pdf/harness.mjs`); plain modules go in `tests/unit/`
   (`topic.unit.mjs`). Open the file with a short comment saying what it pins and why.
2. **Fix the root cause, minimally,** in the style of the surrounding code. The preview is the PDF,
   so a change to what prints usually needs the PDF, Word, Markdown and ATS-text exporters to agree:
   check them all.
3. **Run what you touched:** `node --test <files>` for the suites that cover your change,
   `yarn lint`, and `yarn build`. The full suite is heavy; CI runs it in four shards.
4. **Commit messages** say what now happens, in plain words, with the tracker ID when there is one:
   `fix(word): dates end at the right margin on every paper size (R2-114)`.
5. **Keep the tracker true.** Bugs live in [`docs/tracking/bug-status.md`](docs/tracking/bug-status.md)
   and its sub-files. Set a row's status in the same change that fixes it, and re-total the summary.

## Rules

- Never skip, disable or delete a test to get a green run.
- No personal data in fixtures, screenshots or evidence: use fictional people.
- Don't commit `.env.local` or anything under `private/`.
- User-facing copy says **CPWT-CV**.

## Reporting a bug

Open an issue with the steps to reproduce, what you expected and what happened. If it's about the
PDF, attach a backup JSON (Export → Export Backup JSON) of a fictional résumé that shows it.
