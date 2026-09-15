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
/** One of a demo account's originals ("Keep as my original", src/utils/demoSeed.js). */
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });
const ids = (list) => list.map((r) => r.id).toSorted();
/** Deleted in this browser at version 1 (cv's default updatedAt). */
const del = (...list) => list.map((id) => ({ id, version: 1 }));

describe('first sync after sign-in (R4-1)', () => {
  it('a résumé deleted while signed out is removed from the cloud and listed', () => {
    // Signed out: resume_a deleted in this browser; the store remembers it (localDeletions.js).
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: del('resume_a'), cloud: [cv('resume_a'), cv('resume_b')], cloudDeleted: [] });
    assert.deepEqual(ids(p.merged), ['resume_b']);
    assert.deepEqual(p.hardDeletes, ['resume_a']);
    assert.deepEqual(p.listAdd, ['resume_a']);
    // Listed and flagged ids stay out of every later merge.
    const other = plan.planInitialSync({ local: [cv('resume_a'), cv('resume_b')], cloud: [cv('resume_b')], cloudDeleted: ['resume_a'] });
    assert.deepEqual(ids(other.merged), ['resume_b'], 'the deletion list keeps it off every device');
  });

  it('an original deleted offline is flagged, not removed, so a restore can bring back its edits', () => {
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: [{ id: 'resume_o', version: 5 }], cloud: [orig('resume_o', 5), cv('resume_b')], cloudDeleted: [], demoAccount: true });
    assert.deepEqual(p.flags, ['resume_o'], 'before: removed for good — only the samples were kept');
    assert.deepEqual(p.hardDeletes, []);
    assert.deepEqual(p.listAdd, [], 'originals never go on the deletion list');
    const again = plan.planInitialSync({ local: p.merged, cloud: [orig('resume_o', 5, { deleted: true }), cv('resume_b')], demoAccount: true });
    assert.deepEqual(ids(again.merged), ['resume_b'], 'and it stays deleted');
  });

  it('a sample deleted offline in a demo account is removed for good: the samples never come back now', () => {
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: [{ id: 'demo_classic', version: 5 }], cloud: [cv('demo_classic', 5), cv('resume_b')], cloudDeleted: [], demoAccount: true });
    assert.deepEqual([p.flags, p.hardDeletes, p.listAdd], [[], ['demo_classic'], ['demo_classic']], 'before: flagged, for a restore of the samples');
  });

  it('the copy deleted decides whether it was an original; an older build\'s entry leaves it to the cloud\'s copy', () => {
    // Marked here and deleted before a flush sent the mark: the cloud's copy is not marked yet.
    const marked = plan.planInitialSync({ local: [], deletions: [{ id: 'resume_o', version: 5, keep: true }], cloud: [cv('resume_o', 4)], demoAccount: true });
    assert.deepEqual([marked.flags, marked.hardDeletes], [['resume_o'], []], 'before: removed for good');
    // "Stop keeping" here, then deleted, before either reached the cloud: removed, as the user asked.
    const unmarked = plan.planInitialSync({ local: [], deletions: [{ id: 'resume_o', version: 5, keep: false }], cloud: [orig('resume_o', 4)], demoAccount: true });
    assert.deepEqual([unmarked.flags, unmarked.hardDeletes], [[], ['resume_o']]);
    const legacy = plan.planInitialSync({ local: [], deletions: [{ id: 'resume_o', version: 4 }], cloud: [orig('resume_o', 4)], demoAccount: true });
    assert.deepEqual(legacy.flags, ['resume_o']);
  });

  it('sends only what the cloud still holds: never-synced, already-listed and already-flagged ids change nothing', () => {
    const cloud = [cv('resume_b'), { id: 'demo_minimal', deleted: true }];
    const p = plan.planInitialSync({
      local: [cv('resume_b')], deletions: del('resume_local_only', 'resume_old', 'demo_minimal', 'resume_local_only'),
      cloud, cloudDeleted: ['resume_old'], demoAccount: true,
    });
    assert.deepEqual([p.flags, p.hardDeletes, p.listAdd], [[], [], []]);
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
    assert.deepEqual([p.flags, p.hardDeletes, p.listAdd], [[], [], []]);
    assert.deepEqual(ids(p.sets), ['resume_local'], 'only what the account lacks or holds older (R8-4)');
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

  it('remembers which deletions were originals; put back before the flush, one is written and forgotten there', () => {
    const o1 = orig('resume_o', 1);
    const b1 = cv('resume_b', 1);
    let q = plan.queueChanges(empty(), [o1, b1], []);
    assert.deepEqual([[...q.deletes], [...q.kept]], [['resume_o', 'resume_b'], ['resume_o']]);
    q = plan.queueChanges(q, [], [orig('resume_o', 2)]);
    assert.deepEqual([[...q.writes.keys()], [...q.deletes], [...q.kept]], [['resume_o'], ['resume_b'], []]);
    q = plan.queueChanges(q, [orig('resume_o', 2)], []);
    assert.deepEqual([...q.kept], ['resume_o']);
    q = plan.queueChanges(q, [], [cv('resume_o', 3)]); // back, and "Stop keeping"
    q = plan.queueChanges(q, [cv('resume_o', 3)], []);
    assert.deepEqual([...q.kept], [], 'the copy deleted last was not an original');
  });

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

  it('a flush flags originals, removes the rest and lists them, and takes a restored original off the list', () => {
    const demo = { demoAccount: true, kept: new Set(['resume_o']) };
    const f = plan.planFlush([cv('resume_x')], ['resume_o', 'resume_b', 'demo_a'], new Set(), demo);
    assert.deepEqual([f.flags, f.hardDeletes, f.listAdd, f.listRemove], [['resume_o'], ['resume_b', 'demo_a'], ['resume_b', 'demo_a'], []], 'a sample is removed for good now');
    assert.deepEqual(plan.planFlush([cv('resume_x')], ['resume_o'], new Set(), demo).listAdd, [], 'flags only');
    assert.deepEqual(plan.planFlush([orig('resume_o'), cv('demo_b')], [], new Set(['resume_o', 'demo_b']), demo).listRemove, ['resume_o'], 'a restore revives a listed original, never a sample');
    assert.deepEqual(plan.planFlush([cv('resume_1')], [], new Set(['resume_1']), demo).listRemove, [], 'a regular résumé written again stays deleted: a stale device cannot resurrect it');
  });
});

/**
 * A cloud for flushOnce: the app's Firestore calls over a fake Firestore holding `docs` in account
 * 'u'. `state` shows the account: docs (Map id → résumé), deleted (the list), commits ('restore'
 * for a batch that writes résumés, else 'delete').
 */
function fakeCloud(docs) {
  const cloud = fakeFirestore(Object.fromEntries(docs.map((r) => [resumePath('u', r.id), r])));
  const state = {
    get docs() { return new Map(Object.entries(cloud.resumes('u'))); },
    get deleted() { return cloud.doc(listPath('u'))?.ids || []; },
    get commits() {
      return cloud.commits.map((ops) => (ops.some(([op, path, , opt]) => op === 'set' && path.includes('/resumes/') && !opt) ? 'restore' : 'delete'));
    },
  };
  return { state, cloud, io: io.cloudIo(cloud.fs, cloud.db) };
}

describe('flushes reach the server in the order they were made (R4-3)', () => {
  const ORIGINALS = ['orig_1', 'orig_2', 'orig_3', 'orig_4', 'orig_5'];
  // The owner deletes their résumé R and originals 1-4 (flush A: flags plus a removal); then
  // original 5, which brings them all back (flush B: five writes). A used to read the deletion
  // list first, and B committed while it waited: A's flags landed over the restore.
  const flushA = { uid: 'u', writes: [], deletes: ['resume_r', ...ORIGINALS.slice(0, 4)], kept: new Set(ORIGINALS), listed: new Set(), demoAccount: true };
  const flushB = { uid: 'u', writes: ORIGINALS.map((id) => orig(id, 9, { name: `Restored ${id}` })), deletes: [], listed: new Set(), demoAccount: true };
  const flagged = (state) => [...state.docs.values()].filter((r) => r.deleted).map((r) => r.id);

  it('a flush hands its batch over at once — nothing is read first — so the restored originals stay', async () => {
    const { state, cloud, io: cloudIo } = fakeCloud([...ORIGINALS.map((id) => orig(id)), cv('resume_r')]);
    const ack = deferred();
    cloud.hold.commit = ack.promise; // the server answers later
    const a = flush.flushOnce(flushA, cloudIo);
    assert.deepEqual(state.commits, ['delete'], 'A is with the server before anything else runs');
    const b = flush.flushOnce(flushB, cloudIo);
    assert.deepEqual(state.commits, ['delete', 'restore'], 'in the order they were made');
    assert.deepEqual(cloud.reads, [], 'no read, so no window between a read and a write');
    ack.resolve();
    await Promise.all([a, b]);
    assert.deepEqual(flagged(state), [], 'no original is left flagged as deleted');
    assert.deepEqual(ids([...state.docs.values()]), ORIGINALS);
    assert.deepEqual(state.deleted, ['resume_r']);
  });

  it('flushOnce adds removals to the deletion list and takes restored originals off it, in the same batch', async () => {
    const { state, cloud, io: cloudIo } = fakeCloud([cv('resume_x'), orig('orig_a')]);
    cloud.data.set(listPath('u'), { ids: ['orig_b', 'resume_old'] });
    await flush.flushOnce({ uid: 'u', writes: [cv('resume_x', 2)], deletes: ['orig_a'], kept: new Set(['orig_a']), listed: new Set(), demoAccount: true }, cloudIo);
    assert.deepEqual(state.deleted, ['orig_b', 'resume_old'], 'flags and writes only: the list is left alone');
    await flush.flushOnce({ uid: 'u', writes: [orig('orig_b', 3)], deletes: ['resume_x'], listed: new Set(['orig_b', 'resume_old']), demoAccount: true }, cloudIo);
    assert.deepEqual(state.deleted, ['resume_old', 'resume_x'], 'before: orig_b stayed listed, and every device dropped it again');
    assert.deepEqual(state.commits.length, 2);
  });
});

describe('the owner\'s résumés in an account that is not a demo account (R4-11)', () => {
  // Local résumés carry over to whichever account signs in next in the same browser, so the
  // owner's samples and originals reach a friend's account on a shared computer. Only a demo
  // account keeps a deleted original's last copy for a restore; anyone else deletes it like any
  // résumé.
  it('a flush removes a deleted original for good and lists it (a guard: never flagged outside a demo account)', async () => {
    const { state, io } = fakeCloud([orig('resume_o', 3, { name: 'Owner content' })]);
    const job = { uid: 'u', writes: [], deletes: ['resume_o'], kept: new Set(['resume_o']), listed: new Set(), demoAccount: false };
    assert.deepEqual((await flush.flushOnce(job, io)).flags, []);
    assert.deepEqual([[...state.docs.keys()], state.deleted], [[], ['resume_o']]);
  });

  it('a flush removes a deleted sample for good and lists it as deleted', async () => {
    const { state, io } = fakeCloud([cv('demo_classic', 3, { name: 'Owner content' }), cv('resume_b')]);
    const job = { uid: 'u', writes: [], deletes: ['demo_classic'], listed: new Set(), demoAccount: false }; // the friend's account
    assert.deepEqual((await flush.flushOnce(job, io)).listAdd, ['demo_classic']);
    assert.deepEqual(ids([...state.docs.values()]), ['resume_b'], 'before: flagged, and kept in the cloud for good');
    assert.deepEqual(state.deleted, ['demo_classic']);
  });

  it('the first sync removes samples an older build flagged, and a sample deleted while signed out', () => {
    const cloud = [cv('demo_classic', 3, { deleted: true }), cv('demo_modern', 3), cv('resume_b')];
    const p = plan.planInitialSync({ local: [cv('resume_b')], deletions: [{ id: 'demo_modern', version: 3 }], cloud, cloudDeleted: [], demoAccount: false });
    assert.deepEqual([p.flags, p.hardDeletes.toSorted(), p.listAdd.toSorted()], [[], ['demo_classic', 'demo_modern'], ['demo_classic', 'demo_modern']]);
    assert.deepEqual(ids(p.merged), ['resume_b']);
    const again = plan.planInitialSync({ local: p.merged, cloud: [cv('resume_b')], cloudDeleted: p.listAdd, demoAccount: false });
    assert.deepEqual([again.hardDeletes, again.listAdd], [[], []], 'nothing left to clean up');
  });

  it('an original written again does not come off its deletion list (only a demo account restores originals)', () => {
    const f = plan.planFlush([orig('resume_o'), cv('demo_a')], [], new Set(['resume_o', 'demo_a']), { demoAccount: false });
    assert.deepEqual(f.listRemove, []);
    assert.deepEqual(plan.planFlush([], ['resume_o'], new Set(), { kept: new Set(['resume_o']) }).flags, [], 'not a demo account unless told so');
  });
});
