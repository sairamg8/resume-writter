// A demo account's restore of its originals and the cloud (VM4-6, R4-4, R4-2), as the app runs
// it: the engine, its Firestore calls, the store's own updaters and the demo restore
// (src/utils/demoRestore.js, as useDemoSeed runs it after each render) over a fake Firestore.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';

let mods;
let demo;
let merge;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  demo = await loadModule('/src/utils/demoSeed.js');
  merge = await loadModule('/src/utils/syncMerge.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, template: 'classic', ...extra });
/** One of a demo account's originals ("Keep as my original", src/utils/demoSeed.js). */
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });
const OWNER = { uid: 'u', email: 'owner@example.com' };
/** A page signed in as the owner can be: its demo restore runs as useDemoSeed runs it. */
const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email, demo: { accounts: [OWNER.email], now: () => 1000 } });
const unavailable = () => Object.assign(new Error('Failed to get document from server.'), { code: 'unavailable' });
const names = (p) => p.store.state.resumes.map((r) => r.name);

/**
 * The laptop's morning: it synced original A at 7. Then the phone edited it (20). The laptop, on
 * a bad connection, deletes it — flagged in the cloud — and has no original left, so the restore
 * asks the cloud for its copy.
 */
async function morning() {
  const cloud = fakeFirestore({ [resumePath('u', 'orig_a')]: orig('orig_a', 7, { name: 'Morning A' }) });
  const laptop = page(cloud, { resumes: [orig('orig_a', 7, { name: 'Morning A' })] });
  laptop.sync.start(OWNER);
  await settle();
  cloud.data.set(resumePath('u', 'orig_a'), orig('orig_a', 20, { name: 'Edited on the phone' }));
  return { cloud, laptop };
}

describe('a restore without the cloud\'s answer never overwrites the cloud (VM4-6)', () => {
  it('the cloud answers: nothing comes back before its answer, then the phone\'s edit (R4-4)', async () => {
    const { cloud, laptop } = await morning();
    const read = deferred();
    cloud.hold.read = read.promise;
    await laptop.remove('orig_a');
    await settle();
    assert.deepEqual(names(laptop), [], 'the morning copy is not put back while the cloud is asked');
    cloud.hold.read = null;
    read.resolve();
    await settle();
    await laptop.timers.fire();
    assert.deepEqual(names(laptop), ['Edited on the phone']);
    assert.deepEqual([cloud.resumes('u').orig_a.name, cloud.resumes('u').orig_a.deleted], ['Edited on the phone', undefined]);
  });

  it('the read fails: nothing comes back from this browser\'s copies; the next sync brings the cloud\'s (V2W1a-0)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_a')]: orig('orig_a', 7, { name: 'Morning A' }), [resumePath('u', 'orig_b')]: orig('orig_b', 7, { name: 'B' }) });
    const laptop = page(cloud, { resumes: [orig('orig_a', 7, { name: 'Morning A' }), orig('orig_b', 7, { name: 'B' })] });
    laptop.sync.start(OWNER);
    await settle();
    cloud.data.set(resumePath('u', 'orig_a'), orig('orig_a', 20, { name: 'Edited on the phone' }));
    cloud.fail.read = unavailable();
    await laptop.remove('orig_a');
    await laptop.remove('orig_b'); // no original left: the restore asks the cloud, which cannot answer
    await settle();
    assert.deepEqual(names(laptop), [], 'before: the morning copies came back here — and an edit typed into one was written over the phone\'s at the retry');
    assert.equal(laptop.seen.waiting, true, 'the dashboard says they come back once the account answers');
    await laptop.timers.fire(); // the pause (both flagged), and a retry that still cannot read
    assert.deepEqual([cloud.resumes('u').orig_a.name, cloud.resumes('u').orig_a.deleted], ['Edited on the phone', true]);
    assert.equal(laptop.seen.status, 'error', 'says it will retry');

    cloud.fail.read = null;
    await laptop.timers.fire(); // the retry gets through: the restore asks again
    await laptop.timers.fire();
    assert.deepEqual(names(laptop).toSorted(), ['B', 'Edited on the phone'], 'before: only the edited morning copy was left');
    assert.deepEqual([cloud.resumes('u').orig_a.name, cloud.resumes('u').orig_a.deleted, cloud.resumes('u').orig_b.deleted], ['Edited on the phone', undefined, undefined]);
    assert.deepEqual([laptop.seen.status, laptop.seen.waiting], ['synced', false]);
  });

  it('no answer within the time allowed: nothing comes back, nothing is sent', async () => {
    const { cloud, laptop } = await morning();
    cloud.hold.read = new Promise(() => {}); // the connection hangs
    await laptop.remove('orig_a');
    await laptop.timers.fire(); // the pause, and the 5 s the restore waits for the cloud
    await laptop.timers.fire();
    assert.deepEqual(names(laptop), [], 'before: the morning copy');
    assert.equal(cloud.resumes('u').orig_a.name, 'Edited on the phone', 'before: overwritten with the morning copy');
  });
});

describe('a build with no cloud (the e2e build; a clone without Firebase config)', () => {
  it('this browser\'s list is the whole list: the original comes back at once from its copy', async () => {
    const laptop = page(null, { resumes: [orig('orig_a', 7, { name: 'Mine' }), cv('resume_b')] });
    laptop.sync.start(OWNER);
    await settle();
    await laptop.remove('orig_a');
    await settle();
    assert.deepEqual([names(laptop), laptop.seen.waiting], [['resume_b', 'Mine'], false], 'nothing to wait for');
  });
});

describe('the restore waits for the account\'s list (R4-2)', () => {
  it('an original deleted while the first sync still reads the account comes back as the cloud has it', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_a')]: orig('orig_a', 20, { name: 'Edited on the phone' }), [resumePath('u', 'resume_b')]: cv('resume_b') });
    const laptop = page(cloud, { resumes: [orig('orig_a', 7, { name: 'Morning A' }), cv('resume_b')] });
    const read = deferred();
    cloud.hold.read = read.promise;
    laptop.sync.start(OWNER);
    await settle();
    await laptop.remove('orig_a');
    await settle();
    assert.deepEqual(names(laptop), ['resume_b'], 'nothing comes back before the account is known');
    cloud.hold.read = null;
    read.resolve();
    await settle();
    await laptop.timers.fire();
    assert.deepEqual(names(laptop).toSorted(), ['Edited on the phone', 'resume_b'], 'the phone\'s edit, never the morning copy');
    assert.equal(cloud.resumes('u').orig_a.name, 'Edited on the phone');
  });
});

describe('a restore forgets the deletion it undoes', () => {
  it('so the next first sync does not delete the original put back', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_a')]: orig('orig_a', 7, { name: 'Mine' }) });
    const laptop = page(cloud, { resumes: [orig('orig_a', 7, { name: 'Mine' })] });
    laptop.sync.start(OWNER);
    await settle();
    await laptop.remove('orig_a'); // the last original: it comes back at once
    await settle();
    await laptop.timers.fire();
    assert.deepEqual([names(laptop), laptop.store.state.deletedIds], [['Mine'], []]);
    laptop.sync.start(OWNER); // back online: a first sync
    await settle();
    assert.equal(cloud.resumes('u').orig_a.deleted, undefined, 'a kept deletion would flag it: the copy put back has the version deleted');
    assert.deepEqual(names(laptop), ['Mine']);
  });
});

describe('the status while a first sync is owed', () => {
  it('a flush answered after the cloud stopped answering does not say "synced"', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    p.sync.start(OWNER);
    await settle();
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    await p.change({ resumes: [cv('resume_a', 2, { name: 'Renamed' })] });
    await p.timers.fire(); // sent; the server has not answered
    cloud.hold.commit = null;
    cloud.fail.read = unavailable();
    assert.equal(await p.sync.readCloudCopies(['orig_a']), null);
    assert.equal(p.seen.status, 'error');
    answer.resolve();
    await settle();
    assert.equal(p.seen.status, 'error', 'still owed a first sync: the retry says when it is synced');
  });
});

describe('a first sync that fails for a moment is tried again', () => {
  it('the status says "will retry", and it does', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    const p = page(cloud, { resumes: [] });
    cloud.fail.read = unavailable();
    p.sync.start(OWNER);
    await settle();
    assert.equal(p.seen.status, 'error');
    cloud.fail.read = null;
    await p.timers.fire();
    assert.equal(p.seen.status, 'synced', 'before: never, until the browser went offline and online again, or a reload');
    assert.deepEqual(p.store.state.resumes.map((r) => r.id), ['resume_a']);
  });
});

describe('a restored copy keeps its own time (R4-4)', () => {
  it('so a newer copy of it on another device wins the sync\'s merge', () => {
    const [restored] = demo.buildRestore(new Map([['orig_a', orig('orig_a', 7, { name: 'Morning A' })]]), 1000);
    const phone = orig('orig_a', 20, { name: 'Edited on the phone' });
    assert.equal(merge.mergeResumeLists([phone], [restored], new Set())[0].name, 'Edited on the phone', 'the phone\'s edit wins on the phone');
    assert.equal(merge.mergeResumeLists([restored], [phone], new Set())[0].name, 'Edited on the phone', 'and on the laptop');
  });
});
