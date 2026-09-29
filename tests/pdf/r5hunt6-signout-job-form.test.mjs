// R5-HUNT6-SIGNOUT-JOB-FORM-SAVE-AS-NEW: with a job's Edit form open, signing out empties the job
// list (the cloud sync's leave: replaceJobs([]), then leaveRecovery). The form took that for a job
// deleted in another tab and offered "Save as a new job", which copied the account's job into the
// signed-out list, and the next account to sign in uploaded it. An "Add job" form's draft in
// sessionStorage also outlived the sign-out and was restored for the next account. Now a form open
// as its account's list leaves goes back to the tracker without saving anything, and every job
// form's draft leaves with the list. On the real JobForm and store (tests/pdf/fake-dom.mjs, loaded
// through Vite), in a memory data router as the app's. Fictional data only.
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


/** The cloud sync's leave for this list, as collectionSyncEngine.leave runs it. */
async function signOut(form) {
  const { replaceJobs, leaveRecovery } = await loadModule('/src/hooks/useJobStore.js');
  form.view.act(() => { replaceJobs([]); leaveRecovery(); });
  await form.settle();
}

it('R5-HUNT6: signing out with the Edit form open does not offer "Save as a new job", and saves nothing', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/o/edit', [orbit], session);
  try {
    form.type('salary', '150k');
    await signOut(form);
    assert.ok(!/deleted in another tab/.test(form.text()), `no "deleted in another tab" notice: ${form.text()}`);
    assert.equal(form.has('Save as a new job'), false, 'no Save as a new job');
    assert.equal(form.path(), '/jobs', 'the form went back to the tracker');
    const { jobsNow } = await loadModule('/src/hooks/useJobStore.js');
    assert.deepEqual(jobsNow(), [], 'nothing of the account is in the signed-out list');
    assert.equal(session.getItem('jobform:o'), null, 'its draft left with the list');
  } finally {
    await form.close();
  }
});

it('R5-HUNT6: an Add job draft leaves with the list, so the next account does not get it back', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/new', [orbit], session);
  try {
    form.type('company', 'Account A Co');
    assert.ok(session.getItem('jobform:new'), 'the draft is kept while signed in');
    await signOut(form);
    assert.equal(form.path(), '/jobs', 'the form went back to the tracker');
    assert.equal(session.getItem('jobform:new'), null, 'the Add job draft left with the list');
    const { jobsNow } = await loadModule('/src/hooks/useJobStore.js');
    assert.deepEqual(jobsNow(), [], 'nothing was added to the signed-out list');
  } finally {
    await form.close();
  }
});

it('R5-HUNT6: a job deleted in another tab still offers "Save as a new job" (J-16)', async () => {
  const form = await openForm('/jobs/o/edit');
  try {
    const { replaceJobs } = await loadModule('/src/hooks/useJobStore.js');
    form.view.act(() => { replaceJobs([]); });
    await form.settle();
    assert.ok(/deleted in another tab/.test(form.text()));
    assert.equal(form.has('Save as a new job'), true);
    assert.equal(form.path(), '/jobs/o/edit');
  } finally {
    await form.close();
  }
});
