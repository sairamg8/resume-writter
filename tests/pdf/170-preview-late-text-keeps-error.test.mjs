// The stuck "Updating preview…" (typing-freeze hunt, D-1): the status of a change undone back to the input of the
// latest build comes from how that build ended (PdfPreview `ended`, tests/pdf/116). The text of the pages of an
// EARLIER build is read after its pages are up, and when that read was slow it came in after a LATER build had
// failed: it wrote its own 'ready' over the failed build's record. An undo back to the failed build's input then
// found a record of another build, took it for a build still on its way and set 'rendering' for good, with no
// build running, no timer and no way out but another edit. Now the older text leaves the newer build's record.
// PdfPreview over fake-dom with a stand-in pdf.js and builds the test finishes (preview-stub.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, settle, pause, versions, name, preview, heldBuild, textGate } from './preview-stub.mjs';

before(setupPreview);
after(teardownPreview);

describe('a slow text read of an older build does not erase how a newer build ended', () => {
  it('v1 up with its text pending, v2 fails, v3 typed, v1\'s text arrives, v3 undone to v2: error and Retry, not \'rendering\'', async () => {
    const [v0, v1, v2, v3] = versions(4);
    const { calls, build } = heldBuild();
    const p = await preview({ render: build, input: v0 });
    const gate = textGate(p.pdf);
    const { view, set, status, shown, alert } = p;
    try {
      await settle();
      calls[0].finish();
      await settle();
      assert.deepEqual([shown(), status()], [name(v0), 'ready']);
      gate.hold();
      set({ render: build, input: v1 });
      await pause();
      calls[1].finish();
      await settle();
      assert.equal(status(), 'rendering', 'v1 is up, its text still to come');
      set({ render: build, input: v2 });
      await pause();
      assert.equal(calls.length, 3, 'v2 builds');
      calls[2].fail('layout overflow');
      await settle();
      assert.equal(status(), 'error');
      set({ render: build, input: v3 }); // typing goes on: v2 is no longer the latest
      await settle();
      gate.release(); // v1's text comes in now
      await settle();
      assert.equal(status(), 'rendering', 'v3 is still in its pause');
      set({ render: build, input: v2 }); // undone before v3's build starts
      await pause();
      assert.equal(calls.length, 3, 'nothing builds');
      assert.equal(status(), 'error', 'v2\'s build failed: the preview says so again (was: \'rendering\' for good)');
      assert.match(alert()?.textContent ?? '', /layout overflow/);
    } finally { gate.release(); await view.unmount(); }
  });
});
