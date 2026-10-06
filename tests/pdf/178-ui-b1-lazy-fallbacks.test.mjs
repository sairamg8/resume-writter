// UI rebuild B1 (start-up headroom): New Cover's picker and the Career History panel load on demand
// (Dashboard.jsx, Lazy), and a load can fail: offline, or after a deploy replaced the file. A failed or
// offline chunk must not remove a function, and must not reload the tab (lazyPage's reload would drop a
// draft): New Cover makes a letter from the first source (the most recently edited résumé, as with one),
// still once per visit; Career History shows a notice with a Try again button that imports it again.
// The real Dashboard over tests/pdf/fake-dom.mjs, its two import()s replaced by ones that reject.
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

/** The Dashboard over `resumes`; `fail` names the pieces whose import() rejects. `reloads()`: page reloads asked for. */
async function dashboard(resumes, fail) {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  warmed.clear();
  for (const key of fail) loaders[key] = offline;
  globalThis.localStorage = new MemoryStorage([]);
  let reloaded = 0;
  const savedLocation = globalThis.location;
  globalThis.location = { reload: () => { reloaded += 1; }, assign: () => { reloaded += 1; } };
  // The boundary logs what it caught; the run's log keeps only what is not expected.
  const savedError = console.error;
  console.error = () => {};
  const made = [];
  const noop = () => {};
  const store = {
    appState: { resumes, activeId: resumes[0]?.id }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop,
    createLetter: (fromId) => { made.push(fromId); return `letter_${made.length}`; },
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  const all = () => [...elements(view.document.body)];
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label);
  return {
    made, loaders, real, all, button, view,
    reloads: () => reloaded,
    dialog: () => all().find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed'),
    press(label) { view.act(() => reactProps(button(label)).onClick({})); },
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

const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), id, name, updatedAt });
const several = () => [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000), cv('resume_c', 'Middle CV', 2000)];

it('New Cover with several résumés and the picker\'s code unreachable: a letter from the first source, no picker, no reload, once per visit', async () => {
  const page = await dashboard(several(), ['letter']);
  try {
    page.press('New Cover');
    await until(() => page.made.length > 0, 'a letter made');
    assert.deepEqual(page.made, ['resume_b'], 'from the most recently edited résumé, as the picker\'s first choice');
    assert.equal(page.dialog(), undefined, 'no picker');
    // Another press in the same visit: the guard (the editor is still opening) makes no second letter.
    page.press('New Cover');
    for (let i = 0; i < 20; i += 1) await new Promise((r) => { setTimeout(r, 0); });
    assert.deepEqual(page.made, ['resume_b'], 'still one');
    assert.equal(page.reloads(), 0, 'the page was not reloaded');
  } finally { await page.close(); }
});

it('the dashed New Cover Letter card falls back the same way', async () => {
  const page = await dashboard(several(), ['letter']);
  try {
    page.press('New Cover Letter');
    await until(() => page.made.length > 0, 'a letter made');
    assert.deepEqual(page.made, ['resume_b']);
    assert.equal(page.reloads(), 0);
  } finally { await page.close(); }
});

it('Career History with its code unreachable: the notice and Try again; Try again imports it, and the panel shows, no reload', async () => {
  const page = await dashboard(several(), ['career']);
  try {
    await until(() => page.all().some((el) => text(el).startsWith('Career History could not load')), 'the notice');
    assert.ok(page.all().some((el) => el.tagName === 'H2' && text(el) === 'Career History'), 'the sidebar\'s heading stays');
    assert.ok(page.button('Job Tracker →'), 'and its Job Tracker link');
    assert.equal(page.button('Open Job Tracker →'), undefined, 'no panel');
    const retry = page.button('Try again');
    assert.ok(retry, 'a Try again button');
    page.loaders.career = page.real.career; // the network is back
    page.view.act(() => reactProps(retry).onClick({}));
    await until(() => page.button('Open Job Tracker →'), 'the panel after Try again');
    assert.equal(page.button('Try again'), undefined, 'the notice is gone');
    // The panel shows the open résumé: the store's activeId is the first one, resume_a.
    assert.ok(page.all().some((el) => text(el).includes('Older CV Person')), 'the panel shows the open résumé');
    assert.equal(page.reloads(), 0, 'the page was not reloaded');
  } finally { await page.close(); }
});

it('Try again while it is still unreachable keeps the notice, and a later Try again can still work', async () => {
  const page = await dashboard(several(), ['career']);
  try {
    await until(() => page.button('Try again'), 'the notice');
    page.view.act(() => reactProps(page.button('Try again')).onClick({}));
    await until(() => page.button('Try again') && page.all().some((el) => text(el).startsWith('Career History could not load')), 'the notice again');
    page.loaders.career = page.real.career;
    page.view.act(() => reactProps(page.button('Try again')).onClick({}));
    await until(() => page.button('Open Job Tracker →'), 'the panel');
    assert.equal(page.reloads(), 0);
  } finally { await page.close(); }
});
