// The app shell opens offline (public/sw.js, registered by src/utils/shellWorker.js), and the worker is safe:
// the built app is served as Cloudflare serves it (n2-dist-server.js: the headers of dist/_headers, so the
// worker runs under the Content-Security-Policy too, and index.html for any path that is no file).
//  - Load online, go offline, reload: the shell renders (from the worker's cache).
//  - A page is network-first: a new deploy's page shows on the next load, never the kept one; and what
//    is kept for offline is then the latest.
//  - A new deploy (sw.js with another build id) replaces the old cache: the old cache is deleted on activation.
//  - Nothing cross-origin (Google sign-in, Firestore), nothing under /__/ and no missing built file (the site
//    answers it with index.html) is kept; the "failed route chunk" recovery (lazyPage.js) still sees the failure.
//  - /sw-kill switches the worker off: caches deleted, unregistered.
// Run: playwright: tests/playwright/564-n2-offline-shell.spec.mjs
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist, DIST } from './n2-dist-server.js';
import { buildTestState, STORAGE_KEY } from '../helpers.js';

test.use({ serviceWorkers: 'allow' });

/** Serves the build with sw.js stamped `build()` and index.html carrying `deploy()` as its deploy number. */
async function serve(state, extra = {}) {
  const site = await serveDist({
    reportUri: true,
    extra,
    rewrite: (pathname, body) => {
      if (pathname === '/sw.js') return Buffer.from(body.toString().replace(/var BUILD = '[^']*';/, `var BUILD = '${state.build}';`));
      if (pathname === '/index.html') return Buffer.from(body.toString().replace('</head>', `<meta name="deploy" content="${state.deploy}"></head>`));
      return undefined;
    },
  });
  return site;
}

/** Loads the dashboard with a seeded résumé, and waits until the worker is active and controls the page. */
async function openAndControl(page, site) {
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state: buildTestState('classic') });
  await page.goto(`${site}/#/`);
  await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
}

/** { cacheName: [paths kept] } */
const kept = (page) => page.evaluate(async () => {
  const out = {};
  for (const name of await caches.keys()) out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname).sort();
  return out;
});

const refused = /content security policy|refused to (load|connect|execute|create|frame|apply|evaluate)|violates the following/i;
function watch(page, site) {
  const seen = [];
  page.on('console', (m) => { if (refused.test(m.text())) seen.push(m.text().slice(0, 200)); });
  return () => [...seen, ...site.reports];
}

test('the build is stamped: dist/sw.js carries this build\'s id, not the placeholder', () => {
  const source = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  expect(source).toMatch(/var BUILD = '[0-9a-f]{10}';/);
  expect(source).not.toContain('__BUILD_ID__');
});

test('load online, go offline, reload: the app shell renders', async ({ page, context }) => {
  const s = { build: 'v1', deploy: 1 };
  const site = await serve(s);
  const violations = watch(page, site);
  try {
    await openAndControl(page, site.url);
    await page.reload(); // controlled now: the files the page loads are kept as they go by
    await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
    await expect.poll(async () => (await kept(page))['cpwtcv-shell-v1']?.includes('/index.html'), { timeout: 15_000 }).toBe(true);
    const files = (await kept(page))['cpwtcv-shell-v1'];
    expect(files.filter((f) => f.startsWith('/assets/') && f.endsWith('.js')).length, 'the entry script and its chunks are kept').toBeGreaterThan(1);

    await context.setOffline(true);
    site.state.down = true;
    const before = site.hits.length;
    await page.reload();
    await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
    await expect(page.locator('#root')).not.toBeEmpty();
    expect(site.hits.length, 'the site was not reached').toBe(before);
    await context.setOffline(false);
    site.state.down = false;
    expect(violations()).toEqual([]);
  } finally {
    await site.close();
  }
});

test('a page is network-first: the new deploy\'s page shows at once, and offline then shows that one', async ({ page, context }) => {
  const s = { build: 'v1', deploy: 1 };
  const site = await serve(s);
  try {
    await openAndControl(page, site.url);
    await page.reload();
    await expect(page.locator('meta[name="deploy"]')).toHaveAttribute('content', '1');
    s.deploy = 2; // a deploy that changes the page, not the worker
    await page.reload();
    await expect(page.locator('meta[name="deploy"]')).toHaveAttribute('content', '2');
    await page.waitForTimeout(500); // the copy is stored as the page goes by
    await context.setOffline(true);
    site.state.down = true;
    await page.reload();
    await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
    await expect(page.locator('meta[name="deploy"]')).toHaveAttribute('content', '2');
    await context.setOffline(false);
    site.state.down = false;
  } finally {
    await site.close();
  }
});

test('a new deploy (another build id in sw.js) replaces the old cache', async ({ page }) => {
  const s = { build: 'v1', deploy: 1 };
  const site = await serve(s);
  try {
    await openAndControl(page, site.url);
    await expect.poll(async () => Object.keys(await kept(page)), { timeout: 15_000 }).toEqual(['cpwtcv-shell-v1']);
    s.build = 'v2';
    s.deploy = 2;
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await expect.poll(async () => Object.keys(await kept(page)), { timeout: 20_000 }).toEqual(['cpwtcv-shell-v2']);
    expect((await kept(page))['cpwtcv-shell-v2']).toContain('/index.html');
  } finally {
    await site.close();
  }
});

test('nothing cross-origin, under /__/ or missing is kept, and a missing built file still fails to import', async ({ page, context }) => {
  const s = { build: 'v1', deploy: 1 };
  const site = await serve(s);
  await context.route('https://identitytoolkit.googleapis.com/**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: '{"ok":true}' }));
  try {
    await openAndControl(page, site.url);
    await page.reload();
    const answers = await page.evaluate(async () => {
      const api = await (await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup')).json();
      await fetch('/__/auth/handler');
      await fetch('/favicon.svg');
      const missing = await import('/assets/Gone-AbCd1234.js').then(() => 'loaded', () => 'failed');
      return { api, missing };
    });
    expect(answers.api).toEqual({ ok: true });
    expect(answers.missing, 'the site answers it with index.html: the import fails, so lazyPage.js reloads the tab once').toBe('failed');
    const all = Object.values(await kept(page)).flat();
    for (const p of ['/__/auth/handler', '/favicon.svg', '/assets/Gone-AbCd1234.js', '/v1/accounts:lookup']) expect(all, p).not.toContain(p);
  } finally {
    await site.close();
  }
});

test('/sw-kill switches the worker off: its caches are deleted and it unregisters', async ({ page }) => {
  const s = { build: 'v1', deploy: 1 };
  const site = await serve(s, { '/sw-kill': 'off' });
  try {
    await page.addInitScript((args) => {
      localStorage.clear();
      localStorage.setItem(args.key, JSON.stringify(args.state));
    }, { key: STORAGE_KEY, state: buildTestState('classic') });
    await page.goto(`${site.url}/#/`);
    await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
    await expect.poll(() => site.hits.includes('/sw-kill'), { timeout: 30_000, message: 'the worker registered and asked' }).toBe(true);
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), { timeout: 15_000, message: 'and removed itself' }).toBe(0);
    expect(Object.keys(await kept(page))).toEqual([]);
    expect(site.hits).toContain('/sw-kill');
  } finally {
    await site.close();
  }
});
