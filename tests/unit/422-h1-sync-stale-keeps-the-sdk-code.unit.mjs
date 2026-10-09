// H1-SYNC-22: the SDK's `failed-precondition` and `already-exists` out of a transaction are taken for a copy that changed
// (404), and the sync tries again later. The code the SDK gave was gone from it: a precondition that failed for another reason
// (a rule, a missing index) showed as "the cloud kept changing" and nothing said otherwise. Now the error keeps the
// SDK's own as `cause`, the message names it, and the line the sync logs when it gives up for the moment carries it.
// The real engine, plan and io over a fake Firestore whose documents keep changing under the transaction.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo, isStale } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

test('the io keeps the SDK\'s code behind the stale error', async () => {
  for (const code of ['failed-precondition', 'already-exists']) {
    const fs = {
      collection: () => ({}), doc: (_db, ...segs) => ({ path: segs.join('/') }),
      runTransaction: async () => { throw Object.assign(new Error('sdk says no'), { code }); },
    };
    const io = collectionIo(fs, {}, 'jobs');
    const err = await io.commit('A', { sets: [job('a1', 'x', 1)], expect: new Map([['a1', null]]) }).catch((e) => e);
    assert.ok(isStale(err), code);
    assert.equal(err.cause?.code, code, 'the SDK\'s code is kept');
    assert.match(err.message, new RegExp(code));
  }
});

test('a flush that gives up logs the SDK\'s code', async () => {
  const cloud = fakeFirestore();
  let list = [job('a1', 'Engineer', 1)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const lines = [];
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, log: (...a) => lines.push(a.join(' ')),
  });
  sync.start(A);
  await settle();

  cloud.afterRead = (path) => { const v = cloud.data.get(path); if (v && path.includes('/jobs/')) cloud.data.set(path, { ...v }); };
  set(list.map((x) => ({ ...x, role: 'Staff Engineer', updatedAt: 5 })));
  await timers.fire();
  assert.equal(seen.status, 'error');
  assert.ok(lines.some((l) => l.includes('failed-precondition')), `the log names the SDK's code: ${JSON.stringify(lines)}`);
});
