// R2-145 / R2-140: the jobs and the boards sync to `users/{uid}/jobs`, `users/{uid}/boards` and
// `users/{uid}/meta/{jobs,boards}` (collectionSyncIo.js) under the same security rules as the
// résumés. This pins firestore.rules as the one rule the sync relies on: a signed-in account reads
// and writes the documents under its own `users/{uid}` — any depth, so the new collections are
// covered with no change — and nothing else, and nobody signed out reads or writes anything.
// (tests/pdf/fake-firestore.mjs applies the same rule to the sync tests.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
/** Each `match` path and the `allow` lines under it, comments dropped. */
const code = rules.replace(/\/\/.*$/gm, '');
const matches = [...code.matchAll(/match\s+(\S+)\s*\{/g)].map((m) => m[1]);
const allows = [...code.matchAll(/allow\s+([^:]+):\s*if\s+([^;]+);/g)].map((m) => ({ ops: m[1].split(',').map((s) => s.trim()), cond: m[2].replace(/\s+/g, ' ').trim() }));

test('one rule: an account reaches only its own documents, at any depth under users/{uid}', () => {
  assert.deepEqual(matches, ['/databases/{database}/documents', '/users/{uid}/{document=**}']);
  assert.deepEqual(allows, [{ ops: ['read', 'write'], cond: 'request.auth != null && request.auth.uid == uid' }]);
});

/** The rule above, as the server applies it to a document path. */
function allowed(path, auth) {
  const [root, uid, ...rest] = path.split('/');
  return root === 'users' && rest.length > 0 && auth != null && auth === uid;
}

test('the jobs, the boards and their sync records are the signed-in account\'s alone', () => {
  const paths = ['users/A/jobs/job_1', 'users/A/boards/board_1', 'users/A/meta/jobs', 'users/A/meta/boards', 'users/A/resumes/resume_1'];
  for (const path of paths) {
    assert.equal(allowed(path, 'A'), true, `${path} for A`);
    assert.equal(allowed(path, 'B'), false, `${path} for B`);
    assert.equal(allowed(path, null), false, `${path} signed out`);
  }
  assert.equal(allowed('jobs/job_1', 'A'), false, 'nothing outside users/{uid}');
});
