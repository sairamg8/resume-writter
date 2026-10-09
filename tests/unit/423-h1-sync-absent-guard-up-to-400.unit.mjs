// H1-SYNC-23: a flush expects the copies it read as absent to still be absent when the write lands (405), for a write of
// up to ABSENT_GUARD items — each is a read of a transaction that holds 500 writes at most. The limit was 100, so a file of
// 101 to 400 jobs imported here was written with no check at all: another device writing one of its ids (the same
// file imported there, edited) between the read and the write was overwritten with this device's older copy. Now the limit
// is 400 (400 items and the three writes of the lists fit in 500). A write of more is a plain batch, as before.
// The real engine, plan and io over a fake Firestore that refuses a request of more than 500 writes, as the server does.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const imported = (n) => Array.from({ length: n }, (_, i) => job(`imp${String(i).padStart(3, '0')}`, 'Imported', 100));

async function importAndRace(count) {
  const cloud = fakeFirestore();
  cloud.refuse = (ops) => (ops.length > 500 ? Object.assign(new Error('maximum 500 writes allowed per request'), { code: 'invalid-argument' }) : null);
  let list = [job('base', 'Engineer', 1)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  sync.start(A);
  await settle();

  set([...list, ...imported(count)]);
  const RACED = 'users/A/jobs/imp050';
  let landed = false;
  cloud.afterRead = (path) => {
    if (path !== RACED || landed) return;
    landed = true;
    cloud.data.set(RACED, { ...job('imp050', 'Edited on the other device', 200), syncRev: 1, syncBy: 'dev-other' });
  };
  await timers.fire();
  await settle(10);
  return { cloud, seen, list: () => list, RACED };
}

test('an import of 250 jobs: one another device writes while the flush reads is not overwritten', async () => {
  const { cloud, seen, list, RACED } = await importAndRace(250);
  assert.equal(cloud.doc(RACED).role, 'Edited on the other device', 'the account keeps the later edit');
  assert.equal(list().find((x) => x.id === 'imp050').role, 'Edited on the other device', 'and this device shows it');
  assert.equal(list().length, 251);
  assert.equal([...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).length, 251, 'the rest of the import went');
  assert.equal(seen.status, 'synced');
});

test('an import of 450 jobs still goes in one batch the server takes', async () => {
  const { cloud, seen } = await importAndRace(450);
  assert.equal([...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).length, 451);
  assert.equal(cloud.refused.length, 0);
  assert.equal(seen.status, 'synced');
});
