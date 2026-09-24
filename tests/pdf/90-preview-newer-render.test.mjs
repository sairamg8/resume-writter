// A finished render newer than the one on screen is shown (R2-107). The generation that marks a
// render stale was bumped when a change ARRIVED, before its 350 ms debounce, so a render that
// finished while the next change was still waiting was thrown away: during steady typing with
// short pauses the preview stayed frozen although renders kept finishing. Now only a render older
// than the pages on screen is dropped.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, opened } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('a finished render newer than the one on screen is shown (R2-107)', () => {
  it('a render that finishes while the next change waits out its debounce is shown', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      assert.equal(calls.length, 2, 'the pause started the build of v1');
      set({ render: build, input: v2 }); // typing goes on while v1 renders
      calls[1].finish();
      await settle();
      assert.equal(shown(), name(v1), 'v1 finished and is newer than what is on screen: shown');
      assert.equal(status(), 'rendering', 'v2 is still on its way');
      await pause();
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
    } finally { await view.unmount(); }
  });

  it('renders slower than the debounce: each one is shown as it finishes', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 3, 'v1 and v2 both building');
      calls[1].finish();
      await settle();
      assert.equal(shown(), name(v1), 'v1 is newer than v0: shown while v2 renders');
      assert.equal(status(), 'rendering');
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
    } finally { await view.unmount(); }
  });

  it('a render that finishes after a newer one is on screen is dropped', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status, pdf } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
      calls[1].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready'], 'the older v1 does not replace v2');
      assert.ok(pdf.docs.filter((d) => d.name === name(v1)).every((d) => d.destroyed), 'the dropped document is destroyed');
    } finally { await view.unmount(); }
  });
});

