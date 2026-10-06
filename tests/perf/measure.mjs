// What the performance harness measures (R2-142, PERF-1), a group at a time: run.mjs calls one of these and
// hands what it returns to budget-check.mjs's checkBudgets. Each returns `{ [budget id]: { value, detail } }`
// for the ids budgets.mjs writes for its group. They do the I/O and the timing; the statistics, the limits
// and the printing are budget-check.mjs's, which a unit test pins.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { render, renderCover } from '../pdf/harness.mjs';
import { median, sample, spread, startupPath } from './budget-check.mjs';
import { largeResume, smallResume, storeOf, typedInto, SUMMARY_MARKER } from './fixtures.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const now = () => performance.now();
/** The width the editor paints a page at (A4 at 96 dpi), at a pixel ratio of 1. */
const PAGE_CSS_WIDTH = 794;

/** N1: the PDF build through the app's own react-pdf code, warm — the first build loads fonts and the template. */
export async function measureRender({ runs, warmups }) {
  const small = smallResume();
  const large = largeResume();
  const out = {};
  const timed = async (id, fn) => {
    const times = await sample(fn, { runs, warmups });
    out[id] = { value: median(times), detail: spread(times) };
  };
  await timed('render.classic1', () => render(small));
  await timed('render.classic3', () => render(large));
  await timed('render.cover', () => renderCover(small));
  return out;
}

/**
 * One keystroke in the large résumé's Summary as far as Node reaches it: the same steps PdfPreview takes
 * once its debounce is over — build the PDF, open it in pdf.js, read every page's text, paint every page
 * (@napi-rs/canvas, at the editor's page width). Each pass types one more letter, so no two builds are the same.
 */
export async function measureKeystroke({ runs, warmups }) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const letters = 'engineering';
  let r = largeResume();
  let pages = 0;
  const steps = [];
  for (let i = -warmups; i < runs; i += 1) {
    r = typedInto(r, letters[(i + warmups) % letters.length]);
    const started = now();
    const bytes = await render(r);
    const built = now();
    const doc = await getDocument({ data: bytes, isEvalSupported: false, verbosity: 0 }).promise;
    const list = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      await page.getTextContent();
      list.push(page);
    }
    const opened = now();
    await Promise.all(list.map(async (page) => {
      const viewport = page.getViewport({ scale: PAGE_CSS_WIDTH / page.view[2] });
      const { canvas, context } = doc.canvasFactory.create(Math.round(viewport.width), Math.round(viewport.height));
      await page.render({ canvasContext: context, canvas, viewport }).promise;
    }));
    const painted = now();
    pages = doc.numPages;
    await doc.loadingTask.destroy();
    if (i >= 0) steps.push({ build: built - started, open: opened - built, paint: painted - opened, total: painted - started });
  }
  const of = (key) => steps.map((s) => s[key]);
  const split = `medians: build ${Math.round(median(of('build')))}, open ${Math.round(median(of('open')))}, paint ${Math.round(median(of('paint')))} ms`;
  return {
    'keystroke.pages': { value: pages, detail: 'the fixture: 12 positions of five bullets, projects, education, skills' },
    'keystroke.build': { value: median(of('build')), detail: spread(of('build')) },
    'keystroke.open': { value: median(of('open')), detail: spread(of('open')) },
    'keystroke.paint': { value: median(of('paint')), detail: spread(of('paint')) },
    'keystroke.total': { value: median(of('total')), detail: `${spread(of('total'))}; ${split}` },
  };
}

/**
 * The start-up path of a production build (vite build, nothing written — as 71-startup-chunks builds it):
 * the entry, what it imports statically and what index.html preloads. Run after the timings: a build takes
 * the machine's cores for a while.
 */
export async function measureStartup() {
  const { build } = await import('vite');
  // The harness's dev server (setup) has set NODE_ENV to development for this process, and a build
  // bundles React as that says: a production build says so for its own length.
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  let result;
  try {
    result = await build({
      root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), mode: 'production', logLevel: 'silent', build: { write: false },
    });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
  const files = [result].flat().flatMap((o) => o.output);
  const chunks = files.filter((f) => f.type === 'chunk');
  const page = files.find((f) => f.fileName === 'index.html');
  const html = typeof page?.source === 'string' ? page.source : new TextDecoder().decode(page?.source ?? new Uint8Array());
  const startup = startupPath(chunks, {
    html,
    size: (c) => c.code.length, // characters, as 71-startup-chunks counts them, so the two never disagree about a cap
    gzipSize: (c) => zlib.gzipSync(c.code).length,
  });
  return {
    'startup.raw': { value: startup.rawKb, detail: `${startup.names.length} chunks: ${startup.names.join(', ')}` },
    'startup.gzip': { value: startup.gzipKb },
    'startup.largest': { value: startup.largestKb },
    'startup.lazy': { value: startup.lazyModules },
  };
}

/** Time from `since` (Date.now()) until `check` holds in the page, polled every frame. */
async function until(page, since, check, arg, timeout = 90_000) {
  await page.waitForFunction(check, arg, { polling: 'raf', timeout });
  return Date.now() - since;
}

/**
 * Gate A's typing scenario in Chromium against the built `dist` (served by vite preview): open the large
 * résumé in the editor, wait for its first pages, then type 20 characters into Summary at 150 ms a key
 * and time the last key to the pages that show what was typed (#resume-preview holds the pages' text).
 * The longest main-thread task from the first key to those pages comes from a longtask observer. Three
 * rounds of typing; the median counts, the worst long task does.
 */
export async function measureBrowser({ dist }) {
  const distDir = path.resolve(ROOT, dist);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`no build in ${distDir}: run "yarn build" first, or point --dist at one`);
  }
  const { chromium } = await import('@playwright/test');
  const { preview } = await import('vite');
  const server = await preview({ root: ROOT, logLevel: 'error', build: { outDir: distDir }, preview: { host: '127.0.0.1', port: 4179 } });
  const browser = await chromium.launch();
  try {
    const store = storeOf(largeResume());
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.addInitScript(({ key, state }) => {
      // The state is written before the app starts, so it opens on the large résumé (as tests/playwright/pw-helpers does).
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(state));
      window.__perfLongTasks = [];
      try {
        window.__perfLongObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__perfLongTasks.push(entry.duration);
        });
        window.__perfLongObserver.observe({ type: 'longtask', buffered: true });
      } catch { /* no long task entries in this browser: the budget then reads 0 */ }
    }, { key: 'cpwtcv_v1', state: store });

    const url = `http://127.0.0.1:${server.httpServer.address().port}/#/resume/${store.activeId}`;
    const opened = Date.now();
    await page.goto(url);
    const firstPreview = await until(page, opened, () => !!document.querySelector('[data-preview-status="ready"] canvas'), undefined);

    const summary = page.locator('[contenteditable="true"]').filter({ hasText: SUMMARY_MARKER }).first();
    /** Three rounds of typing into Summary: the last key to the pages, and the longest task, of each. */
    const typeRounds = async (tag) => {
      const lastKeyToPages = [];
      let longest = 0;
      for (let round = 0; round < 3; round += 1) {
        const typed = `${tag}${round}xk7q9zvw3m5j2pb`;
        await page.evaluate(() => { window.__perfLongObserver?.takeRecords(); window.__perfLongTasks.length = 0; });
        await summary.click();
        await page.keyboard.press('Control+End');
        await page.keyboard.type(typed, { delay: 150 });
        const lastKey = Date.now();
        lastKeyToPages.push(await until(page, lastKey, (text) => !!document.querySelector('#resume-preview')?.textContent.includes(text), typed));
        const tasks = await page.evaluate(() => {
          window.__perfLongObserver?.takeRecords().forEach((e) => window.__perfLongTasks.push(e.duration));
          return window.__perfLongTasks;
        });
        longest = Math.max(longest, ...tasks);
      }
      return { lastKeyToPages, longest };
    };
    const collapsed = await typeRounds('perf');
    // The same typing with every entry card open (PERF-4): a keystroke used to re-render every field of every entry.
    await page.evaluate(() => {
      for (const header of document.querySelectorAll('div.cursor-pointer.select-none')) header.click();
    });
    const expanded = await typeRounds('open');
    return {
      'browser.firstPreview': { value: firstPreview, detail: 'navigation to the first painted pages, including the PDF worker and the fonts' },
      'browser.keystrokeToPreview': { value: median(collapsed.lastKeyToPages), detail: spread(collapsed.lastKeyToPages) },
      'browser.longTask': { value: collapsed.longest, detail: 'the longest of three rounds, from the first key to the pages showing the last' },
      'browser.keystrokeToPreviewExpanded': { value: median(expanded.lastKeyToPages), detail: `every entry open; ${spread(expanded.lastKeyToPages)}` },
      'browser.longTaskExpanded': { value: expanded.longest, detail: 'every entry open; the longest of three rounds' },
    };
  } finally {
    await browser.close();
    await server.close();
  }
}
