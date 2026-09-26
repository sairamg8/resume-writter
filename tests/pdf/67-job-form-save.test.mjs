// The job form's save, on the real JobForm and the real store (tests/pdf/fake-dom.mjs, loaded through
// Vite for the `@/` aliases). J-02: Save Changes wrote the whole form — the to-dos, history and status
// as they were when it opened — over the job, so a task or a status change another tab saved meanwhile
// was lost and a false history entry added. J-16: /jobs/:id/edit for a job that does not exist, or
// was deleted while the form was open, took input and threw it away on save. J-36: the page had no
// <form>, so Enter in a field did nothing, and Company and Role both wore a "required" star though
// either one is enough.
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
      h(Route, { path: '/jobs/new', element: h(JobForm, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store: { appState: { resumes: [] } } }) }),
      h(Route, { path: '/jobs/:id', element: h(Detail) })));
  }
  const view = dom.mount(App);
  const all = () => [...dom.elements(view.container)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.includes(text));
  return {
    view,
    all,
    text: () => view.container.textContent,
    input,
    button,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    click(text) {
      const el = button(text);
      const props = dom.reactProps(el);
      // A submit button has no click handler of its own: the browser submits the form it names (J-36).
      if (!props.onClick && el.getAttribute('type') === 'submit') {
        const owner = all().find((f) => f.tagName === 'FORM' && f.getAttribute('id') === el.getAttribute('form'));
        view.act(() => dom.reactProps(owner).onSubmit({ preventDefault() {} }));
        return;
      }
      view.act(() => props.onClick({ preventDefault() {} }));
    },
    /** The form the fields are in, as the browser finds it for Enter in one of them; null when none is. */
    formOf(field) { return all().find((el) => el.tagName === 'FORM' && el.contains(input(field))) ?? null; },
    /** Enter in a field: the browser submits the field's form (implicit submission). */
    pressEnterIn(field) {
      const owner = this.formOf(field);
      assert.ok(owner, `the ${field} field is in a <form>, so Enter in it submits`);
      let prevented = false;
      view.act(() => dom.reactProps(owner).onSubmit({ preventDefault() { prevented = true; } }));
      assert.equal(prevented, true, 'the submit is the page\'s own, not a reload of the page');
    },
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

it('J-36: Enter in a field of a new job adds it and opens it, as Add Job does', async () => {
  const form = await openForm('/jobs/new', []);
  try {
    form.type('company', 'Acme');
    form.pressEnterIn('company');
    const jobs = stored();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].company, 'Acme');
    await form.settle();
    assert.match(form.text(), new RegExp(`DETAIL ${jobs[0].id}`));
  } finally {
    await form.close();
  }
});

it('J-36: Enter in a field of an existing job saves the edit, as Save Changes does', async () => {
  const form = await openForm('/jobs/a/edit', [acme]);
  try {
    form.type('location', 'Berlin');
    form.pressEnterIn('location');
    assert.equal(stored()[0].location, 'Berlin');
    await form.settle();
    assert.match(form.text(), /DETAIL a/);
  } finally {
    await form.close();
  }
});

it('J-36: both Save buttons submit the fields\' form, every other button in it is a plain button, and Enter with neither company nor role saves nothing', async () => {
  const form = await openForm('/jobs/new', []);
  try {
    const owner = form.formOf('company');
    assert.ok(owner);
    for (const field of ['role', 'location', 'salary', 'url', 'appliedDate', 'deadline', 'contact']) {
      assert.equal(form.formOf(field), owner, `${field} is in the same form`);
    }
    const buttons = form.all().filter((el) => el.tagName === 'BUTTON');
    const submits = buttons.filter((b) => b.getAttribute('type') === 'submit');
    assert.equal(submits.length, 2, 'the header\'s and the footer\'s Add Job');
    for (const b of submits) {
      assert.equal(b.textContent.trim(), 'Add Job');
      assert.equal(b.getAttribute('form'), owner.getAttribute('id'), 'it submits the fields\' form');
    }
    // A button with no type inside a form submits it: Cancel or a stage would save the job.
    for (const b of buttons.filter((x) => owner.contains(x))) assert.equal(b.getAttribute('type'), 'button', b.textContent);

    form.pressEnterIn('company');
    assert.equal(stored().length, 0, 'a job with no company and no role is not added');
    assert.ok(form.input('company'), 'the form stays open');
  } finally {
    await form.close();
  }
});

it('J-36: Company and Role wear no "required" star, and the form says either one is enough', async () => {
  const form = await openForm('/jobs/new', []);
  try {
    const labelOf = (field) => form.all().find((el) => el.tagName === 'LABEL' && (el.getAttribute('for') || '').endsWith(field));
    assert.equal(labelOf('company').textContent, 'Company');
    assert.equal(labelOf('role').textContent, 'Role / Position');
    assert.match(form.text(), /A company or a role is enough to save the job\./);
  } finally {
    await form.close();
  }
});
