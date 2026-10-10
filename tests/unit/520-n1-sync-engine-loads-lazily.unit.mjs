// The jobs' and boards' sync engine is not on the start-up path (N1): the whole stack (collectionSyncEngine,
// Plan, Io, Rev, Conflict) was imported statically by useCollectionSync through App.jsx, so a visitor who
// never signs in downloaded and parsed it, and the start-up path was 15 kB from its 1.1 MB cap
// (tests/pdf/71-startup-chunks). It now loads by import() at the first sign-in (collectionSyncLazy.js),
// with the same calls in the same order. Pinned here: nothing the entry imports statically reaches the
// engine's modules; signed out (or with no cloud) it never loads; a sign-in loads it once and its first sync
// sends what was typed before it arrived; a sign-in and a sign-out within the load still take the list out
// of the browser (the order of the calls is kept); a load that fails says so and is tried again.
// Run: node --test tests/unit/520-n1-sync-engine-loads-lazily.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startupModules } from '../pdf/startup-modules.mjs';
import { lazyCollectionSync } from '../../src/utils/collectionSyncLazy.js';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

test('no module the entry imports statically reaches the sync engine; the hook and the small parts are there', () => {
  const startup = startupModules();
  assert.ok(startup.has('src/hooks/useCollectionSync.js') && startup.has('src/utils/collectionSyncLazy.js'), 'the hook and the loader are on the path');
  assert.ok(startup.has('src/utils/collectionSyncMeta.js'), 'the record and the status stores (the job stores use them) stay');
  const engine = ['Engine', 'Plan', 'Io', 'Rev', 'Conflict', 'Loaded'].map((part) => `src/utils/collectionSync${part}.js`);
  assert.deepEqual(engine.filter((file) => startup.has(file)), [], 'a static import brings the sync engine back to the start-up path');
});

/** A device: an in-memory list (the store the engine reads), its record, and the lazy engine over `cloud`. */
function device(cloud, { jobs = [], meta = memoryMeta(), load, cloudOn = true } = {}) {
  let list = jobs;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const { seen, report } = recorder();
  const timers = manualTimers();
  const loads = { n: 0 };
  const real = (options) => createCollectionSync({ ...options, store, io: collectionIo(cloud.fs, cloud.db, 'jobs') });
  const create = lazyCollectionSync(() => { loads.n += 1; return load ? load(real) : Promise.resolve(real); });
  const sync = create({ name: 'jobs', meta, report, timers, cloud: cloudOn, online: () => true });
  return { sync, seen, meta, timers, loads, ids: () => list.map((j) => j.id), add: (j) => set([...list, j]) };
}

test('signed out, or with no cloud to sync to, the engine is never loaded: idle, or off', async () => {
  const d = device(fakeFirestore(), { jobs: [job('j1', 'Acme')] });
  d.sync.start(null);
  d.sync.cancel();
  d.sync.shown();
  await settle();
  assert.equal(d.loads.n, 0, 'nothing asked for the module');
  assert.deepEqual(d.seen.statuses, ['idle'], 'said so, as the engine does');

  const bare = device(fakeFirestore(), { cloudOn: false });
  bare.sync.start(A);
  await settle();
  assert.equal(bare.loads.n, 0, 'no cloud: the engine would only say off');
  assert.deepEqual(bare.seen.statuses, ['off']);
});

test('a sign-in loads the engine once; a job typed before it arrived reaches the account at its first sync', async () => {
  const cloud = fakeFirestore();
  const gate = deferred();
  const d = device(cloud, { jobs: [job('j1', 'Acme')], load: async (real) => { await gate.promise; return real; } });
  d.sync.start(A);
  d.sync.cancel(); // the effect's cleanup, then its next run (a re-render, StrictMode)
  d.sync.start(A);
  await settle();
  assert.equal(d.loads.n, 1, 'one load for the calls that waited on it');
  assert.equal(cloud.data.size, 0, 'nothing sent while the module is on its way');

  d.add(job('j2', 'Beta', 5)); // typed while the module loads: in the store, not yet in the engine
  gate.resolve();
  await settle();
  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(['j1', 'j2'].map((id) => cloud.doc(`users/A/jobs/${id}`)?.company), ['Acme', 'Beta']);
  assert.equal(d.meta.read().uid, 'A');

  d.sync.start(A);
  await settle();
  assert.equal(d.loads.n, 1, 'a loaded engine is kept');
  d.add(job('j3', 'Cyan', 9));
  await d.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j3')?.company, 'Cyan', 'an edit is sent after the pause, by the loaded engine');
});

test('a sign-in and a sign-out within the load: the calls reach the engine in order, so the account\'s list still leaves', async () => {
  const cloud = fakeFirestore();
  const gate = deferred();
  const meta = memoryMeta({ uid: 'A', versions: { j1: 1 }, revs: {}, device: 'dev_1', order: ['j1'], stashed: {} });
  const left = [];
  const d = device(cloud, { jobs: [job('j1', 'Acme')], meta, load: async (real) => { await gate.promise; return real; } });
  d.sync.start(A); // a returning user, signed in at page load
  d.sync.cancel();
  d.sync.start(null); // signs out before the engine is there
  await settle();
  gate.resolve();
  await settle();
  left.push(...d.ids());
  assert.deepEqual(left, [], 'the list left this browser at the sign-out');
  assert.equal(d.meta.read().uid, null);
  assert.equal(d.seen.status, 'idle');
});

test('a load that fails reports an error, is tried again after a pause, and the waiting sign-in then goes through', async () => {
  const cloud = fakeFirestore();
  let fails = true;
  const d = device(cloud, {
    jobs: [job('j1', 'Acme')],
    load: async (real) => { if (fails) throw new TypeError('Failed to fetch dynamically imported module'); return real; },
  });
  d.sync.start(A);
  await settle();
  assert.equal(d.seen.status, 'error');
  assert.deepEqual(d.timers.delays, [30000], 'a retry is set');
  assert.equal(cloud.data.size, 0);

  fails = false;
  await d.timers.fire();
  assert.equal(d.loads.n, 2);
  assert.equal(d.seen.status, 'synced');
  assert.equal(cloud.doc('users/A/jobs/j1')?.company, 'Acme');
});
