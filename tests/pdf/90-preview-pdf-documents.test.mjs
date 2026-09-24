// Every pdf.js document is destroyed once it is not on screen (R2-106): also one opened by a render
// that finishes after the preview unmounted (Cover Letter clicked mid-render, Back to dashboard),
// and one opened by a render that then failed. Each used to stay alive, with its fonts, for the
// session.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, preview, heldBuild, settle, pause, versions, name, opened, unmountLeavingPage } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('pdf.js documents are destroyed once off screen (R2-106)', () => {
  it('unmounted while a render is in flight: the document it opens afterwards is destroyed', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, pdf } = await opened(v0);
    set({ render: build, input: v1 });
    await pause();
    const restore = await unmountLeavingPage(view); // Cover Letter clicked mid-render
    calls[1].finish();
    await settle();
    restore();
    assert.deepEqual(pdf.docs.filter((d) => !d.destroyed).map((d) => d.name), [], 'documents left alive');
  });

  it('unmounted before the first render finishes: its document is destroyed', async () => {
    const [v0] = versions(1);
    const { calls, build } = heldBuild();
    const { view, pdf } = await preview({ render: build, input: v0 });
    await settle();
    const restore = await unmountLeavingPage(view);
    calls[0].finish();
    await settle();
    restore();
    assert.deepEqual(pdf.docs.filter((d) => !d.destroyed).map((d) => d.name), [], 'documents left alive');
  });

  it('a render that fails after opening its document destroys it; the pages on screen stay', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, pdf, shown, status } = await opened(v0);
    try {
      pdf.failPaint = true;
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.equal(status(), 'error');
      assert.equal(shown(), name(v0), 'the last good pages stay');
      assert.deepEqual(pdf.docs.map((d) => [d.name, d.destroyed]), [[name(v0), false], [name(v1), true]]);
    } finally { await view.unmount(); }
    assert.ok(pdf.docs.every((d) => d.destroyed), 'unmount destroys the one on screen');
  });

  it('a newer render replaces the document on screen and destroys the old one', async () => {
    const [v0, v1] = versions(2);
    const { view, set, calls, build, pdf } = await opened(v0);
    try {
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.deepEqual(pdf.docs.map((d) => [d.name, d.destroyed]), [[name(v0), true], [name(v1), false]]);
    } finally { await view.unmount(); }
  });
});

