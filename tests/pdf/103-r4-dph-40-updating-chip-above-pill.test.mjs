// R4-DPH-40: on a phone's Preview tab the "Updating preview…" chip (PdfPreview, fixed bottom-4 right-4)
// sat at the same bottom offset as the editor's Edit | Preview pill (Editor.jsx, fixed bottom-4, z-40),
// which painted over the chip's start. Below md (768 px, where the pill shows) the chip now rides above
// the pill (max-md:bottom-16: 64 px up, past the pill's top 54 px up); from md up it stays at bottom-4
// right-4 as before. The fake DOM has no layout, so this pins the chip's classes on the real PdfPreview,
// mounted over tests/pdf/fake-dom.mjs with the stand-in pdf.js of tests/pdf/preview-stub.mjs and caught
// while a change rebuilds over pages already on screen (the only time the chip shows).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupPreview, teardownPreview, opened, versions, settle } from './preview-stub.mjs';
import { elements } from './fake-dom.mjs';

before(setupPreview);
after(teardownPreview);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

it('the chip sits above the phone\'s pill below md, and where it was from md up', async () => {
  const [v0, v1] = versions(2);
  const { view, set, build, status } = await opened(v0);
  try {
    const chip = () => [...elements(view.container)].find((el) => el.tagName === 'SPAN' && el.textContent.trim() === 'Updating preview…');
    assert.equal(chip(), undefined, 'no chip while the pages on screen are current');
    set({ render: build, input: v1 }); // an edit: it waits for the typing to pause, the old pages stay up
    await settle();
    assert.equal(status(), 'rendering');
    const el = chip();
    assert.ok(el, 'the chip shows while the edit rebuilds');
    const t = tokens(el);
    assert.ok(t.includes('max-md:bottom-16'), `below md the chip clears the pill, got ${t.join(' ')}`);
    for (const kept of ['fixed', 'bottom-4', 'right-4']) assert.ok(t.includes(kept), `from md up the chip keeps ${kept}`);
  } finally { await view.unmount(); }
});
