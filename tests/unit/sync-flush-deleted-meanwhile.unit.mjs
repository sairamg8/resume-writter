// SL-SYNC-FLUSH-WRITES-DELETED-ITEM: a job or project deleted in another tab while this tab's flush
// was reading the cloud's copies (the read can take seconds on a bad connection) was written back all
// the same. The flush (collectionSyncEngine.flush) took its writes from the queue before the read
// and sent them after it, never asking the store again: the other tab's deletion had reached this one
// through the storage event (the list had lost the item, and changed() queued its deletion), yet the
// batch in flight still set it — and, as every write comes off the account's deletion list
// (collectionSyncIo.commit), took the other tab's deletion off that list too: the item came back on
// every device. Now the flush asks the list once the cloud has answered: an item that is no longer
// in it is not written, and stays listed; its deletion, queued behind it, goes next. An item still
// in the list (Undo made meanwhile, one nobody deleted) is written as before. The list engine with
// its Firestore calls over one fake Firestore, for the jobs and for the boards — one engine, one
// fix; the flush's read is held (`cloud.hold.read`) while the deletion is made.
// Run: node --test tests/unit/sync-flush-deleted-meanwhile.unit.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const I1 = 'i1';
const I2 = 'i2';

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobFromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const boardFromCloud = (d) => { const { kept } = readBoard(d); return kept ? completeBoard(kept) : null; };

/** The two lists the one engine syncs: how an item is made, changed and read back from the cloud. */
const KINDS = [
  { name: 'jobs', make: (id, label, updatedAt) => job(id, label, updatedAt), change: { role: 'Lead' }, fromCloud: jobFromCloud, label: (j) => j.company },
  { name: 'boards', make: (id, label, updatedAt) => ({ ...createBoard({ title: label }, { now: updatedAt }), id }), change: { title: 'Edited' }, fromCloud: boardFromCloud, label: (b) => b.title },
];

for (const kind of KINDS) {
  const itemPath = (uid, id) => `users/${uid}/${kind.name}/${id}`;
  const metaPath = (uid) => `users/${uid}/meta/${kind.name}`;
  const deletedIn = (cloud) => cloud.doc(metaPath('A'))?.deleted ?? [];
  /** The items every batch from commit number `from` on wrote (set). */
  const writtenSince = (cloud, from) => cloud.commits.slice(from).flat()
    .filter(([op, path]) => op === 'set' && path.startsWith(`users/A/${kind.name}/`)).map(([, path]) => path.split('/').at(-1));

  /** A device: its list in memory, its record, timers and clock — as in job-sync-delete-edited.unit.mjs. */
  function device(cloud, items = []) {
    let list = items;
    const listeners = new Set();
    const set = (next) => { list = next; listeners.forEach((l) => l()); };
    const store = {
      items: () => list,
      replace: set,
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      fromCloud: kind.fromCloud, label: kind.label,
    };
    const timers = manualTimers();
    const { seen, report } = recorder();
    const sync = createCollectionSync({
      name: kind.name, io: collectionIo(cloud.fs, cloud.db, kind.name), store, meta: memoryMeta(), report, timers, now: () => 0,
    });
    return {
      sync, timers, seen,
      item: (id) => list.find((x) => x.id === id),
      ids: () => list.map((x) => x.id),
      start: async (user) => { sync.start(user); await settle(); },
      edit: (id, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...kind.change, updatedAt } : x))),
      remove: (id) => set(list.filter((x) => x.id !== id)),
      /** Undo of a deletion: the same item back at its place. */
      putBack: (x, index) => set(list.toSpliced(index, 0, x)),
    };
  }

  /**
   * A device signed in with i1 and i2, both in the account. i1 is then edited (and i2 with it,
   * `editBoth`) and the flush that sends it starts: its read of the cloud is held until `release()`.
   */
  async function flushReading({ editBoth = false } = {}) {
    const cloud = fakeFirestore();
    const d = device(cloud, [kind.make(I1, 'Acme', 1), kind.make(I2, 'Beta', 1)]);
    await d.start(A);
    assert.equal(d.seen.status, 'synced');
    const from = cloud.commits.length;
    d.edit(I1, 10);
    if (editBoth) d.edit(I2, 11);
    const gate = deferred();
    cloud.hold.read = gate.promise;
    await d.timers.fire(); // the flush has taken the queue and waits for the cloud's answer
    const release = async () => { cloud.hold.read = null; gate.resolve(); await settle(); };
    return { cloud, d, from, release };
  }

  describe(`${kind.name}: an item deleted in another tab while a flush reads the cloud (SL-SYNC-FLUSH-WRITES-DELETED-ITEM)`, () => {
    it('is not written back by that flush; its own deletion goes next — and the item nobody deleted still is written', async () => {
      const { cloud, d, from, release } = await flushReading({ editBoth: true });
      d.remove(I1); // the other tab's delete, as this tab's list has it
      await release();
      assert.deepEqual(writtenSince(cloud, from), [I2], 'before: [i1, i2] — the deleted item was written back with the other');
      assert.equal(cloud.doc(itemPath('A', I1)).updatedAt, 1, 'the cloud still holds the copy it had');

      await d.timers.fire(); // the deletion queued behind it
      assert.equal(cloud.doc(itemPath('A', I1)), undefined);
      assert.deepEqual(deletedIn(cloud), [I1]);
      assert.equal(cloud.doc(itemPath('A', I2)).updatedAt, 11);
      assert.deepEqual(d.ids(), [I2]);
      assert.deepEqual(cloud.doc(metaPath('A')).order, [I2]);
      assert.equal(d.seen.status, 'synced');
    });

    it('whose deletion reached the cloud first: not written back, and its id stays on the deletion list', async () => {
      const { cloud, d, from, release } = await flushReading();
      // The other tab's flush: the item gone from the cloud and listed as deleted before this read is answered.
      cloud.data.delete(itemPath('A', I1));
      cloud.data.set(metaPath('A'), { ...cloud.doc(metaPath('A')), deleted: [I1] });
      d.remove(I1);
      await release();
      assert.deepEqual(writtenSince(cloud, from), [], 'before: [i1]');
      assert.equal(cloud.doc(itemPath('A', I1)), undefined, 'before: written back to the account');
      assert.deepEqual(deletedIn(cloud), [I1], 'before: [] — the other tab\'s deletion undone on every device');

      await d.timers.fire();
      assert.equal(cloud.doc(itemPath('A', I1)), undefined);
      assert.deepEqual(deletedIn(cloud), [I1]);
      assert.deepEqual(d.ids(), [I2]);
      assert.equal(d.seen.status, 'synced');
    });

    it('put back meanwhile (Undo): still written, and not left deleted', async () => {
      const { cloud, d, from, release } = await flushReading();
      const edited = d.item(I1);
      d.remove(I1);
      d.putBack(edited, 0); // Undo, while the flush waits
      await release();
      assert.deepEqual(writtenSince(cloud, from), [I1], 'the item is in the list: its write goes');
      assert.equal(cloud.doc(itemPath('A', I1)).updatedAt, 10);

      await d.timers.fire();
      assert.equal(cloud.doc(itemPath('A', I1)).updatedAt, 10);
      assert.deepEqual(deletedIn(cloud), []);
      assert.deepEqual(d.ids(), [I1, I2]);
      assert.equal(d.seen.status, 'synced');
    });
  });
}
