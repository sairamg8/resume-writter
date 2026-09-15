// The cloud sync as the app runs it: the engine (src/utils/cloudSyncEngine.js) with the app's own
// Firestore calls (src/utils/cloudSyncIo.js) over a fake Firestore (fake-firestore.mjs) — the
// batch that is really committed, the document ids really read, the queue really flushed (R8-7).
// Before, the tests applied the plans with their own copy of the batch code: removing the fix's
// batch lines, or reading documents without their ids, kept every test green.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, resumePath, listPath, settle } from './fake-firestore.mjs';

let io;
let engine;
let plan;
before(async () => {
  await setup();
  io = await loadModule('/src/utils/cloudSyncIo.js');
  engine = await loadModule('/src/utils/cloudSyncEngine.js');
  plan = await loadModule('/src/utils/cloudSyncPlan.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const withoutId = ({ id: _id, ...r }) => r;
const ids = (list) => list.map((r) => r.id).toSorted();
const USER = { uid: 'u', email: 'someone@example.com' };
const OWNER = { uid: 'u', email: 'owner@example.com' };

const page = (cloud, state) => syncPage({ io, engine, plan }, cloud, state, { isDemo: (u) => u.email === OWNER.email });

const signIn = async (p, user = USER) => { p.sync.start(user); await settle(); };

describe('reading the account (R4-5)', () => {
  it('each résumé carries its document id, also one whose stored data has none', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_b')]: withoutId(cv('resume_b', 3)),
      [resumePath('u', 'demo_x')]: { deleted: true },
    });
    const { docs } = await io.cloudIo(cloud.fs, cloud.db).readCloud('u');
    assert.deepEqual(ids(docs), ['demo_x', 'resume_b']);
  });

  it('the first sync loads a cloud résumé stored without an id field, and never a flag stub', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_b')]: withoutId(cv('resume_b', 3, { name: 'From the cloud' })),
      [resumePath('u', 'demo_x')]: { deleted: true },
    });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signIn(p);
    assert.equal(p.seen.status, 'synced');
    assert.deepEqual(ids(p.store.state.resumes), ['resume_a', 'resume_b'], 'before: resume_b had no id and was dropped');
    assert.equal(p.store.state.resumes.find((r) => r.id === 'resume_b').name, 'From the cloud');
  });
});

describe('the batch the sync commits', () => {
  it('writes whole résumés, flags samples keeping their content, removes the rest, updates the list — in one commit', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'demo_a')]: cv('demo_a', 5, { name: 'Edited sample' }),
      [resumePath('u', 'resume_b')]: cv('resume_b'),
    });
    cloud.data.set(listPath('u'), { ids: ['resume_old', 'demo_c'] });
    await io.cloudIo(cloud.fs, cloud.db).commit('u', { sets: [cv('resume_x', 2)], flags: ['demo_a'], hardDeletes: ['resume_b'], listAdd: ['resume_b'], listRemove: ['demo_c'] });
    assert.equal(cloud.commits.length, 1);
    assert.deepEqual(Object.keys(cloud.resumes('u')).toSorted(), ['demo_a', 'resume_x']);
    assert.deepEqual(cloud.resumes('u').demo_a, { ...cv('demo_a', 5, { name: 'Edited sample' }), deleted: true });
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_old', 'resume_b'], 'added to and taken off, never rewritten');
  });
});

describe('the first sync through the real batch (R4-1)', () => {
  it('a résumé deleted while signed out is removed and listed; it stays gone after a reload and on another device', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [cv('resume_b')], deletedIds: ['resume_a'], deletedInfo: { resume_a: { version: 1, at: 1 } } });
    await signIn(laptop);
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b'], 'removed from the cloud');
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_a'], 'and on the deletion list');
    assert.deepEqual(laptop.store.state.deletedIds, []);

    const reload = page(cloud, laptop.store.state);
    await signIn(reload);
    assert.deepEqual(ids(reload.store.state.resumes), ['resume_b'], 'it does not come back');
    const phone = page(cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    await signIn(phone);
    assert.deepEqual(ids(phone.store.state.resumes), ['resume_b'], 'a device still holding a copy drops it');
  });

  it('a sample deleted offline in a demo account is flagged, its edited copy kept for a restore', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_classic')]: cv('demo_classic', 5, { name: 'Edited sample' }), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_b')], deletedIds: ['demo_classic'], deletedInfo: { demo_classic: { version: 5, at: 1 } } });
    await signIn(p, OWNER);
    assert.equal(cloud.resumes('u').demo_classic.deleted, true);
    assert.equal(cloud.resumes('u').demo_classic.name, 'Edited sample');
    assert.equal(cloud.doc(listPath('u')), undefined, 'samples never go on the deletion list');
    assert.deepEqual(p.seen.account.cloudDemo.map((r) => [r.id, r.name, 'deleted' in r]), [['demo_classic', 'Edited sample', false]]);
  });
});

describe('the write queue through the real batch', () => {
  it('an edit and a deletion are sent after the pause, in one batch; the deleted résumé is listed', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    await signIn(p);
    const commitsBefore = cloud.commits.length;
    await p.change({ resumes: [cv('resume_a', 2, { name: 'Renamed' })], deletedIds: ['resume_b'] });
    assert.equal(p.seen.status, 'syncing');
    assert.equal(cloud.commits.length, commitsBefore, 'nothing is sent before the pause');
    await p.timers.fire();
    assert.equal(cloud.commits.length, commitsBefore + 1);
    assert.deepEqual(cloud.resumes('u'), { resume_a: cv('resume_a', 2, { name: 'Renamed' }) });
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_b']);
    assert.equal(p.seen.status, 'synced');
  });

  it('a deleted sample is flagged in a demo account and removed in any other', async () => {
    for (const [user, flagged] of [[OWNER, true], [USER, false]]) {
      const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 3, { name: 'Owner content' }) });
      const p = page(cloud, { resumes: [cv('demo_a', 3, { name: 'Owner content' })] });
      await signIn(p, user);
      await p.change({ resumes: [], deletedIds: ['demo_a'] });
      await p.timers.fire();
      assert.equal(cloud.resumes('u').demo_a?.deleted, flagged ? true : undefined, user.email);
      assert.deepEqual(cloud.doc(listPath('u'))?.ids, flagged ? undefined : ['demo_a'], user.email);
    }
  });
});

describe('the samples read back for a restore (R4-4)', () => {
  it('readCloudDemo returns the cloud copies with their ids, flagged ones included; null before the first sync', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: { ...withoutId(cv('demo_a', 20)), deleted: true } });
    const p = page(cloud, { resumes: [] });
    assert.equal(await p.sync.readCloudDemo(['demo_a']), null, 'no account yet');
    await signIn(p, OWNER);
    assert.deepEqual((await p.sync.readCloudDemo(['demo_a', 'demo_b'])).map((r) => [r.id, r.updatedAt, r.deleted]), [['demo_a', 20, true]]);
  });
});
