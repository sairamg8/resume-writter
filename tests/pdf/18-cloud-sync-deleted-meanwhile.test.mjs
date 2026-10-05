// SL-SYNC-FLUSH-WRITES-DELETED: a résumé deleted in another tab while this tab's flush was reading
// the cloud's copies (the read can take seconds on a bad connection) was written back all the same.
// The flush took its writes from the queue before the read and sent them after it, never asking the
// store again: the other tab's deletion had reached this one through the storage event (the store
// had lost the résumé, and the watcher queued its deletion), yet the batch in flight still set it.
// Worse, when the other tab's deletion had got to the cloud first, the copy was found missing and
// taken for an edit made where the deletion was never seen (R2-029): the batch wrote it AND took
// it off the deletion list, and every device loaded it again — for good if this tab was closed
// before the deletion it queued went out. Now the flush asks the store once the cloud has answered,
// and a résumé that is no longer there is neither written nor taken off the list; its deletion,
// queued behind it, goes next. A résumé still in the store (an Undo made meanwhile, one never
// deleted) is written as before. The engine, its Firestore calls and the store's own updaters over
// one fake Firestore; the flush's read is held (`cloud.hold.read`) while the deletion is made.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, summary: 'v1', sections: [], dataVersion: DATA_VERSION, ...extra });
const USER = { uid: 'u', email: 'someone@example.com' };
const X = 'resume_x';
const Y = 'resume_y';
const listed = (cloud) => cloud.doc(listPath('u'))?.ids ?? [];
const inCloud = (cloud) => Object.keys(cloud.resumes('u')).toSorted();
/** The résumé documents every batch from commit number `from` on wrote (set). */
const writtenSince = (cloud, from) => cloud.commits.slice(from).flat()
  .filter(([op, path]) => op === 'set' && path.startsWith('users/u/resumes/')).map(([, path]) => path.split('/').at(-1));
const copiesIn = (cloud) => Object.values(cloud.resumes('u')).filter((r) => / \(conflict copy\)$/.test(r.name));

/**
 * A page signed in with X and Y, both in the cloud. X is then edited (and Y with it, `editY`) and
 * the flush that sends it starts: its read of the cloud is held until `release()`.
 */
async function flushReading({ editY = false } = {}) {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X), [resumePath('u', Y)]: cv(Y) });
  const page = syncPage(mods, cloud, { resumes: [cv(X), cv(Y)] });
  page.sync.start(USER);
  await settle();
  const from = cloud.commits.length;
  await page.change({
    resumes: page.store.state.resumes.map((r) => (r.id === X || (editY && r.id === Y) ? { ...r, summary: 'EDITED HERE', updatedAt: 10 } : r)),
  });
  const gate = deferred();
  cloud.hold.read = gate.promise;
  await page.timers.fire(); // the flush has taken the queue and waits for the cloud's answer
  const release = async () => { cloud.hold.read = null; gate.resolve(); await settle(); };
  return { cloud, page, from, release };
}

describe('a résumé deleted in another tab while a flush reads the cloud (SL-SYNC-FLUSH-WRITES-DELETED)', () => {
  it('is not written back by that flush; its own deletion goes next — and the résumé nobody deleted still is written', async () => {
    const { cloud, page, from, release } = await flushReading({ editY: true });
    await page.remove(X); // the other tab's Delete, as this tab's store has it
    await release();
    assert.deepEqual(writtenSince(cloud, from), [Y], 'before: [resume_x, resume_y] — the deleted résumé was written back with the other');
    assert.equal(cloud.resumes('u')[X].summary, 'v1', 'the cloud still holds the copy it had');

    await page.timers.fire(); // the deletion queued behind it
    assert.deepEqual([inCloud(cloud), listed(cloud)], [[Y], [X]]);
    assert.equal(cloud.resumes('u')[Y].summary, 'EDITED HERE');
    assert.deepEqual([page.store.state.deletedIds, page.seen.status], [[], 'synced']);
    assert.deepEqual(page.store.state.resumes.map((r) => r.id), [Y]);
  });

  it('whose deletion reached the cloud first: not written back, and its id stays on the deletion list', async () => {
    const { cloud, page, from, release } = await flushReading();
    // The other tab's flush: X is gone from the cloud and listed as deleted before this read is answered.
    cloud.data.delete(resumePath('u', X));
    cloud.data.set(listPath('u'), { ids: [X] });
    await page.remove(X);
    await release();
    assert.deepEqual(writtenSince(cloud, from), [], 'before: [resume_x] — found missing, taken for an edit made where the deletion was never seen');
    assert.deepEqual([inCloud(cloud), listed(cloud)], [[Y], [X]], 'before: [resume_x, resume_y] and [] — every device then loaded it again');

    await page.timers.fire();
    assert.deepEqual([inCloud(cloud), listed(cloud)], [[Y], [X]]);
    assert.deepEqual([page.store.state.deletedIds, page.seen.status], [[], 'synced']);
  });

  it('that another device edited meanwhile: its newer copy comes back as the résumé itself, with no conflict copy of it', async () => {
    const { cloud, page, from, release } = await flushReading();
    cloud.data.set(resumePath('u', X), cv(X, 50, { summary: 'PHONE EDIT' })); // the phone's edit, made while this read waits
    await page.remove(X);
    await release();
    assert.deepEqual(writtenSince(cloud, from), [], 'before: this tab\'s copy was written, and the phone\'s forked into a conflict copy');

    await page.timers.fire(); // the deletion finds a copy newer than the one deleted: not sent (R8-0), it comes back
    assert.deepEqual(copiesIn(cloud), []);
    assert.deepEqual(inCloud(cloud), [X, Y]);
    assert.equal(cloud.resumes('u')[X].summary, 'PHONE EDIT');
    assert.equal(listed(cloud).length, 0);
    assert.equal(page.store.state.resumes.find((r) => r.id === X)?.summary, 'PHONE EDIT');
    assert.deepEqual([page.store.state.deletedIds, page.seen.status], [[], 'synced']);
  });

  it('put back meanwhile (Undo): still written, and not left deleted', async () => {
    const { cloud, page, from, release } = await flushReading({ editY: true });
    const edited = page.store.state.resumes.find((r) => r.id === X);
    await page.remove(X);
    await page.restore([edited]); // Undo, while the flush waits
    await release();
    assert.deepEqual(writtenSince(cloud, from).toSorted(), [X, Y], 'the résumé is in the store: its write goes');
    assert.equal(cloud.resumes('u')[X].summary, 'EDITED HERE');

    await page.timers.fire();
    assert.deepEqual([inCloud(cloud), listed(cloud)], [[X, Y], []]);
    assert.equal(cloud.resumes('u')[X].summary, 'EDITED HERE');
    assert.deepEqual([page.store.state.deletedIds, page.seen.status], [[], 'synced']);
  });
});
