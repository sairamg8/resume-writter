# 08 — Testing

## Suites

| Suite | Where | Runner | What it checks |
|-------|-------|--------|----------------|
| PDF | `tests/pdf/**/*.test.mjs` | `node --test` | renders résumés with the app's own react-pdf code and reads the PDFs back (pdf.js, Poppler's `pdftotext`, MuPDF's `mutool`) — layout, text, every template, the exporters, and components over a fake DOM |
| Unit | `tests/unit/*.unit.mjs` | `node --test` | modules Node imports as they are (no `@/` aliases, no JSX) |
| Playwright | `tests/playwright/*.spec.mjs` | Playwright, against a built `./dist` | the preview is the downloaded PDF, and every design control repaints it |
| Cypress | `cypress/e2e/*.cy.js` | Cypress, against the e2e build | end to end: dashboard, editor, exports, job tracker, demo accounts |

Helpers the PDF and unit suites share:

- `tests/pdf/harness.mjs` — Vite's SSR loader in middleware mode (so `@/` imports and JSX load
  unchanged), `resume()` / `section()` builders, `render()` / `renderCover()` / `renderDocx()`,
  `read()` / `readDocx()`, `loadModule()`, and `TEMPLATES` (every template the app offers)
- `tests/pdf/extractors.mjs` — text as pdf.js and `pdftotext` read it; what page 1 paints besides text
- `tests/pdf/fake-dom.mjs`, `tests/unit/ui-dom-harness.mjs` — just enough DOM for react-dom to mount
  a component in Node
- `tests/pdf/fake-firestore.mjs` — an in-memory Firestore for the cloud-sync tests
- `tests/pdf/fake-fontsource.mjs` — a stand-in for Fontsource's CDN (jsDelivr) for a test that prints in a web
  font: `fakeFontsource()` answers the metadata and faces of the picker fonts, Gelasio, Bebas Neue and the symbol
  fonts (real WOFF bytes from the bundled Noto Sans, named per face), fails loudly on any URL it does not know and
  refuses every connection beyond this machine, so `05-fonts` cannot fail on a slow CDN
- `tests/pdf/preview-stub.mjs` — a stand-in pdf.js for `PdfPreview`'s mechanics (a test can wrap its
  `getDocument` to log paint and text requests, as `115-r2-142-perf5-*` does)
- `tests/pdf/parity/` — the registry of every control the editor's panels write (`registry*.mjs`)
  and the matrix that checks each one in the PDF and Word; `00-registry` fails for a control with none
- `tests/pdf/startup-modules.mjs` — the start-up path by module, walked from `src/main.jsx` through static
  imports only, so a test can name a module that must stay lazy (`71-startup-public-link-lazy`,
  `122-startup-json-resume-export-lazy`); `71-startup-chunks` weighs the built chunks and logs the kB left
  under the 1,100 kB cap
- `tests/fixtures/` — fictional sample résumés

`tests/pdf/11-photo.test.mjs` paints pages through `@napi-rs/canvas` (a devDependency).

## Scripts

```bash
yarn test         # node --test: the PDF suites and the unit suites
yarn test:pdf     # the PDF suites only
yarn test:unit    # the unit suites only
yarn test:pw      # production build, then Playwright
yarn test:e2e     # e2e build, then Cypress
yarn test:perf    # the performance budgets (tests/perf): never part of yarn test or the CI gate
yarn lint         # oxlint
```

The PDF suites need Poppler and MuPDF (`poppler-utils`, `mupdf-tools` on Debian/Ubuntu); some
measure what Poppler 26.01 does, so CI runs them on Ubuntu 26.04.

## CI

`.github/workflows/ci.yml` runs on every push to master and on a manual dispatch: the node suite
(sharded), the production build, Playwright, oxlint on `src tests cypress`, and Cypress. A dispatch
can name what to run instead — `tests` (node test files), `failfirst` (`sha:test,…` pairs: the
commit's `src/` and `vite.config.js` changes, yarn patch and yarn.lock are undone and its tests must
fail, then pass with them), `playwright` and `cypress` (spec files, or `none`), and `perf` (the budgets
below: only that runs). Sessions and agents run tests only there,
never on their own machine (the owner, 2026-09-24; `docs/tracking/CLUSTER-PROTOCOL.md`).

## Performance budgets

`tests/perf/` is the performance harness (R2-142, PERF-1). `yarn test:perf` (`node tests/perf/run.mjs`)
measures what an edit costs, holds each number to a budget written in `tests/perf/budgets.mjs`, prints
the table and exits 1 when one is missed (2 when the harness itself failed). It is not part of `yarn test`
and never of the CI gate. It measures four groups, `--only=render,keystroke,startup,browser` (or `all`;
the default is all but `browser`):

| Group | Measures |
|-------|----------|
| `render` | N1: the PDF build (`renderResumePdf`, `renderCoverLetterPdf`) of a 1-page and of a large (3+ page) résumé, median of 7 warm builds |
| `keystroke` | one Summary keystroke on the large résumé as far as Node reaches: build the PDF, open it in pdf.js, read every page's text, paint every page (`@napi-rs/canvas`), without the preview's 350 ms debounce |
| `startup` | the start-up path of a production build (entry, static imports, index.html's preloads, built in memory as `71-startup-chunks` does): script kB, gzipped kB, largest chunk, and the PDF or Word library modules on it (none) |
| `browser` | Gate A in Chromium against a built `./dist` (`yarn build`, `npx playwright install chromium`): 20 keys into Summary at 150 ms a key, then the last key to the pages that show it, the longest main-thread task, and the first pages after opening the editor |

Other options: `--strict`, `--slack=N`, `--runs=N`, `--warmups=N`, `--dist=DIR`, `--json` (`--help` lists
them). Each timing has two figures in `budgets.mjs`: `max`, the CI ceiling a run is held to (a shared
runner is several times slower than the laptop the plan was measured on and noisy from run to run, so the
ceilings catch a build several times slower, not a few percent), and `target`, the plan's figure for a quiet
machine, which `--strict` holds it to; `--slack=2` (or `PERF_SLACK=2`) doubles the timing ceilings on a slow
box. Sizes and counts have an exact `max`. A measurement without a budget fails, so nothing is timed that
nobody limited. Tighten a ceiling from what a few dispatched runs print; never loosen one to pass. The
plan's N2 (a WOFF face inflates its glyf table once, however many builds) is not timed: it is counted, in
the gate, by `tests/pdf/97-woff-glyf-once.test.mjs`.

`tests/perf/budget-check.mjs` is the pure part (statistics, limits, the table, the options, the start-up
graph); `tests/unit/perf-budget-check.unit.mjs` pins it, the budgets' shape, and that the workflow runs the
job only on a dispatch that sets `perf`. In CI: Actions → ci → Run workflow with `perf` = `node`, `browser`
or `all`; only that job runs, and its table is on the run's summary. With `browser` or `all` the job then
runs Gate B, `tests/playwright/perf-gate-b.spec.mjs` (PERF-6: the longest main-thread task and key delay
while typing on a long résumé, with the PDF worker and with it refused; soft targets of 50 ms), which the
Playwright gate skips unless `PERF_GATE_B=1`; its two result lines are on the summary too.
The PDF worker's watchdog and the preview's paint-before-text and canvas pool are pinned in the gate by
`tests/pdf/126-r2-142-pdf-worker-watchdog.test.mjs` and `tests/pdf/115-r2-142-perf5-preview-paint-order-canvas-reuse.test.mjs`.
The typing-freeze fixes (2026-10-05, `docs/tracking/TYPING-FREEZE-HUNT-2026-10-05.md`) by
`tests/pdf/110-dev-pdf-worker-no-refresh.test.mjs` (the dev server serves the worker no Fast Refresh runtime; it
starts the dev server in-process), `tests/pdf/111-preview-one-build-at-a-time.test.mjs` and
`tests/pdf/116-preview-status-undo-hidden.test.mjs` (the preview's queued build and its status),
`tests/pdf/112-pdf-worker-watchdog.test.mjs` (the hunt's watchdog cases on the one watchdog, and the main thread's
budget), `tests/pdf/113-font-load-stall.test.mjs` (the bounded font wait) and
`tests/pdf/114-keystroke-burst.test.mjs` and `tests/pdf/117-keystroke-burst-signed-in.test.mjs` (React error #185; the
second mounts `useCloudSync` signed in over the stand-in Firestore, `_setCloudIoForTest`).

## Demo accounts and the owner's private résumé

`tests/unit/demo-seed.unit.mjs` covers the demo-account rules in `src/utils/demoSeed.js` (which
originals come back, and the dev-only import of the owner's private résumé).
`tests/pdf/24-private-data.test.mjs` builds production and e2e and checks that no text of the
git-ignored `private/sairam-resume.json` is in either bundle (skipped, with a message, where the
file is absent); it also runs `vite-plugin-owner-resume.js` on a dev server and in a build.
A `*.unit.mjs` file's module under test has no `@/` imports, so Node loads it as it is.

## Cypress: e2e builds and the fake sign-in

`yarn test:e2e` builds with `vite build --mode e2e`. That build behaves like production except
for one seam (`src/utils/firebase.js` → `e2eUser`): a page that finds `cpwtcv_e2e_user` (a JSON
user such as `{ "uid": "e2e-owner", "email": "…" }`) in localStorage at load starts signed in as
that user and **without Firebase**, so it never reaches a real project. Pages without the key
keep the configured Firebase, so the real sign-in button still renders for the header tests. In
a production build `e2eUser` is always null and the key does not appear in the bundle.
`cypress/e2e/11-demo-account.cy.js` uses it for the owner / another account / signed out — the
owner's originals come back (never the samples) — and `11-demo-account-keep.cy.js` for the controls:
"Keep as my original", "Import as my original", Delete on an original. Their steps (the fake
sign-in, a store of named résumés) are in `cypress/support/demoAccount.js`.

Run by hand: `npx vite build --mode e2e --outDir <scratch>/dist-e2e` →
`npx vite preview --outDir <scratch>/dist-e2e --port 4173` → `npx cypress run --e2e`.

## Testing notes

- No Firebase values are needed: a build without them runs local-only, and the e2e build's fake
  sign-in above stands in for Google.
- Prefer injecting localStorage state over going through Google OAuth in E2E.
- Fidelity tests are sensitive to font/layout changes — run them after template/PDF edits.
- `tests/unit/knowledge-docs.unit.mjs` fails when these docs name a `src/` or `tests/` path that is
  gone, or state a `DATA_VERSION` the code no longer has.
