// Defect (noted in final-hunt round 2 and left): Save, or Cancel, on a job's edit form pushed the job page
// again, so the history read [tracker, job, edit form, job] and Back from the job page opened the edit form
// once more (showing the values just saved). The job page's Edit button now marks the form's entry
// (state.fromJob), and Save and Cancel step back to the job page instead: [tracker, job]. A form opened by
// its address (no mark) pushes as before.
// The real JobForm and job store over tests/pdf/fake-dom.mjs, in a memory data router as the app's
// (the harness of 102-r4-dux-06-one-discard-question).
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

const orbit = {
  id: 'o', company: 'Orbit Labs', role: 'Engineer', status: 'applied', appliedDate: '2026-09-01', notes: '',
  todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, key: '', nativeEvent: {}, ...props });

/** The edit form of job `o`, opened as the Edit button does (`marked`) or by its address. */
async function openForm(marked) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route, useParams } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { ConfirmProvider } = await loadModule('/src/components/ui/index.js');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify({ jobs: [orbit], dataVersion: 2 }));
  globalThis.sessionStorage = new MemoryStorage();
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  const routes = () => h(ConfirmProvider, null, h(Routes, null,
    h(Route, { path: '/jobs', element: h('p', null, 'TRACKER') }),
    h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id', element: h(Detail) })));
  const edit = marked ? { pathname: '/jobs/o/edit', state: { fromJob: true } } : '/jobs/o/edit';
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/jobs', '/jobs/o', edit], initialIndex: 2 });
  const view = dom.mount(() => h(RouterProvider, { router }), {});
  const proto = Object.getPrototypeOf(view.document.body);
  proto.scrollIntoView ??= () => {};
  const all = () => [...dom.elements(view.document.body)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
    await new Promise((r) => { setTimeout(r, 30); });
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
  };
  await settle();
  return {
    path: () => router.state.location.pathname,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    save() { view.act(() => { dom.reactProps(all().find((el) => el.tagName === 'FORM')).onSubmit(ev()); }); },
    cancel() { view.act(() => { dom.reactProps(all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Cancel')).onClick(ev()); }); },
    async back() { view.act(() => { router.navigate(-1); }); await settle(); },
    settle,
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('Save on a form opened from the job page steps back to it: one Back leaves for the tracker', async () => {
  const form = await openForm(true);
  try {
    form.type('role', 'Staff Engineer');
    form.save();
    await form.settle();
    assert.equal(form.path(), '/jobs/o');
    await form.back();
    assert.equal(form.path(), '/jobs', 'before: Back opened the edit form again');
  } finally {
    await form.close();
  }
});

it('Cancel on an untouched form opened from the job page steps back too', async () => {
  const form = await openForm(true);
  try {
    form.cancel();
    await form.settle();
    assert.equal(form.path(), '/jobs/o');
    await form.back();
    assert.equal(form.path(), '/jobs');
  } finally {
    await form.close();
  }
});

it('a form opened by its address (no mark) still pushes the job page, as before', async () => {
  const form = await openForm(false);
  try {
    form.type('role', 'Staff Engineer');
    form.save();
    await form.settle();
    assert.equal(form.path(), '/jobs/o');
    await form.back();
    assert.equal(form.path(), '/jobs/o/edit');
  } finally {
    await form.close();
  }
});
