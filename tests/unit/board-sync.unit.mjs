// The boards' cloud sync (R2-140): the list engine (src/utils/collectionSyncEngine.js) with its
// Firestore calls (collectionSyncIo.js) over one fake Firestore shared by two devices. One device
// is the app's own board store (board-store-harness.mjs), changed through its actions, so every
// updatedAt is stamped as the app stamps it; the other is a plain list in memory. It pins: the
// first sync merges what was made before signing in, the newer board wins on both devices, a
// deletion stays deleted, a board too large for a document is held back on its own, a failure is
// retried, signing out takes the boards off the device (a change not yet sent is kept for that
// account), and the order reaches the other device. Timers are fired by hand. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshStorage, openTab, savedBoards } from './board-store-harness.mjs';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { localMeta, memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { isUntouchedDemoBoard, makeDemoBoards } from '../../src/utils/boardDemo.js';

const DAY = 24 * 60 * 60 * 1000;

const A = { uid: 'A', email: 'ada@example.test' };
const B = { uid: 'B', email: 'bo@example.test' };
const boardPath = (uid, id) => `users/${uid}/boards/${id}`;
const metaPath = (uid) => `users/${uid}/meta/boards`;
const cloudBoards = (cloud, uid) => [...cloud.data].filter(([p]) => p.startsWith(`users/${uid}/boards/`)).map(([, v]) => v);
const sorted = (list) => [...list].sort();
const cloudTitles = (cloud, uid) => sorted(cloudBoards(cloud, uid).map((b) => b.title));
/** Did any batch from commit number `from` on write board `id` of account A? */
const wroteBoard = (cloud, id, from = 0) => cloud.commits.slice(from).some((ops) => ops.some(([op, path]) => op === 'set' && path === boardPath('A', id)));
const unavailable = () => Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });

/** As useCollectionSync's boardSync reads a cloud copy and names a board. */
const fromCloud = (d) => {
  const { kept } = readBoard(d);
  return kept ? completeBoard(kept) : null;
};
const label = (b) => b.title || 'Untitled project';

/** A clock reading later than every one before: the store stamps Date.now(), so each change here is strictly newer than the last. */
function later() {
  const t = Date.now();
  let n = t;
  while (n === t) n = Date.now();
  return n;
}

/** The engine for one device's `store` and `meta`, with its own timers, report and online flag. */
function engineFor(cloud, store, meta, options = {}) {
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'), store, meta, report, timers,
    online: () => net.online, ...options,
  });
  return { sync, timers, seen, net };
}

/** A device running the app's board store (a fresh browser: no boards saved), with its record in the same storage. */
async function boardDevice(cloud) {
  const storage = freshStorage();
  storage.setItem('cpwtcv_boards_v2', JSON.stringify({ boards: [], dataVersion: 2 }));
  const tab = await openTab(storage);
  const mod = tab.run((m) => m);
  const store = { items: mod.boardsNow, replace: mod.replaceBoards, subscribe: mod.subscribe, fromCloud, label };
  const meta = localMeta('cpwtcv_boards_sync_v1', () => storage);
  return {
    storage, store, meta, ...engineFor(cloud, store, meta),
    /** A board action, as a click calls it — a moment after the last one. */
    act: (name, ...args) => { later(); return mod.boardActions[name](...args); },
    titles: () => mod.boardsNow().map((b) => b.title),
    board: (id) => mod.boardsNow().find((b) => b.id === id),
  };
}

/** Another device: a list in memory with its own record. `reload()` starts a new engine over them. */
function memoryDevice(cloud) {
  let list = [];
  const listeners = new Set();
  const store = {
    items: () => list,
    replace: (next) => { list = next; listeners.forEach((l) => l()); },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud, label,
  };
  const meta = memoryMeta();
  const device = {
    store, meta, ...engineFor(cloud, store, meta),
    edit: (id, patch) => store.replace(list.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: later() } : b))),
    titles: () => list.map((b) => b.title),
    ids: () => list.map((b) => b.id),
    reload: () => Object.assign(device, engineFor(cloud, store, meta)),
  };
  return device;
}

let cloud;
beforeEach(() => {
  cloud = fakeFirestore();
  cloud.auth = 'A';
});

test('first sync: boards made before signing in go up to the account and join the ones another device put there', async () => {
  const garden = createBoard({ title: 'Garden' }, { now: 1000 });
  cloud.data.set(boardPath('A', garden.id), JSON.parse(JSON.stringify(garden)));
  cloud.data.set(metaPath('A'), { order: [garden.id], deleted: [] });
  const d = await boardDevice(cloud);
  const kitchen = d.act('addBoard', { title: 'Kitchen' });
  const reading = d.act('addBoard', { title: 'Reading list' });
  assert.equal(d.meta.read().uid, null, 'never synced: the boards are this browser\'s');

  d.sync.start(A);
  await settle();
  assert.deepEqual(cloudTitles(cloud, 'A'), ['Garden', 'Kitchen', 'Reading list']);
  assert.equal(cloud.doc(boardPath('A', kitchen.id)).updatedAt, kitchen.updatedAt);
  assert.deepEqual(d.titles(), ['Garden', 'Kitchen', 'Reading list'], 'the cloud\'s order first, then this browser\'s');
  assert.deepEqual(savedBoards(d.storage).map((b) => b.title), ['Garden', 'Kitchen', 'Reading list']);
  assert.deepEqual(cloud.doc(metaPath('A')).order, [garden.id, kitchen.id, reading.id]);
  assert.deepEqual([d.meta.read().uid, sorted(Object.keys(d.meta.read().versions))], ['A', sorted([garden.id, kitchen.id, reading.id])]);
  assert.equal(d.seen.status, 'synced');
});

test('two devices converge, board by board: the newer change wins on both, and changes to different boards both survive', async () => {
  const d1 = await boardDevice(cloud);
  const x = d1.act('addBoard', { title: 'Roadmap' });
  const y = d1.act('addBoard', { title: 'Holidays' });
  const v = d1.act('addBoard', { title: 'Volunteering' });
  d1.sync.start(A);
  await settle();
  const d2 = memoryDevice(cloud);
  d2.sync.start(A);
  await settle();
  assert.deepEqual(d2.titles(), ['Roadmap', 'Holidays', 'Volunteering']);

  // Device 2 loses its connection and keeps working; device 1 goes on online.
  d2.net.online = false;
  d2.sync.start(A);
  assert.equal(d2.seen.status, 'offline');
  d2.edit(x.id, { title: 'Roadmap (draft)' }); // older than device 1's
  d1.act('updateBoard', x.id, { title: 'Roadmap 2027' });
  d1.act('updateBoard', y.id, { title: 'Holidays (booked)' }); // older than device 2's
  d1.act('addIssue', v.id, { title: 'Sign up for the beach clean' });
  await d1.timers.fire();
  d2.edit(y.id, { title: 'Holidays: Lisbon' });
  d2.store.replace([...d2.store.items(), createBoard({ title: 'Zine club' }, { now: later() })]);

  d2.net.online = true;
  d2.sync.start(A);
  await settle();
  d1.sync.start(A); // device 1 reads the account again
  await settle();
  const want = ['Holidays: Lisbon', 'Roadmap 2027', 'Volunteering', 'Zine club'];
  assert.deepEqual(sorted(d2.titles()), want, 'device 2');
  assert.deepEqual(sorted(d1.titles()), want, 'device 1');
  assert.deepEqual(cloudTitles(cloud, 'A'), want, 'the cloud');
  const issuesOf = (b) => b.issues.map((i) => i.title);
  assert.deepEqual(issuesOf(d2.store.items().find((b) => b.id === v.id)), ['Sign up for the beach clean']);
  assert.deepEqual(issuesOf(cloud.doc(boardPath('A', v.id))), ['Sign up for the beach clean']);
  assert.deepEqual([d1.seen.status, d2.seen.status], ['synced', 'synced']);
});

test('a deleted board stays deleted: gone from the cloud and listed, dropped by the other device, not brought back by a stale one', async () => {
  const d1 = await boardDevice(cloud);
  const p = d1.act('addBoard', { title: 'Paint the fence' });
  const q = d1.act('addBoard', { title: 'Quilting' });
  d1.sync.start(A);
  await settle();
  const d2 = memoryDevice(cloud);
  const d3 = memoryDevice(cloud);
  d2.sync.start(A);
  d3.sync.start(A);
  await settle();
  assert.deepEqual([d2.ids(), d3.ids()], [[p.id, q.id], [p.id, q.id]]);

  d1.act('deleteBoard', p.id);
  const from = cloud.commits.length;
  await d1.timers.fire();
  assert.equal(cloud.doc(boardPath('A', p.id)), undefined, 'removed from the cloud');
  assert.deepEqual([cloud.doc(metaPath('A')).deleted, cloud.doc(metaPath('A')).order], [[p.id], [q.id]]);

  d2.sync.start(A); // device 2 reads the account again
  await settle();
  assert.deepEqual(d2.ids(), [q.id]);
  d2.edit(q.id, { title: 'Quilting group' });
  await d2.timers.fire();
  assert.equal(cloud.doc(boardPath('A', q.id)).title, 'Quilting group');

  // Device 3 still holds the deleted board as it last synced it: a reload does not bring it back.
  d3.reload();
  d3.sync.start(A);
  await settle();
  assert.deepEqual(d3.titles(), ['Quilting group']);
  assert.equal(wroteBoard(cloud, p.id, from), false, 'no device wrote the deleted board back');
  assert.equal(cloud.doc(boardPath('A', p.id)), undefined);
  assert.deepEqual(cloud.doc(metaPath('A')).deleted, [p.id]);
});

test('a board too large for a document is held back and named, the others still sync, and it goes once it is small again', async () => {
  const d = await boardDevice(cloud);
  const small = d.act('addBoard', { title: 'Small notes' });
  const large = d.act('addBoard', { title: 'Large archive' });
  d.sync.start(A);
  await settle();

  d.act('updateBoard', large.id, { description: 'x'.repeat(1_100_000) }); // over Firestore's 1 MiB
  d.act('updateBoard', small.id, { title: 'Small notes, edited' });
  await d.timers.fire();
  assert.equal(cloud.doc(boardPath('A', small.id)).title, 'Small notes, edited', 'the other board still syncs');
  assert.equal(cloud.doc(boardPath('A', large.id)).description, '', 'the large one is not written');
  assert.equal(cloud.refused.length, 0, 'nor even sent: its size is known before');
  assert.deepEqual([d.seen.status, d.seen.held], ['stopped', [{ id: large.id, name: 'Large archive' }]]);

  d.act('updateBoard', large.id, { description: 'Short again' });
  assert.deepEqual(d.seen.held, [], 'changed: let go at once');
  await d.timers.fire();
  assert.equal(cloud.doc(boardPath('A', large.id)).description, 'Short again');
  assert.deepEqual([d.seen.status, d.seen.held], ['synced', []]);
});

test('offline nothing is sent and going online sends it; a failed send is tried again later and gets through', async () => {
  const d = await boardDevice(cloud);
  d.net.online = false;
  const tax = d.act('addBoard', { title: 'Tax return' });
  d.sync.start(A);
  await settle();
  d.act('updateBoard', tax.id, { description: 'Receipts in the blue folder' });
  await settle();
  assert.deepEqual([d.seen.status, cloud.reads.length, cloud.commits.length, d.timers.count], ['offline', 0, 0, 0]);

  d.net.online = true;
  d.sync.start(A);
  await settle();
  assert.equal(cloud.doc(boardPath('A', tax.id)).description, 'Receipts in the blue folder');
  assert.equal(d.seen.status, 'synced');

  cloud.fail.commit = unavailable();
  d.act('updateBoard', tax.id, { title: 'Tax return 2026' });
  await d.timers.fire();
  assert.equal(cloud.doc(boardPath('A', tax.id)).title, 'Tax return');
  assert.deepEqual([d.seen.status, d.timers.delays], ['error', [30000]], 'a retry is waiting');

  cloud.fail.commit = null;
  await d.timers.fire();
  await settle();
  assert.equal(cloud.doc(boardPath('A', tax.id)).title, 'Tax return 2026');
  assert.deepEqual([d.seen.status, d.timers.count], ['synced', 0]);
});

test('signing out takes the boards off the device, keeping a change not yet sent for that account; another account gets none of them', async () => {
  const d = await boardDevice(cloud);
  const moving = d.act('addBoard', { title: 'Moving house' });
  const night = d.act('addBoard', { title: 'Night classes' });
  d.sync.start(A);
  await settle();
  d.act('addIssue', moving.id, { title: 'Call the movers' }); // the pause has not passed: not sent yet

  d.sync.start(null);
  await settle();
  assert.deepEqual([d.store.items(), savedBoards(d.storage), d.timers.count], [[], [], 0]);
  assert.deepEqual(cloud.doc(boardPath('A', moving.id)).issues, [], 'the change was not sent on sign-out');
  const record = d.meta.read();
  assert.equal(record.uid, null);
  assert.deepEqual(record.stashed.A.items.map((b) => [b.id, b.issues.map((i) => i.title)]), [[moving.id, ['Call the movers']]]);

  const commits = cloud.commits.length;
  const scribbles = d.act('addBoard', { title: 'Scribbles' });
  await d.timers.fire();
  assert.equal(cloud.commits.length, commits, 'signed out: nothing is written');
  assert.equal(cloud.doc(boardPath('A', scribbles.id)), undefined);

  cloud.auth = 'B';
  d.sync.start(B);
  await settle();
  // What was made while signed out joins the next account; A's boards do not.
  assert.deepEqual([d.titles(), cloudTitles(cloud, 'B')], [['Scribbles'], ['Scribbles']]);
  assert.ok(!JSON.stringify(cloudBoards(cloud, 'B')).includes('Call the movers'));
  assert.ok(!d.store.items().some((b) => b.id === moving.id || b.id === night.id));

  d.sync.start(null);
  await settle();
  cloud.auth = 'A';
  d.sync.start(A);
  await settle();
  assert.deepEqual(sorted(d.titles()), ['Moving house', 'Night classes']);
  assert.deepEqual(d.board(moving.id).issues.map((i) => i.title), ['Call the movers'], 'the kept change is back');
  assert.deepEqual(cloud.doc(boardPath('A', moving.id)).issues.map((i) => i.title), ['Call the movers'], 'and sent');
  assert.deepEqual([d.meta.read().uid, d.meta.read().stashed.A], ['A', undefined]);
});

test('the boards\' order is written to the account and another device takes it', async () => {
  const d1 = await boardDevice(cloud);
  const ids = ['Alpha', 'Bravo', 'Charlie'].map((title) => d1.act('addBoard', { title }).id);
  d1.sync.start(A);
  await settle();
  assert.deepEqual(cloud.doc(metaPath('A')).order, ids);
  const d2 = memoryDevice(cloud);
  d2.sync.start(A);
  await settle();
  assert.deepEqual(d2.ids(), ids);

  d2.store.replace([...d2.store.items()].reverse());
  await d2.timers.fire();
  const reversed = [...ids].reverse();
  assert.deepEqual(cloud.doc(metaPath('A')).order, reversed);
  assert.ok(cloud.commits.at(-1).every(([, path]) => path === metaPath('A')), 'only the order was written');

  d1.sync.start(A);
  await settle();
  assert.deepEqual(d1.store.items().map((b) => b.id), reversed);
  assert.deepEqual(savedBoards(d1.storage).map((b) => b.id), reversed);
});

test('a fresh demo project (site data cleared) never goes over the demo project the account filled in', async () => {
  // The account adopted the demo project days ago and added an issue; the fresh one is dated an hour ago.
  const adopted = makeDemoBoards(Date.now() - 10 * DAY);
  adopted[0] = { ...adopted[0], issues: [...adopted[0].issues, { ...adopted[0].issues[0], id: 'iss_mine', number: 11, title: 'Paint the hallway' }], updatedAt: Date.now() - 5 * DAY };
  cloud.data.set(boardPath('A', 'demo_board_life'), JSON.parse(JSON.stringify(adopted[0])));
  const storage = freshStorage(); // nothing saved: the store shows the demo project
  const tab = await openTab(storage);
  const mod = tab.run((m) => m);
  assert.ok(isUntouchedDemoBoard(mod.boardsNow()[0]) && mod.boardsNow()[0].updatedAt > adopted[0].updatedAt);
  const store = { items: mod.boardsNow, replace: mod.replaceBoards, subscribe: mod.subscribe, fromCloud, label, seed: isUntouchedDemoBoard };
  const d = engineFor(cloud, store, localMeta('cpwtcv_boards_sync_v1', () => storage));

  d.sync.start(A);
  await settle();
  assert.ok(cloud.doc(boardPath('A', 'demo_board_life')).issues.some((i) => i.title === 'Paint the hallway'), 'the account keeps what was added');
  assert.ok(mod.boardsNow()[0].issues.some((i) => i.title === 'Paint the hallway'), 'this browser takes it');
  assert.equal(d.seen.status, 'synced');
});

test('a saved board list that cannot be read deletes nothing from the account; its boards come back', async () => {
  const garden = createBoard({ title: 'Garden' }, { now: 1000 });
  cloud.data.set(boardPath('A', garden.id), JSON.parse(JSON.stringify(garden)));
  const storage = freshStorage();
  storage.setItem('cpwtcv_boards_sync_v1', JSON.stringify({ uid: 'A', versions: { [garden.id]: garden.updatedAt }, stashed: {} }));
  storage.setItem('cpwtcv_boards_v2', '{"boards": [not json');
  const tab = await openTab(storage);
  const mod = tab.run((m) => m);
  const store = { items: mod.boardsNow, replace: mod.replaceBoards, subscribe: mod.subscribe, fromCloud, label };
  const d = engineFor(cloud, store, localMeta('cpwtcv_boards_sync_v1', () => storage));

  d.sync.start(A);
  await settle();
  assert.ok(cloud.doc(boardPath('A', garden.id)), 'the account keeps the board');
  assert.deepEqual(cloud.doc(metaPath('A'))?.deleted ?? [], [], 'it is not listed as deleted');
  assert.deepEqual(mod.boardsNow().map((b) => b.title), ['Garden'], 'and it comes back here');
});
