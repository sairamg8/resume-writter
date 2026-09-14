# 08 — Testing

## Framework

- **Playwright** (`playwright.config.js`)
- `testDir: ./tests`
- Auto-starts `npm run dev` at `http://localhost:5173`
- `workers: 1`, `retries: 1`, timeout 45s
- HTML report → `playwright-report/`

## Scripts

```bash
npm test          # npx playwright test
npm run test:ui   # interactive UI mode
```

## Spec inventory

| File | Focus |
|------|-------|
| `01-app.spec.js` | App shell / smoke |
| `02-templates.spec.js` | Template switching |
| `03-sections.spec.js` | Section CRUD |
| `04-sidebar.spec.js` | Sidebar template |
| `05-design.spec.js` | Design panel |
| `06-cover-letter.spec.js` | Cover letter |
| `07-export.spec.js` | Export flows |
| `08-pdf-design-fidelity.spec.js` | PDF vs design checks |

Helpers:

- `helpers.js` — `gotoDashboard`, `gotoEditor`, `injectTestState`, `buildTestState`, …
- `pdf-utils.js` — PDF parsing helpers (`pdfjs-dist` in devDependencies)

## Unit tests (`node:test`, no extra dependency)

```bash
yarn test:unit    # node --test tests/unit/*.unit.mjs
```

`tests/unit/demo-seed.unit.mjs` covers the demo-account rules in `src/utils/demoSeed.js`.
Files are `*.unit.mjs` so Playwright's default `*.test.*` / `*.spec.*` match in `tests/`
never picks them up, and the module under test has no imports so Node loads it as it is.

## Cypress: e2e builds and the fake sign-in

`yarn test:e2e` builds with `vite build --mode e2e`. That build behaves like production except
for one seam (`src/utils/firebase.js` → `e2eUser`): a page that finds `cpwtcv_e2e_user` (a JSON
user such as `{ "uid": "e2e-owner", "email": "…" }`) in localStorage at load starts signed in as
that user and **without Firebase**, so it never reaches a real project. Pages without the key
keep the configured Firebase, so the real sign-in button still renders for the header tests. In
a production build `e2eUser` is always null and the key does not appear in the bundle.
`cypress/e2e/11-demo-account.cy.js` uses it for the owner / another account / signed out.

Run by hand: `npx vite build --mode e2e --outDir <scratch>/dist-e2e` →
`npx vite preview --outDir <scratch>/dist-e2e --port 4173` → `npx cypress run --e2e`.

## Testing notes

- Firebase env may be missing in CI/local; config comments say to tolerate related noise.
- Prefer injecting localStorage state over going through Google OAuth in E2E.
- Fidelity tests are sensitive to font/layout changes — run after template/PDF edits.

## Gaps

- No unit test runner (Vitest/Jest) configured
- Job tracker has limited/no dedicated Playwright coverage in the numbered specs list (verify before claiming coverage)
- Lint: `npm run lint` (oxlint) — not a substitute for E2E
