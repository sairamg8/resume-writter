// UI rebuild B1 (hunt B1-H2-15): a New Cover click abandoned while the picker's chunk was slow could fire much
// later: the import rejected, the fallback made a stray letter and navigated away from whatever the person
// had since done. The fallback makes the letter only when the failure arrives within 10 s of the request;
// a later one just closes the request, and the next New Cover starts a fresh one.
// The real Dashboard over tests/pdf/fake-dom.mjs, the picker's import() a promise the test rejects, and
// the Dashboard's clock (_lazyForTest.clock) moved by the test.
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
  const { loaders, warmed, clock } = _lazyForTest;
  const real = { ...loaders };
  const realNow = clock.now;
  warmed.clear();
  let failPicker;
  const pending = new Promise((_, reject) => { failPicker = () => reject(new TypeError('Failed to fetch dynamically imported module')); });
  loaders.letter = () => pending;
  let t = 1_000_000;
  clock.now = () => t;
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
    advance(ms) { t += ms; },
    async close() {
      await view.unmount();
      Object.assign(loaders, real);
      clock.now = realNow;
      console.error = savedError;
      delete globalThis.localStorage;
    },
  };
}

it('a picker that fails more than 10 s after New Cover makes no letter; the next New Cover starts a fresh request', async () => {
  const page = await dashboard();
  try {
    page.press('New Cover');
    page.advance(11_000);
    page.failPicker();
    await settle();
    assert.deepEqual(page.made, [], 'no stray letter from the abandoned request');
    page.press('New Cover');
    await until(() => page.made.length > 0, 'the fresh request makes its letter');
    assert.deepEqual(page.made, ['resume_b']);
  } finally { await page.close(); }
});

it('a picker that fails within 10 s still makes one letter from the first source', async () => {
  const page = await dashboard();
  try {
    page.press('New Cover');
    page.advance(9_000);
    page.failPicker();
    await until(() => page.made.length > 0, 'a letter made');
    await settle();
    assert.deepEqual(page.made, ['resume_b']);
  } finally { await page.close(); }
});
