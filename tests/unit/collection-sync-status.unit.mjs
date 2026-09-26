// The jobs' and the boards' sync status on the workspace pages (R2-140-c). The résumés say what
// their sync is doing in the header's cloud icon (AuthBar's SyncDot); the Job Tracker and the
// boards said nothing: useCollectionSync passed the engine only a `held` report, so its status —
// a sync error, or one the account's rules refuse ('off') — was logged to the console and went no
// further. Now every list's status goes to a small store (collectionSyncStatus, fed by
// collectionReport, the report the hook gives the engine) and the workspace's top bar shows the
// résumés' own icon over the lists the page shows, the worst status winning.
// The engine runs over the fake Firestore (tests/pdf/fake-firestore.mjs), as in job-sync.unit.mjs;
// the top bar is mounted with react-dom/client over tests/pdf/fake-dom.mjs through Vite's SSR
// loader, as in ui-shell.unit.mjs. Run: node --test tests/unit/collection-sync-status.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mount, elements } from '../pdf/fake-dom.mjs';
import { fakeFirestore, manualTimers, settle } from '../pdf/fake-firestore.mjs';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { collectionReport, collectionSyncStatus, memoryMeta, worstSyncStatus } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';

const A = { uid: 'A', email: 'a@example.com' };
const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

// The top bar through Vite's SSR loader (JSX, the `@/` alias); the store is read from the same
// loader, so the test sets the very store the bar reads.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let vite;
before(async () => {
  vite = await createServer({
    root: ROOT, configFile: `${ROOT}vite.config.js`, appType: 'custom', logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
});
after(() => vite?.close());

/** The jobs' engine as useCollectionSync wires it: its report is collectionReport('jobs'). */
function jobsSync(cloud, jobs = []) {
  let list = jobs;
  const store = {
    items: () => list,
    replace: (next) => { list = next; },
    subscribe: () => () => {},
    fromCloud: (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; },
    label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
  };
  return createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(),
    report: collectionReport('jobs'), timers: manualTimers(),
  });
}

describe('R2-140-c: the engine’s status reaches a store the pages read', () => {
  it('a first sync that gets through is "synced", with the time it did', async () => {
    collectionSyncStatus.set('jobs', 'idle');
    const cloud = fakeFirestore();
    const sync = jobsSync(cloud, [job('j1', 'Acme')]);
    sync.start(A);
    assert.equal(collectionSyncStatus.get().jobs.status, 'syncing');
    await settle();
    const { status, at } = collectionSyncStatus.get().jobs;
    assert.equal(status, 'synced');
    assert.ok(at instanceof Date, 'no time kept for "Synced HH:MM"');
    sync.start(null);
    assert.equal(collectionSyncStatus.get().jobs.status, 'idle', 'signed out: no status');
  });

  it('a sync the rules refuse is "off", a failed one "error" — not the console only', async () => {
    collectionSyncStatus.set('jobs', 'idle');
    const refused = fakeFirestore();
    refused.fail.read = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    const off = jobsSync(refused);
    off.start(A);
    await settle();
    assert.equal(collectionSyncStatus.get().jobs.status, 'off');

    const down = fakeFirestore();
    down.fail.read = Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });
    const failing = jobsSync(down);
    failing.start(A);
    await settle();
    assert.equal(collectionSyncStatus.get().jobs.status, 'error');
    off.cancel();
    failing.cancel();
    collectionSyncStatus.set('jobs', 'idle');
  });

  it('the lists shown share one status: the worst of theirs', () => {
    const t1 = new Date(2026, 8, 26, 9, 5);
    const t2 = new Date(2026, 8, 26, 9, 7);
    const all = (jobs, boards) => ({ jobs: { status: jobs, at: t1 }, boards: { status: boards, at: t2 } });
    const both = ['jobs', 'boards'];
    assert.deepEqual(worstSyncStatus(all('synced', 'synced'), both), { status: 'synced', at: t2 }, 'the later time');
    assert.equal(worstSyncStatus(all('syncing', 'synced'), both).status, 'syncing');
    assert.equal(worstSyncStatus(all('synced', 'offline'), both).status, 'offline');
    assert.equal(worstSyncStatus(all('offline', 'off'), both).status, 'off');
    assert.equal(worstSyncStatus(all('error', 'off'), both).status, 'error');
    assert.equal(worstSyncStatus(all('stopped', 'synced'), both).status, 'stopped');
    assert.equal(worstSyncStatus(all('error', 'synced'), ['boards']).status, 'synced', 'a list not shown does not count');
    assert.deepEqual(worstSyncStatus(all('idle', 'idle'), both), { status: 'idle', at: null });
    assert.deepEqual(worstSyncStatus(all('syncing', 'synced'), both).at, null, 'no time unless synced');
  });
});

/** The workspace's top bar at `path`: `dot()` its sync icon (none: undefined), `label()` its words. */
async function topBarAt(path) {
  const { TopBar } = await vite.ssrLoadModule('/src/components/shell/TopBar.jsx');
  const App = () => createElement(MemoryRouter, { initialEntries: [path] }, createElement(TopBar, { projects: [] }));
  const view = mount(App, {});
  const dot = () => [...elements(view.container)].find((el) => el.getAttribute?.('data-testid') === 'sync-status');
  return { view, dot, label: () => dot()?.getAttribute('aria-label') };
}

describe('R2-140-c: the workspace’s top bar shows the jobs’ and boards’ sync as the résumés’ icon', () => {
  it('a job sync error shows on the Job Tracker, in the résumés’ words', async () => {
    const { collectionSyncStatus: status } = await vite.ssrLoadModule('/src/utils/collectionSyncMeta.js');
    status.set('jobs', 'error');
    status.set('boards', 'synced');
    const { view, dot, label } = await topBarAt('/jobs');
    try {
      assert.ok(dot(), 'the Job Tracker shows no sync status');
      assert.equal(label(), 'Sync error — will retry');
      view.act(() => status.set('jobs', 'synced'));
      assert.match(label(), /^Synced/, 'the icon follows the store');
      view.act(() => status.set('boards', 'off'));
      assert.equal(label(), 'Sync is off — changes are saved in this browser', 'the sidebar’s projects count on the Job Tracker');
    } finally { await view.unmount(); }
  });

  it('a board page shows the boards’ status; offline says so; a held project is named', async () => {
    const { collectionSyncStatus: status, syncHeld } = await vite.ssrLoadModule('/src/utils/collectionSyncMeta.js');
    status.set('jobs', 'error');
    status.set('boards', 'offline');
    const { view, label } = await topBarAt('/boards/b1');
    try {
      assert.equal(label(), 'Offline — changes saved locally', 'a job error does not show on a board page');
      view.act(() => { syncHeld.set('boards', [{ id: 'b1', name: 'Life admin' }]); status.set('boards', 'stopped'); });
      assert.equal(label(), '“Life admin” not synced (too large?) — saved in this browser');
    } finally {
      await view.unmount();
      syncHeld.set('boards', []);
    }
  });

  it('signed out (idle): no icon', async () => {
    const { collectionSyncStatus: status } = await vite.ssrLoadModule('/src/utils/collectionSyncMeta.js');
    status.set('jobs', 'idle');
    status.set('boards', 'idle');
    const { view, dot } = await topBarAt('/jobs');
    try {
      assert.equal(dot(), undefined);
    } finally { await view.unmount(); }
  });
});
