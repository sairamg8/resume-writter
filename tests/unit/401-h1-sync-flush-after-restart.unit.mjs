// H1-SYNC-2: a flush whose write was refused as stale (the cloud's copy changed between its read and its write)
// reads again and sends the copy it was queued with, so that a flush the sync was restarted under (a refresh when
// the tab is shown, going online, a retry) was still answered by the older line after the first sync the restart
// ran had already sent a newer edit: the retry took the cloud's copy for this browser's own write (not a move) and
// wrote the queued OLDER copy over it. The account kept the older edit while the list showed the newer one, and
// nothing was left to send it again. Now a flush belongs to the line it began in (`gen`): after a restart it
// stops, and the first sync of the restart decides from the cloud as it is then.
// The real engine, plan and io over a fake Firestore; the first flush's write is held before it reads
// (a gate around runTransaction). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role,
  };
  // The next write that is a transaction waits for the gate (the first flush's), the ones after it do not.
  const gate = deferred();
  let armed = false;
  const fs = {
    ...cloud.fs,
    runTransaction: (db, update) => {
      if (!armed) return cloud.fs.runTransaction(db, update);
      armed = false;
      return gate.promise.then(() => cloud.fs.runTransaction(db, update));
    },
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    sync, timers, seen,
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
  };
}

test('a flush the sync was restarted under does not write its older copy over the edit the restart sent', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('a1', 'Engineer', 1)]);
  await d.start(A);

  d.edit('a1', { role: 'Senior Engineer' }, 5);
  d.hold();
  await d.timers.fire(); // the flush has read the cloud and decided; its write waits
  d.edit('a1', { role: 'Staff Engineer' }, 6); // typed meanwhile
  await d.start(A); // the tab is shown again, going online ...: a first sync, which waits for the request on its way (H1-SYNC-26)
  await d.timers.fire(); // ... until its deadline (the request never lands in time), and sends the newer edit
  assert.equal(cloud.doc('users/A/jobs/a1').role, 'Staff Engineer', 'the restart\'s first sync sent it');

  await d.release(); // the first flush's write is refused as stale and would read again
  assert.equal(cloud.doc('users/A/jobs/a1').role, 'Staff Engineer', 'the account keeps the newer edit');
  assert.equal(cloud.doc('users/A/jobs/a1').updatedAt, 6);
  assert.equal(d.get('a1').role, 'Staff Engineer');
  assert.equal(d.seen.status, 'synced');
});
