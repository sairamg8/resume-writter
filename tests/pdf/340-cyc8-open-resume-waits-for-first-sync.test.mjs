// An address for a résumé this browser does not hold yet, opened on an empty second device right after
// sign-in (before the first cloud sync has brought the account's list), was sent to the Dashboard at
// once by useOpenResume, so the link never opened the résumé. Now, while the account is being restored
// or its first sync has not answered, the Editor shows its loading state; the page goes home as before
// once the sync answered without that résumé, and at once when there is no account, the sync is off,
// offline or failed. The wait is bounded (a sync that never answers cannot hold the user on Loading).
// The hook over a MemoryRouter, and the real Editor page for the loading state.
// Run: node --test tests/pdf/340-cyc8-open-resume-waits-for-first-sync.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage } from './resume-tab.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const settle = async (view) => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
/** Polls until `done()` holds, by what happened (bounded), not by a clock. */
async function until(view, done, what) {
  for (let i = 0; i < 500; i += 1) {
    view.act(() => {});
    if (done()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.fail(`never happened: ${what}`);
}

const USER = { uid: 'u_second' };
const signedIn = { user: USER, authLoading: false };
const signedOut = { user: null, authLoading: false };
const syncing = { syncStatus: 'syncing', account: null };
const answered = { syncStatus: 'synced', account: { uid: 'u_second', cloud: true } };

function makeStore(resumes, calls) {
  return { appState: { resumes, activeId: resumes[0]?.id ?? null }, setActiveId: (id) => calls.push(id) };
}

/** useOpenResume('r_new') on /resume/r_new, with the Dashboard at '/'. */
async function openHook(initial) {
  const { useOpenResume } = await loadModule('/src/hooks/useOpenResume.js');
  const seen = { where: null, calls: [] };
  function Where() { const l = useLocation(); seen.where = l.pathname; return null; }
  function Page({ store, auth, sync, waitMs }) {
    const pending = useOpenResume(store, 'r_new', auth, sync, waitMs);
    return createElement('p', null, pending ? 'WAITING' : 'IDLE');
  }
  function App(props) {
    return createElement(MemoryRouter, { initialEntries: ['/resume/r_new'] },
      createElement(Where),
      createElement(Routes, null,
        createElement(Route, { path: '/resume/:id', element: createElement(Page, props) }),
        createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') })));
  }
  const view = mount(App, { store: makeStore(initial.resumes ?? [], seen.calls), auth: initial.auth, sync: initial.sync, waitMs: initial.waitMs });
  return {
    view,
    seen,
    text: () => view.container.textContent,
    set(next) { view.update({ store: makeStore(next.resumes ?? [], seen.calls), auth: next.auth, sync: next.sync, waitMs: next.waitMs }); },
  };
}

it('signed in with the first sync not answered: the address waits, it is not sent home', async () => {
  const page = await openHook({ auth: signedIn, sync: syncing });
  try {
    await settle(page.view);
    assert.equal(page.seen.where, '/resume/r_new', 'still at the résumé address');
    assert.equal(page.text(), 'WAITING');
  } finally { await page.view.unmount(); }
});

it('the résumé arrives with the sync: it is opened, with no trip to the dashboard', async () => {
  const page = await openHook({ auth: signedIn, sync: syncing });
  try {
    await settle(page.view);
    page.set({ resumes: [{ id: 'r_new' }], auth: signedIn, sync: answered });
    await settle(page.view);
    assert.equal(page.seen.where, '/resume/r_new');
    assert.equal(page.text(), 'IDLE');
    assert.deepEqual(page.seen.calls, [], 'it is the open one already (activeId), nothing to set');
  } finally { await page.view.unmount(); }
});

it('the sync answered without that résumé: the page goes to the dashboard as before', async () => {
  const page = await openHook({ auth: signedIn, sync: syncing });
  try {
    await settle(page.view);
    page.set({ resumes: [{ id: 'other' }], auth: signedIn, sync: answered });
    await settle(page.view);
    assert.equal(page.seen.where, '/');
    assert.match(page.text(), /THE DASHBOARD/);
  } finally { await page.view.unmount(); }
});

it('another account answered earlier: this account first sync is still waited for', async () => {
  const page = await openHook({ auth: signedIn, sync: { syncStatus: 'syncing', account: { uid: 'u_first', cloud: true } } });
  try {
    await settle(page.view);
    assert.equal(page.seen.where, '/resume/r_new');
    assert.equal(page.text(), 'WAITING');
  } finally { await page.view.unmount(); }
});

for (const [name, auth, sync] of [
  ['no account', signedOut, { syncStatus: 'idle', account: null }],
  ['the sync is off', signedIn, { syncStatus: 'off', account: { uid: 'u_second', cloud: false } }],
  ['the browser is offline', signedIn, { syncStatus: 'offline', account: null }],
  ['the sync failed', signedIn, { syncStatus: 'error', account: null }],
  ['the sync stopped', signedIn, { syncStatus: 'stopped', account: null }],
]) {
  it(`${name}: the address goes to the dashboard at once`, async () => {
    const page = await openHook({ auth, sync });
    try {
      await settle(page.view);
      assert.equal(page.seen.where, '/');
      assert.match(page.text(), /THE DASHBOARD/);
    } finally { await page.view.unmount(); }
  });
}

it('the account still being restored waits; once restored as signed out it goes home', async () => {
  const page = await openHook({ auth: { user: null, authLoading: true }, sync: { syncStatus: 'idle', account: null } });
  try {
    await settle(page.view);
    assert.equal(page.seen.where, '/resume/r_new');
    assert.equal(page.text(), 'WAITING');
    page.set({ auth: signedOut, sync: { syncStatus: 'idle', account: null } });
    await settle(page.view);
    assert.equal(page.seen.where, '/');
  } finally { await page.view.unmount(); }
});

it('a sync that never answers cannot hold the page: after the wait it goes home', async () => {
  const page = await openHook({ auth: signedIn, sync: syncing, waitMs: 30 });
  try {
    assert.equal(page.text(), 'WAITING');
    await until(page.view, () => page.seen.where === '/', 'the wait ran out and the page went home');
    assert.match(page.text(), /THE DASHBOARD/);
  } finally { await page.view.unmount(); }
});

it('the real Editor shows its loading state while the résumé is awaited', async () => {
  const { Editor } = await loadModule('/src/pages/Editor.jsx');
  globalThis.localStorage = new MemoryStorage();
  const store = {
    appState: { resumes: [], deletedIds: [], activeId: null, syncedUid: null },
    activeResume: undefined,
    persistError: null, persistReason: null, saving: false, savedAt: null,
    setActiveId() {},
  };
  const auth = { user: USER, authLoading: false, cloudAvailable: true, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'syncing', lastSynced: null, isOnline: true, account: null, heldResumes: [] };
  let where = null;
  function Where() { const l = useLocation(); where = l.pathname; return null; }
  function App() {
    return createElement(MemoryRouter, { initialEntries: ['/resume/r_new'] },
      createElement(Where),
      createElement(Routes, null,
        createElement(Route, { path: '/resume/:id', element: createElement(Editor, { store, auth, sync }) }),
        createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') })));
  }
  const view = mount(App, {});
  try {
    await settle(view);
    assert.equal(where, '/resume/r_new');
    assert.match(view.container.textContent, /Loading…/);
    assert.doesNotMatch(view.container.textContent, /THE DASHBOARD/);
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
