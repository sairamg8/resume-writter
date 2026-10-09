// H1-SYNC-15: a start (going offline, a refresh) replaces the sync it finds running and drops its result — including the
// record of what it wrote — but a write already handed over still lands. A job it added then stood in the account and not in
// this browser's record: at the next sync it was a job "never seen here", so when another device had edited it meanwhile, and this
// one had too, the two edits were settled by their clocks alone and the older was dropped with no copy kept. Now the
// write that landed is recorded all the same (when the record names the account), and the next sync finds the other
// device's edit a change after the one it knows: both are kept, the older as a conflict copy. Found by the three-device
// script with jittered server calls (410).
// The real engine, plan and io over a fake Firestore; the write waits at a gate while the browser goes offline.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  // The next write (a batch or a transaction) waits for the gate; the ones after it do not.
  const gate = deferred();
  let armed = false;
  const hold = (run) => {
    if (!armed) return run();
    armed = false;
    return gate.promise.then(run);
  };
  const fs = {
    ...cloud.fs,
    writeBatch: (db) => {
      const batch = cloud.fs.writeBatch(db);
      return { set: (...a) => batch.set(...a), delete: (...a) => batch.delete(...a), commit: () => hold(() => batch.commit()) };
    },
    runTransaction: (db, update) => hold(() => cloud.fs.runTransaction(db, update)),
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, online: () => net.online,
  });
  return {
    seen, net, timers,
    get: (id) => list.find((x) => x.id === id),
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async (user) => { sync.start(user); await settle(); },
    add: (j) => set([...list, j]),
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}
const notesInCloud = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

/** d1 adds n5 and the write is on its way as the browser goes offline; it lands. The other device then edits n5, and so does d1. */
async function landedWhileOffline(run) {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', '[1]', 100)]);
  await d1.start(A);
  const d2 = device(cloud);
  await d2.start(A);

  d1.add(job('n5', '[5]', 2111));
  d1.hold();
  await run(d1); // the write waits at the gate ...
  d1.net.online = false;
  await d1.start(A); // ... as the browser goes offline
  await d1.release(); // it lands
  assert.equal(cloud.doc('users/A/jobs/n5')?.notes, '[5]', 'the write landed');

  d1.edit('n5', { notes: '[5] [6]' }, 2211); // offline
  await d2.start(A); // d2 gets n5
  d2.edit('n5', { notes: '[5] [7]' }, 1000); // a slow clock
  await d2.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/n5').notes, '[5] [7]');

  d1.net.online = true;
  await d1.start(A);
  await d1.timers.fire();
  return { cloud, d1 };
}

test('a first sync\'s write that landed after a start replaced it is recorded: the next sync keeps both edits', async () => {
  const { cloud, d1 } = await landedWhileOffline((d1) => d1.start(A));
  assert.deepEqual(notesInCloud(cloud).filter((n) => n.includes('[5]')), ['[5] [6]', '[5] [7]'], 'both edits of n5');
  assert.equal(d1.seen.status, 'synced');
});

test('a flush\'s write that landed after a start replaced it is recorded: the next sync keeps both edits', async () => {
  const { cloud, d1 } = await landedWhileOffline(async (d1) => { await d1.timers.fire(); });
  assert.deepEqual(notesInCloud(cloud).filter((n) => n.includes('[5]')), ['[5] [6]', '[5] [7]'], 'both edits of n5');
  assert.equal(d1.seen.status, 'synced');
});
