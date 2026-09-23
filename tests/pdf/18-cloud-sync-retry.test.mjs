// When the cloud sync tries again after a failure, as the app runs it: the engine, its Firestore
// calls and the store's updaters over a fake Firestore, with the timers fired by hand
// (src/utils/cloudSyncRetry.js decides what a failure means; V2W1a-1).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, template: 'classic', ...extra });
const USER = { uid: 'u', email: 'someone@example.com' };
const failure = (code) => Object.assign(new Error(`${code}: refused`), { code });
const rename = (p, name, updatedAt) => p.change({ resumes: p.store.state.resumes.map((r) => (r.id === 'resume_a' ? { ...r, name, updatedAt } : r)) });
const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe('a first sync that keeps failing for a moment', () => {
  it('is tried again later each time — 30 s, 1 min, 2 min … at most 10 min — and from 30 s again after a success', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [] });
    cloud.fail.read = failure('unavailable');
    p.sync.start(USER);
    await settle();
    const pauses = [p.timers.delays];
    for (let i = 0; i < 6; i += 1) { await p.timers.fire(); pauses.push(p.timers.delays); }
    assert.deepEqual(pauses, [[30 * SECOND], [MINUTE], [2 * MINUTE], [4 * MINUTE], [8 * MINUTE], [10 * MINUTE], [10 * MINUTE]], 'before: every 30 s, for good');
    assert.equal(p.seen.status, 'error', 'says it will retry');
    cloud.fail.read = null;
    await p.timers.fire();
    assert.equal(p.seen.status, 'synced');
    cloud.fail.read = failure('unavailable');
    p.sync.start(USER); // e.g. back online
    await settle();
    assert.deepEqual(p.timers.delays, [30 * SECOND]);
  });

  it('another account starts from 30 s again: one account\'s failures never delay the next one\'s retry (V2VF1S-5)', async () => {
    const OTHER = { uid: 'v', email: 'other@example.com' };
    for (const signOut of [true, false]) {
      const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('v', 'resume_b')]: cv('resume_b') });
      const p = syncPage(mods, cloud, { resumes: [] });
      cloud.fail.read = failure('unavailable');
      p.sync.start(USER);
      await settle();
      for (let i = 0; i < 4; i += 1) await p.timers.fire();
      assert.deepEqual(p.timers.delays, [8 * MINUTE], 'the first account failed five times');
      if (signOut) { p.sync.start(null); await settle(); }
      p.sync.start(OTHER); // signed out and another account in, or switched straight to it
      await settle();
      assert.deepEqual([p.seen.status, p.timers.delays], ['error', [30 * SECOND]], `before: the other account's first retry after 10 min (signOut ${signOut})`);
      cloud.fail.read = null;
      await p.timers.fire();
      assert.deepEqual([p.seen.status, p.seen.account?.uid], ['synced', 'v']);
    }
  });

  it('is not tried while the tab is hidden: the retry runs once it is shown', async () => {
    let hidden = false;
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [] }, { hidden: () => hidden });
    cloud.fail.read = failure('unavailable');
    p.sync.start(USER);
    await settle();
    hidden = true;
    const reads = cloud.reads.length;
    await p.timers.fire();
    await p.timers.fire();
    assert.equal(cloud.reads.length, reads, 'before: the account read again while nobody looked');
    cloud.fail.read = null;
    hidden = false;
    p.sync.shown();
    await settle();
    assert.equal(p.seen.status, 'synced');
  });
});

describe('a first sync the project refuses (V2VF1S-2)', () => {
  it('permission-denied or no database turns the sync off, and says so — never "will retry", as nothing is', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [] });
    cloud.fail.read = failure('permission-denied');
    p.sync.start(USER);
    await settle();
    assert.deepEqual([p.seen.status, p.timers.count], ['off', 0], 'before: "error" — "Sync error — will retry", with no retry');
    cloud.fail.read = null;
    p.sync.start(USER); // offline and online again: still off, until a sign-out or a reload
    await settle();
    assert.deepEqual([p.seen.status, cloud.reads.length], ['off', 2]);
    cloud.fail.read = Object.assign(new Error("Database '(default)' not found."), { code: 'not-found' });
    const other = syncPage(mods, cloud, { resumes: [] });
    other.sync.start(USER);
    await settle();
    assert.equal(other.seen.status, 'off');
  });

  it('a build with no cloud says the sync is off', async () => {
    const p = syncPage(mods, null, { resumes: [cv('resume_a')] });
    p.sync.start(USER);
    await settle();
    assert.deepEqual([p.seen.status, p.seen.account.cloud], ['off', false], 'before: "error" — "will retry"');
  });
});

describe('a batch the server refuses for good (V2W1a-1)', () => {
  it('invalid-argument — a résumé over 1 MiB — is not read and re-sent every 30 s: the sync stops and says so', async () => {
    const cloud = fakeFirestore({});
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { name: 'With a 3 MB photo' })] });
    cloud.fail.commit = failure('invalid-argument');
    p.sync.start(USER);
    await settle();
    const reads = cloud.reads.length;
    for (let i = 0; i < 5; i += 1) await p.timers.fire();
    assert.equal(cloud.reads.length, reads, 'before: the account read again, and the batch sent again, every 30 s');
    assert.deepEqual([p.seen.status, p.timers.count], ['stopped', 0]);
  });

  it('stopped, the next change is tried once: taking the photo out lets it through', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { name: 'With a 3 MB photo' })] });
    cloud.fail.commit = failure('invalid-argument');
    p.sync.start(USER);
    await settle();
    cloud.fail.commit = null;
    await rename(p, 'Photo taken out', 3);
    await p.timers.fire();
    assert.equal(p.seen.status, 'synced');
    assert.equal(cloud.resumes('u').resume_a.name, 'Photo taken out');
  });
});

describe('a flush that fails for a moment (V2W1a-1)', () => {
  it('is tried again, as the sync icon says: the edit reaches the cloud with the retry', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a')] });
    p.sync.start(USER);
    await settle();
    cloud.fail.commit = failure('deadline-exceeded');
    await rename(p, 'Renamed', 2);
    await p.timers.fire();
    assert.deepEqual([p.seen.status, p.timers.delays], ['error', [30 * SECOND]], 'before: "will retry", with nothing to retry it');
    cloud.fail.commit = null;
    await p.timers.fire();
    assert.equal(cloud.resumes('u').resume_a.name, 'Renamed', 'before: the edit never reached the cloud');
    assert.equal(p.seen.status, 'synced');
  });

  it('permission-denied turns the sync off, and says so: no "will retry" with nothing to retry it (V2VF1S-2)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a')] });
    p.sync.start(USER);
    await settle();
    cloud.fail.commit = failure('permission-denied');
    await rename(p, 'Renamed', 2);
    await p.timers.fire();
    assert.deepEqual([p.seen.status, p.timers.count], ['off', 0], 'before: "error" — "Sync error — will retry", and nothing was');
  });

  it('refused for good, it stops too, and the next change is tried', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a')] });
    p.sync.start(USER);
    await settle();
    cloud.fail.commit = failure('invalid-argument');
    await rename(p, 'With a 3 MB photo', 2);
    await p.timers.fire();
    assert.deepEqual([p.seen.status, p.timers.count], ['stopped', 0]);
    cloud.fail.commit = null;
    await rename(p, 'Photo taken out', 3);
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u').resume_a.name, p.seen.status], ['Photo taken out', 'synced']);
  });
});
