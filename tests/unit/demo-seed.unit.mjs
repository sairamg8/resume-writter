// Unit tests for the demo-account rules (src/utils/demoSeed.js). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDemoId, parseAccountList, isDemoAccount, needsDemoRestore,
  rememberDemo, buildDemoRestore,
} from '../../src/utils/demoSeed.js';

const resume = (id, updatedAt, name = id) => ({ id, name, updatedAt, sections: [] });
const PRISTINE = [resume('demo_a', 0, 'Sample A'), resume('demo_b', 0, 'Sample B')];

test('isDemoId: only ids with the demo_ prefix', () => {
  assert.equal(isDemoId('demo_classic'), true);
  assert.equal(isDemoId('resume_1757840000000'), false);
  assert.equal(isDemoId('my_demo_classic'), false);
  assert.equal(isDemoId(undefined), false);
  assert.equal(isDemoId(42), false);
});

test('parseAccountList: trims, lower-cases and drops empty entries', () => {
  assert.deepEqual(parseAccountList(' A@X.com, ,b@y.com ,'), ['a@x.com', 'b@y.com']);
  assert.deepEqual(parseAccountList(''), []);
  assert.deepEqual(parseAccountList(undefined), []);
});

test('isDemoAccount: matches the email case-insensitively, never a signed-out visitor', () => {
  const accounts = ['owner@example.com'];
  assert.equal(isDemoAccount({ email: 'Owner@Example.com' }, accounts), true);
  assert.equal(isDemoAccount({ email: 'someone@example.com' }, accounts), false);
  assert.equal(isDemoAccount({ email: null }, accounts), false);
  assert.equal(isDemoAccount({}, accounts), false);
  assert.equal(isDemoAccount(null, accounts), false);
});

test('needsDemoRestore: an empty list, or one holding only the user\'s own résumés', () => {
  assert.equal(needsDemoRestore([]), true);
  assert.equal(needsDemoRestore([resume('resume_1', 1)]), true);
  assert.equal(needsDemoRestore([resume('resume_1', 1), resume('demo_b', 1)]), false);
});

test('rememberDemo: keeps the newest copy of each sample, and forgets nothing on deletion', () => {
  const seed = new Map();
  rememberDemo(seed, [resume('demo_a', 5, 'old'), resume('resume_1', 9)]);
  rememberDemo(seed, [resume('demo_a', 3, 'older')]);
  assert.equal(seed.get('demo_a').name, 'old');
  rememberDemo(seed, [resume('demo_a', 7, 'edited')]);
  assert.equal(seed.get('demo_a').name, 'edited');
  rememberDemo(seed, []); // every résumé deleted
  assert.equal(seed.get('demo_a').name, 'edited');
  assert.equal(seed.has('resume_1'), false);
});

test('rememberDemo: ignores a cloud stub that holds only the deleted flag', () => {
  const seed = rememberDemo(new Map(), [{ id: 'demo_a' }, null, { deleted: true }]);
  assert.equal(seed.size, 0);
});

test('buildDemoRestore: the latest edited copy where known, else the built-in sample', () => {
  const seed = new Map([['demo_a', { ...resume('demo_a', 7, 'My edited A'), extra: { x: 1 } }]]);
  const restored = buildDemoRestore(PRISTINE, seed, 1000);
  assert.deepEqual(restored.map((r) => [r.id, r.name]), [['demo_a', 'My edited A'], ['demo_b', 'Sample B']]);
  restored[0].extra.x = 2; // a deep copy: editing the restored résumé leaves the seed alone
  assert.equal(seed.get('demo_a').extra.x, 1);
  assert.equal(PRISTINE[1].updatedAt, 0);
});

// The sync's merge rule (src/utils/syncMerge.js): the newer updatedAt wins, this browser's on a tie.
const mergeWinner = (local, cloud) => (local.updatedAt >= cloud.updatedAt ? local : cloud);

test('buildDemoRestore: a restored copy keeps its own time, so a newer edit on another device still wins (R4-4)', () => {
  // The laptop last saw Sample A in the morning (7). The phone edited it later (20) and synced.
  // Then the laptop deletes every sample, and the set comes back from what the laptop knew.
  const laptopSeed = new Map([['demo_a', resume('demo_a', 7, 'Morning A')]]);
  const [restoredA, pristineB] = buildDemoRestore(PRISTINE, laptopSeed, 1000);
  assert.equal(restoredA.updatedAt, 7, 'not stamped with the time of the restore');
  // The restore reaches the cloud; the phone's next sync merges its own copy with it.
  const phoneEdit = resume('demo_a', 20, 'Edited on the phone');
  assert.equal(mergeWinner(phoneEdit, restoredA).name, 'Edited on the phone', 'the phone\'s edit is kept');
  // A sample of which no copy is known comes back as the built-in one, stamped now.
  assert.equal(pristineB.updatedAt, 1000);
});

test('buildDemoRestore: a flagged cloud copy comes back without its deleted flag', () => {
  const seed = new Map([['demo_a', { ...resume('demo_a', 7, 'Flagged A'), deleted: true }]]);
  const [restored] = buildDemoRestore(PRISTINE, seed, 1000);
  assert.equal(restored.name, 'Flagged A');
  assert.equal('deleted' in restored, false, 'else the sync writes the flag straight back and it stays hidden');
});
