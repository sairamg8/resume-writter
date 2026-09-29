// R5-HUNT6-TWO-TABS-DOUBLE-CONFLICT-COPY: with two tabs of the app open on the laptop, one conflict
// with the phone made two identical "(conflict copy)" résumés, on every device. Both tabs hold the
// laptop's edit of X (the second took it through the storage event); both read the phone's copy
// before either wrote — both start their first sync on the same 'online' event, or both flush the
// same edit — and each forked X with a conflict copy under its own random id. Now the copy's id comes
// from the résumé and the other device's version (conflictId), so both tabs write the one copy.
// And a first sync takes the copies it counts as the cloud's from before its read: another tab's
// sync landing during the read used to make the laptop's edit look synced, and the phone's copy
// was pulled over it — the edit just typed was gone from X in both tabs.
// The engine, its Firestore calls and the store's own updaters over one fake Firestore; a tab's
// reads can be held after they read (a read that predates another tab's write).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle, deferred } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(teardown);

const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, summary: 'v1', sections: [], dataVersion: DATA_VERSION, ...extra });
const USER = { uid: 'u', email: 'someone@example.com' };
const X = 'resume_x';
const copiesIn = (cloud) => Object.values(cloud.resumes('u')).filter((r) => / \(conflict copy\)$/.test(r.name));
const clone = (v) => JSON.parse(JSON.stringify(v));

/** `cloud` as one tab reaches it: `hold()` makes its next reads wait, after reading, until `release()`. */
function tabView(cloud) {
  let gate = null;
  const late = (read) => async (...args) => {
    const answer = await read(...args);
    if (gate) await gate.promise;
    return answer;
  };
  const fs = { ...cloud.fs, getDocsFromServer: late(cloud.fs.getDocsFromServer), getDocFromServer: late(cloud.fs.getDocFromServer) };
  return {
    view: { ...cloud, fs },
    hold() { gate = deferred(); },
    release() { const g = gate; gate = null; g?.resolve(); },
  };
}

const edit = async (p, id, fields, updatedAt) => {
  await p.change({ resumes: p.store.state.resumes.map((r) => (r.id === id ? { ...r, ...fields, updatedAt } : r)) });
};

/**
 * The laptop's tab A signed in with X (and with `second`, tab B too, from A's saved list); the
 * phone then edits X.
 */
async function laptopAndPhone(net, { second = false } = {}) {
  const cloud = fakeFirestore({ [resumePath('u', X)]: cv(X) });
  const viewA = tabView(cloud);
  const tabA = syncPage(mods, viewA.view, { resumes: [cv(X)] }, { online: () => net.on });
  tabA.sync.start(USER);
  await settle();
  let viewB = null;
  let tabB = null;
  if (second) {
    viewB = tabView(cloud);
    tabB = syncPage(mods, viewB.view, clone(tabA.store.state), { online: () => net.on });
    tabB.sync.start(USER);
    await settle();
  }
  const phone = syncPage(mods, cloud, { resumes: [cv(X)] });
  phone.sync.start(USER);
  await settle();
  await edit(phone, X, { summary: 'PHONE EDIT' }, 10);
  await phone.timers.fire();
  assert.equal(cloud.resumes('u')[X].summary, 'PHONE EDIT');
  return { cloud, viewA, tabA, viewB, tabB };
}

/** The laptop edited X offline in tab A; tab B holds the same list (A's save, through the storage event). */
async function offlineEditInTwoTabs() {
  const net = { on: true };
  const { cloud, viewA, tabA } = await laptopAndPhone(net);
  net.on = false;
  tabA.sync.start(USER);
  await edit(tabA, X, { name: 'edited on laptop' }, 20);
  const viewB = tabView(cloud);
  const tabB = syncPage(mods, viewB.view, clone(tabA.store.state), { online: () => net.on });
  tabB.sync.start(USER);
  await settle();
  return { cloud, net, viewA, viewB, tabA, tabB };
}

describe('two tabs, one conflict with another device (R5-HUNT6-TWO-TABS-DOUBLE-CONFLICT-COPY)', () => {
  it('back online: both tabs\' first syncs read the phone\'s copy before either writes — one conflict copy', async () => {
    const { cloud, net, viewA, viewB, tabA, tabB } = await offlineEditInTwoTabs();
    net.on = true;
    viewA.hold();
    viewB.hold();
    tabA.sync.start(USER); // the 'online' event reaches both tabs
    tabB.sync.start(USER);
    await settle();
    viewA.release();
    viewB.release();
    await settle();
    assert.equal(copiesIn(cloud).length, 1, `before: ${copiesIn(cloud).length} identical conflict copies in the account`);
    assert.equal(copiesIn(cloud)[0].summary, 'PHONE EDIT');
    assert.equal(cloud.resumes('u')[X].name, 'edited on laptop');
    const ids = (tab) => tab.store.state.resumes.map((r) => r.id).toSorted();
    assert.deepEqual(ids(tabA), ids(tabB), 'both tabs hold the same résumés');
  });

  it('online throughout: both tabs flush the same edit against the same read — one conflict copy', async () => {
    const net = { on: true };
    const { cloud, viewA, tabA, viewB, tabB } = await laptopAndPhone(net, { second: true });
    await edit(tabA, X, { name: 'edited on laptop' }, 20);
    await tabB.change({ resumes: clone(tabA.store.state.resumes) }); // A's save, through the storage event
    viewA.hold();
    viewB.hold();
    await tabA.timers.fire();
    await tabB.timers.fire();
    viewA.release();
    viewB.release();
    await settle();
    assert.equal(copiesIn(cloud).length, 1, `before: ${copiesIn(cloud).length} identical conflict copies in the account`);
    assert.equal(cloud.resumes('u')[X].name, 'edited on laptop');
  });

  it('another tab\'s first sync lands while this one reads: the laptop\'s edit is not pulled over by the phone\'s copy', async () => {
    const { cloud, net, viewB, tabA, tabB } = await offlineEditInTwoTabs();
    net.on = true;
    viewB.hold();
    tabB.sync.start(USER); // B reads the account as it is now: the phone's X
    await settle();
    tabA.sync.start(USER); // A's first sync runs and lands meanwhile
    await settle();
    assert.equal(copiesIn(cloud).length, 1);
    await tabB.change(clone(tabA.store.state)); // A's save reaches B through the storage event
    viewB.release(); // … before B plans from its older read
    await settle();

    const x = (tab) => tab.store.state.resumes.find((r) => r.id === X);
    assert.equal(x(tabB).name, 'edited on laptop', `before: tab B pulled the phone's copy over X (${x(tabB).summary})`);
    assert.equal(cloud.resumes('u')[X].name, 'edited on laptop');
    assert.equal(copiesIn(cloud).length, 1, 'still one conflict copy');
  });
});
