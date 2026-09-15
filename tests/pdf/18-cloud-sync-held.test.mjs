// A résumé the cloud will not take holds back only itself (V2VF1S-0), as the app runs it: the
// engine, its Firestore calls, the store's updaters and the demo restore over a fake Firestore
// whose server refuses what each test says (`cloud.refuse`), with the timers fired by hand
// (src/utils/cloudSyncHeld.js). Until then one refused résumé — a photo over 1 MiB — stopped the
// whole sync, and every later change read the account and sent that résumé again.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';

let mods;
let heldMod;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  heldMod = await loadModule('/src/utils/cloudSyncHeld.js');
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, template: 'classic', ...extra });
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });
const USER = { uid: 'u', email: 'someone@example.com' };
const OWNER = { uid: 'u', email: 'owner@example.com' };
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQ';
const tooLarge = () => Object.assign(new Error('Document cannot be written because its size (1,100,123 bytes) exceeds the maximum allowed size of 1,048,576 bytes.'), { code: 'invalid-argument' });
const writes = (ops, id) => ops.some(([op, path]) => op === 'set' && path === resumePath('u', id));
/** How many batches the server was sent that write résumé A, refused or not. */
const triesOfA = (cloud) => [...cloud.commits, ...cloud.refused].filter((ops) => writes(ops, 'resume_a')).length;
/** The server refuses any batch that writes résumé A with a photo, whatever the reason. */
const refuseA = (cloud) => {
  cloud.refuse = (ops) => (ops.some(([op, path, v]) => op === 'set' && path === resumePath('u', 'resume_a') && v.photo) ? tooLarge() : null);
};
/** Change résumé `id` as an edit does; the pause's flush runs with `flush`. */
const edit = async (p, id, fields, updatedAt, { flush = true } = {}) => {
  await p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, ...fields, updatedAt } : r)) });
  if (flush) await p.timers.fire();
};
const names = (p) => p.store.state.resumes.map((r) => r.name);

describe('a résumé the server refuses holds back only itself (V2VF1S-0)', () => {
  it('every other résumé\'s edit still reaches the cloud — without reading the account or sending A again — and A goes once its photo is out', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    refuseA(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    await edit(p, 'resume_a', { name: 'With a photo', photo: PHOTO }, 2);
    assert.deepEqual([p.seen.status, p.timers.count], ['stopped', 0]);
    const [reads, tries] = [cloud.reads.length, triesOfA(cloud)];
    for (let i = 0; i < 3; i += 1) await edit(p, 'resume_b', { name: `B edit ${i}` }, 3 + i);
    assert.equal(cloud.resumes('u').resume_b.name, 'B edit 2', 'before: B\'s edits never reached the cloud while A was refused');
    assert.deepEqual([cloud.reads.length - reads, triesOfA(cloud) - tries], [0, 0], 'before: each pause read the whole account and sent A again');
    assert.deepEqual([p.seen.status, p.seen.held.map((r) => r.name)], ['stopped', ['With a photo']], 'the icon still says A is not in the cloud, and which');
    p.sync.start(USER); // offline and online again: the first sync leaves A out too
    await settle();
    assert.deepEqual([triesOfA(cloud) - tries, p.seen.status], [0, 'stopped']);
    await edit(p, 'resume_a', { name: 'Photo taken out', photo: '' }, 10);
    assert.deepEqual([cloud.resumes('u').resume_a.name, p.seen.status, p.seen.held], ['Photo taken out', 'synced', []]);
  });

  it('a first sync writing A and B: its deletion and B get through, A waits, and the sync goes on', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b'), [resumePath('u', 'resume_c')]: cv('resume_c') });
    refuseA(cloud);
    // Offline, A got a photo, B an edit, and C was deleted.
    const p = syncPage(mods, cloud, {
      resumes: [cv('resume_a', 2, { photo: PHOTO }), cv('resume_b', 2, { name: 'B, edited offline' })],
      deletedIds: ['resume_c'], deletedInfo: { resume_c: { version: 1, at: 100, owner: 'u' } },
    });
    p.sync.start(USER);
    await settle();
    assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b'], 'before: nothing got through — C kept, B not sent');
    assert.deepEqual([cloud.resumes('u').resume_b.name, cloud.doc(listPath('u')).ids, p.store.state.deletedIds], ['B, edited offline', ['resume_c'], []]);
    assert.deepEqual([p.seen.status, p.seen.held.map((r) => r.id), p.timers.count, p.seen.account?.cloud], ['stopped', ['resume_a'], 0, true]);
    const reads = cloud.reads.length;
    await edit(p, 'resume_b', { name: 'B, edited again' }, 3);
    assert.deepEqual([cloud.resumes('u').resume_b.name, cloud.reads.length - reads], ['B, edited again', 0], 'a flush, not another first sync');
  });

  it('a demo account\'s originals come back meanwhile: its account can be reached', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'orig_o')]: orig('orig_o', 1, { name: 'My original' }), [resumePath('u', 'resume_a')]: cv('resume_a') });
    refuseA(cloud);
    const p = syncPage(mods, cloud, { resumes: [orig('orig_o', 1, { name: 'My original' }), cv('resume_a')] }, {
      isDemo: (u) => u.email === OWNER.email, demo: { accounts: [OWNER.email], now: () => 1000 },
    });
    p.sync.start(OWNER);
    await settle();
    await edit(p, 'resume_a', { photo: PHOTO }, 2);
    await p.remove('orig_o'); // the last original: the restore asks the cloud for its copy
    await settle();
    await p.timers.fire();
    assert.deepEqual([names(p).toSorted(), p.seen.waiting], [['My original', 'resume_a'], false], 'before: "they come back as soon as your account can be reached" — while it could');
    assert.equal(cloud.resumes('u').orig_o.deleted, undefined);
  });
});

describe('a résumé too large for a document (V2VF1S-0)', () => {
  const BIG = `data:image/png;base64,${'A'.repeat(1_100_000)}`;
  const bySize = (cloud) => {
    cloud.refuse = (ops) => (ops.some(([op, , v]) => op === 'set' && JSON.stringify(v).length > 1_048_576) ? tooLarge() : null);
  };

  it('is never uploaded — its size is known before sending — on this visit or the next', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    bySize(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    await edit(p, 'resume_a', { name: 'With a 1 MB photo', photo: BIG }, 2);
    assert.deepEqual([cloud.refused.length, p.seen.status, p.seen.held.map((r) => r.name)], [0, 'stopped', ['With a 1 MB photo']], 'before: 1.1 MB uploaded, and refused');
    await edit(p, 'resume_a', { name: 'Still with it' }, 3); // held again, as it is still too large
    await edit(p, 'resume_b', { name: 'B edited' }, 4);
    assert.deepEqual([cloud.refused.length, cloud.resumes('u').resume_b.name, p.seen.held.map((r) => r.name)], [0, 'B edited', ['Still with it']]);
    const next = syncPage(mods, cloud, { resumes: p.store.state.resumes }); // a reload
    next.sync.start(USER);
    await settle();
    assert.deepEqual([cloud.refused.length, next.seen.status, cloud.resumes('u').resume_a.name], [0, 'stopped', 'resume_a']);
  });

  it('docSize counts as Firestore does: its own example is 147 bytes; a résumé just over 1 MiB is too large', () => {
    const task = { type: 'Personal', done: false, priority: 1, description: 'Learn Cloud Firestore' };
    assert.equal(heldMod.docSize(['users', 'jeff', 'tasks', 'my_task_id'], task), 147);
    assert.equal(heldMod.storedSize({ s: 'é', a: [null, true, 2], d: new Date(0), u: undefined }), 2 + 3 + 2 + 1 + 1 + 8 + 2 + 8);
    const base = heldMod.docSize(['users', 'u', 'resumes', 'resume_a'], cv('resume_a', 1, { photo: '' }));
    const fits = cv('resume_a', 1, { photo: 'A'.repeat(heldMod.MAX_DOC_BYTES - base) });
    const held = heldMod.createHeld();
    assert.equal(held.sendable('u', [fits]).length, 1, 'exactly 1 MiB is sent');
    assert.deepEqual([held.sendable('u', [{ ...fits, photo: `${fits.photo}A` }]).length, held.size], [0, 1]);
  });
});

describe('a refused batch taken apart never undoes what was sent since (guards)', () => {
  it('B edited again before the refusal came back: its older copy is not sent over the newer one', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    refuseA(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    await p.change({ resumes: [cv('resume_a', 2, { photo: PHOTO }), cv('resume_b', 2, { name: 'B 2' })] }); // one pause
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    await p.timers.fire(); // A and B in one batch: refused, the answer not back yet
    await edit(p, 'resume_b', { name: 'B 3' }, 3);
    cloud.hold.commit = null;
    answer.resolve();
    await settle();
    assert.deepEqual([cloud.resumes('u').resume_b.name, p.seen.held.map((r) => r.id)], ['B 3', ['resume_a']]);
  });

  it('signed out before the refusal came back: nothing more is sent for that account', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    refuseA(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a'), cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    await p.change({ resumes: [cv('resume_a', 2, { photo: PHOTO }), cv('resume_b', 2, { name: 'B 2' })] });
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    await p.timers.fire();
    p.sync.start(null);
    cloud.hold.commit = null;
    answer.resolve();
    await settle();
    assert.deepEqual([cloud.resumes('u').resume_b.name, cloud.refused.length], ['resume_b', 1], 'its next first sync sends B');
  });

  it('C deleted in the refused batch and put back before the refusal came back: it stays in the cloud, not listed', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_c')]: cv('resume_c') });
    refuseA(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a'), cv('resume_c')] });
    p.sync.start(USER);
    await settle();
    await edit(p, 'resume_a', { photo: PHOTO }, 2, { flush: false });
    await p.remove('resume_c'); // the same pause: one batch
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    await p.timers.fire();
    await p.restore([cv('resume_c')]);
    await p.timers.fire(); // C written back
    cloud.hold.commit = null;
    answer.resolve();
    await settle();
    assert.deepEqual([Object.keys(cloud.resumes('u')).toSorted(), cloud.doc(listPath('u'))], [['resume_a', 'resume_c'], undefined]);
  });
});
