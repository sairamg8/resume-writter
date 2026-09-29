// R5-HUNT6-DASH-IMPORT-AFTER-SIGN-OUT: Dashboard → Import of a PDF or Word file reads for seconds. When the
// account signed out meanwhile (its list leaves the browser, leaveAccount), the read still added the
// résumé to the list that was left — this browser's own, signed out, which joins whoever signs in next
// — and opened it in the editor. Now a read that ends after the list left the account it was started
// for keeps the résumé aside for that account (`stashed`, as leaveAccount keeps what it had not sent;
// its next sign-in brings it), opens nothing and says so. An import with no sign-out is unchanged.
// The real Dashboard over the real store (useAppStore on an in-memory localStorage), in a MemoryRouter
// with no <Routes>, mounted with react-dom/client over tests/pdf/fake-dom.mjs; the file's bytes arrive
// when the test says.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
  // The document reader, loaded now, as the Dashboard loads it when a file comes.
  await loadModule('/src/utils/importFile.js');
});
after(teardown);

const KEY = 'cpwtcv_v1';
const TEXT = 'Wren Calloway\nHarbor Pilot\nwren@example.com\n\nExperience\nHarbor Pilot, Northern Coast Pilots\nJan 2018 - Present\nGuided vessels into port.\n';

async function dashboard() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  const mine = { ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 };
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [mine], activeId: 'resume_a', syncedUid: 'u', cloudVersions: { resume_a: 1000 } })]]);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null };
  function Where() {
    const at = useLocation();
    box.where = at.pathname;
    return null;
  }
  function Page() {
    box.store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), createElement(Dashboard, { store: box.store, auth, sync }));
  }
  const view = mount(Page, {});
  await settle();
  const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
  assert.ok(input, 'the Import file input');
  let arrive;
  const bytes = new Promise((resolve) => { arrive = () => resolve(new TextEncoder().encode(TEXT).buffer); });
  const file = { name: 'wren.txt', size: TEXT.length, arrayBuffer: () => bytes };
  return {
    box,
    text: () => view.container.textContent,
    pick: async () => { view.act(() => reactProps(input).onChange({ target: { files: [file], value: '' } })); await settle(); },
    signOut: async () => { view.act(() => box.store.leaveAccount('u')); await settle(); },
    arrive: async () => { arrive(); await settle(); view.act(() => {}); await settle(); },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('a read that ends after the sign-out keeps the résumé for that account, off the signed-out list', async () => {
  const page = await dashboard();
  try {
    await page.pick();
    await page.signOut();
    assert.equal(page.box.store.appState.syncedUid, null);
    await page.arrive();
    const { appState } = page.box.store;
    assert.deepEqual(appState.resumes.map((r) => r.name), [], 'added to the signed-out list');
    assert.equal(page.box.where, '/', 'opened in the editor after the sign-out');
    const kept = appState.stashed?.u?.resumes ?? [];
    assert.equal(kept.length, 1, 'kept aside for the account it was imported for');
    assert.notEqual(kept[0].id, 'resume_a', 'the imported one, not the list that left');
    assert.match(page.text(), /kept for that account/);
  } finally { await page.close(); }
});

it('with no sign-out, the import is added and opened as before', async () => {
  const page = await dashboard();
  try {
    await page.pick();
    await page.arrive();
    const { appState } = page.box.store;
    assert.equal(appState.resumes.length, 2);
    const made = appState.resumes.find((r) => r.id !== 'resume_a');
    assert.equal(page.box.where, `/resume/${made.id}`);
    assert.equal(appState.stashed?.u, undefined);
  } finally { await page.close(); }
});
