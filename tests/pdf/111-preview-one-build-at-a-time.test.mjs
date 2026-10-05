// One build at a time (R2-142): a pause in typing while a build is on its way must not start another.
// Every pause of DEBOUNCE_MS or more started a build at once, whether or not one was running. The PDF
// worker runs its jobs in turn, so on a long résumé each stale version of the typing was laid out before
// the latest: typing a URL two keys at a time with a pause between (a hunt-and-peck typist) posted 25
// builds for 72 keys, up to 15 queued, and the preview settled 21 s after the last key. Now the change
// that pauses behind a running build waits for it — only the latest does — and builds the moment it
// finishes. The header of PdfPreview.jsx and tests/pdf/97-preview-steady-typing always said one build at
// a time; they covered typing that never pauses, where it held.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, opened, unmountLeavingPage } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('a pause in typing while a build is on its way queues one build, of the latest change (R2-142)', () => {
  it('four pauses behind a running build: still one build running; the latest starts when it finishes', async () => {
    const [v0, v1, v2, v3, v4] = versions(5);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      assert.equal(calls.length, 2, 'the pause started the build of v1');
      for (const v of [v2, v3, v4]) { set({ render: build, input: v }); await pause(); }
      assert.equal(calls.length, 2, `${calls.length - 1} builds started: one per pause piled onto the one running (the worker lays each out in turn)`);
      calls[1].finish();
      await settle();
      assert.equal(shown(), name(v1), 'v1 finished and is newer than what is on screen: shown');
      assert.equal(status(), 'rendering', 'the latest change is still to come');
      assert.equal(calls.length, 3, 'the latest change builds the moment v1 finished');
      assert.equal(calls[2].input, v4, 'of the latest input: v2 and v3 were never built');
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status(), calls.length], [name(v4), 'ready', 3]);
    } finally { await view.unmount(); }
  });

  it('a change typed while one waits takes its place, and builds after its own pause', async () => {
    const [v0, v1, v2, v3] = versions(4);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 2, 'v2 waits for v1');
      set({ render: build, input: v3 }); // typing goes on: v2 is no longer the latest
      calls[1].finish();
      await settle();
      assert.equal(calls.length, 2, 'v1 finished, but v2 was replaced and v3 is still in its pause');
      await pause();
      assert.equal(calls.length, 3, 'v3 builds after its pause');
      assert.equal(calls[2].input, v3);
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v3), 'ready']);
    } finally { await view.unmount(); }
  });

  it('the change that waited builds even when the build before it failed', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status, alert } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 2, 'v2 waits for v1');
      calls[1].fail('layout overflow');
      await settle();
      assert.equal(calls.length, 3, 'v1 failed: v2 builds at once');
      assert.deepEqual([status(), alert()], ['rendering', undefined], 'the older failure says nothing: the newer build decides');
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status(), alert()], [name(v2), 'ready', undefined]);
    } finally { await view.unmount(); }
  });

  it('gone before the running build finishes: the change that waited never builds', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build } = await opened(v0);
    set({ render: build, input: v1 });
    await pause();
    set({ render: build, input: v2 });
    await pause();
    assert.equal(calls.length, 2, 'v2 waits for v1');
    const restore = await unmountLeavingPage(view);
    try {
      calls[1].finish();
      await settle();
      assert.equal(calls.length, 2, 'a preview that is gone starts no build');
    } finally { restore(); }
  });

  it('hidden before the running build finishes: nothing builds; shown again, one build of the latest', async () => {
    const [v0, v1, v2] = versions(3);
    const { view, set, calls, build, shown, status } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 2, 'v2 waits for v1');
      set({ render: build, input: v2, active: false });
      calls[1].finish();
      await settle();
      assert.equal(calls.length, 2, 'a hidden preview builds nothing');
      assert.equal(status(), 'paused');
      set({ render: build, input: v2, active: true });
      await settle();
      assert.equal(calls.length, 3, 'shown again: one build');
      assert.equal(calls[2].input, v2, 'of the latest input');
      calls[2].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v2), 'ready']);
    } finally { await view.unmount(); }
  });
});
