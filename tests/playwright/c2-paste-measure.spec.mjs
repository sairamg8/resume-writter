// THROWAWAY (cluster C-2): the longest long task for a 5.7 MB plain-text paste into each candidate field,
// on the production bundle. Prints `C2 {...}` lines; asserts nothing.
import { test } from '@playwright/test';
import { visitEditor } from './pw-helpers.js';

const SIZE = 5_700_000;
const TEXT = ('Senior engineer with React, AWS and machine learning experience. '.repeat(100) + '\n').repeat(Math.ceil(SIZE / 6500)).slice(0, SIZE);

function observe() {
  window.__c2 = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__c2.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
}

async function pasteInto(page, locator, label) {
  await locator.click();
  await page.evaluate(() => { window.__c2.length = 0; });
  const t0 = Date.now();
  await locator.evaluate((el, text) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, TEXT);
  await page.waitForTimeout(15_000);
  const tasks = await page.evaluate(() => window.__c2.slice());
  const out = { surface: label, longest: Math.max(0, ...tasks), count: tasks.length, over1s: tasks.filter((d) => d >= 1000).length, total: tasks.reduce((a, b) => a + b, 0), dispatchMs: Date.now() - t0 - 15000 };
  console.log(`C2 ${JSON.stringify(out)}`);
}

test.setTimeout(240_000);

test('summary', async ({ page }) => {
  await page.addInitScript(observe);
  await visitEditor(page, 'classic');
  await pasteInto(page, page.locator('[data-placeholder^="Brief professional summary"]'), 'resume summary');
});

test('bullet', async ({ page }) => {
  await page.addInitScript(observe);
  await visitEditor(page, 'classic');
  let box = page.locator('[data-placeholder^="Use bullet points"]').first();
  if (!(await box.count())) {
    const heads = page.locator('button[aria-expanded="false"]');
    for (let i = 0; i < Math.min(8, await heads.count()) && !(await box.count()); i += 1) await heads.nth(i).click().catch(() => {});
  }
  if (!(await box.count())) { console.log('C2 {"surface":"resume bullet","error":"no bullet editor found"}'); return; }
  await pasteInto(page, box, 'resume bullet');
});

test('job notes', async ({ page }) => {
  await page.addInitScript(observe);
  await page.goto('/#/jobs/new');
  const notes = page.locator('[aria-label="Notes"]').first();
  await notes.waitFor({ timeout: 20_000 });
  await pasteInto(page, notes, 'job notes');
});

test('ats box', async ({ page }) => {
  await page.addInitScript(observe);
  await visitEditor(page, 'classic');
  await page.getByRole('button', { name: 'ATS Check' }).first().click();
  const box = page.locator('textarea[placeholder^="Paste job posting"]');
  await box.waitFor({ timeout: 20_000 });
  await box.click();
  await page.evaluate(() => { window.__c2.length = 0; });
  await page.keyboard.insertText(TEXT); // maxLength cuts it as a real paste is cut
  await page.waitForTimeout(15_000);
  const tasks = await page.evaluate(() => window.__c2.slice());
  console.log(`C2 ${JSON.stringify({ surface: 'ats box (capped)', longest: Math.max(0, ...tasks), count: tasks.length, over1s: tasks.filter((d) => d >= 1000).length, total: tasks.reduce((a, b) => a + b, 0), kept: await box.evaluate((e) => e.value.length) })}`);
});
