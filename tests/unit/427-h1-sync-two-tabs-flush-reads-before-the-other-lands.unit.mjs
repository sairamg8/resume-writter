// H1-SYNC-27: two tabs of one browser share the list and the sync record, each with an engine of its own, and an edit
// queues a flush in both. If one tab's flush reads the account's copy and the other's lands before the first decides, the record
// (shared) already holds the newer copy: the older copy just read was then "a change in the cloud since the record's copy",
// and as this tab's edit was the record's copy it was no change at all — so the older cloud copy replaced the edit, in
// the list shared by both tabs and, by the next write, in the account. Now a flush judges what it read by the record
// as it was before the read (as a first sync does), finds its edit the only change, writes it — refused as stale, since the
// other tab's write changed the copy — and decides again from the copy that landed.
// The real engine, plan and io over a fake Firestore; the second tab's read of the copy waits at a gate. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

test('a tab\'s flush that read the copy before the other tab\'s landed does not replace the edit with the older copy', async () => {
  const cloud = fakeFirestore();
  let list = [job('j1', '[1]', 100)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const meta = memoryMeta(); // one record, shared by both tabs
  const gate = deferred();
  let armed = false;
  const tab = (slow) => {
    const fs = slow ? {
      ...cloud.fs,
      // The copy is read at once and handed over when the gate opens: a read that began before the other tab's write landed.
      getDocFromServer: async (ref) => {
        const snapshot = await cloud.fs.getDocFromServer(ref);
        if (armed && ref.path === 'users/A/jobs/j1') { armed = false; await gate.promise; }
        return snapshot;
      },
    } : cloud.fs;
    const timers = manualTimers();
    const { seen, report } = recorder();
    const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta, report, timers });
    return { timers, seen, sync };
  };
  const first = tab(false);
  const second = tab(true);
  first.sync.start(A);
  second.sync.start(A);
  await settle(10);
  assert.equal(first.seen.status, 'synced');

  set(list.map((x) => ({ ...x, notes: '[1] edited', updatedAt: 300 }))); // both tabs queue the flush
  armed = true;
  await second.timers.fire(); // reads the old copy and waits
  await first.timers.fire(); // writes the edit
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '[1] edited');
  gate.resolve();
  await settle(10);
  await second.timers.fire();
  await first.timers.fire();
  await settle(10);

  assert.equal(list[0].notes, '[1] edited', 'the edit is still shown');
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '[1] edited', 'and in the account');
  assert.equal(second.seen.status, 'synced');
});
