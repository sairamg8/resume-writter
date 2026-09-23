// The samples (demo_classic …) that builds before 2026-09-15 flagged { deleted: true } in the
// owner's cloud when deleted — kept for a restore that no build makes any more, so hidden on every
// device for good, beyond reach of the UI. The owner's first sync settles each one (V2OWNER-DATA-8,
// src/utils/oldSamples.js): an untouched copy is removed for good, an edited one is an ordinary
// résumé again. Through the app's own engine, Firestore calls and store updaters over a fake
// Firestore, with the copies those builds really stored (tests/fixtures/oldSampleCopies.js).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, render, read, allItems, renderDocx } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, listPath, settle } from './fake-firestore.mjs';
import { oldSampleCopies } from '../fixtures/oldSampleCopies.js';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, ...extra });
const OWNER = { uid: 'u', email: 'owner@example.com' };
const page = (cloud, state) => syncPage(mods, cloud, state, { isDemo: (u) => u.email === OWNER.email });
const signIn = async (p) => { p.sync.start(OWNER); await settle(); };
const ids = (p) => p.store.state.resumes.map((r) => r.id).toSorted();
const listed = (cloud) => (cloud.doc(listPath('u'))?.ids ?? []).toSorted();
/** The sample `id` as the builds from adbc5b9 on stored it (Between Items 8 px). */
const sample = (id) => oldSampleCopies().find((r) => r.id === id && r.settings.itemGap === 8 && r.settings.photoTextAlign !== 'top'
  && r.sections.every((s) => s.settings.itemGap === undefined));
/** `copy` as an old build left it in the cloud: its time stamped by the restore, then flagged. */
const flagged = (copy, updatedAt = 20, extra = {}) => ({ ...copy, updatedAt, ...extra, deleted: true });
const cloudWith = (...docs) => fakeFirestore(Object.fromEntries(docs.map((d) => [resumePath('u', d.id), d])));

describe('samples an older build flagged in the owner\'s account (V2OWNER-DATA-8)', () => {
  it('an untouched one is removed for good at the first sync — every copy an old build could have stored', async () => {
    // One document per id, so the thirteen copies take four accounts' worth of rounds.
    const rounds = [];
    for (const copy of oldSampleCopies()) {
      const round = rounds.find((r) => !r.some((c) => c.id === copy.id)) ?? rounds[rounds.push([]) - 1];
      round.push(copy);
    }
    for (const [n, round] of rounds.entries()) {
      // dataVersion: none from 4bc56fe, 8 from the builds after it.
      const cloud = cloudWith(...round.map((c) => flagged(c, 20 + n, n % 2 ? { dataVersion: 8 } : {})), cv('resume_b'));
      const p = page(cloud, { resumes: [cv('resume_b')] });
      await signIn(p);
      assert.deepEqual(Object.keys(cloud.resumes('u')), ['resume_b'], `round ${n}: before, flagged in the cloud for good, hidden on every device`);
      assert.deepEqual(listed(cloud), round.map((c) => c.id).toSorted(), 'listed: a device still holding a copy drops it');
      assert.deepEqual(ids(p), ['resume_b']);
    }
  });

  it('a flag with no résumé under it (a copy the cloud never had) goes too; one holding any field is kept', async () => {
    const cloud = fakeFirestore({
      [resumePath('u', 'demo_minimal')]: { deleted: true },
      [resumePath('u', 'demo_classic')]: { deleted: true, name: 'Notes' },
    });
    const p = page(cloud, { resumes: [] });
    await signIn(p);
    assert.deepEqual([Object.keys(cloud.resumes('u')), listed(cloud)], [['demo_classic'], ['demo_minimal']], 'before: both kept, flagged');
    assert.deepEqual(ids(p), ['demo_classic'], 'what someone wrote comes back, never judged a stub');
  });

  it('an edited one is an ordinary résumé again: in the list on every device, in the cloud without its flag', async () => {
    const edited = sample('demo_classic');
    edited.personal.name = 'Sam Owner';
    const recoloured = { ...sample('demo_modern'), settings: { ...sample('demo_modern').settings, accentColor: '#0f766e' } };
    const renamed = { ...sample('demo_minimal'), name: 'My CV' };
    const cloud = cloudWith(flagged(edited), flagged(recoloured), flagged(renamed, 21, { dataVersion: 8 }), flagged(sample('demo_executive')), cv('resume_b'));
    const laptop = page(cloud, { resumes: [cv('resume_b')] });
    await signIn(laptop);
    assert.deepEqual(ids(laptop), ['demo_classic', 'demo_minimal', 'demo_modern', 'resume_b'], 'before: hidden for good');
    assert.equal(laptop.store.state.resumes.find((r) => r.id === 'demo_classic').personal.name, 'Sam Owner');
    const docs = cloud.resumes('u');
    assert.deepEqual(Object.keys(docs).toSorted(), ['demo_classic', 'demo_minimal', 'demo_modern', 'resume_b'], 'the untouched one went');
    assert.deepEqual(['demo_classic', 'demo_minimal', 'demo_modern'].map((id) => docs[id].deleted), [undefined, undefined, undefined], 'written back without the flag');
    assert.deepEqual([docs.demo_classic.personal.name, docs.demo_modern.settings.accentColor, docs.demo_minimal.name, docs.demo_minimal.updatedAt], ['Sam Owner', '#0f766e', 'My CV', 21]);
    assert.deepEqual(listed(cloud), ['demo_executive'], 'only the untouched one is deleted for good');
    assert.deepEqual(laptop.seen.account.cloudOriginals, [], 'no original: a résumé like any other');

    const phone = page(cloud, { resumes: [] });
    await signIn(phone);
    assert.deepEqual(ids(phone), ['demo_classic', 'demo_minimal', 'demo_modern', 'resume_b'], 'on the other device too');
    const commits = cloud.commits.length;
    await signIn(laptop);
    assert.deepEqual(cloud.commits.slice(commits), [[]], 'nothing left to settle: the next sync writes nothing');
  });

  it('back in the list, an old build\'s copy prints as the same copy never flagged: PDF (= the preview) and Word', async () => {
    // The first version as 4bc56fe stored it — no dataVersion, Between Items 10 px — on a Sidebar
    // résumé, edited: loaded through normalizeResume like any old copy, never as it was read.
    const first = oldSampleCopies().find((r) => r.id === 'demo_sidebar' && r.settings.itemGap === 10 && r.sections.every((s) => s.settings.itemGap === undefined));
    first.personal.name = 'Sam Owner';
    const revived = page(cloudWith(flagged(first)), { resumes: [] });
    const live = page(cloudWith({ ...first, updatedAt: 20 }), { resumes: [] });
    await signIn(revived);
    await signIn(live);
    const [back, same] = [revived, live].map((p) => p.store.state.resumes.find((r) => r.id === 'demo_sidebar'));
    assert.ok(back, 'before: hidden for good');
    const printed = async (r) => allItems(await read(await render(r))).map(({ str, x, y, page: n }) => `${n} ${x.toFixed(1)} ${y.toFixed(1)} ${str}`);
    const [pdf, livePdf] = [await printed(back), await printed(same)];
    assert.deepEqual(pdf, livePdf);
    assert.ok(pdf.some((t) => t.endsWith('Sam Owner')) && pdf.some((t) => t.includes('Northwind Traders')), 'the edit and the rest of it print');
    assert.deepEqual((await renderDocx(back)).texts, (await renderDocx(same)).texts);
    assert.ok((await renderDocx(back)).texts.includes('Sam Owner'));
  });

  it('back in the list, it is the owner\'s to keep or delete: Delete removes it for good', async () => {
    const edited = { ...sample('demo_sidebar'), name: 'Mine now' };
    const cloud = cloudWith(flagged(edited));
    const p = page(cloud, { resumes: [] });
    await signIn(p);
    assert.deepEqual(ids(p), ['demo_sidebar'], 'before: hidden for good');
    await p.remove('demo_sidebar');
    await p.timers.fire();
    assert.deepEqual([cloud.resumes('u'), listed(cloud)], [{}, ['demo_sidebar']]);
    await signIn(p);
    assert.deepEqual(ids(p), [], 'and it stays deleted');
  });

  it('a device that still holds a copy: an untouched one goes there too, and never comes back from it', async () => {
    // The phone deleted both on an old build; the laptop last synced before, and edited Modern since.
    const cloud = cloudWith(flagged(sample('demo_classic')), flagged(sample('demo_modern')));
    const laptopCopies = [{ ...sample('demo_classic'), updatedAt: 20 }, { ...sample('demo_modern'), name: 'Edited on the laptop', updatedAt: 30 }];
    const laptop = page(cloud, { resumes: laptopCopies });
    await signIn(laptop);
    assert.deepEqual(ids(laptop), ['demo_modern'], 'an edit made since the flag keeps it, as for any flag');
    assert.deepEqual([Object.keys(cloud.resumes('u')), cloud.resumes('u').demo_modern.deleted, listed(cloud)], [['demo_modern'], undefined, ['demo_classic']], 'before: Classic kept flagged in the cloud');
    // A tab that never saw the deletion: without the list it would upload its copy, and the sample would be back.
    const tab = page(cloud, { resumes: [{ ...sample('demo_classic'), updatedAt: 20 }] });
    await signIn(tab);
    assert.deepEqual([ids(tab), Object.keys(cloud.resumes('u'))], [['demo_modern'], ['demo_modern']]);
  });

  it('a deletion made here still applies to an edited one; an original\'s flag and any other flag stay as they are', async () => {
    const edited = { ...sample('demo_classic'), name: 'Edited, then deleted here' };
    const kept = flagged(sample('demo_modern'), 20, { keep: true }); // marked an original since, then deleted: the restore's
    const other = flagged(cv('resume_x', 20, { name: 'Not a sample' }));
    const cloud = cloudWith(flagged(edited), kept, other);
    // Deleted here offline, at the version the cloud holds, and not sent yet.
    const laptop = page(cloud, { resumes: [cv('resume_b')], deletedIds: ['demo_classic'], deletedInfo: { demo_classic: { version: 20, at: 100 } } });
    await signIn(laptop);
    const docs = cloud.resumes('u');
    assert.deepEqual([docs.demo_classic, listed(cloud)], [undefined, ['demo_classic']], 'before: kept flagged, the deletion never sent');
    assert.deepEqual([docs.demo_modern, docs.resume_x], [kept, other]);
    assert.deepEqual(laptop.seen.account.cloudOriginals.map((r) => r.id), ['demo_modern']);
    assert.deepEqual([ids(laptop), laptop.store.state.deletedIds], [['resume_b'], []]);
  });
});
