// A demo account's sample restore and the cloud (VM4-6, R4-4), as the app runs it: the engine,
// its Firestore calls and the store's own rules over a fake Firestore; the restore is built by
// the app's buildDemoRestore from the copies this browser knows, as useDemoSeed does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, resumePath, settle } from './fake-firestore.mjs';

let mods;
let demo;
let merge;
before(async () => {
  await setup();
  mods = {
    io: await loadModule('/src/utils/cloudSyncIo.js'),
    engine: await loadModule('/src/utils/cloudSyncEngine.js'),
    plan: await loadModule('/src/utils/cloudSyncPlan.js'),
  };
  demo = await loadModule('/src/utils/demoSeed.js');
  merge = await loadModule('/src/utils/syncMerge.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const OWNER = { uid: 'u', email: 'owner@example.com' };
const PRISTINE = [cv('demo_a', 0, { name: 'Sample A' })];
const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email });
const unavailable = () => Object.assign(new Error('Failed to get document from server.'), { code: 'unavailable' });

/**
 * The laptop's morning: it synced Sample A at 7. Then the phone edited it (20) and later lost
 * its copy; the laptop, on a bad connection, deletes the sample — flagged in the cloud — and has
 * none left, so the set comes back.
 */
async function morning() {
  const cloud = fakeFirestore({ [resumePath('u', 'demo_a')]: cv('demo_a', 7, { name: 'Morning A' }) });
  const laptop = page(cloud, { resumes: [cv('demo_a', 7, { name: 'Morning A' })] });
  laptop.sync.start(OWNER);
  await settle();
  cloud.data.set(resumePath('u', 'demo_a'), cv('demo_a', 20, { name: 'Edited on the phone' }));
  await laptop.remove('demo_a');
  await laptop.timers.fire();
  assert.equal(cloud.resumes('u').demo_a.deleted, true);
  return { cloud, laptop };
}

/** useDemoSeed's restore: the cloud's copies if it answers, else the ones this browser knows. */
async function restoreSamples(laptop, known) {
  const cloudCopies = await laptop.sync.readCloudDemo(['demo_a']);
  const seed = demo.rememberDemo(new Map(), known);
  demo.rememberDemo(seed, cloudCopies);
  await laptop.restore(demo.buildDemoRestore(PRISTINE, seed, 1000));
  return cloudCopies;
}

describe('a restore without the cloud\'s answer never overwrites the cloud (VM4-6)', () => {
  it('the read fails: the stale copy shows here, is not sent, and the next sync brings back the cloud\'s', async () => {
    const { cloud, laptop } = await morning();
    cloud.fail.read = unavailable();
    assert.equal(await restoreSamples(laptop, [cv('demo_a', 7, { name: 'Morning A' })]), null);
    assert.equal(laptop.store.state.resumes[0].name, 'Morning A', 'the set is back here at once');
    await laptop.timers.fire(); // the pause, and a retry that still cannot read
    assert.equal(cloud.resumes('u').demo_a.name, 'Edited on the phone', 'before: the morning copy was written over it');
    assert.equal(laptop.seen.status, 'error', 'says it will retry');

    cloud.fail.read = null;
    await laptop.timers.fire(); // the retry gets through
    assert.equal(laptop.seen.status, 'synced');
    assert.deepEqual(laptop.store.state.resumes, [], 'the stale restore goes: the cloud flags that version');
    const copies = await restoreSamples(laptop, []);
    assert.equal(copies[0].name, 'Edited on the phone');
    await laptop.timers.fire();
    assert.equal(laptop.store.state.resumes[0].name, 'Edited on the phone');
    assert.deepEqual([cloud.resumes('u').demo_a.name, cloud.resumes('u').demo_a.deleted], ['Edited on the phone', undefined]);
  });

  it('no answer within the time allowed: nothing is sent either', async () => {
    const { cloud, laptop } = await morning();
    cloud.hold.read = new Promise(() => {}); // the connection hangs
    const answer = laptop.sync.readCloudDemo(['demo_a']);
    await laptop.timers.fire(); // 5 s
    assert.equal(await answer, null);
    await laptop.restore(demo.buildDemoRestore(PRISTINE, new Map([['demo_a', cv('demo_a', 7, { name: 'Morning A' })]]), 1000));
    await laptop.timers.fire();
    assert.equal(cloud.resumes('u').demo_a.name, 'Edited on the phone', 'before: overwritten with the morning copy');
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
    const [restored] = demo.buildDemoRestore(PRISTINE, new Map([['demo_a', cv('demo_a', 7, { name: 'Morning A' })]]), 1000);
    const phone = cv('demo_a', 20, { name: 'Edited on the phone' });
    assert.equal(merge.mergeResumeLists([phone], [restored], new Set())[0].name, 'Edited on the phone', 'the phone\'s edit wins on the phone');
    assert.equal(merge.mergeResumeLists([restored], [phone], new Set())[0].name, 'Edited on the phone', 'and on the laptop');
  });
});
