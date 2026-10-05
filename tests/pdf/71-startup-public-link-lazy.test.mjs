// The public link's Firestore calls load publicLink.js at their first call, not at start-up (R2-142):
// the Dashboard (unpublish on delete) and the cloud sync (the copy of a résumé deleted elsewhere) held it
// on the start-up path, which went over its 1.1 MB cap (tests/pdf/71-startup-chunks). lazyPublicIo
// (src/utils/firebasePublicIo.js) stands in for publicIo with the same calls, each async as publicIo's
// are: here every one, over the stand-in Firestore, does what publicIo's own does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore, resumePath } from './fake-firestore.mjs';

let link;
let lazy;
before(async () => {
  await setup();
  link = await loadModule('/src/utils/publicLink.js');
  lazy = await loadModule('/src/utils/firebasePublicIo.js');
});
after(teardown);

const UID = 'uid_owner';
const cv = (id, title = 'Designer') => Object.assign(resume({ personal: { name: 'Jordan Ellery', title } }), { id, updatedAt: 1 });
const cloudWith = (...ids) => fakeFirestore(Object.fromEntries(ids.map((id) => [resumePath(UID, id), cv(id)])));
const publicDocs = (c) => [...c.data.keys()].filter((p) => p.startsWith('public/')).sort();

describe('lazyPublicIo: publicIo\'s calls, publicLink.js loaded at the first (R2-142)', () => {
  it('has every call publicIo has, and nothing else', () => {
    const c = cloudWith();
    assert.deepEqual(Object.keys(lazy.lazyPublicIo(c.fs, c.db)).sort(), Object.keys(link.publicIo(c.fs, c.db)).sort());
  });

  it('publish, readShare, readPublic, unpublish, unpublishResume and unpublishDeleted do what publicIo\'s do', async () => {
    const c = cloudWith('resume_a', 'resume_b', 'resume_c');
    const io = lazy.lazyPublicIo(c.fs, c.db);
    const a = await io.publish(UID, cv('resume_a'));
    assert.ok(a?.shareId, 'published');
    assert.equal((await io.readShare(UID, 'resume_a'))?.shareId, a.shareId, 'the résumé\'s share record');
    assert.equal((await io.readPublic(a.shareId))?.personal?.name, 'Jordan Ellery', 'the public copy, for anyone');
    await io.unpublish(UID, 'resume_a', a.shareId);
    assert.equal(await io.readPublic(a.shareId), null, 'taken down');

    const b = await io.publish(UID, cv('resume_b'));
    const d = await io.publish(UID, cv('resume_c'));
    assert.deepEqual(publicDocs(c), [`public/${b.shareId}`, `public/${d.shareId}`].sort());
    assert.equal(await io.unpublishResume(UID, 'resume_b'), true, 'b\'s copy taken down');
    assert.deepEqual(await io.unpublishDeleted(UID, ['resume_c']), [], 'c is still in the account: its copy stays, as publicIo has it');
    c.data.delete(resumePath(UID, 'resume_c')); // deleted on another device
    assert.deepEqual(await io.unpublishDeleted(UID, ['resume_c']), ['resume_c'], 'deleted: its copy goes');
    assert.deepEqual(publicDocs(c), [], 'both copies taken down');
  });

  it('a call publicIo refuses is refused the same way (a promise that rejects)', async () => {
    const c = cloudWith('resume_a');
    c.fail.read = Object.assign(new Error('unavailable: refused'), { code: 'unavailable' });
    const io = lazy.lazyPublicIo(c.fs, c.db);
    await assert.rejects(io.readPublic('nope'), /refused/);
  });
});
