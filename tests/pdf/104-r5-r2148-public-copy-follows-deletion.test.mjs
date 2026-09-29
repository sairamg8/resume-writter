// R2-148: a résumé's public copy (Share a public link, public/{shareId}) never outlives the résumé.
// The Dashboard's Delete takes the copy down on the device that deletes, and since R2-148-a the next
// FIRST sync anywhere takes down the copies of the résumés on the account's deletion list. But a
// flush — the sync that sends a deletion while the page stays open — took nothing down: a résumé
// removed without the Dashboard's call (another tab's change, an older build), or whose own
// unpublish failed, stayed public until a reload, a sign-in or a tab shown again ran a first sync.
// Now the flush that deletes it takes its copy down too. The rest pins each other way a résumé
// goes: on a device that never had it, deleted with the sign-in lapsed, signed out before the flush,
// a takedown that fails (tried again at the next first sync) — and that a résumé still in the
// account keeps its copy. (Import only adds résumés, under new ids: it removes none.)
// Run as the app runs it: the engine, its Firestore calls, publicLink.js's calls and the store's own
// updaters over one fake Firestore (tests/pdf/fake-firestore.mjs, which applies firestore.rules).
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle, deferred } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
let link;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  link = await loadModule('/src/utils/publicLink.js');
});
after(teardown);

const cv = (id, updatedAt = 1) => ({
  id, name: id, updatedAt, dataVersion: DATA_VERSION, template: 'classic', settings: {},
  personal: { name: `Owner of ${id}`, title: 'Designer' }, sections: [],
});
const USER = { uid: 'u', email: 'someone@example.com' };
const X = 'resume_x';
const Y = 'resume_y';
const listed = (cloud) => cloud.doc(listPath('u'))?.ids ?? [];
/** What localStorage kept of a page's store: a reload starts from it. */
const stored = (p) => JSON.parse(JSON.stringify(p.store.state));
const page = (cloud, state, { net = { on: true }, publicLinks = link.publicIo(cloud.fs, cloud.db) } = {}) => syncPage(mods, cloud, state, {
  online: () => net.on, publicLinks,
});
const signIn = async (p) => { p.sync.start(USER); await settle(); await settle(); };

/** An account with X and Y in the cloud, both published; the rules apply. */
async function published() {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X), [resumePath('u', Y)]: cv(Y) });
  cloud.auth = 'u';
  const io = link.publicIo(cloud.fs, cloud.db);
  const x = await io.publish('u', cv(X));
  const y = await io.publish('u', cv(Y));
  return { cloud, io, x: x.shareId, y: y.shareId };
}

/** X's copy and its record are gone; Y's copy is still there. */
function onlyXDown(cloud, x, y, why) {
  assert.equal(cloud.doc(`public/${x}`), undefined, why);
  assert.equal(cloud.doc(`users/u/shares/${X}`), undefined, 'its record of the link goes with it');
  assert.ok(cloud.doc(`public/${y}`), 'a résumé still there keeps its copy');
  assert.equal(cloud.doc(`users/u/shares/${Y}`)?.shareId, y);
}

describe('a résumé\'s public copy never outlives the résumé (R2-148)', () => {
  it('deleted with no call to unpublish (an older build\'s Delete): the flush that sends the deletion takes the copy down, no reload needed', async () => {
    const { cloud, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(phone);
    await phone.remove(X);
    await phone.timers.fire();
    await settle();
    assert.deepEqual(listed(cloud), [X], 'the deletion reached the cloud');
    onlyXDown(cloud, x, y, 'before: public until a reload or another device\'s first sync');
    assert.equal(phone.seen.status, 'synced');
  });

  it('deleted in another tab whose own unpublish failed: this tab\'s flush of the deletion takes the copy down', async () => {
    const { cloud, io, x, y } = await published();
    const laptop = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(laptop);
    // The other tab's Dashboard: its unpublish meets a blip and is only logged.
    cloud.fail.commit = Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });
    await assert.rejects(io.unpublishResume('u', X), /unavailable/);
    cloud.fail.commit = null;
    assert.ok(cloud.doc(`public/${x}`), 'still public after the failed unpublish');
    // Its store reaches this tab (the storage event): X is gone from the list.
    await laptop.change({ resumes: [cv(Y)] });
    await laptop.timers.fire();
    await settle();
    assert.deepEqual(listed(cloud), [X]);
    onlyXDown(cloud, x, y, 'before: public for as long as both tabs stayed open');
  });

  it('the flush\'s takedown fails: the next first sync tries it again, as the id stays on the deletion list', async () => {
    const { cloud, io, x, y } = await published();
    let fails = 1;
    const flaky = {
      ...io,
      unpublishDeleted: (...a) => (fails-- > 0 ? Promise.reject(new Error('blip')) : io.unpublishDeleted(...a)),
    };
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] }, { publicLinks: flaky });
    await signIn(phone);
    await phone.remove(X);
    await phone.timers.fire();
    await settle();
    assert.deepEqual(listed(cloud), [X]);
    assert.ok(cloud.doc(`public/${x}`), 'the takedown failed');

    const phoneAgain = page(cloud, stored(phone), { publicLinks: flaky });
    await signIn(phoneAgain);
    await settle();
    onlyXDown(cloud, x, y, 'the next first sync takes it down');
  });

  it('a device that never had the résumé: its first sync takes down the copy of one deleted elsewhere', async () => {
    const { cloud, x, y } = await published();
    // Deleted on a device whose build never unpublished: removed and listed, the copy left up.
    cloud.data.delete(resumePath('u', X));
    cloud.data.set(listPath('u'), { ids: [X] });
    const fresh = page(cloud, { resumes: [] });
    await signIn(fresh);
    await settle();
    assert.deepEqual(fresh.store.state.resumes.map((r) => r.id), [Y]);
    onlyXDown(cloud, x, y, 'a new device\'s first sync takes it down');
  });

  it('deleted while the sign-in had lapsed (the server refuses the account): the sync that later sends the deletion takes the copy down', async () => {
    const { cloud, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(phone);
    cloud.auth = null; // the server no longer knows who this is
    await phone.remove(X);
    await phone.timers.fire();
    await settle();
    assert.ok(cloud.doc(resumePath('u', X)), 'refused: the cloud still has X');
    assert.ok(cloud.doc(`public/${x}`), 'and its copy, while nothing can be written');

    cloud.auth = 'u';
    const phoneAgain = page(cloud, stored(phone));
    await signIn(phoneAgain);
    await settle();
    assert.deepEqual(listed(cloud), [X], 'the deletion waited, and is sent');
    assert.deepEqual(phoneAgain.store.state.resumes.map((r) => r.id), [Y]);
    onlyXDown(cloud, x, y, 'and the copy goes with it');
  });

  it('signed out before the flush: the deletion waits for the account\'s next sign-in, whose sync takes the copy down', async () => {
    const { cloud, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(phone);
    await phone.remove(X);
    phone.sync.start(null); // signed out within the pause before the flush
    await settle();
    await phone.timers.fire();
    assert.deepEqual(listed(cloud), [], 'nothing was sent signed out');
    assert.ok(cloud.doc(`public/${x}`));
    assert.deepEqual(phone.store.state.resumes, [], 'the account\'s list left this browser: nothing more to delete here');

    await signIn(phone);
    await settle();
    assert.deepEqual(listed(cloud), [X]);
    assert.deepEqual(phone.store.state.resumes.map((r) => r.id), [Y], 'X does not come back');
    onlyXDown(cloud, x, y, 'the copy goes with the deletion');
  });

  it('written back and published again elsewhere before the takedown runs (R2-029): the copy of the résumé the account holds again stays up', async () => {
    const { cloud, io, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] }, {
      // The phone's flush has deleted X; before its takedown runs, the laptop's edit the deletion
      // never saw writes X back and takes it off the list, and the laptop publishes X again.
      publicLinks: { ...io, unpublishDeleted: async (...a) => {
        cloud.data.set(resumePath('u', X), cv(X, 50));
        cloud.data.set(listPath('u'), { ids: [] });
        await io.publish('u', cv(X, 50));
        return io.unpublishDeleted(...a);
      } },
    });
    await signIn(phone);
    await phone.remove(X);
    await phone.timers.fire();
    await settle();
    assert.ok(cloud.doc(resumePath('u', X)), 'X is in the account again');
    assert.ok(cloud.doc(`public/${x}`), 'before: the takedown deleted the copy of a résumé the account holds');
    assert.equal(cloud.doc(`users/u/shares/${X}`)?.shareId, x);
    assert.ok(cloud.doc(`public/${y}`));
  });

  it('still gone, whatever copy a stale device wrote back: a listed résumé, or a flagged original, loses its copy', async () => {
    const { cloud, io, x, y } = await published();
    // Listed (deleted for good, V2OWNER-DATA-0) though a stale device wrote X back since.
    cloud.data.set(listPath('u'), { ids: [X] });
    // A demo account's original, flagged rather than removed.
    cloud.data.set(resumePath('u', Y), { ...cv(Y), deleted: true });
    assert.deepEqual((await io.unpublishDeleted('u', [X, Y])).toSorted(), [X, Y]);
    assert.equal(cloud.doc(`public/${x}`), undefined);
    assert.equal(cloud.doc(`public/${y}`), undefined);
  });

  it('the flush\'s answer comes after a sign-out: nothing is taken down under no account, and the next sign-in\'s first sync takes the copy down', async () => {
    const { cloud, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(phone);
    await phone.remove(X);
    const answer = deferred();
    cloud.hold.commit = answer.promise; // the server has the deletion; its answer is on its way
    await phone.timers.fire();
    phone.sync.start(null);
    await settle();
    cloud.hold.commit = null;
    answer.resolve();
    await settle();
    assert.deepEqual(listed(cloud), [X], 'the deletion reached the cloud');
    assert.ok(cloud.doc(`public/${x}`), 'signed out when the answer came: nothing taken down then');

    await signIn(phone);
    await settle();
    assert.deepEqual(phone.store.state.resumes.map((r) => r.id), [Y]);
    onlyXDown(cloud, x, y, 'the next sign-in\'s first sync takes it down');
  });

  it('a résumé still in the account keeps its copy: signing out, an edit\'s flush and a first sync take nothing down', async () => {
    const { cloud, x, y } = await published();
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(phone);
    await phone.change({ resumes: [cv(X, 5), cv(Y)] });
    await phone.timers.fire();
    await settle();
    phone.sync.start(null);
    await settle();
    await signIn(phone);
    await settle();
    assert.deepEqual(phone.store.state.resumes.map((r) => r.id).toSorted(), [X, Y]);
    assert.ok(cloud.doc(`public/${x}`));
    assert.ok(cloud.doc(`public/${y}`));
    assert.equal(cloud.doc(`users/u/shares/${X}`)?.shareId, x);
  });
});
