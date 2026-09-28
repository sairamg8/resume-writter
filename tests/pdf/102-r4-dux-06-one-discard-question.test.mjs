// R4-DUX-06 (review): with the Cancel question already open, the browser's (or Android's) Back was
// held by the form's LeaveGuard, which queued a second "Discard your changes?" behind the first in
// the shell's ConfirmProvider. Discard on the first left the form; the queued question then showed on
// the job page, where answering it did nothing (its guard was gone). Now one question at a time: a
// way out tried while it is up is dropped, and its answer decides.
// The real JobForm, store and kit ConfirmProvider (tests/pdf/fake-dom.mjs, patched for the kit Dialog,
// loaded through Vite for the `@/` aliases), in a memory data router as the app's, with the confirm
// host inside the router and outliving the form, as WorkspaceLayout's does.
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

async function openForm() {
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
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/jobs', '/jobs/o/edit'], initialIndex: 1 });
  const view = dom.mount(() => h(RouterProvider, { router }), {});
  const proto = Object.getPrototypeOf(view.document.body);
  proto.scrollIntoView ??= () => {};
  // The whole document: the question opens in a portal at the end of <body>.
  const all = () => [...dom.elements(view.document.body)];
  const input = (field) => all().find((el) => el.tagName === 'INPUT' && (el.getAttribute('id') || '').endsWith(field));
  const button = (label, node) => (node ? [...dom.elements(node)] : all())
    .find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  // Past the Dialog's 160 ms exit, when a queued question would take the first one's place.
  const settle = async (ms = 0) => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); });
    if (ms) await new Promise((r) => { setTimeout(r, ms); });
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
  };
  await settle();
  return {
    view,
    path: () => router.state.location.pathname,
    text: () => view.document.body.textContent,
    questions: () => all().filter((el) => el.getAttribute('role') === 'alertdialog'),
    type(field, value) { view.act(() => dom.reactProps(input(field)).onChange({ target: { value } })); },
    click(el) { view.act(() => { dom.reactProps(el).onClick(ev()); }); },
    button,
    async back() { view.act(() => { router.navigate(-1); }); await settle(); },
    settle,
    async close() { await view.unmount(); delete globalThis.localStorage; delete globalThis.sessionStorage; },
  };
}

it('R4-DUX-06: the browser\'s Back while the Cancel question is up asks nothing more; Discard leaves with no question left behind', async () => {
  const form = await openForm();
  try {
    form.type('role', 'Staff Engineer');
    form.click(form.button('Cancel'));
    await form.settle();
    assert.equal(form.questions().length, 1, 'Cancel asks "Discard your changes?"');
    assert.match(form.questions()[0].textContent, /Discard your changes\?/);

    await form.back();
    assert.equal(form.path(), '/jobs/o/edit', 'the Back is held: still on the form');
    assert.equal(form.questions().length, 1, 'one question, not a second');

    form.click(form.button('Discard', form.questions()[0]));
    await form.settle(400);
    assert.equal(form.path(), '/jobs/o', 'Discard goes where Cancel was going');
    assert.match(form.text(), /DETAIL o/);
    assert.equal(form.questions().length, 0, 'no question is left over on the job page');
  } finally {
    await form.close();
  }
});

it('R4-DUX-06: Keep editing after a Back held behind the Cancel question stays on the form with the typing', async () => {
  const form = await openForm();
  try {
    form.type('role', 'Staff Engineer');
    form.click(form.button('Cancel'));
    await form.settle();
    await form.back();

    form.click(form.button('Keep editing', form.questions()[0]));
    await form.settle(400);
    assert.equal(form.path(), '/jobs/o/edit', 'still on the form');
    assert.equal(form.questions().length, 0, 'no second question comes up');

    // The next way out asks again, once.
    await form.back();
    assert.equal(form.questions().length, 1, 'Back on its own asks');
    form.click(form.button('Discard', form.questions()[0]));
    await form.settle(400);
    assert.equal(form.path(), '/jobs');
    assert.match(form.text(), /TRACKER/);
    assert.equal(form.questions().length, 0);
  } finally {
    await form.close();
  }
});
