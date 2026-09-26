// R4-DUX-02: Job Tracker → ⋯ → "Clear all jobs" deleted every job for good — no Undo, a question
// that named no count and did not say it deletes, and the item on offer with no job to clear.
// Now the question says how many go, a toast "N jobs cleared" offers Undo that puts the whole
// list back (useJobStore.restoreJobs), the item is disabled with no jobs, and the jobs put back
// are sent to the account again — off its deleted list — by the cloud sync.
// The real page and store over fake-dom (tests/pdf/fake-dom.mjs), as 81-job-tracker-page does.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, manualTimers, recorder, settle } from './fake-firestore.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_jobs_v1';
const job = (id, company, status = 'applied') => ({
  id, company, role: 'Engineer', status, url: '', location: '', salary: '', contact: '', appliedDate: '', deadline: '',
  resumeId: '', notes: '', todos: [], statusHistory: [{ status, changedAt: 1 }], createdAt: 1, updatedAt: 1,
});
const JOBS = [job('a', 'Acme'), job('b', 'Beta Labs', 'interview'), job('c', 'Cobalt', 'saved')];

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, key: '', nativeEvent: {}, ...props });
const stored = () => JSON.parse(localStorage.getItem(KEY)).jobs.map((j) => j.id);

/** The tracker over storage holding JOBS, under the kit's toast and confirm hosts (as in the shell). */
async function tracker() {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { JobTracker } = await loadModule('/src/pages/JobTracker.jsx');
  const { ToastProvider, ConfirmProvider } = await loadModule('/src/components/ui/index.js');
  const { _resetJobStoreForTest } = await loadModule('/src/hooks/useJobStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: JOBS, dataVersion: 2 })]]);
  _resetJobStoreForTest();
  const App = () => h(ToastProvider, null, h(ConfirmProvider, null, h(MemoryRouter, { initialEntries: ['/jobs?view=list'] },
    h(Routes, null, h(Route, { path: '/jobs', element: h(JobTracker, { store: { appState: { resumes: [] } } }) })))));
  const view = dom.mount(App, {});
  const proto = Object.getPrototypeOf(view.document.body);
  proto.scrollIntoView ??= () => {};
  // The whole document: the menu, the question and the toast open in portals at the end of <body>.
  const all = (node = view.document.body) => [...dom.elements(node)];
  const page = {
    view,
    text: () => view.document.body.textContent,
    button: (label, node) => all(node).find((el) => el.tagName === 'BUTTON' && (el.textContent.trim() === label || el.getAttribute('aria-label') === label)),
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    question: () => all().find((el) => el.getAttribute('role') === 'alertdialog'),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev())),
    async settle() { for (let i = 0; i < 5; i += 1) { await settle(1); view.act(() => {}); } },
  };
  return page;
}

it('R4-DUX-02: Clear all jobs names the count, then "3 jobs cleared" with Undo puts the whole list back; with no jobs the item is disabled', async () => {
  const page = await tracker();
  try {
    await page.settle();
    page.click(page.button('More job actions'));
    assert.equal(page.item('Clear all jobs').getAttribute('aria-disabled'), null, 'with jobs, the item is on offer');
    page.click(page.item('Clear all jobs'));
    await page.settle();

    const question = page.question();
    assert.ok(question, 'it asks first');
    assert.match(question.textContent, /3 jobs/, 'the question says how many go');
    assert.match(question.textContent, /deleted/, 'and that they are deleted');
    page.click(page.button('Clear all jobs', question));
    await page.settle();
    assert.deepEqual(stored(), [], 'every job is cleared');
    assert.match(page.text(), /3 jobs cleared/, 'a toast says so');

    // Nothing left to clear: the item is there, disabled.
    page.click(page.button('More job actions'));
    assert.equal(page.item('Clear all jobs').getAttribute('aria-disabled'), 'true');

    const undo = page.button('Undo');
    assert.ok(undo, 'the toast offers Undo');
    page.click(undo);
    await page.settle();
    assert.deepEqual(stored(), ['a', 'b', 'c'], 'Undo puts every job back, in its order');
    assert.match(page.text(), /3 applications tracked/);
  } finally {
    await page.view.unmount();
    delete globalThis.localStorage;
  }
});

it('R4-DUX-02: jobs put back by Undo after the clear reached the account are sent again, and taken off its deleted list', async () => {
  const store = await loadModule('/src/hooks/useJobStore.js');
  const { createCollectionSync } = await loadModule('/src/utils/collectionSyncEngine.js');
  const { collectionIo } = await loadModule('/src/utils/collectionSyncIo.js');
  const { localMeta } = await loadModule('/src/utils/collectionSyncMeta.js');
  const { completeJob, readJob } = await loadModule('/src/utils/normalizeJob.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ jobs: JOBS, dataVersion: 2 })]]);
  store._resetJobStoreForTest();
  const cloud = fakeFirestore();
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'),
    store: {
      items: store.jobsNow, replace: store.replaceJobs, subscribe: store.subscribe,
      fromCloud: (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; },
      label: (j) => j.company || 'Untitled job',
    },
    meta: localMeta('cpwtcv_jobs_sync_v1'), report, timers,
  });
  const inCloud = () => ['a', 'b', 'c'].filter((id) => cloud.doc(`users/A/jobs/${id}`));
  const deleted = () => cloud.doc('users/A/meta/jobs')?.deleted ?? [];
  try {
    sync.start({ uid: 'A', email: 'a@example.com' });
    await settle();
    assert.deepEqual(inCloud(), ['a', 'b', 'c']);

    const removed = store.clearDemoData();
    assert.deepEqual(removed.map((j) => j.id), ['a', 'b', 'c'], 'clearing returns what it removed');
    await timers.fire();
    assert.deepEqual(inCloud(), [], 'the clear reached the account');
    assert.deepEqual(deleted().toSorted(), ['a', 'b', 'c']);

    store.restoreJobs(removed);
    assert.deepEqual(stored(), ['a', 'b', 'c']);
    await timers.fire();
    assert.deepEqual(inCloud(), ['a', 'b', 'c'], 'Undo sends them to the account again');
    assert.deepEqual(deleted(), [], 'and no other device takes them for deleted');
    assert.equal(seen.status, 'synced');
    assert.deepEqual(store.clearDemoData().length, 3);
    assert.deepEqual(store.clearDemoData(), [], 'nothing to clear: nothing written, nothing to undo');
  } finally {
    sync.cancel();
    store._resetJobStoreForTest();
    delete globalThis.localStorage;
  }
});
