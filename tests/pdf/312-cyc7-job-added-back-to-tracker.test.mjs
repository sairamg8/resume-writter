// Job-seeker journey (cycle 7): Add job, Save, then Back. Saving a new job went to the job's page as a new
// history entry on top of the Add job page, so the browser's Back (and a phone's Back key) from the page of
// the job just added opened a blank Add job form again, one press short of the tracker. The job page now takes
// the Add job page's place in the history, so Back goes to where the user came from.
// On the real JobForm and store, in a memory data router as the app's (createMemoryRouter + RouterProvider),
// as tests/pdf/102-r4-dux-06-job-form-discard.test.mjs mounts it.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** JobForm at `path` after the tracker (history: /jobs, then the form), with the tracker and the job page as probes. */
async function openForm(path, jobs = []) {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route, useParams } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
  globalThis.sessionStorage = new MemoryStorage();
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  const routes = () => h(Routes, null,
    h(Route, { path: '/jobs', element: h('p', null, 'TRACKER') }),
    h(Route, { path: '/jobs/new', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id', element: h(Detail) }));
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/jobs', path], initialIndex: 1 });
  function App() { return h(RouterProvider, { router }); }
  const view = dom.mount(App);
  const all = () => [...dom.elements(view.container)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  await settle(); // the blocker registers in effects
  return {
    view,
    router,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    submit() {
      const owner = all().find((el) => el.tagName === 'FORM');
      view.act(() => dom.reactProps(owner).onSubmit({ preventDefault() {} }));
    },
    async back() {
      view.act(() => { router.navigate(-1); });
      await settle();
    },
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('Back from the page of a job just added goes to the tracker, not to a blank Add job form', async () => {
  const form = await openForm('/jobs/new', []);
  try {
    form.type('company', 'Northwind Pixel');
    form.submit();
    await settle();
    assert.match(form.router.state.location.pathname, /^\/jobs\/job_/, 'the new job\'s page is open');
    assert.deepEqual(JSON.parse(localStorage.getItem(KEY)).jobs.map((j) => j.company), ['Northwind Pixel'], 'the job was added');

    await form.back();
    assert.equal(form.router.state.location.pathname, '/jobs', 'Back is the tracker');
  } finally {
    await form.close();
  }
});
