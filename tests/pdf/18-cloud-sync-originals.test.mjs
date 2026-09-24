// A demo account's originals deleted for good — "Stop keeping", then Delete — across devices, as
// the app runs it: the engine, its Firestore calls, the store's updaters and the demo restore
// (src/utils/demoRestore.js, run after each change as useDemoSeed runs it) over a fake Firestore.
// A demo account flags an original it deletes and lists everything else, so an id on the
// account's deletion list was deleted for good: no restore on any device brings it back.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
let seedRules;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  seedRules = await loadModule('/src/utils/demoSeed.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, template: 'classic', ...extra });
/** One of a demo account's originals ("Keep as my original", src/utils/demoSeed.js). */
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });
const OWNER = { uid: 'u', email: 'owner@example.com' };
const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email, demo: { accounts: [OWNER.email], now: () => 1000 } });
const signIn = async (p) => { p.sync.start(OWNER); await settle(); };
const ids = (p) => p.store.state.resumes.map((r) => r.id).toSorted();
const listed = (cloud) => cloud.doc(listPath('u'))?.ids ?? [];
/** "Stop keeping" on `id`, then Delete, each sent after its pause — the delete prompt's advice. */
async function deleteForGood(p, id, at) {
  await p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? seedRules.withKeep(r, false, at) : r)) });
  await p.timers.fire();
  await p.remove(id);
  await p.timers.fire();
}

describe('an original deleted for good stays deleted on every device (V2OWNER-DATA-0)', () => {
  it('a laptop that last synced yesterday does not bring it back', async () => {
    const yesterday = [orig('orig_x', 5, { name: 'X' }), cv('resume_b')];
    const cloud = fakeFirestore({ [resumePath('u', 'orig_x')]: yesterday[0], [resumePath('u', 'resume_b')]: yesterday[1] });
    const phone = page(cloud, { resumes: yesterday });
    await signIn(phone);
    await deleteForGood(phone, 'orig_x', 10);
    assert.deepEqual([Object.keys(cloud.resumes('u')), listed(cloud)], [['resume_b'], ['orig_x']]);

    const laptop = page(cloud, { resumes: yesterday });
    await signIn(laptop);
    await laptop.timers.fire();
    assert.deepEqual(ids(laptop), ['resume_b'], 'before: the laptop\'s kept copy came back');
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b'], 'before: written back to the cloud');
    assert.deepEqual(listed(cloud), ['orig_x'], 'before: taken off the list, so back on every device');
  });

  it('a tab left open since before the deletion does not bring it back with the originals it restores', async () => {
    // X was deleted (flagged) a while ago; the laptop's tab synced then, so it knows X's kept copy.
    const cloud = fakeFirestore({
      [resumePath('u', 'orig_x')]: orig('orig_x', 5, { name: 'X', deleted: true }),
      [resumePath('u', 'orig_y')]: orig('orig_y', 5, { name: 'Y' }), [resumePath('u', 'resume_b')]: cv('resume_b'),
    });
    const laptop = page(cloud, { resumes: [orig('orig_y', 5, { name: 'Y' }), cv('resume_b')] });
    await signIn(laptop);
    // The phone deletes Y: none left there, so X and Y come back; then X is deleted for good.
    const phone = page(cloud, { resumes: [] });
    await signIn(phone);
    await phone.remove('orig_y');
    await settle();
    await phone.timers.fire();
    assert.deepEqual(ids(phone), ['orig_x', 'orig_y', 'resume_b']);
    await deleteForGood(phone, 'orig_x', 10);

    await laptop.remove('orig_y'); // the laptop's only original: the originals come back
    await settle();
    await laptop.timers.fire();
    assert.deepEqual(ids(laptop), ['orig_y', 'resume_b'], 'before: X came back too, from the tab\'s kept copy');
    assert.equal(cloud.resumes('u').orig_x, undefined, 'before: written back whole, kept, while still listed');
    assert.deepEqual(listed(cloud), ['orig_x']);
  });

  it('an original a tab restored just before another device deleted it for good stays deleted: a restore is no edit (R2-029)', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'orig_x')]: orig('orig_x', 5, { name: 'X', deleted: true }),
      [resumePath('u', 'orig_y')]: orig('orig_y', 5, { name: 'Y' }), [resumePath('u', 'resume_b')]: cv('resume_b'),
    });
    const laptop = page(cloud, { resumes: [orig('orig_y', 5, { name: 'Y' }), cv('resume_b')] });
    await signIn(laptop);
    const phone = page(cloud, { resumes: [] });
    await signIn(phone);
    await phone.remove('orig_y');
    await settle();
    await phone.timers.fire();
    // The laptop restores X and Y (the list does not hold X yet); its flush waits for the pause.
    await laptop.remove('orig_y');
    await settle();
    assert.deepEqual(ids(laptop), ['orig_x', 'orig_y', 'resume_b']);
    await deleteForGood(phone, 'orig_x', 10);
    await laptop.timers.fire();
    assert.deepEqual(listed(cloud), ['orig_x'], 'the restore\'s copy took X off the list: back on every device');
    const fresh = page(cloud, { resumes: [] });
    await signIn(fresh);
    assert.ok(!ids(fresh).includes('orig_x'));
  });

  it('a stale tab deleting an original another device stopped keeping does not mark it kept again (V2OWNER-DATA-2)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_x')]: orig('orig_x', 5, { name: 'X' }), [resumePath('u', 'orig_y')]: orig('orig_y', 5, { name: 'Y' }) });
    const laptop = page(cloud, { resumes: [orig('orig_x', 5, { name: 'X' }), orig('orig_y', 5, { name: 'Y' })] });
    await signIn(laptop);
    // The phone: "Stop keeping" on X, and an edit.
    cloud.data.set(resumePath('u', 'orig_x'), cv('orig_x', 20, { name: 'X, edited, not kept' }));
    await laptop.remove('orig_x'); // the laptop still shows it as an original
    await laptop.timers.fire();
    const { name, keep, deleted } = cloud.resumes('u').orig_x;
    // Deleted from a copy older than the phone's edit, it is not sent at all (R2-004): the edit
    // stays, as a deletion made offline already did at a first sync (R8-0), and comes back here.
    assert.deepEqual([name, keep, deleted], ['X, edited, not kept', undefined, undefined], 'before: keep: true written over the phone\'s "Stop keeping"');
    await settle();
    assert.equal(laptop.store.state.resumes.find((r) => r.id === 'orig_x')?.name, 'X, edited, not kept');
    const fresh = page(cloud, { resumes: [] });
    await signIn(fresh);
    assert.deepEqual(fresh.seen.account.cloudOriginals.map((r) => r.id), ['orig_y'], 'before: X was an original again, for the next restore');
  });

  it('a kept copy written back after the deletion (a stale device\'s race) is no original of the account', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'orig_x')]: orig('orig_x', 5, { name: 'X' }), [resumePath('u', 'orig_y')]: orig('orig_y', 5, { name: 'Y' }),
      [listPath('u')]: { ids: ['orig_x'] },
    });
    const device = page(cloud, { resumes: [] });
    await signIn(device);
    assert.deepEqual(device.seen.account.cloudOriginals.map((r) => r.id), ['orig_y'], 'before: [orig_x, orig_y]');
    await device.remove('orig_y');
    await settle();
    await device.timers.fire();
    assert.deepEqual(ids(device), ['orig_y'], 'before: X came back');
    assert.deepEqual(listed(cloud), ['orig_x'], 'before: taken off the list — back on every device');
  });
});

// The dev server's import of the owner's résumé from the private file (vite-plugin-owner-resume.js,
// demoSeed.privateOriginal): once, as the account's original, and never after it was deleted for
// good — which a reload or another browser learns only from the cloud's deletion list
// (account.cloudDeleted: the store forgot the deletion once a flush sent it).
describe('the dev import of the owner\'s private résumé (V2OWNER-DATA-1)', () => {
  const FILE = { name: 'Mine', template: 'classic', settings: {}, personal: { name: 'Real Name', email: OWNER.email }, sections: [], coverLetter: {} };
  const devPage = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email, demo: { accounts: [OWNER.email], ownerResume: FILE, now: () => 1000 } });

  it('an account with no original gets it, and the cloud has it as the account\'s original', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = devPage(cloud, { resumes: [] });
    await signIn(p);
    await p.timers.fire();
    assert.deepEqual(ids(p), ['original_private', 'resume_b']);
    const { name, keep } = cloud.resumes('u').original_private;
    assert.deepEqual([name, keep], ['Mine', true]);
  });

  it('deleted for good, it is not imported again on a reload or in another browser', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b') });
    const p = devPage(cloud, { resumes: [] });
    await signIn(p);
    await p.timers.fire();
    await deleteForGood(p, 'original_private', 2000);
    assert.deepEqual([p.store.state.deletedIds, listed(cloud)], [[], ['original_private']], 'sent, so this browser forgot it');

    for (const [label, state] of [['a reload', p.store.state], ['another browser', { resumes: [] }]]) {
      const next = devPage(cloud, state);
      await signIn(next);
      await next.timers.fire();
      assert.deepEqual(next.seen.account.cloudDeleted, ['original_private'], label);
      assert.deepEqual(ids(next), ['resume_b'], `${label}: imported again`);
      assert.equal(cloud.resumes('u').original_private, undefined, label);
    }
  });

  it('an original deleted for good elsewhere is none the account has: the file comes in', async () => {
    const cloud = fakeFirestore({ [listPath('u')]: { ids: ['orig_x'] } });
    const laptop = devPage(cloud, { resumes: [orig('orig_x', 5, { name: 'X' })] }); // yesterday's kept copy
    await signIn(laptop);
    await laptop.timers.fire();
    assert.deepEqual(ids(laptop), ['original_private'], 'not X, and the file since the account has no original');
  });
});
