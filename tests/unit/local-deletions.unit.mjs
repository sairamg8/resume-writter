// Unit tests for the store's record of deleted résumés (src/utils/localDeletions.js), which the
// first cloud sync checks against the account's copies (R8-0). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletionEntries, withDeletion, withoutDeletions, savedDeletions } from '../../src/utils/localDeletions.js';

test('withDeletion: records the id, the version deleted (the copy\'s updatedAt), when, and whose', () => {
  const state = { deletedIds: ['resume_a'], deletedInfo: { resume_a: { version: 3, at: 10, owner: null } }, syncedUid: 'uid_1' };
  const next = withDeletion(state, { id: 'resume_b', updatedAt: 42 }, 1000);
  assert.deepEqual(next, {
    deletedIds: ['resume_a', 'resume_b'],
    deletedInfo: { resume_a: { version: 3, at: 10, owner: null }, resume_b: { version: 42, at: 1000, owner: 'uid_1', keep: false } },
  });
  assert.deepEqual(state.deletedIds, ['resume_a'], 'the state it was given is left alone');
  // Deleted again after a restore: one entry, the latest version.
  assert.deepEqual(withDeletion(next, { id: 'resume_a', updatedAt: 7 }, 2000).deletedIds, ['resume_b', 'resume_a']);
  // A résumé with no time of its own deletes as the oldest version, never as "unknown".
  assert.deepEqual(withDeletion({}, { id: 'resume_c' }, 5).deletedInfo, { resume_c: { version: 0, at: 5, owner: null, keep: false } }, 'never synced: nobody\'s yet');
});

test('withDeletion: signed in, the deletion is that account\'s, whichever account the list was last synced with (V2W1a-3)', () => {
  const state = { deletedIds: [], deletedInfo: {}, syncedUid: 'uid_a' };
  assert.equal(withDeletion(state, { id: 'resume_r', updatedAt: 5 }, 10, 'uid_b').deletedInfo.resume_r.owner, 'uid_b', 'before: uid_a, whose sync never sends it');
  assert.equal(withDeletion(state, { id: 'resume_r', updatedAt: 5 }, 10).deletedInfo.resume_r.owner, 'uid_a', 'signed out: it waits for the last account');
});

test('withDeletion: records that the copy deleted was one of the account\'s originals', () => {
  // The first sync then flags it in a demo account even when the cloud's copy is not marked yet:
  // kept and deleted before a flush sent the mark (tests/pdf/18-cloud-sync-deletions.test.mjs).
  assert.equal(withDeletion({}, { id: 'resume_o', updatedAt: 9, keep: true }, 10).deletedInfo.resume_o.keep, true);
  assert.equal(deletionEntries(withDeletion({}, { id: 'resume_o', updatedAt: 9, keep: true }, 10))[0].keep, true);
});

test('deletionEntries: one entry per id; an older build\'s id has no version', () => {
  const state = {
    deletedIds: ['resume_old', 'resume_new', 'resume_old', '', null, 7],
    deletedInfo: { resume_new: { version: 9, at: 100, owner: 'uid_1' }, resume_gone: { version: 1, at: 1 } },
  };
  assert.deepEqual(deletionEntries(state), [
    { id: 'resume_old', version: null, at: 0, owner: null, keep: null },
    { id: 'resume_new', version: 9, at: 100, owner: 'uid_1', keep: null },
  ], 'keep null: an entry saved before originals existed does not say');
  assert.deepEqual(deletionEntries({}), []);
  assert.deepEqual(deletionEntries({ deletedIds: ['x'], deletedInfo: [] }), [{ id: 'x', version: null, at: 0, owner: null, keep: null }]);
  assert.deepEqual(deletionEntries({ deletedIds: ['x'], deletedInfo: { x: { version: 'nine', owner: 7, keep: 'yes' } } }), [{ id: 'x', version: null, at: 0, owner: null, keep: null }]);
});

test('withoutDeletions: forgets the ids given, with their versions', () => {
  const state = { deletedIds: ['a', 'b', 'c'], deletedInfo: { a: { version: 1, at: 1 }, b: { version: 2, at: 2 } } };
  assert.deepEqual(withoutDeletions(state, new Set(['a', 'c'])), { deletedIds: ['b'], deletedInfo: { b: { version: 2, at: 2 } } });
  assert.deepEqual(withoutDeletions({}, ['a']), { deletedIds: [], deletedInfo: {} });
});

test('withoutDeletions with `before`: an entry made after that time stays (deleted again since) (R8-1)', () => {
  const state = { deletedIds: ['a', 'b', 'legacy'], deletedInfo: { a: { version: 1, at: 50 }, b: { version: 2, at: 150 } } };
  // A flush that took the queue at 100 sent a, b and legacy: b was deleted again at 150.
  assert.deepEqual(withoutDeletions(state, ['a', 'b', 'legacy'], 100), { deletedIds: ['b'], deletedInfo: { b: { version: 2, at: 150 } } });
});

test('savedDeletions: a store saved by an older build (ids only) loads with its ids kept', () => {
  assert.deepEqual(savedDeletions({ deletedIds: ['resume_a', 'resume_a'] }), { deletedIds: ['resume_a'], deletedInfo: {}, syncedUid: null });
  assert.deepEqual(savedDeletions({ deletedIds: 'junk', deletedInfo: 'junk', syncedUid: 5 }), { deletedIds: [], deletedInfo: {}, syncedUid: null });
  const saved = { deletedIds: ['resume_b'], deletedInfo: { resume_b: { version: 4, at: 8, owner: 'uid_1' }, stray: { version: 1, at: 1 } }, syncedUid: 'uid_2' };
  assert.deepEqual(savedDeletions(saved), { deletedIds: ['resume_b'], deletedInfo: { resume_b: { version: 4, at: 8, owner: 'uid_1' } }, syncedUid: 'uid_2' });
  const kept = { deletedIds: ['resume_o'], deletedInfo: { resume_o: { version: 4, at: 8, owner: null, keep: true } } };
  assert.deepEqual(savedDeletions(kept).deletedInfo, kept.deletedInfo, 'an original\'s entry keeps saying so');
});

test('withDeletion: another account\'s deletion of the same id still waiting is kept with it, never replaced (V2VF1S-1)', () => {
  // A deleted demo_x signed out (A's, waiting for A); B, signed in, deletes its own copy of that id.
  const a = withDeletion({ deletedIds: [], deletedInfo: {}, syncedUid: 'uid_a' }, { id: 'demo_x', updatedAt: 5 }, 10);
  const both = withDeletion({ ...a, syncedUid: 'uid_b' }, { id: 'demo_x', updatedAt: 7 }, 20, 'uid_b');
  assert.deepEqual(both.deletedIds, ['demo_x']);
  assert.deepEqual(deletionEntries(both).map((e) => [e.owner, e.version]), [['uid_b', 7], ['uid_a', 5]], 'before: [[uid_b, 7]] — A\'s deletion gone');
  assert.equal(both.deletedInfo.demo_x.owner, 'uid_b', 'deletedInfo[id] is the latest, as every build reads it');
  // The same account deleting it again replaces its own entry; the other's stays.
  const again = withDeletion(both, { id: 'demo_x', updatedAt: 9 }, 30, 'uid_b');
  assert.deepEqual(deletionEntries(again).map((e) => [e.owner, e.version]), [['uid_b', 9], ['uid_a', 5]]);
});

test('withoutDeletions with the account: only its entries — and nobody\'s — go; another account\'s stays (V2VF1S-1)', () => {
  const state = {
    deletedIds: ['demo_x'],
    deletedInfo: { demo_x: { version: 7, at: 20, owner: 'uid_b', keep: false, also: [{ version: 5, at: 10, owner: 'uid_a', keep: false }] } },
  };
  const left = withoutDeletions(state, ['demo_x'], Infinity, 'uid_b');
  assert.deepEqual(left, { deletedIds: ['demo_x'], deletedInfo: { demo_x: { version: 5, at: 10, owner: 'uid_a', keep: false } } }, 'before: nothing left — A\'s went with B\'s');
  assert.deepEqual(withoutDeletions(left, ['demo_x'], Infinity, 'uid_a'), { deletedIds: [], deletedInfo: {} });
  assert.deepEqual(withoutDeletions(state, ['demo_x'], 15, 'uid_b'), withoutDeletions(state, [], 15, 'uid_b'), 'made after `before`: B\'s stays too');
  assert.deepEqual(withoutDeletions(state, ['demo_x']), { deletedIds: [], deletedInfo: {} }, 'no account given (a restore): every entry of the id goes');
});

test('deletionEntries and savedDeletions read the entries kept with another account\'s: one per account (V2VF1S-1)', () => {
  const also = [{ version: 5, at: 10, owner: 'uid_a', keep: true }, { version: 4, at: 9, owner: 'uid_b' }, 'junk', { at: 3, owner: 'uid_c' }, { version: 2, at: 1 }];
  const saved = { deletedIds: ['demo_x'], deletedInfo: { demo_x: { version: 7, at: 20, owner: 'uid_b', also } } };
  assert.deepEqual(deletionEntries(saved), [
    { id: 'demo_x', version: 7, at: 20, owner: 'uid_b', keep: null },
    { id: 'demo_x', version: 5, at: 10, owner: 'uid_a', keep: true },
  ], 'B\'s older one, one with no version or no account, and junk are left out');
  assert.deepEqual(savedDeletions(saved), {
    deletedIds: ['demo_x'], deletedInfo: { demo_x: { version: 7, at: 20, owner: 'uid_b', also: [{ version: 5, at: 10, owner: 'uid_a', keep: true }] } }, syncedUid: null,
  });
});
