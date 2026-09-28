// R4-DUX-06: the job form's Cancel and back arrow navigated away at once and dropped everything
// typed. Now, with changes, they ask "Discard your changes?" first (the kit's confirm, or the
// browser's confirm() where no ConfirmProvider is mounted, as here), an untouched form still leaves
// at once, and while there are changes closing the tab is guarded by a beforeunload listener.
// The browser's Back and every in-app link (the breadcrumbs, the sidebar, the top bar, quick search)
// left a changed form with no question, as the app's plain HashRouter could not hold them. The app
// now mounts a data router (createHashRouter), and they ask the same question: Keep editing stays
// with what was typed, Discard clears the draft and goes on. Save, Add Job and a confirmed Cancel
// ask nothing more. A reload or a closed tab still keeps the draft in sessionStorage
// ('jobform:new' / 'jobform:<id>') and restores it on return, with a "Restored your unsaved
// changes" line whose Discard goes back to the start values.
// On the real JobForm and store (tests/pdf/fake-dom.mjs, loaded through Vite for the `@/` aliases),
// in a memory data router as the app's (createMemoryRouter + RouterProvider).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

it('R4-DUX-06: Cancel on an untouched form leaves at once, asking nothing', async () => {
  const form = await openForm('/jobs/new');
  try {
    assert.equal(form.beforeunloadListeners(), 0, 'nothing to guard on an untouched form');
    await form.click('Cancel');
    assert.deepEqual(form.asked, []);
    assert.match(form.text(), /TRACKER/);
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: Cancel with changes asks "Discard your changes?"; Keep editing stays, Discard leaves', async () => {
  const form = await openForm('/jobs/new');
  try {
    form.type('company', 'Northwind Pixel');
    form.state.answer = false;
    await form.click('Cancel');
    assert.deepEqual(form.asked, ['Discard your changes?']);
    assert.doesNotMatch(form.text(), /TRACKER/, 'still on the form');
    assert.equal(form.value('company'), 'Northwind Pixel', 'what was typed is kept');

    form.state.answer = true;
    await form.click('Cancel');
    assert.equal(form.asked.length, 2);
    assert.match(form.text(), /TRACKER/);
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: the back arrow on an edited job asks too, then returns to the job', async () => {
  const form = await openForm('/jobs/o/edit');
  try {
    form.type('role', 'Staff Engineer');
    form.state.answer = false;
    await form.click('back');
    assert.deepEqual(form.asked, ['Discard your changes?']);
    assert.doesNotMatch(form.text(), /DETAIL o/, 'still on the form');

    form.state.answer = true;
    await form.click('back');
    assert.match(form.text(), /DETAIL o/);
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: closing the tab is guarded while the form has changes, and only then', async () => {
  const form = await openForm('/jobs/o/edit');
  try {
    assert.equal(form.beforeunloadListeners(), 0);
    form.type('salary', '$120k');
    assert.equal(form.beforeunloadListeners(), 1, 'a beforeunload guard while there are changes');
    let prevented = false;
    const event = { type: 'beforeunload', preventDefault() { prevented = true; }, returnValue: undefined };
    form.view.window.dispatchEvent(event);
    assert.equal(prevented, true, 'the browser is asked to confirm leaving');

    form.type('salary', '');
    assert.equal(form.beforeunloadListeners(), 0, 'back to the starting values: no guard');
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: a changed form closed without leaving (a reload, a closed tab) comes back with what was typed', async () => {
  const session = new MemoryStorage();
  const first = await openForm('/jobs/o/edit', [orbit], session);
  try {
    first.type('role', 'Principal Engineer');
    assert.ok(session.getItem('jobform:o'), 'the draft is kept while the form differs');
  } finally {
    await first.close(); // unmounted as a reload or a closed tab does, with no question the app can ask
  }
  const again = await openForm('/jobs/o/edit', [orbit], session);
  try {
    assert.equal(again.value('role'), 'Principal Engineer', 'the typed value is back');
    assert.match(again.text(), /Restored your unsaved changes/);
    await again.click('Discard');
    assert.equal(again.value('role'), 'Engineer', 'Discard goes back to the job as it is');
    assert.doesNotMatch(again.text(), /Restored your unsaved changes/);
    assert.equal(session.getItem('jobform:o'), null, 'Discard clears the draft');
    assert.equal(again.beforeunloadListeners(), 0);
  } finally {
    await again.close();
  }
});

it('R4-DUX-06: a new job\'s draft comes back too, and Add Job clears it', async () => {
  const session = new MemoryStorage();
  const first = await openForm('/jobs/new', [], session);
  try {
    first.type('company', 'Quillfeather Co');
  } finally {
    await first.close();
  }
  assert.ok(session.getItem('jobform:new'));
  const again = await openForm('/jobs/new', [], session);
  try {
    assert.equal(again.value('company'), 'Quillfeather Co');
    assert.match(again.text(), /Restored your unsaved changes/);
    again.submit();
    await again.settle();
    assert.equal(session.getItem('jobform:new'), null, 'a saved job leaves no draft');
    assert.match(again.text(), /DETAIL /);
  } finally {
    await again.close();
  }
});

it('R4-DUX-06: Discard in the Cancel question clears the draft; an untouched form restores nothing', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/o/edit', [orbit], session);
  try {
    form.type('location', 'Lisbon');
    form.state.answer = true;
    await form.click('Cancel');
    assert.equal(session.getItem('jobform:o'), null);
  } finally {
    await form.close();
  }
  const again = await openForm('/jobs/o/edit', [orbit], session);
  try {
    assert.equal(again.value('location'), '');
    assert.doesNotMatch(again.text(), /Restored your unsaved changes/);
    assert.equal(again.has('Discard'), false);
  } finally {
    await again.close();
  }
});

it('R4-DUX-06: the app mounts a data router, so the job form can hold the browser\'s Back and links', () => {
  const main = readFileSync(new URL('../../src/main.jsx', import.meta.url), 'utf8');
  assert.match(main, /createHashRouter\(/);
  assert.match(main, /<RouterProvider router=\{router\} \/>/);
  assert.doesNotMatch(main, /<HashRouter>/, 'the plain HashRouter has no useBlocker');
});

it('R4-DUX-06: the Job Tracker crumb on a changed form asks; Keep editing stays with the typing, Discard goes on', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/new', [], session);
  try {
    form.type('company', 'Northwind Pixel');
    form.state.answer = false;
    await form.crumb('Job Tracker');
    assert.deepEqual(form.asked, ['Discard your changes?']);
    assert.equal(form.path(), '/jobs/new', 'Keep editing: still on the form');
    assert.doesNotMatch(form.text(), /TRACKER/);
    assert.equal(form.value('company'), 'Northwind Pixel', 'what was typed is kept');

    form.state.answer = true;
    await form.crumb('Job Tracker');
    assert.equal(form.asked.length, 2, 'asked once for this way out');
    assert.equal(form.path(), '/jobs');
    assert.match(form.text(), /TRACKER/);
    assert.equal(session.getItem('jobform:new'), null, 'Discard clears the draft');
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: the job\'s crumb on an edited job asks too, then opens the job', async () => {
  const form = await openForm('/jobs/o/edit');
  try {
    form.type('role', 'Staff Engineer');
    form.state.answer = true;
    await form.crumb('Orbit Labs');
    assert.deepEqual(form.asked, ['Discard your changes?']);
    assert.equal(form.path(), '/jobs/o');
    assert.match(form.text(), /DETAIL o/);
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: the browser\'s Back on a changed form asks; Keep editing stays, Discard goes back', async () => {
  const session = new MemoryStorage();
  const form = await openForm('/jobs/o/edit', [orbit], session);
  try {
    form.type('salary', '$140k');
    form.state.answer = false;
    await form.back();
    assert.deepEqual(form.asked, ['Discard your changes?']);
    assert.equal(form.path(), '/jobs/o/edit', 'Keep editing: still on the form');
    assert.equal(form.value('salary'), '$140k');

    form.state.answer = true;
    await form.back();
    assert.equal(form.asked.length, 2);
    assert.equal(form.path(), '/jobs');
    assert.match(form.text(), /TRACKER/);
    assert.equal(session.getItem('jobform:o'), null, 'Discard clears the draft');
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: an untouched form, Save and a confirmed Cancel leave with no (second) question', async () => {
  const untouched = await openForm('/jobs/o/edit');
  try {
    await untouched.crumb('Job Tracker');
    assert.deepEqual(untouched.asked, []);
    assert.equal(untouched.path(), '/jobs');
  } finally {
    await untouched.close();
  }
  const saved = await openForm('/jobs/o/edit');
  try {
    saved.type('role', 'Lead Engineer');
    saved.submit();
    await saved.settle();
    assert.deepEqual(saved.asked, [], 'Save leaves without asking');
    assert.equal(saved.path(), '/jobs/o');
  } finally {
    await saved.close();
  }
  const added = await openForm('/jobs/new', []);
  try {
    added.type('company', 'Quillfeather Co');
    added.submit();
    await added.settle();
    assert.deepEqual(added.asked, [], 'Add Job leaves without asking');
    assert.match(added.text(), /DETAIL /);
  } finally {
    await added.close();
  }
  const cancelled = await openForm('/jobs/new', []);
  try {
    cancelled.type('company', 'Quillfeather Co');
    cancelled.state.answer = true;
    await cancelled.click('Cancel');
    assert.deepEqual(cancelled.asked, ['Discard your changes?'], 'Cancel asks once, not again as it navigates');
    assert.equal(cancelled.path(), '/jobs');
  } finally {
    await cancelled.close();
  }
});
