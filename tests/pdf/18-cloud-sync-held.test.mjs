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
let smaller;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  heldMod = await loadModule('/src/utils/cloudSyncHeld.js');
  smaller = await loadModule('/src/utils/smallerPhotos.js');
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

  // ONB-10: a photo an older build stored at camera size is made smaller by the store once it has it
  // (useSmallerPhotos), in place — the same version, so neither a merge nor the queue saw a change.
  /** What useSmallerPhotos does once the copy of `from` is made. */
  const madeSmaller = (p, from, to) => p.change(smaller.withPhotoReplaced(p.store.state, from, to));
  const LETTER_BIG = `data:image/jpeg;base64,${'B'.repeat(1_100_000)}`;

  it('held for its photo: sent in the same visit once the store has made the photo smaller, with no edit (ONB-10)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a'), [resumePath('u', 'resume_b')]: cv('resume_b') });
    bySize(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { name: 'Camera photo', personal: { photo: BIG } }), cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    assert.deepEqual([p.seen.status, p.seen.held.map((r) => r.id), cloud.resumes('u').resume_a.updatedAt], ['stopped', ['resume_a'], 1]);
    await madeSmaller(p, BIG, PHOTO);
    await p.timers.fire();
    const a = cloud.resumes('u').resume_a;
    assert.deepEqual([a.personal?.photo, a.updatedAt, p.seen.status, p.seen.held], [PHOTO, 2, 'synced', []], 'before: held until its next edit, or the next visit');
    assert.equal(cloud.refused.length, 0);
  });

  it('still too large once one photo is smaller: held as it was, nothing tried, the icon unchanged (a guard)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    bySize(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { personal: { photo: BIG }, coverLetter: { clPhoto: LETTER_BIG } })] });
    p.sync.start(USER);
    await settle();
    const [commits, heldReports] = [cloud.commits.length, []];
    let held = p.seen.held;
    Object.defineProperty(p.seen, 'held', { get: () => held, set: (v) => { held = v; heldReports.push(v); } });
    await madeSmaller(p, BIG, PHOTO);
    await p.timers.fire();
    assert.deepEqual([cloud.commits.length - commits, cloud.refused.length, heldReports, p.seen.status], [0, 0, [], 'stopped'], 'not let go and held again: the icon would flicker');
    await madeSmaller(p, LETTER_BIG, PHOTO); // and then the letter's
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u').resume_a.coverLetter?.clPhoto, p.seen.status], [PHOTO, 'synced']);
  });

  it('a résumé that came in with such a photo (an import): the flush sends the smaller copy the store has by then (ONB-10)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b') });
    bySize(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_b')] });
    p.sync.start(USER);
    await settle();
    await p.change({ resumes: [...p.store.state.resumes, cv('resume_i', 5, { personal: { photo: BIG } })] });
    await madeSmaller(p, BIG, PHOTO); // before the pause is over
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u').resume_i?.personal.photo, p.seen.held, p.seen.status], [PHOTO, [], 'synced'], 'before: the queued 1.1 MB copy was held back');
  });

  it('made smaller while offline: the first sync on coming back sends it (ONB-10)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_a')]: cv('resume_a') });
    bySize(cloud);
    let online = true;
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { personal: { photo: BIG } })] }, { online: () => online });
    p.sync.start(USER);
    await settle();
    online = false;
    p.sync.start(USER); // the page went offline
    await madeSmaller(p, BIG, PHOTO);
    online = true;
    p.sync.start(USER);
    await settle();
    assert.deepEqual([cloud.resumes('u').resume_a.personal?.photo, p.seen.status, p.seen.held, p.timers.count], [PHOTO, 'synced', [], 0], 'before: the plan\'s copy is the held version, so it was left out');
  });

  it('made smaller while the first sync\'s batch is on its way: that sync puts its copy back, and the next replacement is sent (ONB-10)', async () => {
    const cloud = fakeFirestore({ [resumePath('u', 'resume_b')]: cv('resume_b') });
    bySize(cloud);
    const p = syncPage(mods, cloud, { resumes: [cv('resume_a', 2, { personal: { photo: BIG } }), cv('resume_b', 2, { name: 'B 2' })] });
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    p.sync.start(USER);
    await settle();
    await madeSmaller(p, BIG, PHOTO); // not yet synced: nothing is queued, A stays held
    cloud.hold.commit = null;
    answer.resolve();
    await settle();
    assert.deepEqual([p.store.state.resumes.find((r) => r.id === 'resume_a').personal.photo, p.seen.held.map((r) => r.id)], [BIG, ['resume_a']], 'the merged copy, as the plan read it');
    await madeSmaller(p, BIG, PHOTO); // the store's effect runs again on that change
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u').resume_a?.personal.photo, cloud.resumes('u').resume_b.name, p.seen.status], [PHOTO, 'B 2', 'synced']);
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
