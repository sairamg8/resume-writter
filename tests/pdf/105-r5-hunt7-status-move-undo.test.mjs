// R5-HUNT7-STATUS-MOVE-UNDO, the pages: a job moved to the wrong status by mistake — a card dropped
// on the board's wrong column, a click on the job page's Application Stage stepper — showed no
// Undo, and moving it back by hand left a false history entry and an Applied date. Each move now
// shows a toast with Undo, which puts the job's status, history and applied date back as they were.
// The real JobTracker and JobDetail with the real job store, in the kit's ToastProvider over
// fake-dom, storage in memory (as 105-r5-hunt3-job-task-undo-after-tab-switch). Fictional data.
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
const job = (id, company) => ({
  id, company, role: 'Dev', status: 'saved', url: '', location: '', salary: '', contact: '',
  appliedDate: '', deadline: '', resumeId: '', notes: '', todos: [],
  statusHistory: [{ status: 'saved', changedAt: 1 }], createdAt: 1, updatedAt: 1,
});

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}

const ev = (el, extra = {}) => ({ preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el, nativeEvent: {}, ...extra });
const stored = (id) => JSON.parse(globalThis.localStorage.getItem(KEY)).jobs.find((j) => j.id === id);

async function mount(path, route, element) {
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { ToastProvider, ConfirmProvider } = await loadModule('/src/components/ui/index.js');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: [job('a', 'Acme'), job('b', 'Beta')], dataVersion: 2 })]]);
  _resetJobStoreForTest();
  const App = () => h(ToastProvider, null, h(ConfirmProvider, null, h(MemoryRouter, { initialEntries: [path] },
    h(Routes, null, h(Route, { path: route, element: h(element, { store: { appState: { resumes: [] } } }) })))));
  const view = dom.mount(App, {});
  Object.getPrototypeOf(view.document.body).scrollIntoView ??= () => {};
  // The toasts are portalled to <body>, outside the container.
  const all = () => [...dom.elements(view.document.body)];
  return {
    view, all,
    fire: (el, handler, extra) => view.act(() => dom.reactProps(el)[handler](ev(el, extra))),
    toast: (text) => all().find((el) => el.hasAttribute('data-toast') && el.textContent.includes(text)),
    undo: (toast) => [...dom.elements(toast)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo'),
  };
}

function assertBackAsItWas(id) {
  const back = stored(id);
  assert.equal(back.status, 'saved');
  assert.deepEqual(back.statusHistory, [{ status: 'saved', changedAt: 1 }], 'no false history entry');
  assert.equal(back.appliedDate, '', 'no applied date left behind');
}

it('R5-HUNT7: a card dropped on the wrong column shows "Acme moved to Offer" with Undo, which puts it back as it was', async () => {
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const page = await mount('/jobs?view=kanban', '/jobs', JobTracker);
  try {
    const card = page.all().find((el) => el.getAttribute('aria-roledescription') === 'draggable' && el.textContent.includes('Acme'));
    assert.ok(card, 'the board shows the job\'s card');
    const key = Object.keys(card).find((k) => k.startsWith('__reactFiber$'));
    let fiber = card[key];
    while (fiber && !fiber.memoizedProps?.onDragEnd) fiber = fiber.return;
    page.view.act(() => fiber.memoizedProps.onDragEnd({ active: { id: 'a' }, over: { id: 'offer' } }));
    assert.equal(stored('a').status, 'offer', 'the drop moves the job');
    assert.ok(stored('a').appliedDate, 'and fills in its applied date');

    const toast = page.toast('Acme moved to Offer');
    assert.ok(toast, 'a toast says where the job went');
    assert.ok(page.undo(toast), 'and offers Undo');
    page.fire(page.undo(toast), 'onClick');
    assertBackAsItWas('a');
  } finally {
    await page.view.unmount();
  }
});

it('R5-HUNT7: a click on the job page\'s Offer step shows "Moved to Offer" with Undo, which puts the job back as it was', async () => {
  const { JobDetail } = await loadModule('/src/pages/JobDetail.jsx');
  const page = await mount('/jobs/a', '/jobs/:id', JobDetail);
  try {
    const tab = page.all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Overview');
    page.fire(tab, 'onClick');
    const step = page.all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Offer');
    assert.ok(step, 'the Application Stage stepper has an Offer step');
    page.fire(step, 'onClick');
    assert.equal(stored('a').status, 'offer');

    const toast = page.toast('Moved to Offer');
    assert.ok(toast, 'a toast says where the job went');
    page.fire(page.undo(toast), 'onClick');
    assertBackAsItWas('a');
  } finally {
    await page.view.unmount();
  }
});
