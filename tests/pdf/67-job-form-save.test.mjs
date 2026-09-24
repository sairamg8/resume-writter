// The job form's save, on the real JobForm and the real store (tests/pdf/fake-dom.mjs, loaded through
// Vite for the `@/` aliases). J-02: Save Changes wrote the whole form — the to-dos, history and status
// as they were when it opened — over the job, so a task or a status change another tab saved meanwhile
// was lost and a false history entry added. J-16: /jobs/:id/edit for a job that does not exist, or
// was deleted while the form was open, took input and threw it away on save.
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

const acme = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', appliedDate: '2026-09-01', notes: '',
  todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};
const saved = (jobs) => JSON.stringify({ jobs, dataVersion: 2 });
const stored = () => JSON.parse(localStorage.getItem(KEY)).jobs;

/** JobForm at `path` over storage holding `jobs`, with the job page as a probe that prints its id. */
async function openForm(path, jobs) {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route, useParams } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, saved(jobs));
  _resetJobStoreForTest();
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  function App() {
    return h(MemoryRouter, { initialEntries: [path] }, h(Routes, null,
      h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/:id', element: h(Detail) })));
  }
  const view = dom.mount(App);
  const all = () => [...dom.elements(view.container)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.includes(text));
  return {
    view,
    text: () => view.container.textContent,
    input,
    button,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    click(text) { view.act(() => dom.reactProps(button(text)).onClick({ preventDefault() {} })); },
    otherTabSaves(list) {
      const value = saved(list);
      localStorage.setItem(KEY, value);
      view.act(() => view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: value }));
    },
    /** React Router navigates in a transition: let the scheduler's tasks run before reading the page. */
    async settle() { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('J-02: Save Changes writes what the form edited — another tab\'s task and status stay, no false history', async () => {
  const form = await openForm('/jobs/a/edit', [acme]);
  try {
    form.otherTabSaves([{
      ...acme, status: 'interview', todos: [{ id: 't1', text: 'Prep system design', done: false }],
      statusHistory: [{ status: 'applied', changedAt: 1 }, { status: 'interview', changedAt: 2 }], updatedAt: 2,
    }]);
    form.type('role', 'Senior Dev');
    form.click('Save Changes');
    const [a] = stored();
    assert.equal(a.role, 'Senior Dev');
    assert.equal(a.status, 'interview', 'the status the other tab set');
    assert.deepEqual(a.todos.map((t) => t.text), ['Prep system design']);
    assert.deepEqual(a.statusHistory.map((x) => x.status), ['applied', 'interview'], 'no entry for the stale status');
    await form.settle();
    assert.match(form.text(), /DETAIL a/);
  } finally {
    await form.close();
  }
});

it('J-16: /jobs/:id/edit for a job that does not exist shows "Job not found", not a form', async () => {
  const form = await openForm('/jobs/nope/edit', [acme]);
  try {
    assert.match(form.text(), /Job not found/);
    assert.equal(form.input('company'), undefined, 'no inputs to type into');
  } finally {
    await form.close();
  }
});

it('J-16: a job deleted while its form was open keeps what was typed, and offers to save it as a new job', async () => {
  const form = await openForm('/jobs/a/edit', [acme]);
  try {
    form.type('company', 'Acme Robotics');
    form.otherTabSaves([]); // another tab deletes it
    form.click('Save Changes');
    assert.equal(stored().length, 0, 'nothing was written on the deleted job');
    assert.ok(form.input('company'), 'the form, and what was typed, are still there');
    assert.match(form.text(), /deleted/i);
    form.click('Save as a new job');
    const jobs = stored();
    assert.equal(jobs.length, 1);
    assert.deepEqual([jobs[0].company, jobs[0].role], ['Acme Robotics', 'Dev']);
    assert.notEqual(jobs[0].id, 'a');
    await form.settle();
    assert.match(form.text(), new RegExp(`DETAIL ${jobs[0].id}`));
  } finally {
    await form.close();
  }
});
