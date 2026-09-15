// What a deletion made in this browser does to the account's cloud, through the app's own sync
// engine and Firestore calls over a fake Firestore. The store records each deletion's id in
// `deletedIds` (as every build has) and, since R8-0, the version deleted in `deletedInfo`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, resumePath, listPath, settle } from './fake-firestore.mjs';

let mods;
before(async () => {
  await setup();
  mods = {
    io: await loadModule('/src/utils/cloudSyncIo.js'),
    engine: await loadModule('/src/utils/cloudSyncEngine.js'),
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
