// What a deletion made in this browser does to the account's cloud, through the app's own sync
// engine and Firestore calls over a fake Firestore. The store records each deletion's id in
// `deletedIds` (as every build has) and, since R8-0, the version deleted in `deletedInfo`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, resumePath, listPath, settle } from './fake-firestore.mjs';

let mods;
before(async () => {
  await setup();
  mods = {
    io: await loadModule('/src/utils/cloudSyncIo.js'),
    engine: await loadModule('/src/utils/cloudSyncEngine.js'),
    plan: await loadModule('/src/utils/cloudSyncPlan.js'),
  };
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const ids = (list) => list.map((r) => r.id).toSorted();
const USER = { uid: 'u', email: 'someone@example.com' };
const OWNER = { uid: 'u', email: 'owner@example.com' };
const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email });
const signIn = async (p, user = USER) => { p.sync.start(user); await settle(); };
/** A store that deleted these résumés here — id → the updatedAt of the copy deleted. */
const deleted = (versions) => ({
  deletedIds: Object.keys(versions),
  deletedInfo: Object.fromEntries(Object.entries(versions).map(([id, version]) => [id, { version, at: 100 }])),
});

describe('a deletion the first sync sends carries the version deleted (R8-0)', () => {
  it('an offline deletion of an older copy never removes an edit made later on another device', async () => {
    // The laptop deleted resume_a offline when its copy dated from 9; the phone edited it at 50.
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a', 50, { name: 'Edited on the phone' }), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [cv('resume_b')], ...deleted({ resume_a: 9 }) });
    await signIn(laptop);
    assert.equal(cloud.resumes('u').resume_a?.name, 'Edited on the phone', 'before: removed from the cloud');
    assert.equal(cloud.doc(listPath('u')), undefined, 'before: listed, so the phone dropped it too');
    assert.deepEqual(ids(laptop.store.state.resumes), ['resume_a', 'resume_b'], 'the newer copy comes back here');
    assert.equal(laptop.store.state.resumes.find((r) => r.id === 'resume_a').name, 'Edited on the phone');
  });

  it('the copy deleted, or an older one, is removed from the cloud and listed', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a', 9), [resumePath('u', 'resume_c')]: cv('resume_c', 4), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [cv('resume_b')], ...deleted({ resume_a: 9, resume_c: 7 }) });
    await signIn(laptop);
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b']);
    assert.deepEqual(cloud.doc(listPath('u')).ids.toSorted(), ['resume_a', 'resume_c']);
    assert.deepEqual(ids(laptop.store.state.resumes), ['resume_b']);
  });

  it('a deletion saved by an older build (no version) is left out of this sync, never sent', async () => {
    // Builds before R8-0 kept only the id: whether the cloud copy is newer cannot be told.
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a', 50), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [cv('resume_b')], deletedIds: ['resume_a'] });
    await signIn(laptop);
    assert.deepEqual(Object.keys(cloud.resumes('u')).toSorted(), ['resume_a', 'resume_b'], 'the cloud keeps it');
    assert.equal(cloud.doc(listPath('u')), undefined);
    assert.deepEqual(ids(laptop.store.state.resumes), ['resume_b'], 'hidden here until the next sync, as before 53d6a3b');
  });

  it('a sample deleted offline is not flagged over a newer copy of it in the cloud', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_classic')]: cv('demo_classic', 40, { name: 'Edited later' }) });
    const laptop = page(cloud, { resumes: [], ...deleted({ demo_classic: 5 }) });
    await signIn(laptop, OWNER);
    assert.equal(cloud.resumes('u').demo_classic.deleted, undefined, 'before: flagged, and hidden on every device');
    assert.deepEqual(ids(laptop.store.state.resumes), ['demo_classic']);
  });

  it('a sample deleted offline at the version the cloud holds is flagged', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_classic')]: cv('demo_classic', 5, { name: 'Edited sample' }) });
    const laptop = page(cloud, { resumes: [], ...deleted({ demo_classic: 5 }) });
    await signIn(laptop, OWNER);
    assert.deepEqual(cloud.resumes('u').demo_classic, { ...cv('demo_classic', 5, { name: 'Edited sample' }), deleted: true });
  });
});

describe('deletedIds holds what the cloud does not have yet (R8-1)', () => {
  it('a deletion a flush sent is forgotten: a sample restored on another device is not flagged again', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_classic')]: cv('demo_classic', 5), [resumePath('u', 'demo_modern')]: cv('demo_modern', 5) });
    const laptop = page(cloud, { resumes: [cv('demo_classic', 5), cv('demo_modern', 5)] });
    await signIn(laptop, OWNER);
    await laptop.remove('demo_classic');
    await laptop.timers.fire();
    assert.equal(cloud.resumes('u').demo_classic.deleted, true, 'the flush flagged it');
    assert.deepEqual([laptop.store.state.deletedIds, laptop.store.state.deletedInfo], [[], {}], 'before: kept for good');

    // The phone deletes the other sample; none is left there, so it restores all of them (their
    // own updatedAt kept, R4-4). Then the laptop comes back online and syncs again.
    cloud.data.set(resumePath('u', 'demo_classic'), cv('demo_classic', 5));
    laptop.sync.start(OWNER);
    await settle();
    assert.equal(cloud.resumes('u').demo_classic.deleted, undefined, 'before: flagged again, over the restore');
    assert.deepEqual(ids(laptop.store.state.resumes), ['demo_classic', 'demo_modern']);
  });

  it('a flush that fails keeps the deletion, and the next first sync sends it', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a', 5), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [cv('resume_a', 5), cv('resume_b')] });
    await signIn(laptop);
    cloud.fail.commit = Object.assign(new Error('Failed to get document because the client is offline.'), { code: 'unavailable' });
    await laptop.remove('resume_a');
    await laptop.timers.fire();
    assert.deepEqual(laptop.store.state.deletedIds, ['resume_a'], 'not sent, so not forgotten');
    cloud.fail.commit = null;
    laptop.sync.start(USER); // back online
    await settle();
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b']);
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_a']);
  });

  it('a résumé deleted again after the flush took the queue is not forgotten with it', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 5), [resumePath('u', 'demo_b')]: cv('demo_b', 5) });
    const laptop = page(cloud, { resumes: [cv('demo_a', 5), cv('demo_b', 5)] });
    await signIn(laptop, OWNER);
    await laptop.remove('demo_a');
    const ack = deferred();
    cloud.hold.commit = ack.promise;
    await laptop.timers.fire(); // sent; the server has not answered yet
    // Put back meanwhile (restoreResumes forgets the deletion), then deleted again: a newer entry.
    // A guard for forgetting only what the flush sent (the store used to forget nothing).
    await laptop.change({ resumes: [cv('demo_a', 6), cv('demo_b', 5)], deletedIds: [], deletedInfo: {} });
    laptop.store.deleteResume('demo_a', Date.now() + 60_000);
    ack.resolve();
    await settle();
    assert.deepEqual(laptop.store.state.deletedIds, ['demo_a'], 'the second deletion still has to be sent');
  });
});

describe('a deletion belongs to the account the list came from (R8-6)', () => {
  const A = { uid: 'A', email: 'a@example.com' };
  const B = { uid: 'B', email: 'b@example.com' };

  it('deleted after signing out of A, it waits for A: B signing in does not take it', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_r')]: cv('resume_r', 5), [resumePath('A', 'resume_s')]: cv('resume_s', 5) });
    const p = page(cloud, { resumes: [] });
    await signIn(p, A); // the list is A's now
    p.sync.start(null); // signed out: the list stays in the browser
    await p.remove('resume_r');

    await signIn(p, B);
    assert.deepEqual(p.store.state.deletedIds, ['resume_r'], 'before: B\'s sync forgot it');
    assert.equal(cloud.resumes('B').resume_r, undefined, 'and it is not uploaded to B');

    p.sync.start(null);
    await signIn(p, A);
    assert.deepEqual(Object.keys(cloud.resumes('A')), ['resume_s'], 'before: A kept it, and it came back');
    assert.deepEqual(cloud.doc(listPath('A')).ids, ['resume_r']);
    assert.deepEqual(p.store.state.deletedIds, []);
    assert.equal(p.store.state.resumes.some((r) => r.id === 'resume_r'), false);
  });

  it('deleted before any account synced this list, it goes to the first account that signs in', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_r')]: cv('resume_r', 5) });
    const p = page(cloud, { resumes: [cv('resume_r', 5)] });
    await p.remove('resume_r');
    await signIn(p, A);
    assert.deepEqual(cloud.resumes('A'), {});
    assert.deepEqual(p.store.state.deletedIds, []);
  });
});

describe('a flag is a deletion of the version it carries', () => {
  // A demo account's deleted sample stays in the cloud flagged, with the copy that was deleted.
  it('a sample restored here and edited since is kept at the next sync, and brought back in the cloud', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 20, { deleted: true }), [resumePath('u', 'demo_b')]: cv('demo_b', 20, { deleted: true }) });
    // Restored offline (their own times kept, R4-4), then demo_a edited at 30.
    const laptop = page(cloud, { resumes: [cv('demo_a', 30, { name: 'Edited after the restore' }), cv('demo_b', 20)] });
    await signIn(laptop, OWNER);
    assert.deepEqual(ids(laptop.store.state.resumes), ['demo_a'], 'before: dropped — the cloud still had it flagged');
    const { name, updatedAt, deleted: flag } = cloud.resumes('u').demo_a;
    assert.deepEqual([name, updatedAt, flag], ['Edited after the restore', 30, undefined], 'written whole: the flag is gone');
    assert.equal(cloud.resumes('u').demo_b.deleted, true, 'an unedited copy stays deleted');
  });

  it('outside a demo account too, an edit made after the flag keeps the résumé', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 20, { deleted: true }) });
    const p = page(cloud, { resumes: [cv('demo_a', 30)] });
    await signIn(p, USER);
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['demo_a'], 'before: removed and listed');
    assert.equal(cloud.doc(listPath('u')), undefined);
  });
});
