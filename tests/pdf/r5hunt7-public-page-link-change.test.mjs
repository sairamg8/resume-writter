// R5-HUNT7-PUBLIC-PAGE-STALE-ON-LINK-CHANGE: the public résumé page (#/r/<shareId>) stays mounted when
// the tab moves to another link (an address-bar edit, Back/Forward: only the hash changes), and it kept
// showing the previous link's résumé — its Download PDF saving that résumé — until the new link's read
// settled. Now the page says it is loading until the new link's copy is read, and shows that copy only.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs, with a fake io whose reads the test settles.
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { setupPreview, teardownPreview } from './preview-stub.mjs';
import { resume, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

let PublicResume;
let setPdfjs;
before(async () => {
  patchFakeDom();
  await setupPreview();
  ({ PublicResume } = await loadModule('/src/pages/PublicResume.jsx'));
  setPdfjs = (await loadModule('/src/components/PdfPreview.jsx'))._setPdfjsForTest;
  // pdf.js never finishes opening a document: the preview stays drawing, which this test does not read.
  setPdfjs({ worker: undefined, lib: { getDocument: () => ({ promise: new Promise(() => {}) }) } });
}, { timeout: 60_000 });
after(teardownPreview);

const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** An io whose read of each id waits until the test calls `settle(id, copy)`. */
function fakeIo() {
  const waiting = new Map();
  const reads = [];
  return {
    reads,
    readPublic(id) {
      reads.push(id);
      return new Promise((resolve) => { waiting.set(id, resolve); });
    },
    settle(id, copy) { waiting.get(id)(copy); },
  };
}

const copyOf = (name) => {
  const r = resume({ personal: { name, title: 'Designer', email: '', phone: '', location: '', summary: '', hiddenFields: [] }, sections: [] });
  return { template: r.template, settings: r.settings, personal: r.personal, sections: r.sections };
};

function page(io, start) {
  let navigate;
  const Nav = () => { navigate = useNavigate(); return null; };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [start] },
    createElement(Nav),
    createElement(Routes, null, createElement(Route, { path: '/r/:shareId', element: createElement(PublicResume, { io }) }))));
  return { view, go: (to) => view.act(() => navigate(to)), text: () => view.container.textContent };
}
const hasDownload = (view) => [...elements(view.container)].some((el) => el.tagName === 'BUTTON' && /Download PDF/.test(el.textContent));

describe('the public page moved to another link (R5-HUNT7)', () => {
  it('says it is loading, with no Download PDF, until the new link is read', async () => {
    const io = fakeIo();
    const p = page(io, '/r/idA');
    try {
      await flush();
      io.settle('idA', copyOf('Jordan Ellery'));
      await flush();
      assert.ok(hasDownload(p.view), 'link A shows its résumé');
      p.go('/r/idB');
      await flush();
      assert.deepEqual(io.reads, ['idA', 'idB'], 'link B is read');
      assert.ok(!hasDownload(p.view), 'A\'s résumé and its PDF are gone under B\'s address');
      assert.match(p.text(), /Loading the résumé…/);
      io.settle('idB', null);
      await flush();
      assert.match(p.text(), /This résumé is not published/, 'B\'s own answer is shown');
    } finally { await p.view.unmount(); }
  });

  it('the previous link\'s answer (not published) is not shown for the next link', async () => {
    const io = fakeIo();
    const p = page(io, '/r/idA');
    try {
      await flush();
      io.settle('idA', null);
      await flush();
      assert.match(p.text(), /not published/);
      p.go('/r/idB');
      await flush();
      assert.doesNotMatch(p.text(), /not published/, 'A\'s answer is not shown for B');
      io.settle('idB', copyOf('Casey Morgan'));
      await flush();
      assert.ok(hasDownload(p.view), 'B\'s résumé is shown once read');
    } finally { await p.view.unmount(); }
  });
});
