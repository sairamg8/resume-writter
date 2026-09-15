// The cloud sync's decisions (src/utils/cloudSyncPlan.js), run over plain data: what the first
// sync after sign-in writes, removes and flags, what a flush does, and what is queued (R4-1,
// R4-2). Following a deletion across a reload and onto a second device takes the real batch and
// engine: 18-cloud-sync-io.test.mjs. The flushes here commit through the app's own Firestore
// calls (cloudSyncIo.js) over a fake Firestore.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, resumePath, listPath } from './fake-firestore.mjs';

let plan;
let flush;
let io;
before(async () => {
  await setup();
  plan = await loadModule('/src/utils/cloudSyncPlan.js');
  flush = await loadModule('/src/utils/cloudSyncFlush.js');
  io = await loadModule('/src/utils/cloudSyncIo.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const ids = (list) => list.map((r) => r.id).toSorted();
/** Deleted in this browser at version 1 (cv's default updatedAt). */
const del = (...list) => list.map((id) => ({ id, version: 1 }));

describe('first sync after sign-in (R4-1)', () => {
  it('a résumé deleted while signed out is removed from the cloud and listed', () => {
    // Signed out: resume_a deleted in this browser; the store remembers it (localDeletions.js).
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: del('resume_a'), cloud: [cv('resume_a'), cv('resume_b')], cloudDeleted: [] });
    assert.deepEqual(ids(p.merged), ['resume_b']);
    assert.deepEqual(p.hardDeletes, ['resume_a']);
    assert.deepEqual(p.tombstones, ['resume_a']);
    // Listed and flagged ids stay out of every later merge.
    const other = plan.planInitialSync({ local: [cv('resume_a'), cv('resume_b')], cloud: [cv('resume_b')], cloudDeleted: ['resume_a'] });
    assert.deepEqual(ids(other.merged), ['resume_b'], 'the deletion list keeps it off every device');
  });

  it('a sample deleted offline is flagged, not removed, so a restore can bring back its edits', () => {
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: [{ id: 'demo_classic', version: 5 }], cloud: [cv('demo_classic', 5), cv('resume_b')], cloudDeleted: [], demoAccount: true });
    assert.deepEqual(p.flags, ['demo_classic']);
    assert.deepEqual(p.hardDeletes, []);
    assert.equal(p.tombstones, null, 'samples never go on the deletion list');
    const again = plan.planInitialSync({ local: p.merged, cloud: [cv('demo_classic', 5, { deleted: true }), cv('resume_b')], demoAccount: true });
    assert.deepEqual(ids(again.merged), ['resume_b'], 'and it stays deleted');
  });

  it('sends only what the cloud still holds: never-synced, already-listed and already-flagged ids change nothing', () => {
    const cloud = [cv('resume_b'), { id: 'demo_minimal', deleted: true }];
    const p = plan.planInitialSync({
      local: [cv('resume_b')], deletions: del('resume_local_only', 'resume_old', 'demo_minimal', 'resume_local_only'),
      cloud, cloudDeleted: ['resume_old'], demoAccount: true,
    });
    assert.deepEqual([p.flags, p.hardDeletes, p.tombstones], [[], [], null]);
    assert.deepEqual(ids(p.merged), ['resume_b']);
  });

  it('keeps what nobody deleted: local and cloud résumés merge, the newer copy wins', () => {
    const p = plan.planInitialSync({
      local: [cv('resume_a', 10, { name: 'Local' }), cv('resume_local', 1)],
      deletions: [],
      cloud: [cv('resume_a', 20, { name: 'Cloud' }), cv('resume_cloud', 1)],
      cloudDeleted: [],
    });
    assert.deepEqual(ids(p.merged), ['resume_a', 'resume_cloud', 'resume_local']);
    assert.equal(p.merged.find((r) => r.id === 'resume_a').name, 'Cloud');
    assert.deepEqual([p.flags, p.hardDeletes, p.tombstones], [[], [], null]);
  });
});

describe('the store after a first sync (afterSync, R8-2)', () => {
  it('takes the merged copies of what did not change, keeps what changed meanwhile, forgets only handled deletions', () => {
    const snapshot = [cv('resume_a', 1), cv('resume_gone', 1), cv('resume_kept', 1)];
    // The plan left out resume_gone and resume_kept (deleted on another device), merged A with the cloud's.
    const merged = [cv('resume_a', 5, { name: 'Cloud' }), cv('resume_cloud', 2)];
    const now = {
      resumes: [cv('resume_a', 1), cv('resume_gone', 1), cv('resume_kept', 3, { name: 'Edited meanwhile' })],
      activeId: 'resume_gone',
      deletedIds: ['resume_x', 'resume_y'],
      deletedInfo: { resume_x: { version: 1, at: 10 }, resume_y: { version: 1, at: 99 } },
    };
    const next = plan.afterSync(now, { uid: 'u', snapshot, merged, handled: ['resume_x', 'resume_y'], before: 50 });
    assert.deepEqual(next.resumes.map((r) => [r.id, r.name]), [['resume_a', 'Cloud'], ['resume_cloud', 'resume_cloud'], ['resume_kept', 'Edited meanwhile']]);
    assert.equal(next.activeId, 'resume_a', 'the open résumé went: the first one is open');
    assert.deepEqual(next.deletedIds, ['resume_y'], 'deleted again after the plan read the store');
    assert.equal(next.syncedUid, 'u', 'the list is this account\'s now: a later deletion is too (R8-6)');
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
    const demo = { demoAccount: true };
    const f = plan.planFlush([cv('resume_x')], ['demo_a', 'resume_b'], new Set(), demo);
    assert.deepEqual([f.flags, f.hardDeletes, f.rewriteTombstones], [['demo_a'], ['resume_b'], true]);
    assert.equal(plan.planFlush([cv('resume_x')], ['demo_a'], new Set(), demo).rewriteTombstones, false, 'flags only');
    assert.equal(plan.planFlush([cv('demo_a')], [], new Set(['demo_a']), demo).rewriteTombstones, true, 'a restore revives a listed sample');
  });
});

/**
 * A cloud for flushOnce: the app's Firestore calls over a fake Firestore holding `docs` in account
 * 'u'. The deletion-list read waits for `hold` (a promise) when given — the network round trip
 * the race needs. `state` shows the account: docs (Map id → résumé), deleted (the list), commits
 * ('restore' for a batch that writes résumés, else 'delete').
 */
function fakeCloud(docs, { hold } = {}) {
  const cloud = fakeFirestore(Object.fromEntries(docs.map((r) => [resumePath('u', r.id), r])));
  const real = io.cloudIo(cloud.fs, cloud.db);
  const readDeletions = async (uid) => { await hold; return real.readDeletions(uid); };
  const state = {
    get docs() { return new Map(Object.entries(cloud.resumes('u'))); },
    get deleted() { return cloud.doc(listPath('u'))?.ids || []; },
    get commits() {
      return cloud.commits.map((ops) => (ops.some(([op, path, , opt]) => op === 'set' && path.includes('/resumes/') && !opt) ? 'restore' : 'delete'));
    },
  };
  return { state, io: { ...real, readDeletions } };
}

describe('flushes run one at a time (R4-3)', () => {
  const SAMPLES = ['demo_1', 'demo_2', 'demo_3', 'demo_4', 'demo_5'];
  const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
  // The owner deletes their résumé R and samples 1-4 (flush A: flags plus a removal, so it reads
  // the deletion list first); then sample 5, which brings the whole set back (flush B: five writes).
  const flushA = { uid: 'u', writes: [], deletes: ['resume_r', 'demo_1', 'demo_2', 'demo_3', 'demo_4'], tombstones: new Set(), demoAccount: true };
  const flushB = { uid: 'u', writes: SAMPLES.map((id) => cv(id, 9, { name: `Restored ${id}` })), deletes: [], tombstones: new Set(), demoAccount: true };
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
    assert.equal(await flush.flushOnce({ uid: 'u', writes: [cv('resume_x', 2)], deletes: ['demo_a'], tombstones: new Set(), demoAccount: true }, counted), null);
    assert.equal(reads, 0, 'flags and writes only: no read');
    assert.deepEqual(await flush.flushOnce({ uid: 'u', writes: [], deletes: ['resume_x'], tombstones: new Set() }, counted), ['resume_x']);
    assert.equal(reads, 1);
    assert.deepEqual([state.deleted, state.commits.length], [['resume_x'], 2]);
  });
});

describe('sample résumés in an account that is not a demo account (R4-11)', () => {
  // Local résumés carry over to whichever account signs in next in the same browser, so the
  // owner's samples reach a friend's account on a shared computer. Only a demo account keeps
  // a deleted sample's last copy for a restore; anyone else deletes it like any résumé.
  it('a flush removes a deleted sample for good and lists it as deleted', async () => {
    const { state, io } = fakeCloud([cv('demo_classic', 3, { name: 'Owner content' }), cv('resume_b')]);
    const job = { uid: 'u', writes: [], deletes: ['demo_classic'], tombstones: new Set(), demoAccount: false }; // the friend's account
    assert.deepEqual(await flush.flushOnce(job, io), ['demo_classic']);
    assert.deepEqual(ids([...state.docs.values()]), ['resume_b'], 'before: flagged, and kept in the cloud for good');
    assert.deepEqual(state.deleted, ['demo_classic']);
  });

  it('the first sync removes samples an older build flagged, and a sample deleted while signed out', () => {
    const cloud = [cv('demo_classic', 3, { deleted: true }), cv('demo_modern', 3), cv('resume_b')];
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: [{ id: 'demo_modern', version: 3 }], cloud, cloudDeleted: [], demoAccount: false });
    assert.deepEqual([p.flags, p.hardDeletes.toSorted(), p.tombstones.toSorted()], [[], ['demo_classic', 'demo_modern'], ['demo_classic', 'demo_modern']]);
    assert.deepEqual(ids(p.merged), ['resume_b']);
    const again = plan.planInitialSync({ local: p.merged, cloud: [cv('resume_b')], cloudDeleted: p.tombstones, demoAccount: false });
    assert.deepEqual([again.hardDeletes, again.tombstones], [[], null], 'nothing left to clean up');
  });

  it('a sample written again does not come off its deletion list (only a demo account restores samples)', () => {
    const f = plan.planFlush([cv('demo_a')], [], new Set(['demo_a']), { demoAccount: false });
    assert.equal(f.rewriteTombstones, false);
    assert.deepEqual(plan.planFlush([], ['demo_a'], new Set()).flags, [], 'not a demo account unless told so');
  });
});
