// UI rebuild B1 (hunt B1-H2-13/14): after a deploy replaced the hashed chunk files, a tab opened before it asks
// for a file that is gone, so Career History's Try again can never succeed. The first failure keeps its notice
// as it was; a Try again that fails again adds "The app may have been updated." and a Reload page button. A
// reload the person chooses drops nothing (an automatic one would drop a draft). The real Dashboard over
// tests/pdf/fake-dom.mjs, Career History's import() replaced by one that rejects.
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
const offline = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), id, name, updatedAt });

async function dashboard() {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  warmed.clear();
  loaders.career = offline;
  globalThis.localStorage = new MemoryStorage([]);
  let reloaded = 0;
  const savedLocation = globalThis.location;
  globalThis.location = { reload: () => { reloaded += 1; }, assign: () => { reloaded += 1; } };
  const savedError = console.error;
  console.error = () => {};
  const noop = () => {};
  const resumes = [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)];
  const store = {
    appState: { resumes, activeId: 'resume_a' }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop, createLetter: () => null,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  const all = () => [...elements(view.document.body)];
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label);
  return {
    loaders, real, all, button, view,
    reloads: () => reloaded,
    press(label) { view.act(() => reactProps(button(label)).onClick({})); },
    notice: () => all().find((el) => el.tagName === 'SPAN' && text(el).startsWith('Career History could not load')),
    async close() {
      await view.unmount();
      Object.assign(loaders, real);
      console.error = savedError;
      globalThis.location = savedLocation;
      if (savedLocation === undefined) delete globalThis.location;
      delete globalThis.localStorage;
    },
  };
}

it('the first failure keeps its notice and offers no reload; a second one adds the update sentence and Reload page, which reloads once', async () => {
  const page = await dashboard();
  try {
    await until(() => page.notice(), 'the notice');
    assert.equal(text(page.notice()), 'Career History could not load. Check your connection.', 'the first notice, as it was');
    assert.equal(page.button('Reload page'), undefined, 'no reload on the first failure');
    page.press('Try again');
    await until(() => page.button('Reload page'), 'Reload page after the second failure');
    assert.ok(text(page.notice()).endsWith('The app may have been updated.'), 'the second sentence');
    assert.ok(page.button('Try again'), 'Try again stays');
    assert.equal(page.reloads(), 0, 'nothing reloads by itself');
    page.press('Reload page');
    assert.equal(page.reloads(), 1, 'the page reloads once, when chosen');
  } finally { await page.close(); }
});

it('Try again still recovers after a second failure once the network is back', async () => {
  const page = await dashboard();
  try {
    await until(() => page.button('Try again'), 'the notice');
    page.press('Try again');
    await until(() => page.button('Reload page'), 'the second failure');
    page.loaders.career = page.real.career;
    page.press('Try again');
    await until(() => page.button('Open Job Tracker →'), 'the panel');
    assert.equal(page.button('Reload page'), undefined, 'the notice is gone');
    assert.equal(page.reloads(), 0);
  } finally { await page.close(); }
});
