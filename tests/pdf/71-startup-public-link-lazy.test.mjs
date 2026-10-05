// The public link's Firestore calls load publicLink.js at their first call, not at start-up (R2-142):
// the Dashboard (unpublish on delete) and the cloud sync (the copy of a résumé deleted elsewhere) held it
// on the start-up path, which went over its 1.1 MB cap (tests/pdf/71-startup-chunks). lazyPublicIo
// (src/utils/firebasePublicIo.js) stands in for publicIo with the same calls, each async as publicIo's
// are: here every one, over the stand-in Firestore, does what publicIo's own does. A load of the module
// that fails (offline, a file gone after a deploy) fails that call as a refused call does — every caller
// catches it so — and is not kept: the next call loads it again (review of 38e7b70e: untested). And the
// module really is lazy: nothing the app's entry imports statically reaches it, so a static import added
// later (5.65 kB back on a start-up path within a few kB of its cap) fails here, by name, not only as a
// size in 71-startup-chunks.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { fakeFirestore, resumePath } from './fake-firestore.mjs';
import { startupModules } from './startup-modules.mjs';

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

  it('a load of publicLink.js that fails fails those calls as a refusal does, is not kept, and the next call loads it again', async () => {
    const c = cloudWith('resume_a');
    let loads = 0;
    let fails = true;
    const loadLink = () => {
      loads += 1;
      return fails ? Promise.reject(new TypeError('Failed to fetch dynamically imported module')) : Promise.resolve(link);
    };
    const io = lazy.lazyPublicIo(c.fs, c.db, loadLink);
    // Two calls while the one load is on its way: both fail, as a Firestore refusal does (a rejected
    // promise, never a throw), so every caller's own catch takes it.
    const calls = [io.readShare(UID, 'resume_a'), io.unpublishDeleted(UID, ['resume_a'])];
    for (const call of calls) await assert.rejects(call, /dynamically imported module/);
    assert.equal(loads, 1, 'one load for the calls that waited on it');
    assert.deepEqual(publicDocs(c), [], 'nothing was written');

    fails = false; // back online
    const a = await io.publish(UID, cv('resume_a'));
    assert.ok(a?.shareId, 'the next call loads the module again (the failure was not kept) and works');
    assert.equal(loads, 2);
    assert.equal((await io.readShare(UID, 'resume_a'))?.shareId, a.shareId);
    assert.equal(loads, 2, 'a load that worked is kept');
  });
});

describe('publicLink.js is off the start-up path (R2-142)', () => {
  it('no module the entry imports statically reaches it; its callers there do, through lazyPublicIo', () => {
    const startup = startupModules();
    assert.ok(startup.has('src/index.css') && startup.has('src/pages/Dashboard.jsx'), 'the walk follows the entry\'s static imports');
    assert.ok(!startup.has('src/pages/Editor.jsx'), 'and not a dynamic import() (the editor is a lazy page)');
    assert.ok(startup.has('src/utils/firebasePublicIo.js') && startup.has('src/hooks/useCloudSync.js'), 'its callers are on the start-up path');
    assert.equal(startup.has('src/utils/publicLink.js'), false, 'publicLink.js is reached by a static import from the start-up path');
  });
});
