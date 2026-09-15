// The cloud sync's decisions (src/utils/cloudSyncPlan.js), run over plain data: what the first
// sync after sign-in writes, removes and flags, what a flush does, and what is queued (R4-1,
// R4-2). A fake cloud applies each plan the way useCloudSync's batch does, so a test can
// follow a deletion across a reload and onto a second device.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let plan;
let flush;
before(async () => {
  await setup();
  plan = await loadModule('/src/utils/cloudSyncPlan.js');
  flush = await loadModule('/src/utils/cloudSyncFlush.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const ids = (list) => list.map((r) => r.id).toSorted();

/** The account after useCloudSync's first-sync batch: sets, flags, removals, deletion list. */
function apply(cloud, p) {
  const docs = new Map(cloud.docs.map((r) => [r.id, r]));
  for (const r of p.merged) docs.set(r.id, r);
  for (const id of p.flags) docs.set(id, { ...docs.get(id), id, deleted: true });
  for (const id of p.hardDeletes) docs.delete(id);
  return { docs: [...docs.values()], deleted: p.tombstones || cloud.deleted };
}

describe('first sync after sign-in (R4-1)', () => {
  it('a résumé deleted while signed out is removed from the cloud and stays gone after a reload', () => {
    let cloud = { docs: [cv('resume_a'), cv('resume_b')], deleted: [] };
    // Signed out: resume_a deleted in this browser; the store remembers it in deletedIds.
    const p = plan.planInitialSync({ local: [cv('resume_b')], localDeleted: ['resume_a'], cloud: cloud.docs, cloudDeleted: cloud.deleted });
    assert.deepEqual(ids(p.merged), ['resume_b']);
    assert.deepEqual(p.hardDeletes, ['resume_a']);
    assert.deepEqual(p.tombstones, ['resume_a']);
    cloud = apply(cloud, p);

    // Reload: loadResumes cleared deletedIds. Before the fix the cloud still held resume_a here.
    const again = plan.planInitialSync({ local: p.merged, localDeleted: [], cloud: cloud.docs, cloudDeleted: cloud.deleted });
    assert.deepEqual(ids(again.merged), ['resume_b'], 'it does not come back');
    // A second device that still holds its old copy drops it too.
    const other = plan.planInitialSync({ local: [cv('resume_a'), cv('resume_b')], localDeleted: [], cloud: cloud.docs, cloudDeleted: cloud.deleted });
    assert.deepEqual(ids(other.merged), ['resume_b'], 'the deletion list keeps it off every device');
  });

  it('a sample deleted offline is flagged, not removed, so a restore can bring back its edits', () => {
    const cloud = { docs: [cv('demo_classic', 5, { name: 'Edited sample' }), cv('resume_b')], deleted: [] };
    const p = plan.planInitialSync({ local: [cv('resume_b')], localDeleted: ['demo_classic'], cloud: cloud.docs, cloudDeleted: [] });
    assert.deepEqual(p.flags, ['demo_classic']);
    assert.deepEqual(p.hardDeletes, []);
    assert.equal(p.tombstones, null, 'samples never go on the deletion list');
    const after = apply(cloud, p);
    assert.equal(after.docs.find((r) => r.id === 'demo_classic').name, 'Edited sample', 'the edited copy is kept');
    const again = plan.planInitialSync({ local: p.merged, localDeleted: [], cloud: after.docs, cloudDeleted: after.deleted });
    assert.deepEqual(ids(again.merged), ['resume_b'], 'and it stays deleted');
  });

  it('sends only what the cloud still holds: never-synced, already-listed and already-flagged ids change nothing', () => {
    const cloud = [cv('resume_b'), { id: 'demo_minimal', deleted: true }];
    const p = plan.planInitialSync({
      local: [cv('resume_b')], localDeleted: ['resume_local_only', 'resume_old', 'demo_minimal', 'resume_local_only'],
      cloud, cloudDeleted: ['resume_old'],
    });
    assert.deepEqual([p.flags, p.hardDeletes, p.tombstones], [[], [], null]);
    assert.deepEqual(ids(p.merged), ['resume_b']);
  });

  it('keeps what nobody deleted: local and cloud résumés merge, the newer copy wins', () => {
    const p = plan.planInitialSync({
      local: [cv('resume_a', 10, { name: 'Local' }), cv('resume_local', 1)],
      localDeleted: [],
      cloud: [cv('resume_a', 20, { name: 'Cloud' }), cv('resume_cloud', 1)],
      cloudDeleted: [],
    });
    assert.deepEqual(ids(p.merged), ['resume_a', 'resume_cloud', 'resume_local']);
    assert.equal(p.merged.find((r) => r.id === 'resume_a').name, 'Cloud');
    assert.deepEqual([p.flags, p.hardDeletes, p.tombstones], [[], [], null]);
  });

  it('ignores a cloud entry without an id instead of merging it (R4-5)', () => {
    const p = plan.planInitialSync({ local: [cv('resume_a')], cloud: [{ deleted: true }, { name: 'no id' }, cv('resume_b')] });
    assert.deepEqual(ids(p.merged), ['resume_a', 'resume_b']);
  });
});

describe('the write queue and the flush (R4-2)', () => {
  const empty = () => ({ writes: new Map(), deletes: new Set() });

  it('queues edits and deletions; a résumé deleted and put back before the flush is written, not deleted', () => {
    const a1 = cv('demo_a', 1);
    const b1 = cv('resume_b', 1);
    let q = plan.queueChanges(empty(), [a1, b1], [b1]);
    assert.equal(q.dirty, true);
    assert.deepEqual([[...q.writes.keys()], [...q.deletes]], [[], ['demo_a']]);
    const restored = cv('demo_a', 2);
    q = plan.queueChanges(q, [b1], [b1, restored]);
    assert.deepEqual([[...q.writes.keys()], [...q.deletes]], [['demo_a'], []]);
    assert.equal(plan.queueChanges(empty(), [b1], [b1]).dirty, false, 'nothing changed');
    const fresh = { id: 'resume_new', sections: [] }; // no updatedAt yet
    assert.deepEqual([...plan.queueChanges(empty(), [b1], [b1, fresh]).writes.keys()], ['resume_new'], 'a new résumé is written');
  });

  it('a flush flags samples, removes the rest, and rewrites the deletion list only when it must', () => {
    const f = plan.planFlush([cv('resume_x')], ['demo_a', 'resume_b'], new Set());
    assert.deepEqual([f.flags, f.hardDeletes, f.rewriteTombstones], [['demo_a'], ['resume_b'], true]);
    assert.equal(plan.planFlush([cv('resume_x')], ['demo_a'], new Set()).rewriteTombstones, false, 'flags only');
    assert.equal(plan.planFlush([cv('demo_a')], [], new Set(['demo_a'])).rewriteTombstones, true, 'a restore revives a listed sample');
  });
});

/**
 * A cloud for flushOnce: `io` commits a batch the way useCloudSync's does. `readDeletions` waits
 * for `hold` (a promise) when given — the network round trip the race needs.
 */
function fakeCloud(docs, { hold } = {}) {
  const state = { docs: new Map(docs.map((r) => [r.id, r])), deleted: [], commits: [] };
  const io = {
    async readDeletions() {
      await hold;
      return [...state.deleted];
    },
    async commit(uid, { sets, flags, hardDeletes, tombstones }) {
      for (const r of sets) state.docs.set(r.id, r);
      for (const id of flags) state.docs.set(id, { ...state.docs.get(id), id, deleted: true });
      for (const id of hardDeletes) state.docs.delete(id);
      if (tombstones) state.deleted = tombstones;
      state.commits.push(sets.length ? 'restore' : 'delete');
    },
  };
  return { state, io };
}

describe('flushes run one at a time (R4-3)', () => {
  const SAMPLES = ['demo_1', 'demo_2', 'demo_3', 'demo_4', 'demo_5'];
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  };
  const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
  // The owner deletes their résumé R and samples 1-4 (flush A: flags plus a removal, so it reads
  // the deletion list first); then sample 5, which brings the whole set back (flush B: five writes).
  const flushA = { uid: 'u', writes: [], deletes: ['resume_r', 'demo_1', 'demo_2', 'demo_3', 'demo_4'], tombstones: new Set() };
  const flushB = { uid: 'u', writes: SAMPLES.map((id) => cv(id, 9, { name: `Restored ${id}` })), deletes: [], tombstones: new Set() };
  const flagged = (state) => [...state.docs.values()].filter((r) => r.deleted).map((r) => r.id);

  it('a flush still reading the deletion list commits before the next starts: the restored samples stay', async () => {
    const network = deferred();
    const { state, io } = fakeCloud([...SAMPLES.map((id) => cv(id)), cv('resume_r')], { hold: network.promise });
    const run = flush.serialQueue();
    const a = run(() => flush.flushOnce(flushA, io));
    const b = run(() => flush.flushOnce(flushB, io));
    await ticks(); // flush B would commit here if it did not wait for A
    assert.deepEqual(state.commits, [], 'nothing commits while A waits on the network');
    network.resolve();
    await Promise.all([a, b]);
    assert.deepEqual(state.commits, ['delete', 'restore'], 'in the order they were queued');
    assert.deepEqual(flagged(state), [], 'no sample is left flagged as deleted');
    assert.deepEqual(ids([...state.docs.values()]), SAMPLES);
    assert.deepEqual(state.deleted, ['resume_r']);
  });

  it('the race is real: the same two flushes side by side leave four samples flagged (what happened before)', async () => {
    const network = deferred();
    const { state, io } = fakeCloud([...SAMPLES.map((id) => cv(id)), cv('resume_r')], { hold: network.promise });
    const a = flush.flushOnce(flushA, io);
    const b = flush.flushOnce(flushB, io);
    await ticks();
    network.resolve();
    await Promise.all([a, b]);
    assert.deepEqual(state.commits, ['restore', 'delete']);
    assert.deepEqual(flagged(state), ['demo_1', 'demo_2', 'demo_3', 'demo_4']);
  });

  it('a failed flush does not stop the ones after it, and each settles as its own task did', async () => {
    const run = flush.serialQueue();
    const order = [];
    const failed = run(async () => { order.push('a'); throw new Error('offline'); });
    const next = run(async () => { order.push('b'); return 'sent'; });
    await assert.rejects(failed, /offline/);
    assert.equal(await next, 'sent');
    assert.deepEqual(order, ['a', 'b']);
  });

  it('flushOnce reads the deletion list only when it changes, and writes it in the same batch', async () => {
    const { state, io } = fakeCloud([cv('resume_x'), cv('demo_a')]);
    let reads = 0;
    const counted = { ...io, readDeletions: (uid) => { reads += 1; return io.readDeletions(uid); } };
    assert.equal(await flush.flushOnce({ uid: 'u', writes: [cv('resume_x', 2)], deletes: ['demo_a'], tombstones: new Set() }, counted), null);
    assert.equal(reads, 0, 'flags and writes only: no read');
    assert.deepEqual(await flush.flushOnce({ uid: 'u', writes: [], deletes: ['resume_x'], tombstones: new Set() }, counted), ['resume_x']);
    assert.equal(reads, 1);
    assert.deepEqual([state.deleted, state.commits.length], [['resume_x'], 2]);
  });
});
