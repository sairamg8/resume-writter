// R5-HUNT3-checklist-undo-overwrites-after-remount, the job's Tasks tab (review): Undo on "Task
// deleted" wrote back the task list as the TasksTab that did the delete last rendered it. That tab
// unmounts when another tab (Overview, Notes) is opened, so a task added after coming back to
// Tasks was lost when Undo was clicked. Pinned: Undo puts the task back into the job's tasks as the
// job store has them at the click. The real job page and job store in the kit's ToastProvider over
// fake-dom, storage in memory (as 95-job-notes-tab). Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = {
  id: 'a', company: 'Acme', role: 'Dev', status: 'applied', url: '', location: '', salary: '', contact: '',
  appliedDate: '2026-09-01', deadline: '', resumeId: '', notes: '',
  todos: [
    { id: 't1', text: 'Email the recruiter', done: false },
    { id: 't2', text: 'Book a mock interview', done: false },
  ],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const ev = (el, extra = {}) => ({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, ...extra });

it('Undo after leaving the Tasks tab and adding a task on coming back keeps the new task', async () => {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: [job], dataVersion: 2 })]]);
  _resetJobStoreForTest();
  function App() {
    return h(ToastProvider, null, h(MemoryRouter, { initialEntries: ['/jobs/a'] }, h(Routes, null,
      h(Route, { path: '/jobs/:id', element: h(JobDetail, { store: { appState: { resumes: [] } } }) }))));
  }
  const view = dom.mount(App, {});
  // The toasts are portalled to <body>, outside the container.
  const all = () => [...dom.elements(view.document.body)];
  const fire = (el, handler, extra) => view.act(() => dom.reactProps(el)[handler](ev(el, extra)));
  // A tab's button: its label, then the Tasks count when there are tasks.
  const tabButton = (label) => all().find((el) => el.tagName === 'BUTTON'
    && el.textContent.trim().replace(/\d+$/, '') === label);
  const stored = () => JSON.parse(globalThis.localStorage.getItem(KEY)).jobs.find((j) => j.id === 'a');
  const row = (text) => all().find((el) => el.tagName === 'SPAN' && el.textContent === text)?.parentNode;
  try {
    // The job page opens on its Tasks tab.
    assert.ok(row('Book a mock interview'), 'the Tasks tab shows the job\'s tasks');
    fire(row('Book a mock interview').childNodes.at(-1), 'onClick');
    assert.deepEqual(stored().todos.map((t) => t.id), ['t1'], 'the task goes at once');
    const toast = all().find((el) => el.hasAttribute('data-toast') && el.textContent.includes('Task deleted'));
    assert.ok(toast, 'the delete offered Undo');
    const undo = [...dom.elements(toast)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
    assert.ok(undo, 'the toast has an Undo button');

    // To Overview and back: the Tasks tab is a new one.
    fire(tabButton('Overview'), 'onClick');
    assert.equal(row('Email the recruiter'), undefined, 'the Tasks tab is gone while Overview shows');
    fire(tabButton('Tasks'), 'onClick');
    const field = all().find((el) => el.getAttribute('aria-label') === 'New task');
    assert.ok(field, 'back on the Tasks tab');
    fire(field, 'onChange', { target: { value: 'Send a thank-you note' } });
    fire(all().find((el) => el.getAttribute('aria-label') === 'New task'), 'onKeyDown', { key: 'Enter' });
    assert.deepEqual(stored().todos.map((t) => t.text), ['Email the recruiter', 'Send a thank-you note']);

    fire(undo, 'onClick');
    assert.deepEqual(stored().todos.map((t) => t.text), ['Email the recruiter', 'Book a mock interview', 'Send a thank-you note'],
      'the deleted task is back at its place and the one added since is kept');
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
