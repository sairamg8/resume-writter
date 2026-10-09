// H1-SYNC-16 (the review of 415): a write that landed after a start replaced the sync that sent it is recorded
// (415), but the list was never given the result of that sync: a conflict copy the sync made and wrote is in the account
// and not in this browser's list. Recorded as seen, it was at the next sync an item known here and gone from the
// list — deleted here — and the sync deleted it from the account: the older side of a conflict, kept for nothing. Now only
// what the list holds is recorded; the copy comes to the list from the account at the next sync, as an item new here.
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

test('a conflict copy a replaced sync wrote is not deleted by the next one', async () => {
  // The account's j1 was changed by another device (time 2000); this browser last saw it at time 100 (rev 1) and has edited it since (time 2500).
  const cloud = fakeFirestore({
    'users/A/jobs/j1': { ...job('j1', '[1] [3]', 2000), syncRev: 2, syncBy: 'dev-other' },
    'users/A/meta/jobs': { order: ['j1'], deleted: [] },
  });
  let list = [job('j1', '[1] [5]', 2500)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
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
  const net = { online: true };
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store,
    meta: memoryMeta({ uid: 'A', versions: { j1: 100 }, revs: { j1: 1 }, device: 'dev-here', order: ['j1'], stashed: {} }),
    report, timers: manualTimers(), online: () => net.online,
  });
  const start = async () => { sync.start(A); await settle(); };

  armed = true;
  await start(); // the first sync finds the conflict and sends j1 with a copy of the account's; the write waits
  net.online = false;
  await start(); // the browser goes offline: the sync is replaced
  gate.resolve();
  await settle(10); // the write lands
  const copies = () => [...cloud.data].filter(([p]) => p.includes('conflict')).map(([, v]) => v.notes);
  assert.deepEqual(copies(), ['[1] [3]'], 'the copy of the other device\'s edit is in the account');

  net.online = true;
  await start();
  await settle(10);
  assert.deepEqual(copies(), ['[1] [3]'], 'and is still there: it was not deleted as an item removed here');
  assert.deepEqual(list.map((x) => x.notes).toSorted(), ['[1] [3]', '[1] [5]'], 'this browser shows both');
  assert.equal(seen.status, 'synced');
});
