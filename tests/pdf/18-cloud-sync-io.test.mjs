// The cloud sync as the app runs it: the engine (src/utils/cloudSyncEngine.js) with the app's own
// Firestore calls (src/utils/cloudSyncIo.js) over a fake Firestore (fake-firestore.mjs) — the
// batch that is really committed, the document ids really read, the queue really flushed (R8-7).
// Before, the tests applied the plans with their own copy of the batch code: removing the fix's
// batch lines, or reading documents without their ids, kept every test green.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';

let mods;
let io;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  ({ io } = mods);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
/** One of a demo account's originals ("Keep as my original", src/utils/demoSeed.js). */
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });
const withoutId = ({ id: _id, ...r }) => r;
const ids = (list) => list.map((r) => r.id).toSorted();
const USER = { uid: 'u', email: 'someone@example.com' };
const OWNER = { uid: 'u', email: 'owner@example.com' };

const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email });

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
  it('writes whole résumés, flags originals keeping their content, removes the rest, updates the list — in one commit', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'orig_a')]: cv('orig_a', 5, { name: 'My résumé' }), // marked here, the mark not sent yet
      [resumePath('u', 'resume_b')]: cv('resume_b'),
    });
    cloud.data.set(listPath('u'), { ids: ['resume_old', 'orig_c'] });
    await io.cloudIo(cloud.fs, cloud.db).commit('u', { sets: [cv('resume_x', 2)], flags: ['orig_a'], marks: ['orig_a'], hardDeletes: ['resume_b'], listAdd: ['resume_b'] });
    assert.equal(cloud.commits.length, 1);
    assert.deepEqual(Object.keys(cloud.resumes('u')).toSorted(), ['orig_a', 'resume_x']);
    assert.deepEqual(cloud.resumes('u').orig_a, { ...orig('orig_a', 5, { name: 'My résumé' }), deleted: true }, 'flagged, and marked an original');
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_old', 'orig_c', 'resume_b'], 'added to, never rewritten');
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

  it('an original deleted offline in a demo account is flagged, its edited copy kept for a restore', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_o')]: orig('resume_o', 5, { name: 'Edited original' }), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_b')], deletedIds: ['resume_o'], deletedInfo: { resume_o: { version: 5, at: 1 } } });
    await signIn(p, OWNER);
    assert.equal(cloud.resumes('u').resume_o.deleted, true, 'before: removed for good');
    assert.equal(cloud.resumes('u').resume_o.name, 'Edited original');
    assert.equal(cloud.doc(listPath('u')), undefined, 'originals never go on the deletion list');
    assert.deepEqual(p.seen.account.cloudOriginals.map((r) => [r.id, r.name, 'deleted' in r]), [['resume_o', 'Edited original', false]]);
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

  it('a deleted original is flagged in a demo account and removed in any other', async () => {
    for (const [user, flagged] of [[OWNER, true], [USER, false]]) {
      const cloud = fakeFirestore({ [resumePath('u', 'resume_o')]: orig('resume_o', 3, { name: 'Owner content' }) });
      const p = page(cloud, { resumes: [orig('resume_o', 3, { name: 'Owner content' })] });
      await signIn(p, user);
      await p.remove('resume_o');
      await p.timers.fire();
      assert.equal(cloud.resumes('u').resume_o?.deleted, flagged ? true : undefined, `${user.email} (before: removed for the owner too)`);
      assert.deepEqual(cloud.doc(listPath('u'))?.ids, flagged ? undefined : ['resume_o'], user.email);
    }
  });

  it('a deleted sample is removed for good in a demo account too: the samples never come back now', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 3, { name: 'Sample' }) });
    const p = page(cloud, { resumes: [cv('demo_a', 3, { name: 'Sample' })] });
    await signIn(p, OWNER);
    await p.remove('demo_a');
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u'), cloud.doc(listPath('u'))?.ids], [{}, ['demo_a']], 'before: flagged, for a restore of the samples');
  });
});

describe('the originals read back for a restore (R4-4)', () => {
  it('readCloudCopies returns the cloud copies with their ids, flagged ones included, and the deletion list; null before the first sync', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_a')]: { ...withoutId(orig('orig_a', 20)), deleted: true } });
    const p = page(cloud, { resumes: [] });
    assert.equal(await p.sync.readCloudCopies(['orig_a']), null, 'no account yet');
    await signIn(p, OWNER);
    cloud.data.set(listPath('u'), { ids: ['orig_b'] }); // another device, since this one's first sync
    const { docs, deleted } = await p.sync.readCloudCopies(['orig_a', 'orig_b']);
    assert.deepEqual(docs.map((r) => [r.id, r.updatedAt, r.deleted]), [['orig_a', 20, true]]);
    assert.deepEqual(deleted, ['orig_b'], 'read now, not as the first sync saw it (V2OWNER-DATA-0)');
  });
});
