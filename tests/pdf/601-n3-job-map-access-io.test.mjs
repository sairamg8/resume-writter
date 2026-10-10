// N3 (Job Map access panel): src/utils/jobMapAccessIo.js, the Firestore calls of the admin panel, run on the
// fake Firestore (tests/pdf/fake-firestore.mjs). list() is the admin check too: a refusal by the rules
// (permission-denied) is "not an admin", any other failed read is thrown (the panel offers a retry), and an
// admin gets the document ids sorted. add() creates { allowed: true, createdAt } and leaves an address that is
// already there as it is; remove() deletes that one document.
// Run: node --test tests/pdf/601-n3-job-map-access-io.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore } from './fake-firestore.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

let mod;
before(async () => {
  await setup();
  mod = await loadModule('/src/utils/jobMapAccessIo.js');
});
after(teardown);

const seed = () => fakeFirestore({
  'jobmap_access/owner@example.org': { allowed: true },
  'jobmap_access/Zed@example.org': { note: 'made in the console', allowed: true },
  'jobmap_access/amy@example.org': { anything: 1 },
  'jobmap/meta': { crawled: 'x' },
  'users/u1/jobs/j1': { title: 'not an address' },
});
const io = (cloud, now = () => 1_700_000_000_000) => mod.accessIoOver(cloud.fs, cloud.db, now);

it('an admin lists the addresses: the ids of jobmap_access only, sorted, in one read', async () => {
  const cloud = seed();
  assert.deepEqual(await io(cloud).list(), { admin: true, addresses: ['amy@example.org', 'owner@example.org', 'Zed@example.org'] });
  assert.deepEqual(cloud.reads, ['jobmap_access'], 'one read, nothing else');
});

it('a refusal by the rules is "not an admin": no addresses, no error', async () => {
  const cloud = seed();
  cloud.auth = 'someone-else'; // the fake refuses every path outside the account's own, as firestore.rules does for a non-admin
  assert.deepEqual(await io(cloud).list(), { admin: false });
  assert.equal(cloud.reads.length, 1, 'one read, no retries');
});

it('any other failed read is thrown, not taken for "not an admin"', async () => {
  const cloud = seed();
  cloud.fail.read = Object.assign(new Error('Failed to get documents from server.'), { code: 'unavailable' });
  await assert.rejects(io(cloud).list(), (e) => e.code === 'unavailable');
  cloud.fail.read = null;
  cloud.goOffline();
  await assert.rejects(io(cloud).list(), (e) => e.code === 'unavailable', 'offline: the cache is not an answer');
});

it('with no cloud (a build without Firebase) nobody is an admin, and the real calls say so', async () => {
  assert.deepEqual(await mod.accessIoOver({}, null).list(), { admin: false });
  assert.deepEqual(await mod.jobMapAccessIo.list(), { admin: false });
});

it('add creates { allowed: true, createdAt } and nothing else changes', async () => {
  const cloud = seed();
  assert.equal(await io(cloud).add('new@example.org'), true);
  assert.deepEqual(cloud.doc('jobmap_access/new@example.org'), { allowed: true, createdAt: 1_700_000_000_000 });
  assert.deepEqual(cloud.doc('jobmap_access/Zed@example.org'), { note: 'made in the console', allowed: true });
  assert.deepEqual(cloud.doc('jobmap/meta'), { crawled: 'x' });
  assert.equal(cloud.commits.flat().length, 1, 'one document written');
});

it('add leaves an address that already has a document as it is, with its own fields', async () => {
  const cloud = seed();
  assert.equal(await io(cloud).add('amy@example.org'), false);
  assert.deepEqual(cloud.doc('jobmap_access/amy@example.org'), { anything: 1 });
  assert.deepEqual(cloud.commits.flat(), [], 'nothing written');
});

it('remove deletes that one document', async () => {
  const cloud = seed();
  await io(cloud).remove('Zed@example.org');
  assert.equal(cloud.doc('jobmap_access/Zed@example.org'), undefined);
  assert.deepEqual(cloud.doc('jobmap_access/amy@example.org'), { anything: 1 });
  assert.deepEqual(cloud.doc('jobmap_access/owner@example.org'), { allowed: true });
});

it('a write the rules refuse is thrown as permission-denied, and changes nothing', async () => {
  const cloud = seed();
  cloud.auth = 'someone-else';
  await assert.rejects(io(cloud).add('new@example.org'), (e) => e.code === 'permission-denied');
  await assert.rejects(io(cloud).remove('amy@example.org'), (e) => e.code === 'permission-denied');
  assert.deepEqual(cloud.doc('jobmap_access/amy@example.org'), { anything: 1 });
  assert.equal(cloud.doc('jobmap_access/new@example.org'), undefined);
});
