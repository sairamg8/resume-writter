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

## Testing notes

- Firebase env may be missing in CI/local; config comments say to tolerate related noise.
- Prefer injecting localStorage state over going through Google OAuth in E2E.
- Fidelity tests are sensitive to font/layout changes — run after template/PDF edits.

## Gaps

- No unit test runner (Vitest/Jest) configured
- Job tracker has limited/no dedicated Playwright coverage in the numbered specs list (verify before claiming coverage)
- Lint: `npm run lint` (oxlint) — not a substitute for E2E
