// The preview's status after a change that never built (R2-142). A change sets 'rendering' and waits
// for a pause (or, one build at a time, for the build on its way). Undone before its build started —
// Undo, or a value typed back — the input is again what the last build was asked for, so nothing is
// built; but the status stayed 'rendering' for good, the "Updating preview…" chip up over pages that
// were current, and a failed build's alert never came back. Waiting for a running build
// (tests/pdf/111-preview-one-build-at-a-time) widened that window from the 350 ms pause to the whole
// build. And a change made while the preview is hidden left it 'paused', but a build still on its way
// then reported 'ready' over it when its text came in (PERF-5 reads the text after the paint).
// Now the last build speaks for the status again when its input is back, and a hidden change is a
// generation of its own.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, opened } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('a change undone before it built leaves the status of the build it went back to (R2-142)', () => {
  it('undone within the pause: ready on the pages it has, and nothing builds', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      assert.equal(status(), 'ready');
      set({ render: build, input: v1 });
      await settle();
      assert.equal(status(), 'rendering', 'the change waits for its pause');
      set({ render: build, input: v0 }); // undone before the pause ends
      await pause();
      assert.equal(calls.length, 1, 'v0 is on screen: nothing to build');
      assert.deepEqual([shown(), status()], [name(v0), 'ready'], 'ready on v0 (was: \'rendering\' for good)');
    } finally { await view.unmount(); }
  });

  it('undone while waiting for a running build of the input it went back to: ready when that build ends', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      assert.equal(calls.length, 2, 'v1 is building');
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 2, 'v2 waits for v1');
      set({ render: build, input: v1 }); // v2 undone: v1 is what is building
      await settle();
      assert.equal(status(), 'rendering', 'v1 is still on its way');
      calls[1].finish();
      await settle();
      assert.equal(calls.length, 2, 'v2 never builds');
      assert.deepEqual([shown(), status()], [name(v1), 'ready'], 'ready on v1 once it is up (was: \'rendering\' for good)');
    } finally { await view.unmount(); }
  });

  it('undone back to an input whose build failed: the alert and Retry are back', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, status, alert } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      calls[1].fail('layout overflow');
      await settle();
      assert.equal(status(), 'error');
      set({ render: build, input: v2 });
      await settle();
      assert.deepEqual([status(), alert()], ['rendering', undefined]);
      set({ render: build, input: v1 }); // undone before its pause ends
      await pause();
      assert.equal(calls.length, 2, 'nothing builds');
      assert.equal(status(), 'error', 'v1\'s build failed: the preview says so again (was: \'rendering\', no alert)');
      assert.match(alert()?.textContent ?? '', /layout overflow/, 'with that build\'s message and Retry');
    } finally { await view.unmount(); }
  });
});

describe('a change made while the preview is hidden (R2-016, R2-142)', () => {
  it('a build on its way when it is hidden and edited: the status stays \'paused\' when that build ends; shown, the latest builds', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      assert.equal(calls.length, 2, 'v1 is building');
      set({ render: build, input: v2, active: false });
      await settle();
      assert.equal(status(), 'paused');
      calls[1].finish();
      await settle();
      assert.equal(status(), 'paused', 'v2 is not built: still behind (was: \'ready\' once v1\'s text came in)');
      set({ render: build, input: v2, active: true });
      await settle();
      assert.deepEqual([calls.length, calls[2]?.input], [3, v2], 'shown: one build, of v2');
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
    } finally { await view.unmount(); }
  });

  it('edited while hidden and edited back: ready, and shown again nothing builds', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1, active: false });
      await settle();
      assert.equal(status(), 'paused');
      set({ render: build, input: v0, active: false });
      await settle();
      assert.equal(status(), 'ready', 'v0 is on screen again: not behind');
      set({ render: build, input: v0, active: true });
      await settle();
      assert.equal(calls.length, 1, 'shown with nothing to build');
      assert.deepEqual([shown(), status()], [name(v0), 'ready'], 'ready (was: \'paused\' for good, though shown and current)');
    } finally { await view.unmount(); }
  });
});
