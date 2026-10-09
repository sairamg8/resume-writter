// CYC8-S1 (first sync): jobs and projects sync as one document per item, "newer updatedAt wins".
// When BOTH devices changed the same job or project since they last synced, the older side's edits
// were dropped with no word — and two devices adding issues to one project offline lost the older
// side's issues. Now, as with the résumés (cloudSyncLineage.js), nothing typed is lost: the newer
// copy stays the item, the older one is kept beside it as a conflict copy (a job: a new id, its
// company marked "(conflict copy)"; a project: a new id and key, titled "<name> (conflict copy)"),
// in the account and on both devices, and the engine reports it for the notice. No copy when only
// one side changed, when the two hold the same content, or for the deletion rules (an edit made
// where the deletion was never seen still wins, with no copy). The real engine, plan and io over a
// fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { boardConflictCopy, jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, company, updatedAt = 1, extra = {}) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});

/**
 * A device: its own in-memory list, sync record and timers, the engine over `cloud`.
 * `kind` 'jobs' or 'boards'; `notices` collects what the engine reports as kept for a conflict.
 */
function device(cloud, kind, items = [], { online = () => true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const jobs = kind === 'jobs';
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: jobs ? (j) => [j.company, j.role].filter(Boolean).join(' — ') : (b) => b.title,
    conflictCopy: jobs ? jobConflictCopy : boardConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  let clock = 0;
  const sync = createCollectionSync({
    name: kind, io: collectionIo(cloud.fs, cloud.db, kind), store, meta: memoryMeta(), report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    list: () => list,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}

const cloudDocs = (cloud, kind) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/A/${kind}/`)).map((p) => cloud.doc(p));

/** Two devices that have both synced job j1 (Acme, t=1); device 2 then loses its connection. */
async function twoDevicesWithJob(cloud) {
  const d1 = device(cloud, 'jobs', [job('j1', 'Acme')]);
  await d1.start(A);
  let online = true;
  const d2 = device(cloud, 'jobs', [], { online: () => online });
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j1']);
  online = false;
  await d2.start(A);
  return { d1, d2, back: async () => { online = true; await d2.start(A); } };
}

test('a job edited on both devices: the newer stays, the older is kept as a conflict copy on both and in the account', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevicesWithJob(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30); // offline
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire(); // reaches the account
  await back();

  assert.equal(d2.get('j1').role, 'Staff Engineer', 'the newer copy stays the job');
  const copy = d2.list().find((j) => j.id !== 'j1');
  assert.ok(copy, 'the older copy is kept');
  assert.equal(copy.company, 'Acme (conflict copy)');
  assert.equal(copy.role, 'Lead Engineer', 'with the older side\'s edit');
  assert.deepEqual(d2.ids(), ['j1', copy.id], 'right after the job it belongs to');
  assert.deepEqual(d2.notices, ['Acme — Staff Engineer'], 'the engine reports it');
  assert.equal(d2.seen.status, 'synced');
  assert.equal(d2.timers.count, 0, 'nothing is queued: the copy is already sent');

  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Lead Engineer', 'the copy is in the account');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, d2.ids());

  await d1.refresh();
  assert.deepEqual(d1.ids(), ['j1', copy.id], 'the other device gets both');
  assert.equal(d1.get('j1').role, 'Staff Engineer');
  assert.deepEqual(d1.notices, [], 'and is told nothing: it had no conflict');
});

test('the older side can be this browser\'s: its edit is the copy, the cloud\'s copy stays', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevicesWithJob(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 15);
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire();
  await back();

  assert.equal(d2.get('j1').role, 'Lead Engineer');
  const copy = d2.list().find((j) => j.id !== 'j1');
  assert.deepEqual([copy.company, copy.role], ['Acme (conflict copy)', 'Staff Engineer']);
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Staff Engineer');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Lead Engineer');
});

test('a tie on the time with different content keeps both too: this browser\'s stays', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevicesWithJob(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 20);
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire();
  await back();

  assert.equal(d2.get('j1').role, 'Staff Engineer');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer', 'its copy is written over the account\'s');
  const copy = d2.list().find((j) => j.id !== 'j1');
  assert.equal(copy.role, 'Lead Engineer');
});

test('no copy when only one side changed, or when both made the same change', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevicesWithJob(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30); // only this device
  await back();
  assert.deepEqual(d2.ids(), ['j1']);
  assert.deepEqual(d2.notices, []);
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');

  await d1.refresh();
  assert.deepEqual(d1.ids(), ['j1'], 'only the other side changed: it takes the edit, no copy');
  assert.equal(d1.get('j1').role, 'Staff Engineer');

  // The same new role typed on both devices, offline: the same content, no conflict.
  const cloud2 = fakeFirestore();
  const again = await twoDevicesWithJob(cloud2);
  again.d2.edit('j1', { role: 'Staff Engineer' }, 30);
  again.d1.edit('j1', { role: 'Staff Engineer' }, 20);
  await again.d1.timers.fire();
  await again.back();
  assert.deepEqual(again.d2.ids(), ['j1'], 'equal content: no copy');
  assert.deepEqual(again.d2.notices, []);
  assert.equal(cloudDocs(cloud2, 'jobs').length, 1);
});

test('an edit made where the deletion was never seen still wins over it, with no copy', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevicesWithJob(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30);
  d1.remove('j1');
  await d1.timers.fire();
  await back();

  assert.deepEqual(d2.ids(), ['j1']);
  assert.equal(d2.get('j1').role, 'Staff Engineer');
  assert.deepEqual(d2.notices, []);
  assert.equal(cloudDocs(cloud, 'jobs').length, 1);
});

test('two devices adding issues to one project offline: the older side\'s issues are kept in a conflict copy of the project', async () => {
  const cloud = fakeFirestore();
  const roadmap = { ...createBoard({ title: 'Roadmap', key: 'RD' }, { now: 1 }), id: 'b1' };
  const d1 = device(cloud, 'boards', [roadmap]);
  await d1.start(A);
  let online = true;
  const d2 = device(cloud, 'boards', [], { online: () => online });
  await d2.start(A);
  online = false;
  await d2.start(A);

  d2.edit('b1', { issues: [{ id: 'i2', title: 'Plan the launch' }] }, 30);
  d1.edit('b1', { issues: [{ id: 'i1', title: 'Write the brief' }] }, 20);
  await d1.timers.fire();
  online = true;
  await d2.start(A);

  assert.equal(d2.ids().length, 2);
  assert.deepEqual(d2.get('b1').issues.map((i) => i.title), ['Plan the launch'], 'the newer copy stays the project');
  const copy = d2.list().find((b) => b.id !== 'b1');
  assert.equal(copy.title, 'Roadmap (conflict copy)');
  assert.deepEqual(copy.issues.map((i) => i.title), ['Write the brief'], 'the older side\'s issue is not lost');
  assert.notEqual(copy.key, 'RD', 'the copy has a key of its own');
  assert.deepEqual(d2.notices, ['Roadmap']);
  assert.equal(cloudDocs(cloud, 'boards').length, 2, 'both are in the account');

  await d1.refresh();
  assert.deepEqual(d1.list().map((b) => b.title), ['Roadmap', 'Roadmap (conflict copy)']);
});
