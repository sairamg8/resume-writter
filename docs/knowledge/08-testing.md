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
- `tests/pdf/preview-stub.mjs` — a stand-in pdf.js for `PdfPreview`'s mechanics
- `tests/pdf/parity/` — the registry of every control the editor's panels write (`registry*.mjs`)
  and the matrix that checks each one in the PDF and Word; `00-registry` fails for a control with none
- `tests/fixtures/` — fictional sample résumés

`tests/pdf/11-photo.test.mjs` paints pages through `@napi-rs/canvas` (a devDependency).

## Scripts

```bash
yarn test         # node --test: the PDF suites and the unit suites
yarn test:pdf     # the PDF suites only
yarn test:unit    # the unit suites only
yarn test:pw      # production build, then Playwright
yarn test:e2e     # e2e build, then Cypress
yarn lint         # oxlint
```

The PDF suites need Poppler and MuPDF (`poppler-utils`, `mupdf-tools` on Debian/Ubuntu); some
measure what Poppler 26.01 does, so CI runs them on Ubuntu 26.04.

## CI

`.github/workflows/ci.yml` runs on every push to master and on a manual dispatch: the node suite
(sharded), the production build, Playwright, oxlint on `src tests cypress`, and Cypress. A dispatch
can name what to run instead — `tests` (node test files), `failfirst` (`sha:test,…` pairs: the
commit's `src/` changes, yarn patch and yarn.lock are undone and its tests must fail, then pass with
them), `playwright` and `cypress` (spec files, or `none`). Sessions and agents run tests only there,
never on their own machine (the owner, 2026-09-24; `docs/tracking/CLUSTER-PROTOCOL.md`).

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
