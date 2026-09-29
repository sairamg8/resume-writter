// R5-HUNT6-SIGNOUT-JOB-FORM-SAVE-AS-NEW, review: the fix sent a job form back to the tracker only in
// the tab that ran the cloud sync's leave (collectionSyncEngine.leave → leaveRecovery). A sign-out
// reaches every tab, and the leave runs in whichever hears it first: the sync record then names no
// account, so every other tab's own leave finds nothing to do, and only hears its list empty. A job
// form open there still took that for a job deleted in another tab and offered "Save as a new
// job", which copied the account's job into the signed-out list for the next account to upload;
// and an Add job draft kept in a tab that heard nothing was restored for the next account. Now a
// tab hears the account leave from the sync record, and a draft names the account it was typed on.
// On the real JobForm and store (tests/pdf/fake-dom.mjs, loaded through Vite), in a memory data
// router as the app's. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const SYNC_KEY = 'cpwtcv_jobs_sync_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const orbit = {
  id: 'o', company: 'Orbit Labs', role: 'Engineer', status: 'applied', appliedDate: '2026-09-01', notes: '',
  todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};
const record = (uid) => JSON.stringify({ uid, versions: uid ? { o: 1 } : {}, order: null, stashed: {} });
const list = (jobs) => JSON.stringify({ jobs, dataVersion: 2 });

/** JobForm at `path` over `local` (this browser's localStorage) and `session` (this tab's sessionStorage). */
async function openForm(path, local, session) {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route, useParams } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  const routes = () => h(Routes, null,
    h(Route, { path: '/jobs', element: h('p', null, 'TRACKER') }),
    h(Route, { path: '/jobs/new', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id', element: h(Detail) }));
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/jobs', path], initialIndex: 1 });
  const view = dom.mount(() => h(RouterProvider, { router }));
  view.window.confirm = () => false;
  const all = () => [...dom.elements(view.container)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };
  await settle();
  return {
    path: () => router.state.location.pathname,
    text: () => view.container.textContent,
    value: (field) => dom.reactProps(input(field)).value,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    has: (text) => all().some((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    /** Another tab runs the leave: the sync record forgets the account, then the list empties. */
    async otherTabSignsOut(uid) {
      local.setItem(SYNC_KEY, record(null));
      view.act(() => view.window.dispatchEvent({ type: 'storage', key: SYNC_KEY, oldValue: record(uid), newValue: record(null) }));
      local.setItem(KEY, list([]));
      view.act(() => view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: list([]) }));
      await settle();
    },
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('R5-HUNT6 review: signed out in another tab, an open Edit form goes back and saves nothing', async () => {
  const local = new MemoryStorage();
  local.setItem(KEY, list([orbit]));
  local.setItem(SYNC_KEY, record('account-a'));
  const session = new MemoryStorage();
  const form = await openForm('/jobs/o/edit', local, session);
  try {
    form.type('salary', '150k');
    await form.otherTabSignsOut('account-a');
    assert.equal(form.has('Save as a new job'), false, `no Save as a new job: ${form.text()}`);
    assert.equal(form.path(), '/jobs', 'the form went back to the tracker');
    assert.deepEqual(JSON.parse(local.getItem(KEY)).jobs, [], 'nothing of the account is in the signed-out list');
    assert.equal(session.getItem('jobform:o'), null, 'its draft left with the list');
  } finally {
    await form.close();
  }
});

it('R5-HUNT6 review: an Add job draft kept in a tab that heard nothing is not restored for the next account', async () => {
  const local = new MemoryStorage();
  local.setItem(KEY, list([orbit]));
  local.setItem(SYNC_KEY, record('account-a'));
  const session = new MemoryStorage();
  let form = await openForm('/jobs/new', local, session);
  form.type('company', 'Account A Co');
  await form.close(); // the draft stays, as after a link away
  assert.ok(session.getItem('jobform:new'), 'the draft is kept while the account is here');

  // Still account A's list: the draft comes back, as it always did (R4-DUX-06).
  form = await openForm('/jobs/new', local, session);
  try {
    assert.equal(form.value('company'), 'Account A Co', 'restored on the same account');
  } finally {
    await form.close();
  }

  // Another tab signs out (no job page listens here) and account B signs in.
  local.setItem(KEY, list([]));
  local.setItem(SYNC_KEY, record('account-b'));
  form = await openForm('/jobs/new', local, session);
  try {
    assert.equal(form.value('company'), '', 'account A\'s draft is not given to account B');
    assert.ok(!/Account A Co/.test(form.text()), 'nothing of it shows');
  } finally {
    await form.close();
  }
  assert.equal(session.getItem('jobform:new'), null, 'and it is dropped');
});
