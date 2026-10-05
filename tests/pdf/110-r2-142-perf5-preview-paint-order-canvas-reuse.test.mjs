// PERF-5 (R2-142): the preview paints its pages before it asks pdf.js for their text, and paints into
// canvases it already has. It used to read every page's getTextContent first (the worker answers
// requests in turn, so the first paint waited for all of them) and to create a new canvas for every
// page of every render and zoom repaint. Now the pages go up first and their text (the screen-reader
// element `textId`) is read after; the status is 'ready' once it is in. A canvas that leaves the screen
// is shrunk to 0×0 as before (R2-170: tests/pdf/90-preview-canvas-memory) and kept in a pool, and
// the next render or repaint paints into it again instead of creating one.
// PdfPreview over fake-dom with the stand-in pdf.js of preview-stub.mjs, wrapped here to log what it is
// asked for and to hold or fail a page's text.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, heldBuild, preview, settle, pause, versions, name, opened, size, COLUMN_PX } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

const FIT_PX = Math.min(794, COLUMN_PX - 48); // A4 at 100 %: a canvas' width in the fake column

/**
 * Wrap the stand-in pdf.js: `events` lists what it was asked for, in order ('paint:<résumé name>',
 * 'text:<name>'); `holdText(name)` makes that résumé's text wait for the function it returns;
 * `failText` makes every page's text fail; `pages` is how many pages a document has.
 */
function instrument(stub) {
  const log = { events: [], failText: false, pages: 1, held: new Map() };
  log.holdText = (docName) => {
    let go;
    log.held.set(docName, new Promise((r) => { go = r; }));
    return () => { log.held.delete(docName); go(); };
  };
  const open = stub.pdfjs.lib.getDocument;
  stub.pdfjs.lib.getDocument = (args) => {
    const task = open(args);
    return {
      promise: task.promise.then((doc) => {
        doc.numPages = log.pages;
        const getPage = doc.getPage;
        doc.getPage = async (n) => {
          const page = await getPage(n);
          const { render, getTextContent } = page;
          page.render = (options) => { log.events.push(`paint:${doc.name}`); return render(options); };
          page.getTextContent = async () => {
            log.events.push(`text:${doc.name}`);
            await log.held.get(doc.name);
            if (log.failText) throw new Error('text failed');
            return getTextContent();
          };
          return page;
        };
        return doc;
      }),
    };
  };
  return log;
}

/** Mount the preview on `v0` with the stand-in wrapped; its first build is held until `calls[0].finish()`. */
async function open(v0, props = {}) {
  const { calls, build } = heldBuild();
  const p = await preview({ render: build, input: v0, ...props });
  const log = instrument(p.pdf);
  await settle();
  return { ...p, calls, build, log };
}

describe('the pages are painted before their text is read (PERF-5)', () => {
  it('every page paints before pdf.js is asked for any page\'s text; with the text still pending the pages are on screen', async () => {
    const [v0] = versions(1);
    const p = await open(v0);
    try {
      p.log.pages = 2;
      const release = p.log.holdText(name(v0));
      p.calls[0].finish();
      await settle();
      assert.deepEqual(p.log.events, [`paint:${name(v0)}`, `paint:${name(v0)}`, `text:${name(v0)}`, `text:${name(v0)}`], 'paint, then text');
      assert.equal(p.onScreen().length, 2, 'the pages are on screen while their text is still being read');
      assert.deepEqual(p.onScreen().map(size).map(([w]) => w), [FIT_PX, FIT_PX], 'and painted');
      assert.equal(p.status(), 'rendering', 'not ready until the text is in');
      assert.equal(p.shown(), '', 'no text yet');
      release();
      await settle();
      assert.deepEqual([p.status(), p.shown()], ['ready', name(v0) + name(v0)], 'the text of both pages is in once ready');
    } finally { await p.view.unmount(); }
  });

  it('a newer render\'s pages go up while an older one\'s text is pending; the older text is dropped when it arrives', async () => {
    const [v0, v1, v2] = versions(3);
    const p = await open(v0);
    try {
      p.calls[0].finish();
      await settle();
      assert.deepEqual([p.status(), p.shown()], ['ready', name(v0)]);
      const release1 = p.log.holdText(name(v1));
      p.set({ render: p.build, input: v1 });
      await pause();
      p.calls[1].finish();
      await settle();
      assert.equal(p.pdf.canvases.length, 2, 'v1 painted although its text is still pending');
      assert.equal(p.status(), 'rendering');
      p.set({ render: p.build, input: v2 });
      await pause();
      p.calls[2].finish();
      await settle();
      assert.deepEqual([p.status(), p.shown()], ['ready', name(v2)]);
      release1(); // v1's document was let go for v2's; its text is of no use
      await settle();
      assert.deepEqual([p.status(), p.shown()], ['ready', name(v2)], 'the dropped text changed nothing');
    } finally { await p.view.unmount(); }
  });

  it('a page whose text cannot be read leaves the pages on screen and the preview ready', async () => {
    const [v0] = versions(1);
    const p = await open(v0);
    try {
      p.log.failText = true;
      p.calls[0].finish();
      await settle();
      assert.deepEqual([p.status(), p.alert(), p.onScreen().length, p.shown()], ['ready', undefined, 1, '']);
    } finally { await p.view.unmount(); }
  });
});

describe('canvases are painted into again (PERF-5)', () => {
  it('a render paints into a canvas an earlier render left; the one still on screen is never painted over', async () => {
    const [v0, v1, v2, v3, v4] = versions(5);
    const p = await open(v0);
    try {
      p.calls[0].finish();
      await settle();
      const first = p.onScreen()[0];
      for (const [i, v] of [v1, v2, v3, v4].entries()) {
        const onScreenBefore = p.onScreen()[0];
        p.set({ render: p.build, input: v });
        await pause();
        p.calls[i + 1].finish();
        await settle();
        assert.equal(p.shown(), name(v));
        assert.notEqual(p.onScreen()[0], onScreenBefore, 'the pages on screen are not painted over: the next render goes into another canvas');
        assert.deepEqual(size(onScreenBefore), [0, 0], 'the one that left the screen holds no pixels (R2-170)');
        assert.notDeepEqual(size(p.onScreen()[0]), [0, 0]);
      }
      assert.equal(p.pdf.canvases.length, 5, 'five renders');
      assert.equal(new Set(p.pdf.canvases).size, 2, 'in two canvases, one on screen and one to paint into');
      assert.equal(p.pdf.canvases[2], first, 'the third render paints into the first render\'s canvas');
      assert.equal(p.onScreen()[0], first, 'the fifth is on it again');
      assert.equal(p.onScreen().length, 1);
    } finally { await p.view.unmount(); }
  });

  it('a résumé of three pages reuses the canvases of its last render: six canvases for three renders, not nine', async () => {
    const [v0, v1, v2] = versions(3);
    const p = await open(v0);
    try {
      p.log.pages = 3;
      p.calls[0].finish();
      await settle();
      for (const [i, v] of [v1, v2].entries()) {
        p.set({ render: p.build, input: v });
        await pause();
        p.calls[i + 1].finish();
        await settle();
      }
      assert.equal(p.pdf.canvases.length, 9, 'three pages, three renders');
      assert.equal(new Set(p.pdf.canvases).size, 6, 'the third render painted into the first one\'s three');
      const firstThree = p.pdf.canvases.slice(0, 3);
      assert.ok(p.pdf.canvases.slice(6).every((c) => firstThree.includes(c)), 'the third render\'s pages are the first render\'s canvases');
      assert.equal(p.onScreen().length, 3);
      assert.ok(p.onScreen().every((c) => size(c)[0] === FIT_PX), 'each sized for its paint');
    } finally { await p.view.unmount(); }
  });

  it('a zoom repaint paints into a canvas an earlier paint left, resized to the new zoom', async () => {
    const [v0] = versions(1);
    const { view, set, build, pdf, onScreen } = await opened(v0);
    try {
      const first = onScreen()[0];
      set({ render: build, input: v0, zoom: 1.25 });
      await settle();
      const second = onScreen()[0];
      assert.notEqual(second, first);
      set({ render: build, input: v0, zoom: 1.5 });
      await settle();
      assert.equal(onScreen()[0], first, 'the first paint\'s canvas is painted into again');
      assert.equal(onScreen()[0].width, Math.round(FIT_PX * 1.5), 'at the new zoom');
      assert.equal(new Set(pdf.canvases).size, 2, 'three paints, two canvases');
      assert.deepEqual(size(second), [0, 0]);
    } finally { await view.unmount(); }
  });

  it('a canvas whose paint failed is painted into again by the retry', async () => {
    const [v0] = versions(1);
    const p = await open(v0);
    try {
      p.pdf.failPaint = true;
      p.calls[0].finish();
      await settle();
      assert.equal(p.status(), 'error');
      p.pdf.failPaint = false;
      p.retry();
      await settle();
      p.calls[1].finish();
      await settle();
      assert.deepEqual([p.status(), p.shown()], ['ready', name(v0)]);
      assert.equal(p.pdf.canvases.length, 2);
      assert.equal(p.pdf.canvases[1], p.pdf.canvases[0], 'the failed paint\'s canvas is painted into again');
      assert.equal(p.onScreen()[0], p.pdf.canvases[0]);
    } finally { await p.view.unmount(); }
  });

  it('a preview that unmounted holds no canvas: its pixels are freed and the next preview creates its own', async () => {
    const [v0] = versions(1);
    const a = await opened(v0);
    const first = a.pdf.canvases[0];
    await a.view.unmount();
    assert.deepEqual(size(first), [0, 0], 'released on unmount');
    const b = await opened(v0);
    try {
      assert.notEqual(b.pdf.canvases[0], first, 'not another preview\'s canvas');
    } finally { await b.view.unmount(); }
  });
});
