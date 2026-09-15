// The first sync after sign-in, as the app runs it (the engine, its Firestore calls, the store's
// own rules) over a fake Firestore: what happens to work done while it runs, and what it writes.
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
const byId = (list, id) => list.find((r) => r.id === id);
const USER = { uid: 'u', email: 'someone@example.com' };
const page = (cloud, state, opts) => syncPage(mods, cloud, state, opts);

describe('work done while the first sync runs is kept (R8-2)', () => {
  it('an edit, a deletion and a new résumé made while the batch is on its way stay, and are sent', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b'),
      [resumePath('u', 'resume_cloud')]: cv('resume_cloud', 1, { name: 'From the phone' }),
    });
    const laptop = page(cloud, { resumes: [cv('resume_a'), cv('resume_b')], activeId: 'resume_a' });
    const ack = deferred();
    cloud.hold.commit = ack.promise;
    laptop.sync.start(USER);
    await settle(); // read, planned and committed; the server has not answered
    assert.equal(cloud.commits.length, 1);

    // Meanwhile the user types into A, deletes B and creates a résumé.
    await laptop.change({ resumes: [cv('resume_a', 2, { name: 'Typed meanwhile' }), cv('resume_b'), cv('resume_new', 3)] });
    await laptop.remove('resume_b');
    cloud.hold.commit = null;
    ack.resolve();
    await settle();

    const { state } = laptop.store;
    assert.equal(byId(state.resumes, 'resume_a')?.name, 'Typed meanwhile', 'before: the edit was replaced by the pre-sync copy');
    assert.deepEqual(ids(state.resumes), ['resume_a', 'resume_cloud', 'resume_new'], 'before: B came back and the new one was gone');
    assert.deepEqual(state.deletedIds, ['resume_b'], 'the deletion is still to be sent');
    assert.equal(state.activeId, 'resume_a');

    // The watcher sends what changed after the sync's snapshot.
    await laptop.timers.fire();
    const docs = cloud.resumes('u');
    assert.deepEqual(Object.keys(docs).toSorted(), ['resume_a', 'resume_cloud', 'resume_new']);
    assert.equal(docs.resume_a.name, 'Typed meanwhile');
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_b']);
    assert.deepEqual(laptop.store.state.deletedIds, [], 'sent, then forgotten');
  });

  it('nothing changed meanwhile: the store takes the merged list, in the merged order', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a', 5, { name: 'Newer in the cloud' }), [resumePath('u', 'resume_c')]: cv('resume_c') });
    const laptop = page(cloud, { resumes: [cv('resume_b'), cv('resume_a', 2)] });
    laptop.sync.start(USER);
    await settle();
    assert.deepEqual(laptop.store.state.resumes.map((r) => [r.id, r.name]), [['resume_a', 'Newer in the cloud'], ['resume_c', 'resume_c'], ['resume_b', 'resume_b']]);
    const before = cloud.commits.length;
    await laptop.timers.fire();
    assert.equal(cloud.commits.length, before, 'and the watcher has nothing to send');
  });
});
