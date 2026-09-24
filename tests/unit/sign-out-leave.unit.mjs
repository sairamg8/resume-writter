// Unit tests for what a sign-out takes off a shared browser (R2-005): the résumé store's list
// leaving with its account (src/utils/cloudSyncLeave.js) and the Firestore cache an earlier build
// left on disk (src/utils/firestoreOldCache.js). The engine that runs them: tests/pdf/18-cloud-sync-sign-out.test.mjs.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveAccount, stashOf, withoutStash } from '../../src/utils/cloudSyncLeave.js';
import { forgetOldCache, oldCacheName } from '../../src/utils/firestoreOldCache.js';

const cv = (id, updatedAt, extra = {}) => ({ id, name: id, updatedAt, ...extra });
const synced = (resumes, versions, extra = {}) => ({ resumes, activeId: resumes[0]?.id ?? null, syncedUid: 'A', cloudVersions: versions, deletedIds: [], deletedInfo: {}, ...extra });

test('leaveAccount: what A\'s cloud holds goes; a change it lacks is kept aside for A with the version it came from', () => {
  const state = synced([cv('a', 5), cv('b', 9), cv('c', 3)], { a: 5, b: 7 });
  const next = leaveAccount(state, 'A');
  assert.deepEqual([next.resumes, next.activeId, next.syncedUid, next.cloudVersions], [[], null, null, {}]);
  assert.deepEqual(next.stashed, { A: { resumes: [cv('b', 9), cv('c', 3)], versions: { b: 7 } } }, 'b edited since the cloud\'s 7; c never sent');
  assert.deepEqual(state.resumes.length, 3, 'the state it was given is left alone');
});

test('leaveAccount: nothing to keep aside, nothing stashed; deletions stay, they are A\'s (R8-6)', () => {
  const deletions = { deletedIds: ['r'], deletedInfo: { r: { version: 2, at: 1, owner: 'A', keep: false } } };
  const next = leaveAccount(synced([cv('a', 5)], { a: 5 }, deletions), 'A');
  assert.deepEqual([next.resumes, next.stashed, next.deletedIds, next.deletedInfo], [[], {}, deletions.deletedIds, deletions.deletedInfo]);
});

test('leaveAccount: a list that is not that account\'s is left as it is — made signed out, or another account\'s', () => {
  const local = { resumes: [cv('a', 1)], syncedUid: null };
  assert.equal(leaveAccount(local, 'A'), local);
  const bs = { ...synced([cv('a', 1)], {}), syncedUid: 'B' };
  assert.equal(leaveAccount(bs, 'A'), bs);
  assert.equal(leaveAccount(bs, null), bs);
});

test('leaveAccount: a second leave adds to what was kept aside; a newer copy of the same résumé replaces the older', () => {
  const first = leaveAccount(synced([cv('a', 5), cv('b', 2)], { a: 4 }), 'A');
  const again = leaveAccount({ ...first, resumes: [cv('a', 6), cv('c', 1)], syncedUid: 'A', cloudVersions: { a: 5 } }, 'A');
  assert.deepEqual(again.stashed.A, { resumes: [cv('b', 2), cv('a', 6), cv('c', 1)], versions: { a: 5 } });
});

test('leaveAccount: a list saved before cloudVersions existed — nothing is known to be in the cloud, all of it kept aside', () => {
  const next = leaveAccount({ resumes: [cv('a', 5)], syncedUid: 'A' }, 'A');
  assert.deepEqual(next.stashed.A.resumes, [cv('a', 5)]);
});

test('stashOf / withoutStash: read back, and dropped once the list is the account\'s again; junk reads as none', () => {
  const state = { stashed: { A: { resumes: [cv('a', 1), null, { name: 'no id' }], versions: { a: 1 } }, B: { resumes: [cv('b', 1)] } } };
  assert.deepEqual(stashOf(state, 'A'), { resumes: [cv('a', 1)], versions: { a: 1 } });
  assert.deepEqual(stashOf(state, 'B'), { resumes: [cv('b', 1)], versions: {} });
  assert.equal(stashOf(state, 'C'), null);
  assert.equal(stashOf({ stashed: 'x' }, 'A'), null);
  assert.equal(stashOf({}, 'A'), null);
  assert.deepEqual(withoutStash(state, 'A'), { stashed: { B: state.stashed.B } });
  assert.deepEqual(withoutStash(state, 'C'), {});
  assert.deepEqual(withoutStash({}, 'A'), {});
});

test('forgetOldCache: asks for the database Firestore\'s persistent cache used, and never throws', () => {
  const asked = [];
  const request = {};
  const idb = { deleteDatabase: (name) => { asked.push(name); return request; } };
  assert.equal(forgetOldCache(idb, 'resume-writer'), true);
  assert.deepEqual(asked, ['firestore/[DEFAULT]/resume-writer/main']);
  assert.equal(oldCacheName('p'), 'firestore/[DEFAULT]/p/main');
  assert.equal(typeof request.onblocked, 'function', 'a tab of an earlier build holding it open: the deletion waits, quietly');
  assert.equal(forgetOldCache(undefined, 'p'), false, 'no IndexedDB (a private window in some browsers)');
  assert.equal(forgetOldCache(idb, ''), false);
  assert.equal(forgetOldCache({ deleteDatabase: () => { throw new Error('SecurityError'); } }, 'p'), false);
});
