// #/r/<shareId> on a connection that failed: the page said "Check your connection and try again." and offered nothing to
// press, so a visitor on a phone had to reload the whole page to try again. Now the message has a Try again button that
// reads the link again (the page goes back to "Loading the résumé…" meanwhile) and shows the résumé when the read succeeds.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs, with a fake io whose reads the test settles. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setupPreview, teardownPreview } from './preview-stub.mjs';
import { resume, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
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

const copyOf = (name) => {
  const r = resume({ personal: { name, title: 'Designer', email: '', phone: '', location: '', summary: '', hiddenFields: [] }, sections: [] });
  return { template: r.template, settings: r.settings, personal: r.personal, sections: r.sections };
};

const button = (view, label) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);

it('a read that failed on the connection has a Try again button that reads the link again and shows the résumé', async () => {
  const reads = [];
  const answers = [() => Promise.reject(Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' })), () => Promise.resolve(copyOf('Jordan Ellery'))];
  const io = { readPublic: (id) => { reads.push(id); return answers[reads.length - 1](); } };
  const log = console.error;
  console.error = () => {};
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/r/idA'] },
    createElement(Routes, null, createElement(Route, { path: '/r/:shareId', element: createElement(PublicResume, { io }) }))));
  try {
    await flush();
    assert.match(view.container.textContent, /could not be loaded/);
    assert.equal(button(view, 'Download PDF'), undefined, 'no résumé yet');
    const retry = button(view, 'Try again');
    assert.ok(retry, 'the message offers Try again');
    view.act(() => reactProps(retry).onClick({}));
    await flush();
    assert.deepEqual(reads, ['idA', 'idA'], 'the same link is read a second time');
    assert.ok(button(view, 'Download PDF'), 'the résumé of the second read is shown');
    assert.doesNotMatch(view.container.textContent, /could not be loaded/);
    assert.equal(button(view, 'Try again'), undefined, 'the button goes with the message');
  } finally {
    console.error = log;
    await view.unmount();
  }
});
