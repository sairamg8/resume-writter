// Gate B of the performance plan (R2-142, PERF-6): with the PDF built in a Web Worker, typing into the
// editor must leave the page's own thread free — no long task over 50 ms, and a key's input delay of
// 50 ms or less. The target is inferred, not measured yet: this spec measures it, in the same browser
// twice — once with the worker (the app as shipped) and once with the PDF worker refused, so pdfBuild.js
// builds on the main thread as it did before PERF-6 — and prints both. It measures rather than gates: a
// shared CI machine's long tasks say little, so it runs only when asked:
//
//   yarn build && PERF_GATE_B=1 npx playwright test tests/playwright/perf-gate-b.spec.mjs --reporter=list
//
// (each run's numbers are printed and attached; the worker run's assertions are soft, so both runs print
// even when the target is missed).
import { test, expect } from '@playwright/test';
import { ALL_SECTION_TYPES } from '../helpers.js';
import { visitEditor } from './pw-helpers.js';

test.skip(!process.env.PERF_GATE_B, 'a measurement, run on request: PERF_GATE_B=1 npx playwright test tests/playwright/perf-gate-b.spec.mjs');

const KEYS = 20;
const KEY_GAP_MS = 150;

/** The fixture résumé, made longer so its PDF takes long enough to lay out to show on the main thread. */
const longSections = () => ALL_SECTION_TYPES.map((s) => ({
  ...s,
  items: Array.from({ length: 4 }, (_, copy) => s.items.map((it) => ({ ...it, id: `${it.id}_${copy}` }))).flat(),
}));

/** Records the page's long tasks and each key's input delay (Event Timing) from the first script on. */
function observe() {
  window.__gateB = { longTasks: [], keyDelays: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__gateB.longTasks.push(e.duration);
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === 'keydown') window.__gateB.keyDelays.push(e.processingStart - e.startTime);
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
}

/** Refuse to start the PDF worker (and only it: pdf.js keeps its own), so builds run on the main thread. */
function refusePdfWorker() {
  const Native = window.Worker;
  window.Worker = class extends Native {
    constructor(url, options) {
      if (/pdfWorker/.test(String(url))) throw new Error('the PDF worker is refused for this run');
      super(url, options);
    }
  };
}

async function measure(page, { workerOn }) {
  await page.addInitScript(observe);
  if (!workerOn) await page.addInitScript(refusePdfWorker);
  await visitEditor(page, 'modern', { sections: longSections() });
  const pages = Number(await page.locator('[data-preview-status]').first().getAttribute('data-preview-pages'));
  await page.evaluate(() => { window.__gateB.longTasks.length = 0; window.__gateB.keyDelays.length = 0; });
  const summary = page.locator('[data-placeholder^="Brief professional summary"]');
  await summary.click();
  await page.keyboard.press('End');
  await page.keyboard.type('x'.repeat(KEYS), { delay: KEY_GAP_MS });
  await page.waitForSelector('[data-preview-status="ready"]', { timeout: 30_000 });
  const { longTasks, keyDelays } = await page.evaluate(() => window.__gateB);
  const max = (xs) => Math.round(Math.max(0, ...xs));
  const result = { thread: workerOn ? 'PDF worker' : 'main thread', pages, longTasks: longTasks.length, maxLongTaskMs: max(longTasks), maxKeyDelayMs: max(keyDelays) };
  console.log(`Gate B — ${JSON.stringify(result)}`);
  test.info().annotations.push({ type: `gate-b ${result.thread}`, description: JSON.stringify(result) });
  return result;
}

test('typing on a long résumé: long tasks and key delay, PDF worker against the main thread', async ({ browser }) => {
  test.setTimeout(120_000);
  const results = {};
  for (const workerOn of [true, false]) {
    const context = await browser.newContext();
    try {
      results[workerOn ? 'worker' : 'main'] = await measure(await context.newPage(), { workerOn });
    } finally {
      await context.close();
    }
  }
  // Gate B's target (inferred): no long task over 50 ms, a key's delay of 50 ms or less.
  expect.soft(results.worker.maxLongTaskMs, 'longest long task with the PDF worker').toBeLessThanOrEqual(50);
  expect.soft(results.worker.maxKeyDelayMs, 'longest key delay with the PDF worker').toBeLessThanOrEqual(50);
  // The point of the worker: the page's thread is freer with it than without it.
  expect.soft(results.worker.maxLongTaskMs, 'the worker takes the build off the main thread').toBeLessThanOrEqual(results.main.maxLongTaskMs);
});
