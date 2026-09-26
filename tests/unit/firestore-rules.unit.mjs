// R2-145 / R2-140: the jobs and the boards sync to `users/{uid}/jobs`, `users/{uid}/boards` and
// `users/{uid}/meta/{jobs,boards}` (collectionSyncIo.js) under the same security rules as the
// résumés. This pins firestore.rules as the one rule the sync relies on: a signed-in account reads
// and writes the documents under its own `users/{uid}` — any depth, so the new collections are
// covered with no change — and nothing else, and nobody signed out reads or writes anything.
// (tests/pdf/fake-firestore.mjs applies the same rule to the sync tests.)
// R2-148: Share a public link adds the one other rule: a published résumé, `public/{shareId}`, is got
// by anyone by its id (never listed), and only the account named its `owner` creates, changes or
// deletes it. Nothing else is readable by anyone else.
// R2-148-d: a write to public/{shareId} may carry only what src/utils/publicLink.js writes —
// `{ owner, resume, publishedAt }`, the copy publicSnapshot's fields — each of its type
// (isPublishedCopy). Before, the rule checked the owner alone: an account could put any field in
// the one document anyone can read. The owner must publish the new rules (README).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
/** Each `match` path and the `allow` lines under it, comments dropped. */
const code = rules.replace(/\/\/.*$/gm, '');
const matches = [...code.matchAll(/match\s+(\S+)\s*\{/g)].map((m) => m[1]);
const allows = [...code.matchAll(/allow\s+([^:]+):\s*if\s+([^;]+);/g)].map((m) => ({ ops: m[1].split(',').map((s) => s.trim()), cond: m[2].replace(/\s+/g, ' ').trim() }));

test('two rules: an account reaches only its own documents under users/{uid}; a published résumé is got by anyone, written by its owner', () => {
  assert.deepEqual(matches, ['/databases/{database}/documents', '/users/{uid}/{document=**}', '/public/{shareId}']);
  assert.deepEqual(allows, [
    { ops: ['read', 'write'], cond: 'request.auth != null && request.auth.uid == uid' },
    { ops: ['get'], cond: 'true' },
    { ops: ['create'], cond: 'request.auth != null && isPublishedCopy(request.resource.data)' },
    { ops: ['update'], cond: 'request.auth != null && resource.data.owner == request.auth.uid && isPublishedCopy(request.resource.data)' },
    { ops: ['delete'], cond: 'request.auth != null && resource.data.owner == request.auth.uid' },
  ]);
});

/** The rules above, as the server applies them to a read (get) of a document path. */
function allowed(path, auth) {
  const [root, uid, ...rest] = path.split('/');
  if (root === 'public') return uid !== undefined && rest.length === 0;
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

test('a published résumé is read by anyone by its id; nothing else outside the account is', () => {
  for (const auth of ['A', 'B', null]) assert.equal(allowed('public/share_1', auth), true, `public/share_1 for ${auth}`);
  assert.equal(allowed('public', null), false, 'the list of published résumés is not readable');
  assert.equal(allowed('users/A/shares/resume_1', 'B'), false, "an account's record of its links is its own");
});

/** isPublishedCopy's body, one condition a line, comments dropped. */
const published = code.match(/function\s+isPublishedCopy\(d\)\s*\{\s*return\s+([^;]+);\s*\}/)?.[1]
  .split('&&').map((c) => c.replace(/\s+/g, ' ').trim());
/** The keys a `hasOnly` / `hasAll` condition on `of` (`d` or `d.resume`) lists. */
const keysIn = (of, fn) => {
  const found = published.find((c) => c.startsWith(`${of}.keys().${fn}(`));
  return found ? JSON.parse(found.slice(found.indexOf('[')).replace(/\)$/, '').replace(/'/g, '"')) : null;
};

test('a published copy carries only what publicLink.js writes, each of its type (R2-148-d)', () => {
  assert.ok(published, 'before: create and update checked the owner alone, whatever else the document held');
  assert.deepEqual([keysIn('d', 'hasOnly'), keysIn('d', 'hasAll')], [['owner', 'resume', 'publishedAt'], ['owner', 'resume', 'publishedAt']]);
  assert.deepEqual(keysIn('d.resume', 'hasOnly'), ['template', 'settings', 'personal', 'sections', 'dataVersion']);
  assert.deepEqual(keysIn('d.resume', 'hasAll'), ['template', 'settings', 'personal', 'sections'], 'the data version only when the résumé has one');
  for (const c of ['d.owner == request.auth.uid', 'd.publishedAt is number', 'd.resume is map', 'd.resume.template is string',
    'd.resume.settings is map', 'd.resume.personal is map', 'd.resume.sections is list', "d.resume.get('dataVersion', 0) is number"]) {
    assert.ok(published.includes(c), c);
  }
});

test('the keys the rule allows are the ones publicLink.js writes', () => {
  const src = readFileSync(new URL('../../src/utils/publicLink.js', import.meta.url), 'utf8');
  const write = src.match(/batch\.set\(publicDoc\(shareId\), \{([^}]*)\}\)/)?.[1];
  assert.deepEqual(write.split(',').map((kv) => kv.split(':')[0].trim()), keysIn('d', 'hasOnly'), 'the document publish() sets');
  const copy = src.match(/const copy = \{([\s\S]*?)\n {2}\};/)?.[1];
  const copyKeys = [...copy.matchAll(/^\s*(\w+)\s*[:,]/gm)].map((m) => m[1]);
  assert.match(src, /copy\.dataVersion = resume\.dataVersion;/, 'and the data version, when the résumé has one');
  assert.deepEqual([...copyKeys, 'dataVersion'], keysIn('d.resume', 'hasOnly'), "publicSnapshot's copy");
});
