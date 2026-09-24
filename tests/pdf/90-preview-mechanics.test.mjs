// The preview's mechanics with builds that succeed (R2-165): the typing debounce keeps the pages on
// screen and builds once per pause; a stale render is dropped; a zoom change repaints the pages
// already built, at the new width, without building again (and not while hidden); a failed build
// shows an alert with its message and a Retry that builds again at once and, when that succeeds,
// clears the alert. tests/pdf/71-preview-* pin the same debounce and Retry with builds that fail at
// once; these run the whole way to pages on screen.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, heldBuild, preview, settle, pause, wait, versions, name, opened, COLUMN_PX } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

const FIT_PX = Math.min(794, COLUMN_PX - 48); // A4 (a blank résumé's page) at 100 %: its own width, inside the column's gutters

describe('typing debounce, with pages on screen (R2-165)', () => {
  it('while typing, the last pages stay up and nothing builds; the pause builds once, the latest', async () => {
    const [v0, ...typed] = versions(6);
    const { view, set, calls, build, shown, status, onScreen } = await opened(v0);
    try {
      const canvas = onScreen()[0];
      for (const v of typed) { set({ render: build, input: v }); await wait(60); }
      assert.equal(calls.length, 1, 'no build while typing');
      assert.deepEqual([shown(), status(), onScreen()[0]], [name(v0), 'rendering', canvas], 'the last pages stay up');
      await pause();
      assert.deepEqual(calls.map((c) => c.input), [v0, typed.at(-1)]);
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(typed.at(-1)), 'ready']);
    } finally { await view.unmount(); }
  });
});

describe('a stale render is dropped (R2-165)', () => {
  it('a render that finishes after a newer one went up does not replace it', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      calls[2].finish();
      await settle();
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
    } finally { await view.unmount(); }
  });
});

describe('zoom repaints the pages already built (R2-165)', () => {
  it('a zoom change repaints at the new width, with no new build; zoom back repaints again', async () => {
    const [v0] = versions(1);
    const { view, set, calls, build, onScreen, status } = await opened(v0);
    try {
      assert.equal(onScreen()[0].width, FIT_PX, '100 % fits the column');
      set({ render: build, input: v0, zoom: 1.5 });
      await settle();
      assert.equal(onScreen()[0].width, Math.round(FIT_PX * 1.5));
      set({ render: build, input: v0, zoom: 1 });
      await settle();
      assert.equal(onScreen()[0].width, FIT_PX);
      assert.deepEqual([calls.length, status()], [1, 'ready'], 'zoom never builds');
    } finally { await view.unmount(); }
  });

  it('hidden, a zoom change repaints nothing; shown again, it repaints at the new zoom', async () => {
    const [v0] = versions(1);
    const { view, set, calls, build, onScreen, pdf } = await opened(v0);
    try {
      const painted = pdf.canvases.length;
      set({ render: build, input: v0, active: false, zoom: 1.5 });
      await settle();
      assert.equal(pdf.canvases.length, painted, 'painted while hidden');
      set({ render: build, input: v0, active: true, zoom: 1.5 });
      await settle();
      assert.equal(onScreen()[0].width, Math.round(FIT_PX * 1.5));
      assert.equal(calls.length, 1, 'shown with nothing changed: no build');
    } finally { await view.unmount(); }
  });
});

describe('a failed build: an alert and Retry (R2-165)', () => {
  it('the first build fails: an alert with its message and no pages; Retry builds at once and clears it', async () => {
    const [v0] = versions(1);
    const { calls, build } = heldBuild();
    const { view, status, alert, retry, shown, onScreen } = await preview({ render: build, input: v0 });
    try {
      await settle();
      calls[0].fail('fonts did not load');
      await settle();
      assert.equal(status(), 'error');
      assert.match(alert()?.textContent ?? '', /Preview failed to render \(fonts did not load\)\./);
      assert.equal(onScreen().length, 0);
      retry();
      await settle();
      assert.equal(calls.length, 2, 'Retry builds at once');
      assert.equal(calls[1].input, v0);
      calls[1].finish();
      await settle();
      assert.deepEqual([status(), alert(), shown()], ['ready', undefined, name(v0)]);
    } finally { await view.unmount(); }
  });

  it('a later build fails: the last pages stay under the alert; the next pause in typing clears it', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, status, alert, shown } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      calls[1].fail('layout overflow');
      await settle();
      assert.equal(status(), 'error');
      assert.ok(alert(), 'the alert shows');
      assert.equal(shown(), name(v0), 'the last good pages stay');
      set({ render: build, input: v2 });
      await pause();
      calls[2].finish();
      await settle();
      assert.deepEqual([status(), alert(), shown()], ['ready', undefined, name(v2)]);
    } finally { await view.unmount(); }
  });

  it('a build that fails while a newer change waits says nothing: the newer one decides', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, status, alert, shown } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      calls[1].fail('superseded');
      await settle();
      assert.deepEqual([status(), alert()], ['rendering', undefined]);
      await pause();
      calls[2].finish();
      await settle();
      assert.deepEqual([status(), shown()], ['ready', name(v2)]);
    } finally { await view.unmount(); }
  });
});
