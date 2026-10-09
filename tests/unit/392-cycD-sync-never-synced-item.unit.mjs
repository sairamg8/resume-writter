// CYCD-SYNC (a): an item that was never synced, edited on two devices before either synced it. The demo
// job (and the demo project) has one fixed id on every browser, and a file imported on two browsers
// brings the same ids: the account then holds a copy of an id another browser also holds and never
// synced. The sync had no recorded version for it, a conflict needed one, so the newer stamp won and the other
// browser's edit was dropped with no word. Now a first sync of a list that was never this account's treats the
// cloud's copy (written by another device, not the pristine demo) and this browser's (not the untouched demo)
// as two edits of one start: both are kept, the older as a "(conflict copy)", with the usual notice.
// The real engine, plan and io over a fake Firestore two browsers share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import * as conflict from '../../src/utils/collectionSyncConflict.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, role, updatedAt, extra = {}) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});
/** The store's untouched demo, as the app tells it: here a job marked so. */
const pristine = (x) => x.pristine === true;

/** A browser that never synced: its list, a record of its own, and the engine over `cloud`. */
function browser(cloud, kind, items, { record } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const jobs = kind === 'jobs';
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: jobs ? (j) => [j.company, j.role].filter(Boolean).join(' — ') : (b) => b.title,
    seed: pristine,
    conflictCopy: jobs ? conflict.jobConflictCopy : conflict.boardConflictCopy,
    ...(jobs ? {} : { conflictApart: conflict.BOARD_COSMETIC }),
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  let clock = 0;
  const sync = createCollectionSync({
    name: kind, io: collectionIo(cloud.fs, cloud.db, kind), store, meta: record ? memoryMeta(record) : memoryMeta(), report,
    timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    list: () => list,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
  };
}
const docs = (cloud, kind) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/A/${kind}/`));

test('the demo job edited on two browsers before either synced: the second to sync keeps both', async () => {
  const cloud = fakeFirestore();
  const b1 = browser(cloud, 'jobs', [job('demo', 'Lead Engineer', 20)]);
  const b2 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 30)]);
  await b1.start();
  await b2.start();

  assert.equal(b2.get('demo').role, 'Staff Engineer', 'the later edit stays the job');
  const copy = b2.list().find((j) => j.id !== 'demo');
  assert.ok(copy, 'the other browser\'s edit is kept');
  assert.equal(copy.role, 'Lead Engineer');
  assert.equal(copy.company, 'Acme (conflict copy)');
  assert.deepEqual(b2.notices, ['Acme — Staff Engineer'], 'and said');
  assert.equal(docs(cloud, 'jobs').length, 2);
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Lead Engineer', 'the copy is in the account');
  assert.equal(cloud.doc('users/A/jobs/demo').role, 'Staff Engineer');

  await b1.refresh();
  assert.deepEqual(b1.ids(), ['demo', copy.id], 'the first browser gets both too');
  assert.equal(b1.get('demo').role, 'Staff Engineer');
  assert.deepEqual(b1.notices, []);
});

test('the older edit can be the second browser\'s: it is the copy', async () => {
  const cloud = fakeFirestore();
  const b1 = browser(cloud, 'jobs', [job('demo', 'Lead Engineer', 30)]);
  const b2 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 20)]);
  await b1.start();
  await b2.start();
  assert.equal(b2.get('demo').role, 'Lead Engineer');
  const copy = b2.list().find((j) => j.id !== 'demo');
  assert.equal(copy?.role, 'Staff Engineer');
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Staff Engineer');
});

test('no copy for the same content, for an untouched demo, or for a pristine demo in the account', async () => {
  // The same change typed on both.
  let cloud = fakeFirestore();
  let b1 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 20)]);
  let b2 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 30)]);
  await b1.start();
  await b2.start();
  assert.deepEqual(b2.ids(), ['demo']);
  assert.deepEqual(b2.notices, []);

  // This browser's demo is untouched: the account's copy wins, as it always did.
  cloud = fakeFirestore();
  b1 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 20)]);
  b2 = browser(cloud, 'jobs', [job('demo', 'Engineer', 30, { pristine: true })]);
  await b1.start();
  await b2.start();
  assert.deepEqual(b2.ids(), ['demo']);
  assert.equal(b2.get('demo').role, 'Staff Engineer');
  assert.deepEqual(b2.notices, []);

  // The account holds the pristine demo; this browser's edit, stamped earlier than it, is the only change: it stays.
  cloud = fakeFirestore();
  b1 = browser(cloud, 'jobs', [job('demo', 'Engineer', 40, { pristine: true })]);
  b2 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 5)]);
  await b1.start();
  await b2.start();
  assert.deepEqual(b2.ids(), ['demo'], 'no copy of a demo nobody edited');
  assert.deepEqual(b2.notices, []);
  assert.equal(b2.get('demo').role, 'Staff Engineer');
  assert.equal(cloud.doc('users/A/jobs/demo').role, 'Staff Engineer', 'the edit reached the account');
});

test('a list that was this account\'s before (its record lost the versions) is not guessed at: no copy', async () => {
  const cloud = fakeFirestore();
  const b1 = browser(cloud, 'jobs', [job('demo', 'Lead Engineer', 20)]);
  await b1.start();
  const record = { uid: 'A', versions: {}, revs: {}, device: 'dev_b2', order: null, stashed: {} };
  const b2 = browser(cloud, 'jobs', [job('demo', 'Staff Engineer', 30)], { record });
  await b2.start();
  assert.deepEqual(b2.ids(), ['demo']);
  assert.deepEqual(b2.notices, []);
  assert.equal(b2.get('demo').role, 'Staff Engineer', 'the newer copy wins, as it did');
});

test('the demo project edited on two browsers before either synced keeps both', async () => {
  const cloud = fakeFirestore();
  const board = (issues, updatedAt) => ({ ...createBoard({ title: 'Roadmap', key: 'RD' }, { now: 1 }), id: 'board_demo', issues, updatedAt });
  const b1 = browser(cloud, 'boards', [board([{ id: 'i1', title: 'Write the brief' }], 20)]);
  const b2 = browser(cloud, 'boards', [board([{ id: 'i2', title: 'Plan the launch' }], 30)]);
  await b1.start();
  await b2.start();

  assert.deepEqual(b2.get('board_demo').issues.map((i) => i.title), ['Plan the launch']);
  const copy = b2.list().find((b) => b.id !== 'board_demo');
  assert.equal(copy?.title, 'Roadmap (conflict copy)');
  assert.deepEqual(copy.issues.map((i) => i.title), ['Write the brief'], 'the first browser\'s issue is not lost');
  assert.equal(docs(cloud, 'boards').length, 2);
});
