// Typing-freeze finding 5, two ways the write that takes in the other tab's save went wrong (review round 1).
// (1) The write merged the other tab's save into this tab's state, marked it as taken, and then storage
// refused it (full): the tab read its merged, unwritten résumés as stored, so the next event of the other
// tab took its list whole and this tab's typing was gone, with nothing to write it again. Now a write that
// failed leaves the merged state to be written again, and the tab's edits stay what is unsaved.
// (2) The account changed in THIS tab — signed out (its list left, what it had not sent kept aside for the
// account) or signed in — and the other tab's save landed unheard before this tab wrote: taken in, its
// owner replaced this tab's, putting the account's résumés back into a signed-out browser and replacing the
// stash (or undoing the sign-in). Now the change of account is this tab's, and the other tab's save is edits
// on the old account's list: kept aside for it.
// The real useAppStore under StrictMode in tabs of one localStorage (tests/pdf/xtab-tabs.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { openTabs, storeOf, savedResume, assertConverged, type } from './xtab-tabs.mjs';

before(setup);
after(teardown);

const UID = 'uid_casey';

async function tabs(n, body, state = storeOf([savedResume()])) {
  const t = await openTabs(n, state);
  try { await body(t, ...t.tabs); } finally { await t.close(); }
}

const signedIn = () => {
  const resume = savedResume();
  return { ...storeOf([resume]), syncedUid: UID, cloudVersions: { [resume.id]: resume.updatedAt } };
};

describe('a write that takes in the other tab\'s save and fails (typing-freeze 5)', () => {
  it('storage full while A writes over B\'s unheard save: A keeps what it typed, writes it again, and B\'s later save does not take it away', () => tabs(2, async (t, a, b) => {
    await b.edit((s) => s.updatePersonal('website', 'b.example'));
    await b.flush();
    t.storage.full = true;
    await a.edit((s) => s.updatePersonal('name', 'Casey R. Example'), { race: true });
    await a.flush({ race: true });
    assert.ok(a.store().persistError, 'A shows that it could not save');
    assert.equal(t.saved().resumes[0].personal.website, 'b.example', 'storage holds B\'s save alone');
    assert.equal(t.saved().resumes[0].personal.name, 'Casey Example');
    t.storage.full = false;
    await b.edit((s) => s.updatePersonal('jobTitle', 'Staff Engineer'));
    await b.flush();
    await a.deliver();
    for (const field of ['website', 'jobTitle']) assert.equal(a.resume().personal[field], field === 'website' ? 'b.example' : 'Staff Engineer');
    assert.equal(a.resume().personal.name, 'Casey R. Example', 'before: B\'s next save took A\'s typing away from A\'s own screen');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(
        [tab.resume().personal.name, tab.resume().personal.website, tab.resume().personal.jobTitle],
        ['Casey R. Example', 'b.example', 'Staff Engineer'],
        `tab ${tab.name}`,
      );
    }
    assert.equal(t.saved().resumes[0].personal.name, 'Casey R. Example');
    assertConverged(assert, t);
  }));

  it('with nothing more heard, the failed write is tried again on its own once the wait is over', () => tabs(2, async (t, a, b) => {
    await b.edit((s) => s.updatePersonal('website', 'b.example'));
    await b.flush();
    t.storage.full = true;
    await a.edit((s) => s.updatePersonal('name', 'Casey R. Example'), { race: true });
    await a.flush({ race: true });
    assert.ok(a.store().persistError);
    t.storage.full = false;
    await t.tick(3000);
    assert.equal(t.saved().resumes[0].personal.name, 'Casey R. Example', 'before: nothing was scheduled, the typing stayed unwritten');
    assert.equal(t.saved().resumes[0].personal.website, 'b.example');
    assert.equal(a.store().persistError, null);
    await t.quiesce();
    assertConverged(assert, t);
  }));
});

describe('the account changes in this tab while the other tab\'s save is unheard (typing-freeze 5)', () => {
  it('A signs out, B saved edits and a new résumé that A has not heard: the signed-out browser stays empty, the account\'s stash holds both tabs\' unsent work', () => tabs(2, async (t, a, b) => {
    await type(a, 'name', '!'); // unsent to the account, held here
    await b.edit((s) => { s.updatePersonal('website', 'b.example'); s.createResume('Second'); });
    await b.flush();
    await a.edit((s) => s.leaveAccount(UID), { race: true }); // the list changing hands is written at once, over B's save
    const saved = t.saved();
    assert.equal(saved.syncedUid, null, 'before: the write took B\'s save\'s owner and wrote the account back into the browser');
    assert.deepEqual(saved.resumes, []);
    const stash = saved.stashed?.[UID]?.resumes || [];
    const first = stash.find((r) => r.id === 'resume_x');
    assert.equal(first?.personal.name, 'Casey Example!', 'A\'s own unsent typing is still kept aside');
    assert.equal(first?.personal.website, 'b.example', 'and B\'s edit of the same résumé with it');
    assert.equal(stash.length, 2, 'B\'s new résumé is kept aside for the account too');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(tab.store().appState.resumes, [], `tab ${tab.name}`);
      assert.equal(tab.store().appState.syncedUid, null, `tab ${tab.name}`);
    }
    assert.equal(t.saved().stashed[UID].resumes.length, 2);
    assertConverged(assert, t);
  }, signedIn()));

  it('A signs out with an edit to one entry, and B\'s unheard save deleted another: the stash does not bring the deleted one back', () => tabs(2, async (t, a, b) => {
    await a.edit((s) => s.updateItem('sec_exp', 'e_b', (i) => ({ ...i, role: 'Lead' })));
    await b.edit((s) => s.removeItem('sec_exp', 'e_a'));
    await b.flush();
    await a.edit((s) => s.leaveAccount(UID), { race: true });
    await t.quiesce();
    const first = t.saved().stashed[UID].resumes.find((r) => r.id === 'resume_x');
    assert.deepEqual(first.sections[0].items.map((i) => i.id), ['e_b', 'e_c']);
    assert.equal(first.sections[0].items[0].role, 'Lead');
  }, signedIn()));

  it('A signs in (a first sync\'s result) while B, signed out, saved an edit A has not heard: the account stays, the edit is kept', () => tabs(2, async (t, a, b) => {
    await type(a, 'name', '!');
    await b.edit((s) => s.updatePersonal('website', 'b.example'));
    await b.flush();
    const mine = a.store().appState.resumes;
    await a.edit((s) => s.applyCloudSync({ uid: UID, snapshot: mine, merged: mine, handled: [], before: 0, versions: { resume_x: mine[0].updatedAt } }), { race: true });
    const saved = t.saved();
    assert.equal(saved.syncedUid, UID, 'before: the write read the sign-in as the other tab\'s sign-out and wrote the list back signed out');
    assert.equal(saved.resumes[0].personal.name, 'Casey Example!');
    assert.equal(saved.resumes[0].personal.website, 'b.example');
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.equal(tab.store().appState.syncedUid, UID, `tab ${tab.name}`);
      assert.equal(tab.resume().personal.website, 'b.example', `tab ${tab.name}`);
      assert.equal(tab.resume().personal.name, 'Casey Example!', `tab ${tab.name}`);
    }
    assertConverged(assert, t);
  }));

  it('the other tab signing out is still the other tab\'s: this tab\'s unsent typing is kept aside, as before', () => tabs(2, async (t, a, b) => {
    await type(a, 'name', '!');
    await b.edit((s) => s.leaveAccount(UID));
    await b.flush();
    await a.deliver();
    assert.deepEqual(a.store().appState.resumes, []);
    assert.equal(a.store().appState.stashed[UID].resumes[0].personal.name, 'Casey Example!');
    await t.quiesce();
    assertConverged(assert, t);
  }, signedIn()));

  it('A signs out holding typing, B (still signed in) holds other typing in the same résumé: B keeps both aside when it hears, not only its own', () => tabs(2, async (t, a, b) => {
    await type(a, 'name', '!');
    await type(b, 'website', 'b.example');
    await a.edit((s) => s.leaveAccount(UID), { race: true });
    await b.deliver(); // B's own typing is unsent, its stash entry for the résumé would replace A's
    await t.quiesce();
    const first = t.saved().stashed[UID].resumes.find((r) => r.id === 'resume_x');
    assert.equal(first.personal.name, 'Casey Example!', 'before: A\'s typing was replaced by B\'s copy of the résumé');
    assert.equal(first.personal.website, 'b.example');
    for (const tab of [a, b]) assert.deepEqual(tab.store().appState.resumes, [], `tab ${tab.name}`);
    assertConverged(assert, t);
  }, signedIn()));
});

// A whole résumé the other tab deleted, with this tab signing out holding a copy of it (review round 2).
// The résumé is the account's and unsent here (the cloud holds an older version of it), so sign-out keeps
// it aside for the account. A copy this tab only held is not kept once the other tab's deletion is
// heard — it would bring the deleted résumé back at the next sign-in. One this tab typed in since it last
// read storage is an edit made after the deletion, and wins: nothing typed is lost to a sign-out, and the
// cloud sync treats an edit after a deletion the same way (R2-029). Two résumés, so deleting one leaves a list.
const signedInTwo = () => {
  const first = savedResume();
  const second = savedResume({ id: 'resume_y', name: 'Sam' });
  return { ...storeOf([first, second]), syncedUid: UID, cloudVersions: { resume_x: 0, resume_y: second.updatedAt } };
};
const stashIds = (t) => (t.saved().stashed?.[UID]?.resumes || []).map((r) => r.id);

describe('the other tab deleted a résumé this tab signs out holding (typing-freeze 5)', () => {
  it('this tab only held it: the stash does not keep it, and the deletion stays waiting for the account', () => tabs(2, async (t, a, b) => {
    await b.edit((s) => s.deleteResume('resume_x', UID));
    await b.flush();
    await a.edit((s) => s.leaveAccount(UID), { race: true });
    assert.deepEqual(stashIds(t), [], 'before the filter, the stash brought the deleted résumé back at the next sign-in');
    assert.deepEqual(t.saved().deletedIds, ['resume_x']);
    assert.deepEqual(t.saved().resumes, []);
    await t.quiesce();
    for (const tab of [a, b]) assert.deepEqual(tab.store().appState.resumes, [], `tab ${tab.name}`);
    assert.deepEqual(stashIds(t), []);
    assertConverged(assert, t);
  }, signedInTwo()));

  it('this tab typed in it: the typing is kept aside for the account, as an edit made after the deletion', () => tabs(2, async (t, a, b) => {
    await type(a, 'name', '!');
    await b.edit((s) => s.deleteResume('resume_x', UID));
    await b.flush();
    await a.edit((s) => s.leaveAccount(UID), { race: true });
    assert.deepEqual(stashIds(t), ['resume_x'], 'before, the deletion dropped the résumé a tab had typed in from the stash');
    assert.equal(t.saved().stashed[UID].resumes[0].personal.name, 'Casey Example!');
    await t.quiesce();
    for (const tab of [a, b]) assert.deepEqual(tab.store().appState.resumes, [], `tab ${tab.name}`);
    assert.deepEqual(stashIds(t), ['resume_x']);
    assertConverged(assert, t);
  }, signedInTwo()));

  it('the other tab deleted it and this tab, which only held it, writes without signing out: it stays deleted', () => tabs(2, async (t, a, b) => {
    await b.edit((s) => s.deleteResume('resume_x', UID));
    await b.flush();
    await a.edit((s) => { s.setActiveId('resume_y'); s.updatePersonal('name', 'Sam!'); }, { race: true });
    await a.flush({ race: true });
    assert.deepEqual(t.saved().resumes.map((r) => r.id), ['resume_y']);
    assert.deepEqual(t.saved().deletedIds, ['resume_x']);
    await t.quiesce();
    for (const tab of [a, b]) {
      assert.deepEqual(tab.store().appState.resumes.map((r) => r.id), ['resume_y'], `tab ${tab.name}`);
      assert.equal(tab.store().appState.syncedUid, UID, `tab ${tab.name}`);
    }
    assertConverged(assert, t);
  }, signedInTwo()));
});
