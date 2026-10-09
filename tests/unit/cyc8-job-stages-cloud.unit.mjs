// CYC8-S3: the custom interview stages stayed on one device. Signed in, they are now also kept in the
// account's jobs meta document (`users/{uid}/meta/jobs`, field `stages`: one capped array of short
// names, added and removed with arrayUnion / arrayRemove), so a second device gets them and the jobs
// sync's own fields in the same document are left alone (jobStagesCloud.js). Signing out sends no
// deletion. Runs the app's own code on the fake Firestore. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { stagesIo, watchStages } from '../../src/utils/jobStagesCloud.js';
import * as jobStages from '../../src/utils/jobStages.js';
import { fakeFirestore, settle } from '../pdf/fake-firestore.mjs';

const KEY = 'cpwtcv_job_stages_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.addEventListener = () => {};
});

const metaPath = (uid) => `users/${uid}/meta/jobs`;
// One uid per test: the module keeps the list it shows between tests.
let n = 0;
const nextUid = () => `cloud-${n += 1}`;

test('a second device gets the account\'s stages, and sends the ones only it has', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { deleted: ['j1'], order: ['j2'], stages: ['Culture Round'] } });
  localStorage.setItem(`${KEY}_${uid}`, JSON.stringify(['Founder Chat']));
  jobStages.stagesSnapshot(uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Founder Chat', 'Culture Round'], 'the cloud\'s name is offered on this device');
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Culture Round', 'Founder Chat'], 'this device\'s name is now in the cloud');
  assert.deepEqual(cloud.doc(metaPath(uid)).deleted, ['j1'], 'the jobs sync\'s fields are untouched');
  assert.deepEqual(cloud.doc(metaPath(uid)).order, ['j2']);
  stop();
});

test('a stage added or removed while the form is open follows to the cloud, and the stop ends it', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore();
  jobStages.stagesSnapshot(uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.addCustomStage('Culture Round');
  jobStages.addCustomStage('Founder Chat');
  await settle();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Culture Round', 'Founder Chat']);
  jobStages.removeCustomStage('Culture Round');
  await settle();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat']);
  stop();
  jobStages.addCustomStage('Offsite');
  await settle();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat'], 'after the form closes nothing more is sent');
});

test('signing out deletes nothing from the cloud: the account\'s stages are still there for its next sign-in', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['Culture Round'] } });
  jobStages.stagesSnapshot(uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  stop();
  jobStages.stagesSnapshot(null);
  await settle();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Culture Round']);
  assert.equal(cloud.commits.length, 0, 'not a single write');
});

test('the cloud list is small: names that are too long or not text are not taken, and it holds at most 50', async () => {
  const uid = nextUid();
  const many = Array.from({ length: 60 }, (_, i) => `Stage ${i}`);
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['x'.repeat(200), 7, null, ...many] } });
  jobStages.stagesSnapshot(uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  const shown = jobStages.stagesSnapshot(uid);
  assert.equal(shown.length, 50, 'the first fifty usable names');
  assert.deepEqual(shown.slice(0, 2), ['Stage 0', 'Stage 1']);
  jobStages.addCustomStage('One More');
  await settle();
  assert.ok(!cloud.doc(metaPath(uid)).stages.includes('One More'), 'the cloud list is full: the name stays on this device');
  stop();
});

test('another account\'s document is not read or written, and a build without a cloud does nothing', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore();
  jobStages.stagesSnapshot(uid);
  const stopNone = watchStages(uid, null);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.addCustomStage('Culture Round');
  await settle();
  assert.deepEqual(cloud.reads, [metaPath(uid)]);
  assert.ok(cloud.commits.every((ops) => ops.every(([, path]) => path === metaPath(uid))));
  stop();
  stopNone();
});

test('a read that fails leaves the list as it is on this device', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore();
  cloud.fail.read = Object.assign(new Error('offline'), { code: 'unavailable' });
  localStorage.setItem(`${KEY}_${uid}`, JSON.stringify(['Founder Chat']));
  jobStages.stagesSnapshot(uid);
  const logged = [];
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db), (...a) => logged.push(a));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Founder Chat']);
  assert.equal(logged.length, 1);
  stop();
});
