// UI rebuild B1 (hunts B1-H2-15, B1-H3-2-8): a New Cover click abandoned while the picker's chunk was slow could fire
// much later: the import rejected, the fallback made a stray letter and navigated away from whatever the person
// had since done. The first fix judged it by a 10 s window, which also dropped the letter of a person who just
// waited (B1-H3-1-2); it is now judged by what the person did: another click, key or address change since New
// Cover closes the request with no letter, however soon the failure comes; without one the letter is made, however late.
// The real Dashboard over tests/pdf/fake-dom.mjs, the picker's import() a promise the test rejects.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
async function until(check, what) {
  for (let i = 0; i < 500; i += 1) {
    if (check()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.fail(`never: ${what}`);
}
const settle = async () => { for (let i = 0; i < 30; i += 1) await new Promise((r) => { setTimeout(r, 10); }); };
const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), id, name, updatedAt });

/** The Dashboard over several résumés; the picker's import() is one pending promise, `failPicker()` rejects it. */
async function dashboard() {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  warmed.clear();
  let failPicker;
  const pending = new Promise((_, reject) => { failPicker = () => reject(new TypeError('Failed to fetch dynamically imported module')); });
  loaders.letter = () => pending;
  globalThis.localStorage = new MemoryStorage([]);
  const savedError = console.error;
  console.error = () => {};
  const made = [];
  const noop = () => {};
  const resumes = [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000), cv('resume_c', 'Middle CV', 2000)];
  const store = {
    appState: { resumes, activeId: 'resume_a' }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop,
    createLetter: (fromId) => { made.push(fromId); return `letter_${made.length}`; },
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  const button = (label) => [...elements(view.document.body)].find((el) => el.tagName === 'BUTTON' && text(el) === label);
  return {
    made, failPicker,
    press(label) { view.act(() => reactProps(button(label)).onClick({})); },
    interact(target, type) { view[target].dispatchEvent({ type }); },
    listening: () => view.document.listeners('pointerdown') > 0,
    async close() {
      await view.unmount();
      Object.assign(loaders, real);
      console.error = savedError;
      delete globalThis.localStorage;
    },
  };
}

it('an abandoned New Cover (the person clicked elsewhere) makes no letter, and the next New Cover starts a fresh request', async () => {
  const page = await dashboard();
  try {
    page.press('New Cover');
    await until(page.listening, 'the request is watching');
    page.interact('window', 'hashchange');
    page.failPicker();
    // The retry that shows a failed lazy piece is throttled by React (about 300 ms): wait until the request has closed.
    await until(() => !page.listening(), 'the abandoned request closed');
    assert.deepEqual(page.made, [], 'no stray letter from the abandoned request');
    page.press('New Cover');
    await until(() => page.made.length > 0, 'the fresh request makes its letter');
    assert.deepEqual(page.made, ['resume_b']);
  } finally { await page.close(); }
});

it('a picker that fails with the person doing nothing else still makes one letter from the first source', async () => {
  const page = await dashboard();
  try {
    page.press('New Cover');
    page.failPicker();
    await until(() => page.made.length > 0, 'a letter made');
    await settle();
    assert.deepEqual(page.made, ['resume_b']);
  } finally { await page.close(); }
});
