// The write queue across slow acknowledgements, sign-outs and account switches, as the app runs
// it (the engine, its Firestore calls, the store's own rules) over a fake Firestore.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { deferred, fakeFirestore, syncPage, resumePath, listPath, settle, syncModules } from './fake-firestore.mjs';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, ...extra });
const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const page = (cloud, state) => syncPage(mods, cloud, state);
const signIn = async (p, user) => { p.sync.start(user); await settle(); };
const rename = (p, id, name, updatedAt) => p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, name, updatedAt } : r)) });

describe('a flush never waits for the one before it to be acknowledged (VM4-3)', () => {
  it('an acknowledgement that does not come holds back no later flush', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signIn(p, A);
    const commits = cloud.commits.length;
    cloud.hold.commit = new Promise(() => {}); // the network drops before the server answers
    await rename(p, 'resume_a', 'First', 2);
    await p.timers.fire();
    cloud.hold.commit = null;
    await rename(p, 'resume_a', 'Second', 3);
    await p.timers.fire();
    assert.equal(cloud.commits.length, commits + 2, 'before: the second waited for the first\'s answer, for good');
    assert.equal(cloud.resumes('A').resume_a.name, 'Second');
    assert.equal(p.seen.status, 'synced');
  });

  it('A\'s unanswered flush does not stop B\'s, after A signs out and B signs in', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a'), [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signIn(p, A);
    cloud.hold.commit = new Promise(() => {}); // Firestore keeps A's write until A is back
    await rename(p, 'resume_a', 'Edited by A', 2);
    await p.timers.fire();
    cloud.hold.commit = null;
    p.sync.start(null);
    await signIn(p, B);
    await rename(p, 'resume_b', 'Edited by B', 5);
    await p.timers.fire();
    assert.equal(cloud.resumes('B').resume_b.name, 'Edited by B', 'before: queued behind A\'s commit for the rest of the visit');
    assert.equal(p.seen.status, 'synced');
  });
});

describe('signing out ends the account\'s queue (R8-5)', () => {
  /** Signed in as `user` in Firebase too: the rules let only that account's documents through. */
  const signInAs = async (p, cloud, user) => { cloud.auth = user?.uid ?? null; p.sync.start(user); await settle(); };

  it('a change still waiting when the user signs out is not sent without auth, and sync works at the next sign-in', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signInAs(p, cloud, A);
    await rename(p, 'resume_a', 'Renamed', 2);
    await signInAs(p, cloud, null); // within the 1.5 s pause
    await p.timers.fire();
    assert.equal(cloud.resumes('A').resume_a.name, 'resume_a', 'nothing sent signed out');
    await signInAs(p, cloud, A);
    assert.equal(p.seen.status, 'synced', 'before: permission-denied had turned sync off — "error" until a reload');
    assert.equal(cloud.resumes('A').resume_a.name, 'Renamed', 'the change reaches the cloud with the next sync');
  });

  it('another account signing in within the pause is not sent the first one\'s changes, and its sync stays on', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signInAs(p, cloud, A);
    await rename(p, 'resume_a', 'Renamed by A', 2);
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, B);
    await p.timers.fire();
    assert.equal(p.seen.status, 'synced', 'before: A\'s flush was denied under B, and B\'s sync turned off');
    await rename(p, 'resume_a', 'Edited as B', 3);
    await p.timers.fire();
    assert.equal(cloud.resumes('B').resume_a?.name, 'Edited as B');
  });

  it('A\'s edit and deletion waiting at sign-out never reach B: B\'s flush sends B\'s, and A\'s next sign-in the deletion (V2W1a-2)', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a'), [resumePath('A', 'resume_r')]: cv('resume_r'), [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_a'), cv('resume_r')] });
    await signInAs(p, cloud, A);
    await rename(p, 'resume_a', 'Renamed by A', 2);
    await p.remove('resume_r'); // both within the 1.5 s pause
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, B);
    const before = cloud.commits.length;
    await rename(p, 'resume_b', 'Edited by B', 5); // before any pause has ended
    await p.timers.fire();
    const sent = cloud.commits.slice(before).flat().map(([op, path]) => `${op} ${path}`);
    assert.deepEqual(sent, ['set users/B/resumes/resume_b'], 'before (dropQueue removed): A\'s rename and deletion went out with B\'s flush');
    assert.equal(cloud.doc(listPath('B')), undefined, 'R is not on B\'s deletion list');
    assert.deepEqual([p.store.state.deletedIds, p.store.state.deletedInfo.resume_r?.owner], [['resume_r'], 'A'], 'the deletion waits for A');
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, A);
    assert.equal(cloud.resumes('A').resume_r, undefined, 'A\'s next sign-in removes R — before: it came back');
    assert.deepEqual(cloud.doc(listPath('A')).ids, ['resume_r']);
  });

  it('A\'s pause ending after B signed in sends nothing, and leaves B\'s queue empty (a guard: sendPending\'s own check)', async () => {
    // start() drops A's queue and timer; if a timer of A's still fired, sendPending clears what it
    // holds before it bails out, so B's next flush cannot carry it. Removing both fails this test.
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a'), [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signInAs(p, cloud, A);
    await rename(p, 'resume_a', 'Renamed by A', 2);
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, B);
    await p.timers.fire(); // A's pause, had it survived the sign-out
    const before = cloud.commits.length;
    await rename(p, 'resume_b', 'Edited by B', 5);
    await p.timers.fire();
    assert.deepEqual(cloud.commits.slice(before).flat().map(([op, path]) => `${op} ${path}`), ['set users/B/resumes/resume_b']);
  });

  it('a flush of an account signed out since that fails does not turn sync off for the next one', async () => {
    const cloud = fakeFirestore({ [resumePath('A', 'resume_a')]: cv('resume_a'), [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = page(cloud, { resumes: [cv('resume_a')] });
    await signInAs(p, cloud, A);
    const answer = deferred();
    cloud.hold.commit = answer.promise;
    await rename(p, 'resume_a', 'Renamed by A', 2);
    await p.timers.fire(); // sent; no answer yet
    cloud.hold.commit = null;
    await signInAs(p, cloud, null);
    await signInAs(p, cloud, B);
    answer.reject(Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }));
    await settle();
    assert.equal(p.seen.status, 'synced', 'before: "error", and B\'s changes stayed local for the visit');
    await rename(p, 'resume_b', 'Edited by B', 5);
    await p.timers.fire();
    assert.equal(cloud.resumes('B').resume_b.name, 'Edited by B');
  });
});
