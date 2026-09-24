// A canvas that leaves the screen (a newer render, a zoom repaint, unmount) or never reaches it (a
// stale or failed render) is shrunk to 0×0 at once (R2-170), instead of holding its pixels until
// the garbage collector runs: iOS Safari caps a page's total canvas memory and fails the next paint
// past it ("Preview failed to render").
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, opened, size } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('canvases leaving the screen are shrunk to 0×0 (R2-170)', () => {
  it('a newer render: the old canvases are 0×0, the new ones on screen are painted', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, onScreen } = await opened(v0);
    try {
      const old = onScreen();
      assert.equal(old.length, 1);
      assert.notDeepEqual(size(old[0]), [0, 0]);
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.deepEqual(size(old[0]), [0, 0], 'the replaced canvas still holds its pixels');
      assert.notEqual(onScreen()[0], old[0]);
      assert.notDeepEqual(size(onScreen()[0]), [0, 0]);
    } finally { await view.unmount(); }
  });

  it('a zoom repaint: the old canvases are 0×0', async () => {
    const [v0] = versions(1);
    const { view, set, build, onScreen } = await opened(v0);
    try {
      const old = onScreen()[0];
      set({ render: build, input: v0, zoom: 1.25 });
      await settle();
      assert.notEqual(onScreen()[0], old, 'repainted');
      assert.deepEqual(size(old), [0, 0]);
    } finally { await view.unmount(); }
  });

  it('unmount: the canvases on screen are 0×0', async () => {
    const [v0] = versions(1);
    const { view, onScreen } = await opened(v0);
    const shownCanvases = onScreen();
    await view.unmount();
    assert.deepEqual(shownCanvases.map(size), [[0, 0]]);
  });

  it('a dropped (stale) or failed render: its canvases are 0×0', async () => {
    const [v0, v1, v2, v3] = versions(4);
    const { view, set, calls, build, pdf, onScreen, shown } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      const paintV1 = pdf.holdPaint(name(v1));
      calls[1].finish(); // v1 is painting when v2 goes up: dropped once its paint ends
      await settle();
      calls[2].finish();
      await settle();
      paintV1();
      await settle();
      assert.equal(shown(), name(v2));
      pdf.failPaint = true;
      set({ render: build, input: v3 });
      await pause();
      calls[3].finish();
      await settle();
      const live = new Set(onScreen());
      const offScreen = pdf.canvases.filter((c) => !live.has(c));
      assert.equal(offScreen.length, 3, 'v0, v1 and v3 painted a canvas each');
      assert.deepEqual(offScreen.map(size), [[0, 0], [0, 0], [0, 0]]);
    } finally { await view.unmount(); }
  });
});
