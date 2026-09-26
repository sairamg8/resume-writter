// R2-145 / R2-140: the Privacy page said every piece of content syncs and is restored after the
// browser's storage is cleared, while the Job Tracker's jobs and the boards never left
// localStorage. They sync now (collectionSyncEngine.js), and the page says exactly what syncs —
// résumés, jobs and boards — and that signing out takes them off the browser. A job or a project
// the cloud will not take (over Firestore's 1 MiB document limit) is held back on its own, and the
// board pages and the Job Tracker name it (SyncHeldNotice) instead of letting it look synced.
// Rendered through Vite's loader (tests/pdf/harness.mjs) with react-dom/server — but for the Job
// Tracker page, mounted with react-dom/client over the fake DOM (tests/pdf/fake-dom.mjs): its job
// store has no server snapshot. The page itself is pinned, not only the notice: the tracker revamp
// rewrote the page, and its merge with the sync placed the notice in it by hand.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let PrivacyPage;
let Boards;
let JobTracker;
let SyncHeldNotice;
let syncHeld;
let boardStore;
let jobStore;
before(async () => {
  await setup();
  PrivacyPage = (await loadModule('/src/pages/PrivacyPage.jsx')).default;
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
  ({ JobTracker } = await loadModule('/src/pages/JobTracker.jsx'));
  ({ SyncHeldNotice } = await loadModule('/src/components/SyncHeldNotice.jsx'));
  ({ syncHeld } = await loadModule('/src/utils/collectionSyncMeta.js'));
  boardStore = await loadModule('/src/hooks/useBoardStore.js');
  jobStore = await loadModule('/src/hooks/useJobStore.js');
});
after(teardown);
afterEach(() => {
  syncHeld.set('jobs', []);
  syncHeld.set('boards', []);
  delete globalThis.localStorage;
});

/** Visible text of `markup`: inline tags dropped, the rest a space, spaces collapsed. */
const text = (markup) => markup.replace(/<\/?(strong|em|a|span)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const at = (path, element) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
  createElement(Routes, null, createElement(Route, { path, element }))));

it('the Privacy page names what syncs with an account — résumés, jobs and boards — and no more', () => {
  const page = text(at('/privacy', createElement(PrivacyPage)));
  assert.doesNotMatch(page, /all content you enter into CPWT-CV, synced/i, 'the old claim that everything syncs');
  assert.match(page, /Resume data: your résumés, synced to Firebase Firestore/);
  assert.match(page, /Job Tracker data: your jobs[^.]*synced the same way/);
  assert.match(page, /Boards: your projects[^.]*synced the same way/);
  assert.match(page, /sync your résumés, jobs and boards across devices/);
  // Without an account, all three stay in this browser.
  assert.match(page, /résumés[^.]*the Job Tracker's jobs, and your boards — is stored exclusively in your browser's localStorage/);
  // Signing out takes them off the browser; what is added signed out stays local until the next sign-in.
  assert.match(page, /When you sign out, your résumés, jobs and boards are removed from this browser/);
  assert.match(page, /Anything you add while signed out stays in this browser only/);
});

it('a project the cloud holds back is named on the board pages; none held, no notice', () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
  boardStore._resetBoardStoreForTest();
  const grid = () => text(at('/boards', createElement(Boards)));
  assert.doesNotMatch(grid(), /too large to sync/);
  syncHeld.set('boards', [{ id: 'board_big', name: 'Kitchen refit' }]);
  assert.match(grid(), /This project is too large to sync to your account and stays on this device only: Kitchen refit\./);
});

it('the jobs the cloud holds back are named, each of them', () => {
  const notice = () => text(renderToStaticMarkup(createElement(SyncHeldNotice, { name: 'jobs' })));
  assert.equal(notice().trim(), '');
  syncHeld.set('jobs', [{ id: 'j1', name: 'Northwind — Analyst' }, { id: 'j2', name: 'Contoso — Designer' }]);
  assert.match(notice(), /These jobs are too large to sync to your account and stay on this device only: Northwind — Analyst, Contoso — Designer\./);
  // The boards' notice is its own: a held job does not show on the board pages.
  assert.equal(text(renderToStaticMarkup(createElement(SyncHeldNotice, { name: 'boards' }))).trim(), '');
});

/** localStorage holding `entries`, as the job store reads and writes it. */
function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); },
  };
}

const NORTHWIND = {
  id: 'j1', company: 'Northwind', role: 'Analyst', status: 'applied', url: '', location: '', salary: '', contact: '',
  appliedDate: '', deadline: '', resumeId: '', notes: '', todos: [], statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
};

it('the Job Tracker page names the jobs the cloud holds back, as the sync reports them; none held, no notice', async () => {
  const dom = await import('./fake-dom.mjs');
  // assertSame on a node, never assert.equal: its report on a failure inspects the whole DOM and
  // React's fibers until the process runs out of memory (R3-005).
  const { patchFakeDom, assertSame } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  globalThis.localStorage = memoryStorage([['cpwtcv_jobs_v1', JSON.stringify({ jobs: [NORTHWIND], dataVersion: 2 })]]);
  jobStore._resetJobStoreForTest();
  const view = dom.mount(() => createElement(MemoryRouter, { initialEntries: ['/jobs'] },
    createElement(Routes, null, createElement(Route, { path: '/jobs', element: createElement(JobTracker, { store: { appState: { resumes: [] } } }) }))), {});
  const notice = () => [...dom.elements(view.container)].find((el) => el.getAttribute('role') === 'status' && /too large to sync/.test(el.textContent));
  try {
    assert.match(view.container.textContent, /Northwind/, 'the page is up, with its job');
    assertSame(notice(), undefined, 'nothing held: no notice');
    view.act(() => syncHeld.set('jobs', [{ id: 'j1', name: 'Northwind — Analyst' }]));
    assert.match(notice()?.textContent ?? '', /^This job is too large to sync to your account and stays on this device only: Northwind — Analyst\. Make it smaller/);
    // A project held back is the board pages' to name, not the tracker's.
    view.act(() => { syncHeld.set('jobs', []); syncHeld.set('boards', [{ id: 'board_big', name: 'Kitchen refit' }]); });
    assertSame(notice(), undefined, 'no job held: no notice');
    assert.doesNotMatch(view.container.textContent, /Kitchen refit/);
  } finally {
    await view.unmount();
    jobStore._resetJobStoreForTest();
  }
});
