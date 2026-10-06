// PdfPreview gives every call to pdf.js a budget (R2-142, the twin of PERF-6's PDF worker watchdog in pdfBuild.js).
// A call that never settled — pdf.js' worker died or hung, or its chunk never loaded — held a build for good: the
// preview stayed on "Rendering preview…" and, one build at a time, held the slot of every change after it. Now a
// stage of a build (loading pdf.js, opening the PDF, reading its pages, painting them) that outstays its budget
// fails the build like any other failure — the alert, Retry, the next change builds — and what pdf.js settles late
// is ignored. The pages' text, read after they are up, is let go the same way: empty text and status 'ready', for
// pages that were painted are no failed render.
// PdfPreview over fake-dom with a stand-in pdf.js whose calls hang when the test says and a clock the test rings
// (the budget is 20 s or more), so nothing here waits for it (preview-stub.mjs).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './harness.mjs';
import { setupPreview, teardownPreview, settle, pause, versions, name, size, preview, heldBuild } from './preview-stub.mjs';

let mod;
// The preview's clock seam. A preview with no watchdog has none: the tests then fail on the clock they find
// idle (no timer to ring), which is the defect, not on a function missing.
const setClock = (clock) => mod._setPreviewClockForTest?.(clock);
before(async () => {
  await setupPreview();
  mod = await loadModule('/src/components/PdfPreview.jsx');
});
after(async () => {
  setClock(null);
  await teardownPreview();
});
afterEach(() => setClock(null));

// What a stage gets (PdfPreview's pdfjsTimeoutMs): 20 s, twice that before a document has opened, a second a page.
const BASE = 20_000;
const COLD = 40_000;
const ONE_PAGE = 21_000;
const THREE_PAGES = 23_000;

/** The watchdog's clock, run by the test: `armed` lists the budgets of the timers running, `sets` every timer ever set. */
function fakeClock() {
  const live = new Map();
  let n = 0;
  const clock = {
    at: 1_000,
    sets: [],
    now: () => clock.at,
    set(fn, ms) { n += 1; live.set(n, { fn, ms, due: clock.at + ms }); clock.sets.push(ms); return n; },
    clear(id) { live.delete(id); },
    get armed() { return [...live.values()].map((t) => t.ms); },
    /** Ring the oldest timer, `late` ms after its time. */
    fire(late = 0) {
      const first = live.entries().next().value;
      assert.ok(first, 'a timer is running to fire');
      live.delete(first[0]);
      clock.at = Math.max(clock.at, first[1].due + late);
      first[1].fn();
    },
  };
  return clock;
}

/**
 * Calls of the stand-in pdf.js that wait until the test lets them: `hang(kind)` makes the NEXT call of `kind`
 * ('open', 'page', 'paint' or 'text') wait and returns `{ settle() }` to let it through, late. `seen` counts what
 * the preview told pdf.js: loading tasks destroyed, render tasks cancelled, and the canvases it was asked to paint.
 * Documents open with `pages` pages.
 */
function trap(pdf, { pages = 1 } = {}) {
  const queue = { open: [], page: [], paint: [], text: [] };
  const seen = { destroyed: 0, cancelled: 0, canvases: [] };
  const lib = pdf.pdfjs.lib;
  const openDocument = lib.getDocument;
  const gated = (kind, promise) => {
    const gate = queue[kind].shift();
    return gate ? gate.promise.then(() => promise) : promise;
  };
  lib.getDocument = (args) => {
    const inner = openDocument(args);
    const promise = inner.promise.then((doc) => {
      doc.numPages = pages;
      const getPage = doc.getPage;
      doc.getPage = (n) => gated('page', getPage(n).then((page) => {
        const render = page.render;
        const read = page.getTextContent;
        page.render = (options) => {
          const task = render(options);
          seen.canvases.push(options.canvas);
          return { promise: gated('paint', task.promise), cancel: () => { seen.cancelled += 1; } };
        };
        page.getTextContent = () => gated('text', read());
        return page;
      }));
      return doc;
    });
    return { promise: gated('open', promise), destroy: async () => { seen.destroyed += 1; } };
  };
  return {
    seen,
    hang(kind) {
      let go;
      queue[kind].push({ promise: new Promise((r) => { go = r; }) });
      return { settle: () => go() };
    },
  };
}

/** A preview of `v0` on the fake clock, its first build waiting for its PDF (`calls[0].finish()`). */
async function start(v0, { pages = 1 } = {}) {
  const clock = fakeClock();
  setClock(clock);
  const { calls, build } = heldBuild();
  const p = await preview({ render: build, input: v0 });
  const t = trap(p.pdf, { pages });
  await settle();
  assert.equal(calls.length, 1, 'the first build asked for its PDF');
  return { ...p, calls, build, t, clock };
}

describe('the budget a stage of pdf.js work gets', () => {
  it('is 20 s, twice that while the library is cold, and a second more for every page, up to a limit', () => {
    const { pdfjsTimeoutMs: budget } = mod;
    assert.equal(budget(), 20_000);
    assert.equal(budget(0, true), 40_000, 'cold: pdf.js and its worker are still loading');
    assert.equal(budget(3), 23_000, 'each page adds to it');
    assert.equal(budget(3, true), 43_000);
    assert.equal(budget(5000), 20_000 + 100 * 1_000, 'up to a limit, so a hang is still found');
    for (const odd of [undefined, -4, 0]) assert.equal(budget(odd), 20_000);
  });
});

describe('a call to pdf.js that never settles fails the build instead of holding it for good (R2-142)', () => {
  it('pdf.js never opens the PDF: the build fails within its budget, Retry builds, and a document that comes in late is let go', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, shown, alert, retry, pdf } = await start(v0);
    try {
      const late = t.hang('open');
      calls[0].finish();
      await settle();
      assert.equal(status(), 'rendering');
      assert.deepEqual(clock.armed, [COLD], 'one clock, on the open, with the cold budget (the library has not opened a document yet)');
      clock.fire();
      await settle();
      assert.equal(status(), 'error', 'was: \'rendering\' for good');
      assert.match(alert()?.textContent ?? '', /Preview failed to render \(The preview took too long to draw\)/);
      assert.equal(t.seen.destroyed, 1, 'its loading task is destroyed');
      assert.deepEqual(clock.armed, [], 'no clock is left running');
      late.settle(); // the document comes in too late
      await settle();
      assert.equal(pdf.docs[0].destroyed, true, 'the document that arrives late is let go');
      assert.equal(status(), 'error', 'and changes nothing on screen');
      assert.equal(shown(), '');
      retry();
      await settle();
      assert.equal(calls.length, 2, 'Retry builds again');
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status(), alert()], [name(v0), 'ready', undefined]);
      assert.deepEqual(clock.armed, []);
    } finally { await view.unmount(); }
  });

  it('a page that never comes: the build fails and its document is released', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, alert, retry, pdf } = await start(v0);
    try {
      const late = t.hang('page');
      calls[0].finish();
      await settle();
      assert.equal(status(), 'rendering');
      assert.deepEqual(clock.armed, [ONE_PAGE], 'the document opened, so the pages get the plain budget for one page');
      clock.fire();
      await settle();
      assert.equal(status(), 'error');
      assert.match(alert()?.textContent ?? '', /took too long to draw/);
      assert.equal(pdf.docs[0].destroyed, true, 'the opened document is released');
      late.settle();
      await settle();
      assert.equal(status(), 'error', 'the late page changes nothing');
      retry();
      await settle();
      calls[1].finish();
      await settle();
      assert.equal(status(), 'ready');
    } finally { await view.unmount(); }
  });

  it('a paint that never ends: the build fails, the paint is cancelled, its canvases are let go and never painted into again', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, shown, onScreen, alert, retry, pdf } = await start(v0);
    try {
      const late = t.hang('paint');
      calls[0].finish();
      await settle();
      assert.equal(status(), 'rendering');
      assert.deepEqual(clock.armed, [ONE_PAGE]);
      clock.fire();
      await settle();
      assert.equal(status(), 'error');
      assert.match(alert()?.textContent ?? '', /took too long to draw/);
      assert.equal(t.seen.cancelled, 1, 'the render task is cancelled');
      assert.equal(pdf.docs[0].destroyed, true);
      const [abandoned] = t.seen.canvases;
      assert.deepEqual(size(abandoned), [0, 0], 'its pixels are freed at once');
      assert.deepEqual(onScreen(), [], 'nothing of it is on screen');
      late.settle();
      await settle();
      assert.equal(status(), 'error', 'the late paint changes nothing');
      retry();
      await settle();
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v0), 'ready']);
      assert.equal(t.seen.canvases.length, 2);
      assert.notEqual(t.seen.canvases[1], abandoned, 'the next paint did not reuse a canvas the stuck one still holds');
      assert.deepEqual(size(abandoned), [0, 0], 'and the stuck canvas is still shrunk');
    } finally { await view.unmount(); }
  });

  it('the stage clock restarts for the next stage, and a document of more pages gets longer', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, pdf } = await start(v0, { pages: 3 });
    try {
      t.hang('paint');
      calls[0].finish();
      await settle();
      assert.deepEqual(clock.sets.slice(0, 4), [COLD, COLD, THREE_PAGES, THREE_PAGES], 'load, open, pages, paint: each starts its own clock');
      assert.deepEqual(clock.armed, [THREE_PAGES], 'three pages: 20 s and a second each');
      assert.equal(pdf.docs.length, 1);
      clock.fire();
      await settle();
      assert.equal(status(), 'error');
    } finally { await view.unmount(); }
  });

  it('a library that never loads: the build fails, and Retry builds once it has', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, clock, status, alert, retry, pdf } = await start(v0);
    try {
      calls[0].finish();
      await settle();
      assert.equal(status(), 'ready', 'a document opened: the library is loaded');
      mod._setPdfjsForTest(new Promise(() => {})); // its chunk never arrives
      set({ render: build, input: v1 });
      await pause();
      assert.equal(calls.length, 2);
      assert.deepEqual(clock.armed, [BASE], 'the load has the plain budget');
      calls[1].finish();
      await settle();
      assert.equal(status(), 'rendering');
      clock.fire();
      await settle();
      assert.equal(status(), 'error');
      assert.match(alert()?.textContent ?? '', /took too long to draw/);
      mod._setPdfjsForTest(pdf.pdfjs); // the chunk is there now
      retry();
      await settle();
      calls[2].finish();
      await settle();
      assert.equal(status(), 'ready');
    } finally { await view.unmount(); }
  });

  it('the change typed meanwhile still builds: it started the moment the stuck build was given up on', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, t, clock, status, shown, alert } = await start(v0);
    try {
      t.hang('paint');
      calls[0].finish();
      await settle();
      set({ render: build, input: v1 }); // typed while v0 is stuck: it waits its turn
      await pause();
      assert.equal(calls.length, 1, 'one build at a time: v1 waits for the stuck one');
      assert.equal(status(), 'rendering');
      clock.fire();
      await settle();
      assert.equal(calls.length, 2, 'v1 builds as the stuck build ends (was: never)');
      assert.equal(alert(), undefined, 'v0 failed, but v1 is the latest change and owns the status');
      assert.equal(status(), 'rendering');
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status(), alert()], [name(v1), 'ready', undefined]);
    } finally { await view.unmount(); }
  });

  it('what a stuck build\'s call settles late never overwrites a newer build\'s pages or record', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, t, clock, status, shown, alert, onScreen, pdf } = await start(v0);
    try {
      const late = t.hang('paint');
      calls[0].finish();
      await settle();
      clock.fire();
      await settle();
      assert.equal(status(), 'error');
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status(), alert()], [name(v1), 'ready', undefined]);
      const up = onScreen();
      late.settle(); // v0's paint ends now
      await settle();
      assert.deepEqual([shown(), status(), alert()], [name(v1), 'ready', undefined], 'v1\'s pages and status stand');
      assert.deepEqual(onScreen(), up, 'the same canvases');
      assert.ok(up.map(size).every(([w, h]) => w > 0 && h > 0), 'still painted');
      assert.equal(pdf.docs.filter((d) => !d.destroyed).length, 1, 'only v1\'s document is open');
    } finally { await view.unmount(); }
  });

  it('a clock that rings long past its time slept with the page: the stage gets its budget again', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status } = await start(v0);
    try {
      t.hang('open');
      calls[0].finish();
      await settle();
      clock.fire(10 * 60_000); // the tab was frozen for ten minutes past the budget
      await settle();
      assert.equal(status(), 'rendering', 'not given up on (was: failed as soon as the tab woke)');
      assert.deepEqual(clock.armed, [COLD], 'the whole budget again');
      clock.fire(); // and now it is on time
      await settle();
      assert.equal(status(), 'error');
    } finally { await view.unmount(); }
  });
});

describe('the pages\' text, read after they are up (PERF-5)', () => {
  it('a read that never ends is let go: the pages stay up, the status is ready, those pages\' text is empty', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, shown, onScreen, alert } = await start(v0);
    try {
      const late = t.hang('text');
      calls[0].finish();
      await settle();
      assert.equal(onScreen().length, 1, 'the page is painted and up');
      assert.equal(status(), 'rendering', 'its text is still to come');
      assert.deepEqual(clock.armed, [ONE_PAGE], 'the text read has its own clock');
      clock.fire();
      await settle();
      assert.deepEqual([status(), alert(), shown()], ['ready', undefined, ''], 'was: \'rendering\' for good; the page is no failed render');
      assert.deepEqual(clock.armed, []);
      late.settle();
      await settle();
      assert.deepEqual([status(), shown()], ['ready', ''], 'the text that comes in late is dropped');
    } finally { await view.unmount(); }
  });

  it('the pages whose text came keep it; only the one that did not is empty', async () => {
    const [v0] = versions(1);
    const { view, calls, t, clock, status, shown } = await start(v0, { pages: 2 });
    try {
      t.hang('text'); // the first page's read
      calls[0].finish();
      await settle();
      assert.equal(status(), 'rendering');
      clock.fire();
      await settle();
      assert.equal(status(), 'ready');
      assert.equal(shown(), name(v0), 'the second page\'s text only');
    } finally { await view.unmount(); }
  });

  it('a read that ends in time is unaffected, and every stage leaves its clock behind it', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, clock, status, shown } = await start(v0, { pages: 2 });
    try {
      calls[0].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v0).repeat(2), 'ready']);
      assert.deepEqual(clock.armed, [], 'nothing is left running');
      assert.deepEqual(clock.sets, [40_000, 40_000, 22_000, 22_000, 22_000], 'load and open on the cold budget, then pages, paint and text on the plain one');
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.equal(status(), 'ready');
      assert.deepEqual(clock.sets.slice(5), [20_000, 20_000, 22_000, 22_000, 22_000], 'a document has opened: the next build\'s load and open are on the plain budget');
      assert.deepEqual(clock.armed, []);
    } finally { await view.unmount(); }
  });
});

describe('a zoom repaint that never ends (PERF-5)', () => {
  it('is let go: the pages stay as they were, its canvases are shrunk and not reused, and the next zoom paints', async () => {
    const [v0] = versions(1);
    const { view, set, build, calls, t, clock, status, onScreen } = await start(v0);
    try {
      calls[0].finish();
      await settle();
      const first = onScreen()[0];
      const late = t.hang('paint');
      set({ render: build, input: v0, zoom: 1.25 });
      await settle();
      assert.deepEqual(clock.armed, [ONE_PAGE], 'the repaint has a clock');
      assert.equal(onScreen()[0], first, 'still the first pages');
      clock.fire();
      await settle();
      assert.equal(t.seen.cancelled, 1);
      const stuck = t.seen.canvases[1];
      assert.deepEqual(size(stuck), [0, 0]);
      assert.equal(onScreen()[0], first);
      assert.equal(status(), 'ready', 'a repaint is no build: nothing to report');
      late.settle();
      await settle();
      set({ render: build, input: v0, zoom: 1.5 });
      await settle();
      assert.notEqual(onScreen()[0], first, 'the next zoom repaints');
      assert.notEqual(onScreen()[0], stuck, 'into a canvas of its own');
      assert.deepEqual(clock.armed, []);
    } finally { await view.unmount(); }
  });
});
