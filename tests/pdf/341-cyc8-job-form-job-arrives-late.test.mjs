// /jobs/:id/edit opened for a job this browser does not hold yet (an empty second device right after
// sign-in, before the first cloud sync brought the jobs) froze the job as "none" in useState, so the
// page said "Job not found" for good even after the job arrived (a reload fixed it). The form now looks
// the job up on every render and opens on it when it arrives, with its values, as if opened on it.
// On the real JobForm and job store (tests/pdf/fake-dom.mjs), in a MemoryRouter.
// Run: node --test tests/pdf/341-cyc8-job-form-job-arrives-late.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const orbit = {
  id: 'late', company: 'Orbit Labs', role: 'Engineer', status: 'applied', appliedDate: '2026-09-01', notes: '',
  todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

async function openEmpty(path) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const store = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: [], dataVersion: 2 }));
  globalThis.sessionStorage = new MemoryStorage();
  store._resetJobStoreForTest();
  const appStore = { appState: { resumes: [] } };
  function App() {
    return h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store: appStore }) })));
  }
  const view = dom.mount(App);
  await settle();
  const all = () => [...dom.elements(view.container)];
  return {
    view,
    text: () => view.container.textContent,
    heading: () => all().find((el) => el.tagName === 'H3')?.textContent.trim(),
    value: (field) => dom.reactProps(all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field))).value,
    /** The cloud sync bringing the job: the shared list is replaced, as useCollectionSync does. */
    arrive(jobs) { view.act(() => { store.replaceJobs(jobs); }); },
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('the job arrives after the page opened: "Job not found" gives way to the form on that job', async () => {
  const page = await openEmpty('/jobs/late/edit');
  try {
    assert.equal(page.heading(), 'Job not found', 'nothing yet: the missing-job state');
    page.arrive([orbit]);
    await settle();
    assert.doesNotMatch(page.text(), /Job not found/);
    assert.equal(page.value('company'), 'Orbit Labs', 'the form holds the job that arrived');
    assert.equal(page.value('role'), 'Engineer');
  } finally {
    await page.close();
  }
});

it('a job that never arrives still shows "Job not found"', async () => {
  const page = await openEmpty('/jobs/nope/edit');
  try {
    page.arrive([orbit]);
    await settle();
    assert.equal(page.heading(), 'Job not found', 'another job arrived, not this one');
  } finally {
    await page.close();
  }
});
