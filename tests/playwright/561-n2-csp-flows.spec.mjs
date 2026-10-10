// The site's Content-Security-Policy (public/_headers) must be one the whole app works under: the built app is
// served with the headers of dist/_headers (n2-dist-server.js, as Cloudflare's static assets answer), and each
// main flow runs with every violation watched — the page's securitypolicyviolation events, the console's
// "Refused to ..." lines, and the browser's own reports (report-uri), which also cover the PDF worker and
// pdf.js's worker, where no page event fires. Not one may appear: home, the editor (PDF worker, WebAssembly
// layout, pdf.js preview, a font from jsDelivr), Export PDF and Word, the Job Tracker, Projects and a public
// résumé link. The last test shows the watcher sees a violation (eval, an inline script, a fetch to a site
// the policy does not name), so an empty list is a proof and not a blind spot.
// Run: playwright: tests/playwright/561-n2-csp-flows.spec.mjs
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { serveDist, DIST, headersFile } from './n2-dist-server.js';
import { buildTestState, STORAGE_KEY } from '../helpers.js';

let site;
test.beforeAll(async () => { site = await serveDist({ reportUri: true }); });
test.afterAll(async () => { await site.close(); });

const NOTO = path.resolve('node_modules/@fontsource/noto-sans');

/** jsDelivr, answered here (a CI machine may have no route to it): Noto Sans' files under any package's name. */
async function fakeJsDelivr(context) {
  await context.route('https://cdn.jsdelivr.net/**', (route) => {
    const url = new URL(route.request().url());
    const cors = { 'access-control-allow-origin': '*' };
    if (url.pathname.endsWith('/metadata.json')) {
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: fs.readFileSync(path.join(NOTO, 'metadata.json')) });
    }
    const m = url.pathname.match(/-(\d+)-(normal|italic)\.(woff2?)$/);
    if (!m) return route.fulfill({ status: 404, headers: cors, body: 'no' });
    const file = path.join(NOTO, 'files', `noto-sans-latin-${Number(m[1]) >= 600 ? 700 : 400}-${m[2]}.${m[3]}`);
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': m[3] === 'woff2' ? 'font/woff2' : 'font/woff' }, body: fs.readFileSync(file) });
  });
}

/** Starts watching `page`; the returned function lists every violation seen so far (after the reports have arrived). */
async function watch(page) {
  const seen = [];
  const refused = /content security policy|refused to (load|connect|execute|create|frame|apply|evaluate)|violates the following/i;
  page.on('console', (m) => { if (refused.test(m.text())) seen.push(`console: ${m.text().slice(0, 240)}`); });
  page.on('pageerror', (e) => { if (refused.test(e.message) || /EvalError/.test(e.name)) seen.push(`pageerror: ${e.message.slice(0, 240)}`); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}`);
    });
  });
  const before = site.reports.length;
  return async () => {
    await page.waitForTimeout(700); // the browser sends its reports a moment after the event
    const events = await page.evaluate(() => window.__csp || []).catch(() => []);
    const reports = site.reports.slice(before).map((r) => `report: ${r.slice(0, 240)}`);
    return [...seen, ...events.map((e) => `event: ${e}`), ...reports];
  };
}

/** Seeds the résumé store with `state` on every load of `page`. */
async function seed(page, state) {
  await page.addInitScript((args) => {
    localStorage.clear();
    localStorage.setItem(args.key, JSON.stringify(args.state));
  }, { key: STORAGE_KEY, state });
}

test('the page is served with the policy of dist/_headers, and it has no inline script', async ({ page }) => {
  const res = await page.goto(`${site.url}/`);
  const served = res.headers()['content-security-policy'];
  const file = headersFile(DIST).find(([k]) => /^content-security-policy$/i.test(k))?.[1];
  expect(file, 'dist/_headers sets a Content-Security-Policy').toBeTruthy();
  expect(served.startsWith(file)).toBe(true);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    expect(attrs, 'every script of the page has a src').toMatch(/\bsrc=/);
    expect(body.trim(), 'and no body').toBe('');
  }
});

test('home: the dashboard and the legal pages open under the policy', async ({ page }) => {
  const violations = await watch(page);
  await page.goto(`${site.url}/#/`);
  await page.waitForSelector('[data-testid="resume-card"]', { timeout: 20_000 });
  await page.goto(`${site.url}/#/terms`);
  await page.getByRole('heading', { name: 'Terms and Conditions' }).waitFor({ timeout: 20_000 });
  await page.goto(`${site.url}/#/privacy`);
  await page.getByRole('heading', { name: 'Privacy Policy' }).waitFor({ timeout: 20_000 });
  expect(await violations()).toEqual([]);
});

test('editor: the preview is built in the PDF worker (WebAssembly layout, fonts from jsDelivr) and painted by pdf.js', async ({ page, context }) => {
  await fakeJsDelivr(context);
  const violations = await watch(page);
  const state = buildTestState('modern', { font: 'inter' });
  await seed(page, state);
  await page.goto(`${site.url}/#/resume/${state.activeId}`);
  await page.waitForSelector('button:has-text("Export")', { timeout: 20_000 });
  await page.waitForSelector('[data-preview-status="ready"] canvas', { timeout: 45_000 });
  expect(await violations()).toEqual([]);
});

test('export: PDF and Word download under the policy', async ({ page, context }) => {
  await fakeJsDelivr(context);
  const violations = await watch(page);
  const state = buildTestState('classic');
  await seed(page, state);
  await page.goto(`${site.url}/#/resume/${state.activeId}`);
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 45_000 });
  for (const label of ['Export PDF', 'Export Word']) {
    await page.locator('button:has-text("Export")').first().click();
    const download = page.waitForEvent('download', { timeout: 45_000 });
    await page.getByRole('button', { name: label, exact: true }).click();
    const file = await download;
    expect(fs.statSync(await file.path()).size, `${label} gave a file`).toBeGreaterThan(1000);
  }
  expect(await violations()).toEqual([]);
});

test('Job Tracker and Projects: the workspace pages (drag and drop included) open under the policy', async ({ page }) => {
  const violations = await watch(page);
  await page.goto(`${site.url}/#/jobs`);
  await page.locator('main').first().waitFor({ timeout: 20_000 });
  await page.goto(`${site.url}/#/jobs/new`);
  await page.locator('main').first().waitFor({ timeout: 20_000 });
  await page.goto(`${site.url}/#/boards`);
  const href = await page.locator('a[href*="#/boards/"]').first().getAttribute('href', { timeout: 20_000 });
  const id = href.split('#/boards/')[1].split(/[/?]/)[0];
  for (const view of ['', '/list', '/timeline', '/calendar', '/backlog']) {
    await page.goto(`${site.url}/#/boards/${id}${view}`);
    await page.locator('main header h1').waitFor({ timeout: 20_000 });
  }
  expect(await violations()).toEqual([]);
});

test('a public résumé link opens under the policy (this build has no cloud, so it says so)', async ({ page }) => {
  const violations = await watch(page);
  await page.goto(`${site.url}/#/r/abc123`);
  await page.waitForSelector('text=/not available|not published|could not be loaded/i', { timeout: 20_000 });
  expect(await violations()).toEqual([]);
});

test('the watcher sees a violation: eval, an inline script and a fetch to a site the policy does not name are refused', async ({ page }) => {
  const violations = await watch(page);
  await page.goto(`${site.url}/#/terms`);
  await page.getByRole('heading', { name: 'Terms and Conditions' }).waitFor({ timeout: 20_000 });
  const outcome = await page.evaluate(async () => {
    const r = {};
    try { globalThis['ev' + 'al']('1 + 1'); r.eval = 'ran'; } catch { r.eval = 'refused'; }
    try { new Function('return 1')(); r.fn = 'ran'; } catch { r.fn = 'refused'; }
    const s = document.createElement('script');
    s.textContent = 'window.__inline = true';
    document.body.append(s);
    r.inline = window.__inline ? 'ran' : 'refused';
    try { await fetch('http://example.invalid/x'); r.fetch = 'sent'; } catch { r.fetch = 'refused'; }
    const o = document.createElement('object');
    o.data = '/favicon.svg';
    document.body.append(o);
    return r;
  });
  expect(outcome).toEqual({ eval: 'refused', fn: 'refused', inline: 'refused', fetch: 'refused' });
  const seen = (await violations()).join('\n');
  expect(seen).toMatch(/script-src/);
  expect(seen).toMatch(/connect-src/);
  expect(seen).toMatch(/object-src/);
});
