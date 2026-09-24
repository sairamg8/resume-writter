import { defineConfig, devices } from '@playwright/test';

// The browser suite runs against a BUILT app (R2-153): `yarn test:pw` builds ./dist first, and GitHub CI
// (.github/workflows/ci.yml) serves its build job's ./dist. PW_DIST (another build to serve) and PW_PORT
// (a free port, so two checkouts' runs never share a server) point elsewhere; neither set: ./dist on 4173.
const PORT = Number(process.env.PW_PORT) || 4173;
const DIST = process.env.PW_DIST || 'dist';

export default defineConfig({
  testDir: './tests/playwright',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    headless: true,
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `./node_modules/.bin/vite preview --outDir "${DIST}" --port ${PORT} --strictPort --host 127.0.0.1`,
    port: PORT,
    // Only a local run on the default port may reuse a server already up; a gate's own port never does.
    reuseExistingServer: !process.env.PW_PORT,
    timeout: 30_000,
  },
});
