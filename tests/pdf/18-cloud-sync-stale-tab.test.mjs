// A page left open while another device edits the same résumé (R2-004), as the app runs it: the
// engine, its Firestore calls and the store's own updaters over one fake Firestore shared by two
// pages — the laptop, whose tab stays open, and the phone. Until then the laptop's next change
// wrote its stale copy over the phone's later edit (a flush sets the whole résumé and read
// nothing), and a first sync kept whichever copy was newer: the other one's edit was gone on
// every device, with no word. Now a résumé changed on both sides since this browser last saw the
// cloud's copy keeps both: this browser's copy under its id, the other device's as
// "<name> (conflict copy)"; a deletion made from a stale copy is not sent, and the newer copy comes
// back; and a tab shown again reads the account, so its next edit starts from the newer copy.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle, deferred } from './fake-firestore.mjs';
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
const COPY = `${X} (conflict copy)`;
/** A page on its own clock (`clock.t`, ms), online while `net.on`. */
const page = (cloud, state, { clock = { t: 0 }, net = { on: true } } = {}) => syncPage(mods, cloud, state, { now: () => clock.t, online: () => net.on });
const signIn = async (p) => { p.sync.start(USER); await settle(); };
/** Change résumé `id` as an edit does; the pause's flush runs unless `flush` is false. */
const edit = async (p, id, fields, updatedAt, { flush = true } = {}) => {
  await p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, ...fields, updatedAt } : r)) });
  if (flush) await p.timers.fire();
};
const shape = (list) => list.map(({ name, summary }) => `${name} | ${summary}`).toSorted();
const cloudShape = (cloud) => shape(Object.values(cloud.resumes('u')));
/** Both pages start signed in with X as the cloud holds it. */
async function twoDevices(opts = {}) {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X) });
  const laptop = page(cloud, { resumes: [cv(X)] }, opts);
  const phone = page(cloud, { resumes: [cv(X)] });
  await signIn(laptop);
  await signIn(phone);
  await edit(phone, X, { summary: 'PHONE EDIT' }, 10);
  assert.equal(cloud.resumes('u')[X].summary, 'PHONE EDIT');
  return { cloud, laptop, phone };
}

describe('a page left open does not write its stale copy over another device\'s edit (R2-004)', () => {
  it('the laptop\'s next change keeps the phone\'s edit: both copies, on every device', async () => {
    const { cloud, laptop, phone } = await twoDevices();
    await edit(laptop, X, { name: 'renamed on laptop' }, 20);
    const both = ['renamed on laptop | v1', `${COPY} | PHONE EDIT`];
    assert.deepEqual(cloudShape(cloud), both, 'before: [\'renamed on laptop | v1\'] — the phone\'s edit gone everywhere');
    assert.deepEqual(shape(laptop.store.state.resumes), both, 'the laptop shows the phone\'s copy too');
    assert.equal(cloud.resumes('u')[X].name, 'renamed on laptop', 'the laptop\'s copy keeps the id: the editor open on it is not changed under the user');
    const reloaded = page(cloud, phone.store.state);
    await signIn(reloaded);
    assert.deepEqual(shape(reloaded.store.state.resumes), both, 'the phone after a reload');
    assert.equal(laptop.seen.status, 'synced');
  });

  it('a deletion made from the stale copy is not sent: the phone\'s edit stays, and comes back on the laptop', async () => {
    const { cloud, laptop } = await twoDevices();
    await laptop.remove(X);
    await laptop.timers.fire();
    assert.equal(cloud.resumes('u')[X]?.summary, 'PHONE EDIT', 'before: removed from the cloud');
    assert.equal(cloud.doc(listPath('u')), undefined, 'and not put on the deletion list');
    await settle();
    assert.deepEqual([shape(laptop.store.state.resumes), laptop.store.state.deletedIds], [[`${X} | PHONE EDIT`], []]);
  });

  it('an edit made offline in the same visit: the first sync back online keeps both copies', async () => {
    const net = { on: true };
    const { cloud, laptop } = await twoDevices({ net });
    net.on = false;
    laptop.sync.start(USER); // useCloudSync's effect on the offline event
    await edit(laptop, X, { name: 'edited offline' }, 20, { flush: false });
    net.on = true;
    await signIn(laptop);
    assert.deepEqual(cloudShape(cloud), ['edited offline | v1', `${COPY} | PHONE EDIT`], 'before: the newer copy won, the phone\'s edit gone');
    assert.deepEqual(shape(laptop.store.state.resumes), cloudShape(cloud));
  });

  it('an edit made offline, then the page reloaded: the store remembers the cloud\'s copy it came from', async () => {
    const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X) });
    const net = { on: true };
    const laptop = page(cloud, { resumes: [cv(X)] }, { net });
    await signIn(laptop);
    net.on = false;
    laptop.sync.start(USER);
    await edit(laptop, X, { name: 'edited offline' }, 20, { flush: false });
    const phone = page(cloud, { resumes: [cv(X)] });
    await signIn(phone);
    await edit(phone, X, { summary: 'PHONE EDIT' }, 10);
    const reloaded = page(cloud, JSON.parse(JSON.stringify(laptop.store.state))); // what localStorage kept
    await signIn(reloaded);
    assert.deepEqual(cloudShape(cloud), ['edited offline | v1', `${COPY} | PHONE EDIT`], 'before: the newer copy won');
  });
});

describe('no conflict copy without a conflict (R2-004)', () => {
  it('the laptop\'s own flushes one after another, the first not answered yet', async () => {
    const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X) });
    const laptop = page(cloud, { resumes: [cv(X)] });
    await signIn(laptop);
    const ack = deferred();
    cloud.hold.commit = ack.promise;
    await edit(laptop, X, { name: 'one' }, 2);
    await edit(laptop, X, { name: 'two' }, 3);
    ack.resolve();
    await settle();
    assert.deepEqual([cloudShape(cloud), laptop.seen.status], [['two | v1'], 'synced']);
  });

  it('another tab of this browser synced a newer copy, and this tab took it from storage', async () => {
    const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X) });
    const tabA = page(cloud, { resumes: [cv(X)] });
    const tabB = page(cloud, { resumes: [cv(X)] });
    await signIn(tabA);
    await signIn(tabB);
    await edit(tabA, X, { name: 'in tab A' }, 5);
    await tabB.change({ resumes: tabA.store.state.resumes }); // the storage event
    await tabB.timers.fire();
    await edit(tabB, X, { summary: 'in tab B' }, 6);
    assert.deepEqual(cloudShape(cloud), ['in tab A | in tab B']);
  });

  it('the phone edited another résumé: the laptop\'s edit of X is sent as it is', async () => {
    const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X), [resumePath('u', 'resume_y')]: cv('resume_y') });
    const laptop = page(cloud, { resumes: [cv(X), cv('resume_y')] });
    const phone = page(cloud, { resumes: [cv(X), cv('resume_y')] });
    await signIn(laptop);
    await signIn(phone);
    await edit(phone, 'resume_y', { summary: 'PHONE EDIT' }, 10);
    await edit(laptop, X, { name: 'renamed on laptop' }, 20);
    assert.deepEqual(cloudShape(cloud), ['renamed on laptop | v1', 'resume_y | PHONE EDIT']);
  });
});

describe('a tab shown again reads the account (R2-004)', () => {
  it('after a while away, the phone\'s edit is on the laptop before its next change', async () => {
    const clock = { t: 0 };
    const { cloud, laptop } = await twoDevices({ clock });
    clock.t = 60_000;
    laptop.sync.shown();
    await settle();
    assert.equal(laptop.store.state.resumes[0].summary, 'PHONE EDIT', 'before: the laptop showed its stale copy until a reload');
    await edit(laptop, X, { name: 'renamed on laptop' }, 20);
    assert.deepEqual(cloudShape(cloud), ['renamed on laptop | PHONE EDIT'], 'one résumé, both edits: no conflict copy');
  });

  it('shown again within moments: nothing is read', async () => {
    const clock = { t: 0 };
    const { cloud, laptop } = await twoDevices({ clock });
    const reads = cloud.reads.length;
    clock.t = 2_000;
    laptop.sync.shown();
    await settle();
    assert.equal(cloud.reads.length, reads);
  });
});
