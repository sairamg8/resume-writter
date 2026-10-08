// #/r/<shareId> with an id Firestore refuses as a document name (a %2F in the link, "..", one far too long): the read
// throws "invalid-argument" before it asks the server anything, and the page said "The résumé could not be loaded.
// Check your connection and try again." for a link no connection can mend. Now such a link gets the answer of a link
// that was never published ("This résumé is not published ... the link is wrong"); a real failure (offline) still
// says to check the connection.
// Mounted with react-dom/client over tests/pdf/fake-dom.mjs, with a fake io. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setupPreview, teardownPreview } from './preview-stub.mjs';
import { loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

let PublicResume;
before(async () => {
  patchFakeDom();
  await setupPreview();
  ({ PublicResume } = await loadModule('/src/pages/PublicResume.jsx'));
}, { timeout: 60_000 });
after(teardownPreview);

const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };

async function textFor(path, failure) {
  const io = { readPublic: () => Promise.reject(failure) };
  const log = console.error;
  console.error = () => {};
  const view = mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/r/:shareId', element: createElement(PublicResume, { io }) }))));
  try {
    await flush();
    return view.container.textContent;
  } finally {
    console.error = log;
    await view.unmount();
  }
}

it('a link whose id Firestore refuses says the résumé is not published, not that the connection failed', async () => {
  const refused = Object.assign(new Error('Invalid document reference. Document references must have an even number of segments.'), { code: 'invalid-argument' });
  const text = await textFor('/r/a%2Fb', refused);
  assert.match(text, /This résumé is not published/);
  assert.doesNotMatch(text, /Check your connection/);
});

it('a read that fails for another reason (offline) still says to check the connection', async () => {
  const text = await textFor('/r/idA', Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' }));
  assert.match(text, /could not be loaded/);
  assert.match(text, /Check your connection/);
});
