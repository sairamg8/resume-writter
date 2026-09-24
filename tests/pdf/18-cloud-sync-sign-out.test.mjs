// A shared or public browser (R2-005), as the app runs it: the engine, its Firestore calls and the
// store's own updaters over a fake Firestore whose rules let only the signed-in account through.
// Until R2-005 signing out left account A's résumés on the dashboard — readable and exportable by
// whoever used the browser next — and account B's first sync merged them into B's cloud. Now A's
// list leaves the browser with A: what A's cloud holds goes (it comes back at A's next sign-in),
// and a change A's cloud does not have yet is kept aside for A, off the dashboard, and sent at A's
// next sign-in. A list no account synced (made signed out) is the browser's own and joins whoever
// signs in, as before; and a build with no cloud keeps its list, its only copy.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, ...extra });
const ALICE = cv('resume_alice', 5, { name: 'Alice', personal: { phone: '555-0100', email: 'alice@x' } });
const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const page = (cloud, state, opts) => syncPage(mods, cloud, state, opts);
/** Signed in as `user` (null: signed out) in Firebase too: the rules let only that account's documents through. */
const signInAs = async (p, cloud, user) => { if (cloud) cloud.auth = user?.uid ?? null; p.sync.start(user); await settle(); };
const rename = (p, id, name, updatedAt) => p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, name, updatedAt } : r)) });
const names = (p) => p.store.state.resumes.map((r) => r.name).toSorted();
/** What this browser keeps (localStorage holds the store's state as it is). */
const kept = (p) => JSON.stringify(p.store.state);

describe('signing out takes the account\'s résumés off this browser (R2-005)', () => {
  it('A signs out: A\'s résumés leave the dashboard and the browser; B signing in gets none of them', async () => {
    const cloud = fakeFirestore({ [resumePath('A', ALICE.id)]: ALICE });
    const p = page(cloud, { resumes: [] });
    await signInAs(p, cloud, A);
    assert.deepEqual(names(p), ['Alice']);
    await signInAs(p, cloud, null);
    assert.deepEqual(names(p), [], 'before: [\'Alice\'] — readable and exportable after sign-out');
    assert.equal(kept(p).includes('555-0100'), false, 'before: A\'s phone number stayed in this browser\'s storage');
    await signInAs(p, cloud, B);
    assert.deepEqual(cloud.resumes('B'), {}, 'before: Alice\'s résumé written to users/B/resumes');
    assert.deepEqual(names(p), []);
    assert.equal(p.seen.status, 'synced');
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, A);
    assert.deepEqual(names(p), ['Alice'], 'A\'s next sign-in brings them back');
  });

  it('a change A\'s cloud does not have yet is kept aside for A — off the dashboard, never sent to B — and sent at A\'s next sign-in', async () => {
    const cloud = fakeFirestore({ [resumePath('A', ALICE.id)]: ALICE, [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [] });
    await signInAs(p, cloud, A);
    await rename(p, ALICE.id, 'Alice, renamed', 6); // signed out within the pause before the flush
    await signInAs(p, cloud, null);
    await p.timers.fire();
    assert.deepEqual(names(p), [], 'before: [\'Alice, renamed\']');
    await signInAs(p, cloud, B);
    assert.deepEqual([names(p), Object.keys(cloud.resumes('B'))], [['resume_b'], ['resume_b']], 'before: A\'s renamed résumé shown to B and written to B\'s cloud');
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, A);
    assert.equal(cloud.resumes('A')[ALICE.id].name, 'Alice, renamed', 'the rename is not lost');
    assert.deepEqual(names(p), ['Alice, renamed']);
    assert.equal(kept(p).includes('"stashed":{"A"'), false, 'nothing kept aside once it is back');
  });

  it('the list an earlier build left for A on a signed-out page: B\'s sign-in neither shows it nor copies it, and A gets it back', async () => {
    const cloud = fakeFirestore({ [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [ALICE], activeId: ALICE.id, syncedUid: 'A' });
    await signInAs(p, cloud, B);
    assert.deepEqual([names(p), Object.keys(cloud.resumes('B'))], [['resume_b'], ['resume_b']], 'before: Alice shown to B and written to B\'s cloud');
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, A);
    assert.deepEqual([names(p), cloud.resumes('A')[ALICE.id]?.name], [['Alice'], 'Alice'], 'no version of it was known: kept for A, and A\'s sign-in sends it');
  });

  it('B signs in offline: A\'s list is not left on screen for B while B\'s first sync waits', async () => {
    const net = { on: false };
    const cloud = fakeFirestore({ [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [ALICE], syncedUid: 'A' }, { online: () => net.on });
    await signInAs(p, cloud, B);
    assert.deepEqual([p.seen.status, names(p)], ['offline', []], 'before: Alice under B, editable');
    net.on = true;
    await signInAs(p, cloud, B);
    assert.deepEqual([names(p), Object.keys(cloud.resumes('B'))], [['resume_b'], ['resume_b']]);
  });
});

describe('what stays on this browser (R2-005)', () => {
  it('a list made signed out, before any account synced it, joins the account that signs in — as before', async () => {
    const cloud = fakeFirestore({});
    const p = page(cloud, { resumes: [cv('resume_local')] });
    await signInAs(p, cloud, A);
    assert.deepEqual([names(p), Object.keys(cloud.resumes('A'))], [['resume_local'], ['resume_local']]);
  });

  it('a build with no cloud keeps its list at sign-out: it is the only copy', async () => {
    const p = page(null, { resumes: [cv('resume_local')] });
    await signInAs(p, null, A);
    await signInAs(p, null, null);
    assert.deepEqual(names(p), ['resume_local']);
  });

  it('going offline and back, or a retry, is no sign-out: the list stays', async () => {
    const net = { on: true };
    const cloud = fakeFirestore({ [resumePath('A', ALICE.id)]: ALICE });
    const p = page(cloud, { resumes: [] }, { online: () => net.on });
    await signInAs(p, cloud, A);
    net.on = false;
    await signInAs(p, cloud, A); // useCloudSync's effect on the offline event
    assert.deepEqual(names(p), ['Alice']);
    net.on = true;
    await signInAs(p, cloud, A);
    assert.deepEqual([names(p), p.seen.status], [['Alice'], 'synced']);
  });

  it('A\'s deletion waiting at sign-out still waits for A, and A\'s next sign-in sends it', async () => {
    const cloud = fakeFirestore({ [resumePath('A', ALICE.id)]: ALICE, [resumePath('A', 'resume_r')]: cv('resume_r') });
    const p = page(cloud, { resumes: [] });
    await signInAs(p, cloud, A);
    await p.remove('resume_r'); // within the pause
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, A);
    assert.deepEqual(Object.keys(cloud.resumes('A')), [ALICE.id]);
    assert.deepEqual([names(p), p.store.state.deletedIds], [['Alice'], []]);
  });
});
