// A résumé deleted on one device and edited on another that had not heard of the deletion (R2-029),
// as the app runs it: the engine, its Firestore calls and the store's own updaters over one fake
// Firestore shared by two pages. Until then the edit was written back under the deleted id while
// the id stayed on the account's deletion list: every device left the résumé out from then on —
// the editing one too, at its next reload — and its content stayed in Firestore for good, where
// nothing would ever show or remove it. Now an edit the deleting device never saw wins, as an edit
// made later already did over a deletion made offline (R8-0): the résumé comes back on every
// device, and its id comes off the deletion list. A copy nobody edited since still goes.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';
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
const page = (cloud, state, { net = { on: true }, isDemo = () => false } = {}) => syncPage(mods, cloud, state, { online: () => net.on, isDemo });
const signIn = async (p) => { p.sync.start(USER); await settle(); };
const edit = async (p, id, fields, updatedAt, { flush = true } = {}) => {
  await p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, ...fields, updatedAt } : r)) });
  if (flush) await p.timers.fire();
};
const shape = (list) => list.map(({ name, summary }) => `${name} | ${summary}`).toSorted();
const cloudShape = (cloud) => shape(Object.values(cloud.resumes('u')));
const listed = (cloud) => cloud.doc(listPath('u'))?.ids ?? [];
/** What localStorage kept of a page's store: a reload starts from it. */
const stored = (p) => JSON.parse(JSON.stringify(p.store.state));

/** Both pages signed in with X and Y; the phone then deletes X, and the deletion is sent. */
async function deletedOnPhone({ net } = {}) {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X), [resumePath('u', Y)]: cv(Y) });
  const laptop = page(cloud, { resumes: [cv(X), cv(Y)] }, { net });
  const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
  await signIn(laptop);
  await signIn(phone);
  return { cloud, laptop, phone };
}
async function phoneDeletes({ cloud, phone }) {
  await phone.remove(X);
  await phone.timers.fire();
  assert.deepEqual([cloudShape(cloud), listed(cloud)], [['resume_y | v1'], [X]]);
}

describe('an edit the deleting device never saw is kept (R2-029)', () => {
  it('a page left open edits X after the phone deleted it: X comes back everywhere, off the deletion list', async () => {
    const devices = await deletedOnPhone();
    const { cloud, laptop, phone } = devices;
    await phoneDeletes(devices);
    await edit(laptop, X, { summary: 'LAPTOP EDIT' }, 20);
    assert.deepEqual(cloudShape(cloud), ['resume_x | LAPTOP EDIT', 'resume_y | v1']);
    assert.deepEqual(listed(cloud), [], 'before: [resume_x] — every device then left the edited copy out');
    assert.equal(laptop.seen.status, 'synced');

    const laptopAgain = page(cloud, stored(laptop));
    await signIn(laptopAgain);
    assert.deepEqual(shape(laptopAgain.store.state.resumes), ['resume_x | LAPTOP EDIT', 'resume_y | v1'], 'before: X and the edit vanished at the reload');
    const phoneAgain = page(cloud, stored(phone));
    await signIn(phoneAgain);
    assert.deepEqual(shape(phoneAgain.store.state.resumes), ['resume_x | LAPTOP EDIT', 'resume_y | v1']);
  });

  it('an edit made offline, sent once back online in the same visit', async () => {
    const net = { on: true };
    const devices = await deletedOnPhone({ net });
    const { cloud, laptop } = devices;
    net.on = false;
    laptop.sync.start(USER); // useCloudSync's effect on the offline event
    await edit(laptop, X, { summary: 'EDITED OFFLINE' }, 20, { flush: false });
    await phoneDeletes(devices);
    net.on = true;
    await signIn(laptop);
    await laptop.timers.fire();
    assert.deepEqual(shape(laptop.store.state.resumes), ['resume_x | EDITED OFFLINE', 'resume_y | v1'], 'before: the offline edit was dropped');
    assert.deepEqual([cloudShape(cloud), listed(cloud)], [['resume_x | EDITED OFFLINE', 'resume_y | v1'], []]);
  });

  it('an edit made offline, then the page reloaded: the store remembers the cloud\'s copy it came from', async () => {
    const net = { on: true };
    const devices = await deletedOnPhone({ net });
    const { cloud, laptop } = devices;
    net.on = false;
    laptop.sync.start(USER);
    await edit(laptop, X, { summary: 'EDITED OFFLINE' }, 20, { flush: false });
    await phoneDeletes(devices);
    net.on = true;
    const reloaded = page(cloud, stored(laptop));
    await signIn(reloaded);
    assert.deepEqual(shape(reloaded.store.state.resumes), ['resume_x | EDITED OFFLINE', 'resume_y | v1'], 'before: the offline edit was dropped');
    assert.deepEqual([cloudShape(cloud), listed(cloud)], [['resume_x | EDITED OFFLINE', 'resume_y | v1'], []]);
  });

  it('an offline edit too large for a document is held: its id stays listed until the copy goes, and the account says so', async () => {
    const net = { on: true };
    const devices = await deletedOnPhone({ net });
    const { cloud, laptop } = devices;
    net.on = false;
    laptop.sync.start(USER);
    await edit(laptop, X, { summary: 'S'.repeat(1_100_000) }, 20, { flush: false });
    await phoneDeletes(devices);
    net.on = true;
    const reloaded = page(cloud, stored(laptop));
    await signIn(reloaded);
    assert.deepEqual([Object.keys(cloud.resumes('u')), listed(cloud)], [[Y], [X]], 'taken off the list without its copy');
    assert.deepEqual(reloaded.seen.account.cloudDeleted, [X], 'the account read as if the list no longer held it');
    assert.equal(reloaded.seen.status, 'stopped');
    // Made smaller: the edit goes, and comes off the list with it.
    await edit(reloaded, X, { summary: 'EDITED OFFLINE' }, 21);
    assert.deepEqual([cloudShape(cloud), listed(cloud)], [['resume_x | EDITED OFFLINE', 'resume_y | v1'], []]);
  });

  it('a listed résumé an older build wrote back after the deletion is shown again, not kept out of sight in Firestore', async () => {
    // The state R2-029 left behind: the stale page's edit written under the listed id.
    const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X, 20, { summary: 'LAPTOP EDIT' }), [resumePath('u', Y)]: cv(Y), [listPath('u')]: { ids: [X] } });
    // The laptop that wrote it: its store knows that copy as the cloud's.
    const laptop = page(cloud, { resumes: [cv(X, 20, { summary: 'LAPTOP EDIT' }), cv(Y)], syncedUid: 'u', cloudVersions: { [X]: 20, [Y]: 1 } });
    await signIn(laptop);
    assert.deepEqual(shape(laptop.store.state.resumes), ['resume_x | LAPTOP EDIT', 'resume_y | v1'], 'before: gone at the reload');
    assert.deepEqual(listed(cloud), []);
    const phone = page(cloud, { resumes: [cv(Y)], syncedUid: 'u', cloudVersions: { [Y]: 1 } });
    await signIn(phone);
    assert.deepEqual(shape(phone.store.state.resumes), ['resume_x | LAPTOP EDIT', 'resume_y | v1']);
  });
});

describe('a deletion still reaches a copy nobody edited (R2-029 guards)', () => {
  it('the stale page reloads without having touched X: X goes, and stays deleted', async () => {
    const devices = await deletedOnPhone();
    const { cloud, laptop } = devices;
    await phoneDeletes(devices);
    await edit(laptop, Y, { summary: 'Y EDIT' }, 20);
    const reloaded = page(cloud, stored(laptop));
    await signIn(reloaded);
    assert.deepEqual(shape(reloaded.store.state.resumes), ['resume_y | Y EDIT']);
    assert.deepEqual([cloudShape(cloud), listed(cloud)], [['resume_y | Y EDIT'], [X]]);
  });

  it('a copy the store holds from before it knew the cloud\'s versions is left out, as before', async () => {
    const cloud = fakeFirestore({ [resumePath('u', Y)]: cv(Y), [listPath('u')]: { ids: [X] } });
    const laptop = page(cloud, { resumes: [cv(X, 20), cv(Y)] });
    await signIn(laptop);
    assert.deepEqual(shape(laptop.store.state.resumes), ['resume_y | v1']);
    assert.deepEqual([Object.keys(cloud.resumes('u')), listed(cloud)], [[Y], [X]]);
  });

  it('a demo account\'s original written back after it was deleted for good stays deleted, and its copy leaves the cloud', async () => {
    const orig = cv('orig_x', 5, { keep: true });
    const cloud = fakeFirestore({ [resumePath('u', 'orig_x')]: orig, [resumePath('u', Y)]: cv(Y), [listPath('u')]: { ids: ['orig_x'] } });
    const device = page(cloud, { resumes: [] }, { isDemo: () => true });
    await signIn(device);
    assert.deepEqual(shape(device.store.state.resumes), ['resume_y | v1']);
    assert.deepEqual([Object.keys(cloud.resumes('u')), listed(cloud)], [[Y], ['orig_x']], 'before: its content stayed in Firestore for good');
  });
});
