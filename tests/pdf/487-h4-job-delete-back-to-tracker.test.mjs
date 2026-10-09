// Defect: deleting a job from its page pushed the tracker, so the history read [tracker, job, tracker] and
// Back from the tracker opened the job that was just deleted, as "Job not found". A job opened from the
// tracker now marks its entry (state.fromTracker); deleting it steps back to the tracker's entry as it was
// left (its view). A job page reached another way (its address) is replaced by the tracker instead.
// The real JobTracker, JobDetail and job store over tests/pdf/fake-dom.mjs, in a memory data router as the
// app's, under the kit's toast and confirm hosts.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = (id, company) => ({
  id, company, role: 'Engineer', status: 'applied', url: '', location: '', salary: '', contact: '', appliedDate: '', deadline: '',
  resumeId: '', notes: '', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
});
const JOBS = [job('a', 'Acme'), job('b', 'Beta Labs')];

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, key: '', nativeEvent: {}, ...props });

/** The app's two job routes at `entries` (the last one shown), after a first page `/`. */
async function open(entries) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const { ToastProvider, ConfirmProvider } = await loadModule('/src/components/ui/index.js');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: JOBS, dataVersion: 2 })]]);
  globalThis.sessionStorage = memoryStorage();
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  const routes = () => h(ToastProvider, null, h(ConfirmProvider, null, h(Routes, null,
    h(Route, { path: '/', element: h('p', null, 'HOME') }),
    h(Route, { path: '/jobs', element: h(JobTracker, { store }) }),
    h(Route, { path: '/jobs/:id', element: h(JobDetail, { store }) }))));
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: entries, initialIndex: entries.length - 1 });
  const view = dom.mount(() => h(RouterProvider, { router }), {});
  Object.getPrototypeOf(view.document.body).scrollIntoView ??= () => {};
  const all = (node = view.document.body) => [...dom.elements(node)];
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
    await new Promise((r) => { setTimeout(r, 30); });
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
  };
  await settle();
  const click = (el) => view.act(() => dom.reactProps(el).onClick(ev()));
  return {
    router, all, click, settle,
    at: () => `${router.state.location.pathname}${router.state.location.search}`,
    button: (label, node) => all(node).find((el) => el.tagName === 'BUTTON' && (el.textContent.trim() === label || el.getAttribute('aria-label') === label)),
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    async deleteHere() {
      click(this.button('Job actions'));
      click(this.item('Delete'));
      await settle();
      click(this.button('Delete', all().find((el) => el.getAttribute('role') === 'alertdialog')));
      await settle();
    },
    async back() { view.act(() => { router.navigate(-1); }); await settle(); },
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('a job opened from the tracker: deleting it steps back to the tracker as it was left, and Back from there leaves the tracker', async () => {
  const app = await open(['/', '/jobs?view=list']);
  try {
    app.click(app.button('Acme'));
    await app.settle();
    assert.equal(app.at(), '/jobs/a');
    assert.deepEqual(app.router.state.location.state, { fromTracker: true }, 'the card marks the entry it opens');
    await app.deleteHere();
    assert.equal(app.at(), '/jobs?view=list', 'the tracker, in the view it was left in');
    await app.back();
    assert.equal(app.at(), '/', 'before: Back opened the job that was just deleted');
  } finally {
    await app.close();
  }
});

it('a job page reached by its address: deleting it replaces that page with the tracker', async () => {
  const app = await open(['/', '/jobs/a']);
  try {
    await app.deleteHere();
    assert.equal(app.at(), '/jobs');
    await app.back();
    assert.equal(app.at(), '/');
  } finally {
    await app.close();
  }
});
