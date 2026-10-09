// CYC-B (S3 follow-up): a custom interview stage removed on one device came back from another that
// still held it, because the cloud list only ever lost the name (arrayRemove) and a device with the
// name sent it up again. A removal now also leaves the name in `removedStages` in the account's jobs
// meta document (written in the same batch; adding the name takes it off), so a device that still
// holds the name finds it removed and drops it. A removal made where the cloud could not be reached
// is kept here until the cloud has it. Runs the app's own code on the fake Firestore, two "devices"
// being two browser storages over one cloud. Run: yarn test:unit
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
let n = 0;
const nextUid = () => `tomb-${n += 1}`;

/** Sit down at a device: its own storage, and the module reading the list from it afresh. */
function device(storage, uid) {
  globalThis.localStorage = storage;
  jobStages.stagesSnapshot('somebody-else');
  return jobStages.stagesSnapshot(uid);
}
const stored = (storage, uid) => JSON.parse(storage.getItem(`${KEY}_${uid}`));

test('a stage removed on one device stays removed when another that still holds it opens a form', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { deleted: ['j1'], stages: ['Culture Round', 'Founder Chat'] } });
  const laptop = new MemoryStorage();
  const phone = new MemoryStorage();
  laptop.setItem(`${KEY}_${uid}`, JSON.stringify(['Culture Round', 'Founder Chat']));
  phone.setItem(`${KEY}_${uid}`, JSON.stringify(['Culture Round', 'Founder Chat']));

  device(laptop, uid);
  const stopLaptop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.removeCustomStage('Culture Round');
  await settle();
  stopLaptop();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat']);
  assert.deepEqual(cloud.doc(metaPath(uid)).removedStages, ['Culture Round'], 'the removal is remembered in the cloud');
  assert.deepEqual(cloud.doc(metaPath(uid)).deleted, ['j1'], 'the jobs sync\'s fields are untouched');

  device(phone, uid);
  const stopPhone = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Founder Chat'], 'the phone drops its stale copy');
  assert.deepEqual(stored(phone, uid), ['Founder Chat']);
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat'], 'and does not send it up again');
  stopPhone();
});

test('adding the stage again takes it off the removed list, and a device that held it keeps it', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['Founder Chat'], removedStages: ['Culture Round', 'Offsite'] } });
  const laptop = new MemoryStorage();
  const phone = new MemoryStorage();
  phone.setItem(`${KEY}_${uid}`, JSON.stringify(['Founder Chat', 'Culture Round']));
  device(laptop, uid);
  const stopLaptop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.addCustomStage('Culture Round');
  await settle();
  stopLaptop();
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat', 'Culture Round']);
  assert.deepEqual(cloud.doc(metaPath(uid)).removedStages, ['Offsite'], 'no longer removed');
  device(phone, uid);
  const stopPhone = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Founder Chat', 'Culture Round']);
  stopPhone();
});

test('a name on both lists is alive: a build that does not know the removed list can add it again', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['Culture Round'], removedStages: ['Culture Round'] } });
  const phone = new MemoryStorage();
  phone.setItem(`${KEY}_${uid}`, JSON.stringify(['Culture Round']));
  device(phone, uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Culture Round']);
  stop();
});

test('a removal made while the cloud cannot be reached is kept, and beats the cloud\'s copy when a form next opens', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['Culture Round', 'Founder Chat'] } });
  const laptop = new MemoryStorage();
  laptop.setItem(`${KEY}_${uid}`, JSON.stringify(['Culture Round', 'Founder Chat']));
  device(laptop, uid);
  const logged = [];
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db), (...a) => logged.push(a));
  await settle();
  cloud.fail.commit = Object.assign(new Error('offline'), { code: 'unavailable' });
  jobStages.removeCustomStage('Culture Round');
  await settle();
  stop();
  assert.equal(logged.length, 1, 'the failed send is logged');
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Culture Round', 'Founder Chat'], 'the cloud has not heard');

  cloud.fail.commit = null;
  device(laptop, uid);
  const again = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  assert.deepEqual(jobStages.stagesSnapshot(uid), ['Founder Chat'], 'the cloud\'s old copy does not come back');
  assert.deepEqual(cloud.doc(metaPath(uid)).stages, ['Founder Chat']);
  assert.deepEqual(cloud.doc(metaPath(uid)).removedStages, ['Culture Round']);
  again();
  const third = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  third();
  assert.equal(cloud.commits.length, 1, 'once the cloud has the removal nothing more is sent');
});

test('the removed list is small: past 100 names the oldest make room', async () => {
  const uid = nextUid();
  const old = Array.from({ length: 100 }, (_, i) => `Old ${i}`);
  const cloud = fakeFirestore({ [metaPath(uid)]: { stages: ['Culture Round'], removedStages: old } });
  const laptop = new MemoryStorage();
  laptop.setItem(`${KEY}_${uid}`, JSON.stringify(['Culture Round']));
  device(laptop, uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.removeCustomStage('Culture Round');
  await settle();
  stop();
  const removed = cloud.doc(metaPath(uid)).removedStages;
  assert.equal(removed.length, 100);
  assert.equal(removed.at(-1), 'Culture Round');
  assert.equal(removed[0], 'Old 1', 'the oldest went');
});

test('a removal of a name the cloud cannot hold sends nothing and is not kept waiting', async () => {
  const uid = nextUid();
  const cloud = fakeFirestore();
  const long = 'x'.repeat(120);
  const laptop = new MemoryStorage();
  laptop.setItem(`${KEY}_${uid}`, JSON.stringify([long]));
  device(laptop, uid);
  const stop = watchStages(uid, stagesIo(cloud.fs, cloud.db));
  await settle();
  jobStages.removeCustomStage(long);
  await settle();
  stop();
  assert.equal(cloud.commits.length, 0);
  assert.equal(laptop.getItem(`cpwtcv_job_stages_gone_v1_${uid}`), null);
});
