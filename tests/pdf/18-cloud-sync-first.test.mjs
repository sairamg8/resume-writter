// The first sync after sign-in, as the app runs it (the engine, its Firestore calls, the store's
// own rules) over a fake Firestore: what happens to work done while it runs, and what it writes.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, resumePath, listPath, settle, syncModules } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, ...extra });
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

describe('the first sync writes what it must, never back what it read (R8-4)', () => {
  it('an entry another device puts on the deletion list meanwhile is kept, and its résumé stays deleted', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_r')]: cv('resume_r', 5), [resumePath('u', 'resume_s')]: cv('resume_s', 5),
      [listPath('u')]: { ids: ['resume_x'] },
    });
    // The laptop deleted R offline, at the version the cloud holds.
    const laptop = page(cloud, { resumes: [], deletedIds: ['resume_r'], deletedInfo: { resume_r: { version: 5, at: 1 } } });
    // The phone deletes S once the laptop has read the account (both reads), before its batch.
    let reads = 0;
    cloud.afterRead = () => {
      if ((reads += 1) !== 2) return;
      cloud.data.delete(resumePath('u', 'resume_s'));
      cloud.data.set(listPath('u'), { ids: ['resume_x', 'resume_s'] });
    };
    laptop.sync.start(USER);
    await settle();
    assert.deepEqual(cloud.doc(listPath('u')).ids.toSorted(), ['resume_r', 'resume_s', 'resume_x'], 'before: [x, r] — S fell off the list');
    assert.equal(cloud.resumes('u').resume_s, undefined, 'before: the copy read was written back');
  });

  it('a résumé edited on another device after the read is not overwritten with the copy read', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_a')]: cv('resume_a', 5), [resumePath('u', 'resume_b')]: cv('resume_b', 3),
    });
    const laptop = page(cloud, { resumes: [cv('resume_a', 5), cv('resume_b', 7, { name: 'Newer here' }), cv('resume_c', 2)] });
    cloud.afterRead = () => cloud.data.set(resumePath('u', 'resume_a'), cv('resume_a', 9, { name: 'Edited on the phone' }));
    laptop.sync.start(USER);
    await settle();
    const docs = cloud.resumes('u');
    assert.equal(docs.resume_a.name, 'Edited on the phone', 'before: the copy read at 5 was written over it');
    assert.equal(docs.resume_b.name, 'Newer here', 'a newer copy here is written');
    assert.ok(docs.resume_c, 'and one the account lacks');
  });

  it('a first sync that cannot reach the server plans nothing from the cache and writes nothing', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'resume_a')]: cv('resume_a', 1), [resumePath('u', 'resume_r')]: cv('resume_r', 5),
    });
    cloud.goOffline(); // the cache holds the account as it was
    cloud.data.set(resumePath('u', 'resume_a'), cv('resume_a', 9, { name: 'Edited on the phone' }));
    cloud.data.set(listPath('u'), { ids: ['resume_s'] });
    const laptop = page(cloud, { resumes: [cv('resume_a', 1)], deletedIds: ['resume_r'], deletedInfo: { resume_r: { version: 5, at: 1 } } });
    laptop.sync.start(USER);
    await settle();
    assert.equal(cloud.commits.length, 0, 'before: planned from the cache and committed');
    assert.equal(cloud.resumes('u').resume_a.name, 'Edited on the phone');
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_s']);
    assert.deepEqual(laptop.store.state.deletedIds, ['resume_r'], 'kept for the next sync');
    assert.equal(laptop.seen.status, 'error');
  });
});

describe('a flush adds to the deletion list without reading it (R8-4)', () => {
  it('the list is never read, and an entry another device wrote is kept', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [listPath('u')]: { ids: ['resume_x'] } });
    const laptop = page(cloud, { resumes: [cv('resume_a')] });
    laptop.sync.start(USER);
    await settle();
    cloud.data.set(listPath('u'), { ids: ['resume_x', 'resume_s'] }); // the phone, since
    const readsBefore = cloud.reads.length;
    await laptop.remove('resume_a');
    await laptop.timers.fire();
    // The flush reads the résumé it sends, to keep another device's edit (R2-004) — never the list.
    assert.deepEqual(cloud.reads.slice(readsBefore), [resumePath('u', 'resume_a')], 'before: read, then set whole — whatever landed in between was lost');
    assert.deepEqual(cloud.doc(listPath('u')).ids, ['resume_x', 'resume_s', 'resume_a']);
  });
});
