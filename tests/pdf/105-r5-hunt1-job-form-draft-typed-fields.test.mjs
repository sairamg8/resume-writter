// R5-HUNT1-jobform-draft-reverts-newer-fields: the job form's draft (R4-DUX-06) held the whole form,
// so every field the user never touched was kept as it was when the draft was written. Restored over
// a job moved or edited since (on the board, in another tab, by a sync), those old values differed
// from the job as it is now, the save counted them as edits, and Save moved the job back to its old
// status with a false history entry and put back the old location: J-02's overwrite through the
// draft. Now the draft holds only the fields typed, and only those go over the job as it is now.
// On the real JobForm and store (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases),
// in a memory data router as the app's. Fictional data only.
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

/**
 * JobForm at `path`, with the tracker and the job page as probes; `answer` is what confirm() replies.
 * The history holds the tracker first, so the browser's Back (router.navigate(-1)) goes there.
 */
async function openForm(path, jobs = [orbit], session = new MemoryStorage()) {
  const dom = await import('./fake-dom.mjs');
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route, useParams } = await import('react-router-dom');
  const { JobForm } = await loadModule('/src/pages/JobForm.jsx');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
  globalThis.sessionStorage = session;
  _resetJobStoreForTest();
  const store = { appState: { resumes: [] } };
  function Detail() { return h('p', null, `DETAIL ${useParams().id}`); }
  // As main.jsx: the app's own <Routes> under the data router's one catch-all route.
  const routes = () => h(Routes, null,
    h(Route, { path: '/jobs', element: h('p', null, 'TRACKER') }),
    h(Route, { path: '/jobs/new', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id/edit', element: h(JobForm, { store }) }),
    h(Route, { path: '/jobs/:id', element: h(Detail) }));
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/jobs', path], initialIndex: 1 });
  function App() { return h(RouterProvider, { router }); }
  const view = dom.mount(App);
  const asked = [];
  const state = { answer: false };
  // No ConfirmProvider here: useConfirmOptional asks the browser's confirm() with the title.
  view.window.confirm = (text) => { asked.push(text); return state.answer; };
  const all = () => [...dom.elements(view.container)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };
  await settle(); // the blocker registers in effects
  return {
    view,
    router,
    asked,
    state,
    /** The address the router is at. */
    path: () => router.state.location.pathname,
    /** The value React last rendered into the field. */
    value: (field) => dom.reactProps(input(field)).value,
    text: () => view.container.textContent,
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    /** Click `which`: 'back' is the header's arrow (the first button), else the button whose text it is. */
    async click(which) {
      const el = which === 'back' ? buttons()[0] : buttons().find((b) => b.textContent.trim() === which);
      assert.ok(el, `a ${which} button`);
      let done;
      view.act(() => { done = dom.reactProps(el).onClick({ preventDefault() {} }); });
      await done;
      await settle();
    },
    has: (text) => buttons().some((b) => b.textContent.trim() === text),
    /** Follow the page header's breadcrumb link `label`, as a plain left click does. */
    async crumb(label) {
      const link = all().find((el) => el.tagName === 'A' && el.textContent.trim() === label);
      assert.ok(link, `a ${label} crumb`);
      const event = {
        button: 0, metaKey: false, altKey: false, ctrlKey: false, shiftKey: false, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
      };
      view.act(() => dom.reactProps(link).onClick(event));
      await settle();
    },
    /** The browser's Back button. */
    async back() {
      view.act(() => { router.navigate(-1); });
      await settle();
    },
    /** Submit the fields' form, as its Save button or Enter does. */
    submit() {
      const owner = all().find((el) => el.tagName === 'FORM');
      view.act(() => dom.reactProps(owner).onSubmit({ preventDefault() {} }));
    },
    settle,
    beforeunloadListeners: () => view.window.listeners('beforeunload'),
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}


it('R5-HUNT1: the draft keeps only the fields typed', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/o/edit', [orbit], session);
  try {
    form.type('salary', '150k');
    assert.deepEqual(JSON.parse(session.getItem('jobform:o')), { salary: '150k' });
  } finally {
    await form.close();
  }
});

it('R5-HUNT1: a restored draft over a job moved and edited since saves only what was typed', async () => {
  const session = new MemoryStorage();
  const first = await openForm('/jobs/o/edit', [orbit], session);
  try {
    first.type('salary', '150k');
  } finally {
    await first.close(); // a reload or a closed tab: the draft stays
  }
  // Meanwhile the board moved the job to Interview and the Overview changed its location.
  const moved = {
    ...orbit, status: 'interview', location: 'Boston', updatedAt: 3,
    statusHistory: [...orbit.statusHistory, { status: 'interview', changedAt: 2 }],
  };
  const again = await openForm('/jobs/o/edit', [moved], session);
  try {
    assert.match(again.text(), /Restored your unsaved changes/);
    assert.equal(again.value('salary'), '150k', 'what was typed is back');
    assert.equal(again.value('location'), 'Boston', 'an untouched field shows the job as it is now');
    again.submit();
    await again.settle();
    const [saved] = JSON.parse(localStorage.getItem(KEY)).jobs;
    assert.equal(saved.salary, '150k');
    assert.equal(saved.status, 'interview', 'the status the board set is kept');
    assert.equal(saved.location, 'Boston', 'the location set elsewhere is kept');
    assert.deepEqual(saved.statusHistory.map((e) => e.status), ['applied', 'interview'], 'no false history entry');
  } finally {
    await again.close();
  }
});
