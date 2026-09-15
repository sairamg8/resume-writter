// Unit tests for the store's record of deleted résumés (src/utils/localDeletions.js), which the
// first cloud sync checks against the account's copies (R8-0). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletionEntries, withDeletion, withoutDeletions, savedDeletions } from '../../src/utils/localDeletions.js';

test('withDeletion: records the id and the version deleted (the copy\'s updatedAt), and when', () => {
  const state = { deletedIds: ['resume_a'], deletedInfo: { resume_a: { version: 3, at: 10 } } };
  const next = withDeletion(state, { id: 'resume_b', updatedAt: 42 }, 1000);
  assert.deepEqual(next, {
    deletedIds: ['resume_a', 'resume_b'],
    deletedInfo: { resume_a: { version: 3, at: 10 }, resume_b: { version: 42, at: 1000 } },
  });
  assert.deepEqual(state.deletedIds, ['resume_a'], 'the state it was given is left alone');
  // Deleted again after a restore: one entry, the latest version.
  assert.deepEqual(withDeletion(next, { id: 'resume_a', updatedAt: 7 }, 2000).deletedIds, ['resume_b', 'resume_a']);
  // A résumé with no time of its own deletes as the oldest version, never as "unknown".
  assert.deepEqual(withDeletion({}, { id: 'resume_c' }, 5).deletedInfo, { resume_c: { version: 0, at: 5 } });
});

test('deletionEntries: one entry per id; an older build\'s id has no version', () => {
  const state = {
    deletedIds: ['resume_old', 'resume_new', 'resume_old', '', null, 7],
    deletedInfo: { resume_new: { version: 9, at: 100 }, resume_gone: { version: 1, at: 1 } },
  };
  assert.deepEqual(deletionEntries(state), [
    { id: 'resume_old', version: null, at: 0 },
    { id: 'resume_new', version: 9, at: 100 },
  ]);
  assert.deepEqual(deletionEntries({}), []);
  assert.deepEqual(deletionEntries({ deletedIds: ['x'], deletedInfo: [] }), [{ id: 'x', version: null, at: 0 }]);
  assert.deepEqual(deletionEntries({ deletedIds: ['x'], deletedInfo: { x: { version: 'nine' } } }), [{ id: 'x', version: null, at: 0 }]);
});

test('withoutDeletions: forgets the ids given, with their versions', () => {
  const state = { deletedIds: ['a', 'b', 'c'], deletedInfo: { a: { version: 1, at: 1 }, b: { version: 2, at: 2 } } };
  assert.deepEqual(withoutDeletions(state, new Set(['a', 'c'])), { deletedIds: ['b'], deletedInfo: { b: { version: 2, at: 2 } } });
  assert.deepEqual(withoutDeletions({}, ['a']), { deletedIds: [], deletedInfo: {} });
});

test('savedDeletions: a store saved by an older build (ids only) loads with its ids kept', () => {
  assert.deepEqual(savedDeletions({ deletedIds: ['resume_a', 'resume_a'] }), { deletedIds: ['resume_a'], deletedInfo: {} });
  assert.deepEqual(savedDeletions({ deletedIds: 'junk', deletedInfo: 'junk' }), { deletedIds: [], deletedInfo: {} });
  const saved = { deletedIds: ['resume_b'], deletedInfo: { resume_b: { version: 4, at: 8 }, stray: { version: 1, at: 1 } } };
  assert.deepEqual(savedDeletions(saved), { deletedIds: ['resume_b'], deletedInfo: { resume_b: { version: 4, at: 8 } } });
});
