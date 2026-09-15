// A demo account's originals deleted for good — "Stop keeping", then Delete — across devices, as
// the app runs it: the engine, its Firestore calls, the store's updaters and the demo restore
// (src/utils/demoRestore.js, run after each change as useDemoSeed runs it) over a fake Firestore.
// A demo account flags an original it deletes and lists everything else, so an id on the
// account's deletion list was deleted for good: no restore on any device brings it back.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';

let mods;
let seedRules;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  seedRules = await loadModule('/src/utils/demoSeed.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, template: 'classic', ...extra });
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
