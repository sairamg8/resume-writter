// R2-148: a résumé deleted anywhere takes its public copy (Share a public link, public/{shareId})
// with it. The Dashboard's Delete took the copy down only on the device that deleted, signed in and
// online; a résumé deleted on another device, or offline, kept its copy public for good — its share
// panel was gone with it, so nothing was left to unpublish it. Now the cloud sync takes down, after
// each first sync, the copies of the résumés on the account's deletion list and of those its batch
// removed. Run as the app runs it: the engine, its Firestore calls, publicLink.js's calls and the
// store's own updaters over one fake Firestore (tests/pdf/fake-firestore.mjs, which applies
// firestore.rules) shared by two pages. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';
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
const page = (cloud, state, { net = { on: true } } = {}) => syncPage(mods, cloud, state, {
  online: () => net.on, publicLinks: link.publicIo(cloud.fs, cloud.db),
});
const signIn = async (p) => { p.sync.start(USER); await settle(); await settle(); };

/** An account with X and Y in the cloud, both published by the laptop; the rules apply. */
async function published() {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X), [resumePath('u', Y)]: cv(Y) });
  cloud.auth = 'u';
  const io = link.publicIo(cloud.fs, cloud.db);
  const x = await io.publish('u', cv(X));
  const y = await io.publish('u', cv(Y));
  return { cloud, io, x: x.shareId, y: y.shareId };
}

describe('a résumé deleted anywhere takes its public copy with it (R2-148)', () => {
  it('deleted on the phone: the laptop\'s next sync takes its copy down; the other résumé\'s stays', async () => {
    const { cloud, io, x, y } = await published();
    const laptop = page(cloud, { resumes: [cv(X), cv(Y)] });
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] });
    await signIn(laptop);
    await signIn(phone);
    assert.ok(cloud.doc(`public/${x}`), 'published before the deletion');

    // The phone's Delete, with no Dashboard to unpublish (another device, an older build): the
    // sync sends the deletion only.
    await phone.remove(X);
    await phone.timers.fire();
    assert.deepEqual(listed(cloud), [X]);

    const laptopAgain = page(cloud, stored(laptop));
    await signIn(laptopAgain);
    assert.equal(cloud.doc(`public/${x}`), undefined, 'before: the deleted résumé stayed public for good');
    assert.equal(cloud.doc(`users/u/shares/${X}`), undefined, 'its record of the link goes with it');
    cloud.auth = null;
    assert.equal(await io.readPublic(x), null, 'signed out, the link finds nothing');
    assert.equal((await io.readPublic(y)).personal.name, 'Owner of resume_y', 'a résumé still there keeps its copy');
    cloud.auth = 'u';
    assert.deepEqual(cloud.doc(`users/u/shares/${Y}`)?.shareId, y);
    assert.equal(laptopAgain.seen.status, 'synced');
  });

  it('deleted offline: the deleting device\'s own sync, back online, takes the copy down with the deletion', async () => {
    const { cloud, x, y } = await published();
    const net = { on: true };
    const phone = page(cloud, { resumes: [cv(X), cv(Y)] }, { net });
    await signIn(phone);
    net.on = false;
    phone.sync.start(USER); // useCloudSync's effect on the offline event
    await phone.remove(X);
    await phone.timers.fire();
    assert.ok(cloud.doc(`public/${x}`), 'offline, nothing reached the cloud');

    net.on = true;
    await signIn(phone);
    assert.deepEqual(listed(cloud), [X], 'the deletion is sent');
    assert.equal(cloud.doc(`public/${x}`), undefined, 'and its copy is taken down');
    assert.equal(cloud.doc(`users/u/shares/${X}`), undefined);
    assert.ok(cloud.doc(`public/${y}`), 'the other copy stays');
  });

  it('a deletion made offline that a later edit elsewhere wins over (R8-0): the résumé comes back, and keeps its copy', async () => {
    const { cloud, x } = await published();
    // The laptop deleted X offline when its copy dated from 1; the phone edited X at 50 since.
    cloud.data.set(resumePath('u', X), cv(X, 50));
    const laptop = page(cloud, { resumes: [cv(Y)], deletedIds: [X], deletedInfo: { [X]: { version: 1, at: 1 } } });
    await signIn(laptop);
    assert.deepEqual(laptop.store.state.resumes.map((r) => r.id).toSorted(), [X, Y], 'the edit wins: X is back');
    assert.deepEqual(listed(cloud), []);
    assert.ok(cloud.doc(`public/${x}`), 'a résumé still there keeps its copy');
    assert.ok(cloud.doc(`users/u/shares/${X}`));
  });

  it('publicIo.unpublishDeleted takes down only the listed résumés\' copies, and nothing when none is published', async () => {
    const { cloud, io, x, y } = await published();
    assert.deepEqual(await io.unpublishDeleted('u', []), [], 'no deletion: nothing read');
    assert.deepEqual(await io.unpublishDeleted('u', ['resume_never_published', X]), [X]);
    assert.equal(cloud.doc(`public/${x}`), undefined);
    assert.ok(cloud.doc(`public/${y}`));
    assert.deepEqual(await io.unpublishDeleted('u', [X]), [], 'already taken down: nothing to do');
  });
});
