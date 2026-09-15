// Unit tests for the demo-account rules (src/utils/demoSeed.js): what a restore brings back.
// Run: yarn test:unit. The same rules through the sync engine and a fake Firestore:
// tests/pdf/18-cloud-sync-restore.test.mjs; in the app: cypress/e2e/11-demo-account.cy.js.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as seedRules from '../../src/utils/demoSeed.js';

const {
  parseAccountList, isDemoAccount, isOriginal, withKeep, needsRestore,
  rememberCopies, originalsIn, buildRestore,
} = seedRules;

const resume = (id, updatedAt, name = id, extra = {}) => ({ id, name, updatedAt, sections: [], ...extra });
const original = (id, updatedAt, name = id, extra = {}) => resume(id, updatedAt, name, { keep: true, ...extra });
const names = (list) => list.map((r) => r.name);

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

test('isOriginal: only a résumé marked keep: true — never a sample by its id', () => {
  assert.equal(isOriginal(original('resume_1', 1)), true);
  assert.equal(isOriginal(resume('demo_classic', 1)), false, 'the fictional samples are not the owner\'s résumé');
  assert.equal(isOriginal(resume('resume_1', 1, 'x', { keep: 'yes' })), false);
  assert.equal(isOriginal(null), false);
});

test('withKeep: marks or unmarks, and is an edit (a new updatedAt), leaving the résumé given alone', () => {
  const r = resume('resume_1', 5);
  const kept = withKeep(r, true, 99);
  assert.deepEqual([kept.keep, kept.updatedAt, r.keep, r.updatedAt], [true, 99, undefined, 5]);
  const unkept = withKeep(kept, false, 120);
  assert.deepEqual([('keep' in unkept), unkept.updatedAt], [false, 120]);
});

test('needsRestore: a list without an original — empty, only samples, or only other résumés', () => {
  assert.equal(needsRestore([]), true);
  assert.equal(needsRestore([resume('demo_classic', 1), resume('demo_modern', 1)]), true, 'only samples left');
  assert.equal(needsRestore([resume('resume_1', 1)]), true);
  assert.equal(needsRestore([resume('resume_1', 1), original('resume_2', 1)]), false);
});

test('rememberCopies: keeps the newest copy of each résumé, and forgets nothing on deletion', () => {
  const seen = new Map();
  rememberCopies(seen, [original('resume_a', 5, 'old'), resume('resume_b', 9)]);
  rememberCopies(seen, [original('resume_a', 3, 'older')]);
  assert.equal(seen.get('resume_a').name, 'old');
  rememberCopies(seen, [original('resume_a', 7, 'edited')]);
  assert.equal(seen.get('resume_a').name, 'edited');
  rememberCopies(seen, []); // every résumé deleted
  assert.deepEqual(names(originalsIn(seen)), ['edited']);
});

test('rememberCopies: "Stop keeping" wins over an older kept copy from the cloud or another device', () => {
  const seen = rememberCopies(new Map(), [resume('resume_a', 9, 'No longer kept')]);
  rememberCopies(seen, [original('resume_a', 5, 'Kept, older')]); // the cloud's copy, from before
  assert.deepEqual(originalsIn(seen), []);
  rememberCopies(seen, [original('resume_a', 12, 'Kept again')]);
  assert.deepEqual(names(originalsIn(seen)), ['Kept again']);
});

test('rememberCopies: ignores a cloud stub that holds only the deleted flag', () => {
  const seen = rememberCopies(new Map(), [{ id: 'resume_a', keep: true }, null, { deleted: true }, { sections: [] }]);
  assert.equal(seen.size, 0);
});

test('buildRestore: every original seen, as its latest copy — never a sample, never another résumé', () => {
  const seen = rememberCopies(new Map(), [
    original('resume_a', 7, 'My edited résumé', { extra: { x: 1 } }),
    resume('demo_classic', 8, 'Sample · Classic'),
    resume('resume_b', 9, 'Not kept'),
    original('resume_c', 4, 'Deleted earlier'),
  ]);
  const restored = buildRestore(seen, 1000);
  assert.deepEqual(names(restored), ['My edited résumé', 'Deleted earlier']);
  assert.equal(restored.every((r) => r.keep === true), true, 'still originals');
  restored[0].extra.x = 2; // a deep copy: editing the restored résumé leaves the copy seen alone
  assert.equal(seen.get('resume_a').extra.x, 1);
  assert.deepEqual(buildRestore(rememberCopies(new Map(), [resume('demo_classic', 1)]), 1000), [], 'no original, nothing to bring back');
});

test('buildRestore: a restored copy keeps its own time (R4-4); one with none is stamped now', () => {
  // The laptop last saw the résumé in the morning (7); it comes back from what the laptop knew.
  // That a newer edit elsewhere then wins is the sync's merge: 18-cloud-sync-restore.test.mjs.
  const [morning, timeless] = buildRestore(new Map([
    ['resume_a', original('resume_a', 7, 'Morning')],
    ['resume_b', original('resume_b', undefined, 'No time')],
  ]), 1000);
  assert.equal(morning.updatedAt, 7, 'not stamped with the time of the restore');
  assert.equal(timeless.updatedAt, 1000);
});

test('buildRestore / originalsIn: never one on the account\'s deletion list — it was deleted for good (V2OWNER-DATA-0)', () => {
  // A device that last saw X kept still holds that copy after X was deleted for good elsewhere.
  const seen = rememberCopies(new Map(), [original('resume_x', 5, 'X'), original('resume_y', 5, 'Y')]);
  assert.deepEqual(names(buildRestore(seen, 1000, ['resume_x'])), ['Y'], 'before: X came back, and was written back');
  assert.deepEqual(names(originalsIn(seen, new Set(['resume_x', 'resume_y']))), []);
  assert.deepEqual(names(buildRestore(seen, 1000)), ['X', 'Y'], 'nothing listed: every original');
});

test('buildRestore: each copy says when it was put back — its version cannot (V2W1a-4)', () => {
  const [restored] = buildRestore(new Map([['resume_a', original('resume_a', 7, 'Morning', { restoredAt: 50 })]]), 1000);
  assert.deepEqual([restored.updatedAt, restored.restoredAt], [7, 1000]);
});

test('buildRestore: a flagged cloud copy comes back without its deleted flag', () => {
  const [restored] = buildRestore(new Map([['resume_a', original('resume_a', 7, 'Flagged', { deleted: true })]]), 1000);
  assert.equal(restored.name, 'Flagged');
  assert.equal('deleted' in restored, false, 'else the sync writes the flag straight back and it stays hidden');
});

// The owner's résumé from the git-ignored private file, on the dev server (useDemoSeed with
// vite-plugin-owner-resume.js). The file as it is saved: no id, no keep, no updatedAt.
describe('privateOriginal: the private file becomes the owner\'s original once', () => {
  const { privateOriginal, PRIVATE_ORIGINAL_ID } = seedRules;
  const OWNER = { uid: 'u', email: 'Owner@Example.com' };
  const FILE = { name: 'Mine — Classic', template: 'classic', settings: {}, personal: { name: 'Real Name', email: 'owner@example.com' }, sections: [{ id: 's', items: [] }], coverLetter: {} };
  const into = (opts = {}) => privateOriginal?.(FILE, OWNER, { now: 500, ...opts });

  test('an account with no original gets it, marked an original, under one fixed id', () => {
    const own = into({ resumes: [resume('demo_classic', 1), resume('resume_b', 2)] });
    assert.deepEqual([own?.id, own?.keep, own?.updatedAt, own?.name, own?.personal.name], [PRIVATE_ORIGINAL_ID, true, 500, 'Mine — Classic', 'Real Name']);
    own.sections[0].items.push('x'); // a copy: the module's data stays as the file has it
    assert.deepEqual(FILE.sections[0].items, []);
  });

  test('only into the account whose e-mail the file carries', () => {
    assert.equal(privateOriginal?.(FILE, { uid: 'v', email: 'someone@example.com' }, { now: 1 }), null);
    assert.equal(privateOriginal?.(FILE, { uid: 'v' }, { now: 1 }), null);
    assert.equal(privateOriginal?.({ ...FILE, personal: { name: 'x' } }, OWNER, { now: 1 }), null, 'a file with no e-mail is nobody\'s');
  });

  test('nothing when there is no file (every build), or it is not a résumé', () => {
    assert.equal(privateOriginal?.(null, OWNER, { now: 1 }), null);
    assert.equal(privateOriginal?.({ hello: 'world' }, OWNER, { now: 1 }), null);
  });

  test('never while the account has an original — deleted ones included — nor twice, nor after it was deleted for good', () => {
    assert.equal(into({ seen: rememberCopies(new Map(), [original('resume_a', 3)]) }), null, 'the account has one: it comes back instead');
    assert.equal(into({ resumes: [resume(PRIVATE_ORIGINAL_ID, 3)] }), null, '"Stop keeping" left it an ordinary résumé: its edits stay');
    assert.equal(into({ seen: rememberCopies(new Map(), [resume(PRIVATE_ORIGINAL_ID, 3)]) }), null);
    assert.equal(into({ deleted: [PRIVATE_ORIGINAL_ID] }), null, 'deleted for good: not brought back by the next dev sign-in');
  });

  test('an original deleted for good is none the account has: the file becomes its original', () => {
    const seen = rememberCopies(new Map(), [original('resume_a', 3)]);
    assert.equal(into({ seen, gone: ['resume_a'] })?.id, PRIVATE_ORIGINAL_ID, 'before: the stale kept copy counted');
  });
});
