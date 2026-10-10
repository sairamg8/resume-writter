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
// N3 (Job Map access): the addresses the Job Map lets in are the documents `jobmap_access/<email>`.
// A Job Map admin, named by one field set to true in the single document `jobmap_admin/<id>` (made in the
// console; no rule gives a client that collection), reads and writes them from the Job Map page
// (isJobMapAdmin). Anyone else, signed out or not, and an admin whose e-mail is unverified, gets nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
/** Each `match` path and the `allow` lines under it, comments dropped. */
const code = rules.replace(/\/\/.*$/gm, '');
const matches = [...code.matchAll(/match\s+(\S+)\s*\{/g)].map((m) => m[1]);
const allows = [...code.matchAll(/allow\s+([^:]+):\s*if\s+([^;]+);/g)].map((m) => ({ ops: m[1].split(',').map((s) => s.trim()), cond: m[2].replace(/\s+/g, ' ').trim() }));

test('four rules (the Job Map\'s two are the owner-allowed ones): an account reaches only its own documents under users/{uid}; a published résumé is got by anyone, written by its owner', () => {
  assert.deepEqual(matches, ['/databases/{database}/documents', '/users/{uid}/{document=**}', '/jobmap/{document}', '/jobmap_access/{email}', '/public/{shareId}']);
  assert.deepEqual(allows, [
    { ops: ['read', 'write'], cond: 'request.auth != null && request.auth.uid == uid' },
    { ops: ['read', 'write'], cond: 'mayUseJobMap()' },
    { ops: ['read', 'write'], cond: 'isJobMapAdmin()' },
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
  // publish() writes in a transaction (tx.set) since R4-LO-22.
  const write = src.match(/tx\.set\(publicDoc\(shareId\), \{([^}]*)\}\)/)?.[1];
  assert.deepEqual(write.split(',').map((kv) => kv.split(':')[0].trim()), keysIn('d', 'hasOnly'), 'the document publish() sets');
  const copy = src.match(/const copy = \{([\s\S]*?)\n {2}\};/)?.[1];
  const copyKeys = [...copy.matchAll(/^\s*(\w+)\s*[:,]/gm)].map((m) => m[1]);
  assert.match(src, /copy\.dataVersion = resume\.dataVersion;/, 'and the data version, when the résumé has one');
  assert.deepEqual([...copyKeys, 'dataVersion'], keysIn('d.resume', 'hasOnly'), "publicSnapshot's copy");
});

/** A function's body, one condition a line, comments dropped. */
const conditionsOf = (name) => code.match(new RegExp(`function\\s+${name}\\(\\)\\s*\\{\\s*return\\s+([^;]+);\\s*\\}`))?.[1]
  .split('&&').map((c) => c.replace(/\s+/g, ' ').trim());
const ADMIN_DOC = 'CyNg0r3JBnvYNkQi2W7H';
const ADMIN_CONDITIONS = [
  'request.auth != null',
  'request.auth.token.email_verified == true',
  `get(/databases/$(database)/documents/jobmap_admin/${ADMIN_DOC}).data.get(request.auth.token.email, false) == true`,
];

test('isJobMapAdmin: a verified sign-in whose e-mail is a field set to true in the one jobmap_admin document', () => {
  assert.deepEqual(conditionsOf('isJobMapAdmin'), ADMIN_CONDITIONS);
  assert.match(rules, /\/\/ Job Map admins: a single document in `jobmap_admin`/, 'the comment that says where the admins are');
  assert.deepEqual(conditionsOf('mayUseJobMap'), [
    'request.auth != null',
    'request.auth.token.email_verified == true',
    'exists(/databases/$(database)/documents/jobmap_access/$(request.auth.token.email))',
  ], 'mayUseJobMap is unchanged');
});

test('jobmap_access is the admins\' alone; jobmap_admin has no match block, so no client reads or writes it', () => {
  const block = code.match(/match\s+\/jobmap_access\/\{email\}\s*\{([^}]*)\}/)?.[1];
  assert.ok(block, 'a jobmap_access/{email} block');
  assert.deepEqual([...block.matchAll(/allow\s+([^:]+):\s*if\s+([^;]+);/g)].map((m) => [m[1].trim(), m[2].trim()]), [['read, write', 'isJobMapAdmin()']]);
  assert.deepEqual(matches.filter((m) => /jobmap_admin/.test(m)), [], 'no match for jobmap_admin');
  assert.equal((code.match(/jobmap_admin/g) ?? []).length, 1, 'the name occurs once in code: in isJobMapAdmin\'s get()');
  assert.ok(!matches.some((m) => /\{[a-z]+=\*\*\}/.test(m) && !m.startsWith('/users/')), 'no recursive wildcard that would reach it');
  assert.ok(!/match\s+\/\{/.test(code), 'no catch-all match at the top');
});

/**
 * The rule as the server applies it, built from the conditions above (asserted equal to the file's):
 * `adminDoc` is the data of jobmap_admin/<id> (undefined: the document is missing).
 */
function adminMayUse(auth, adminDoc) {
  if (auth == null) return false;
  if (auth.email_verified !== true) return false;
  return adminDoc?.[auth.email] === true;
}
/** What a client may do to a path: only the jobmap_access documents, only for an admin; jobmap_admin never. */
function mayTouch(path, auth, adminDoc) {
  const [root, , ...rest] = path.split('/');
  if (root === 'jobmap_access' && rest.length === 0) return adminMayUse(auth, adminDoc);
  return false;
}

test('a non-admin cannot read or write jobmap_access; an admin can; nobody touches jobmap_admin', () => {
  assert.deepEqual(conditionsOf('isJobMapAdmin'), ADMIN_CONDITIONS, 'the model below is this rule');
  const admin = { email: 'owner@example.org', email_verified: true };
  const adminDoc = { 'owner@example.org': true, 'former@example.org': false };
  assert.equal(mayTouch('jobmap_access/new@example.org', admin, adminDoc), true);
  assert.equal(mayTouch('jobmap_access/new@example.org', null, adminDoc), false, 'signed out');
  assert.equal(mayTouch('jobmap_access/new@example.org', { email: 'allowed@example.org', email_verified: true }, adminDoc), false, 'an allowed address is not an admin');
  assert.equal(mayTouch('jobmap_access/new@example.org', { email: 'former@example.org', email_verified: true }, adminDoc), false, 'a field set to false');
  assert.equal(mayTouch('jobmap_access/new@example.org', { email: 'owner@example.org', email_verified: false }, adminDoc), false, 'unverified e-mail');
  assert.equal(mayTouch('jobmap_access/new@example.org', admin, undefined), false, 'no admin document');
  assert.equal(mayTouch(`jobmap_admin/${ADMIN_DOC}`, admin, adminDoc), false, 'not even an admin touches jobmap_admin');
  assert.equal(mayTouch('jobmap_access', admin, adminDoc), false);
});
