// CYC9-H2: starring a project or choosing its colour stamps its updatedAt like any edit, so a star
// on one device and a colour on another made the older side a whole-project "(conflict copy)" —
// every issue twice — although nothing typed was in conflict. Now a difference in only the
// looks (collectionSyncConflict.BOARD_COSMETIC: the star and the colour) is no conflict: the newer
// copy simply wins them, on the first sync and on the live path alike; the title, description,
// columns, sprints, labels, mode, issues and the rest stay real differences and still make a copy.
// The real plan, engine and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import * as conflict from '../../src/utils/collectionSyncConflict.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const { boardConflictCopy, sameContent } = conflict;
const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;
const roadmap = () => ({ ...createBoard({ title: 'Roadmap', key: 'RD' }, { now: 1 }), id: 'b1' });

/** A device: as the app wires boardSync (conflictApart is what useCollectionSync gives the boards' store). */
function device(cloud, items = [], { online = () => true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (b) => b.title,
    conflictCopy: boardConflictCopy, conflictApart: conflict.BOARD_COSMETIC,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'), store, meta: memoryMeta(), report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}
const cloudBoards = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/boards/'));

/** Two devices in sync on the project; the second then loses its connection. */
async function twoDevices(cloud) {
  const d1 = device(cloud, [roadmap()]);
  await d1.start();
  let online = true;
  const d2 = device(cloud, [], { online: () => online });
  await d2.start();
  assert.deepEqual(d2.ids(), ['b1']);
  online = false;
  await d2.start();
  return { d1, d2, back: async () => { online = true; await d2.start(); } };
}

test('only the star and the colour are apart; a difference in anything typed is not', () => {
  const a = roadmap();
  const looks = { ...a, starred: !a.starred, color: '#123456', updatedAt: 99 };
  assert.equal(sameContent(a, looks), false, 'without the list they differ');
  assert.equal(sameContent(a, looks, conflict.BOARD_COSMETIC), true, 'with it they do not');
  for (const patch of [
    { issues: [{ id: 'i1', title: 'Write the brief' }] }, { title: 'Plan' }, { description: 'notes' },
    { mode: a.mode === 'scrum' ? 'kanban' : 'scrum' }, { sprints: [{ id: 's1', name: 'S1' }] },
    { labels: [{ id: 'l1', name: 'Bug', color: 'red' }] }, { columns: [{ id: 'c1', title: 'Later', category: 'todo', wipLimit: null }] }, { key: 'RX' },
  ]) {
    assert.equal(sameContent(a, { ...looks, ...patch }, conflict.BOARD_COSMETIC), false, `${Object.keys(patch)[0]} is a real difference`);
  }
});

test('first sync: a star on one device and a colour on the other make no copy; the newer wins them', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevices(cloud);
  d2.edit('b1', { color: '#ff0000' }, 30); // offline
  d1.edit('b1', { starred: true }, 20);
  await d1.timers.fire();
  await back();

  assert.deepEqual(d2.ids(), ['b1'], 'no copy of the whole project');
  assert.deepEqual(d2.notices, []);
  assert.equal(d2.get('b1').color, '#ff0000');
  assert.equal(d2.get('b1').starred, false, 'the newer copy wins the star too');
  assert.equal(cloudBoards(cloud).length, 1);
  assert.equal(cloud.doc('users/A/boards/b1').color, '#ff0000');

  await d1.refresh();
  assert.deepEqual(d1.ids(), ['b1']);
  assert.equal(d1.get('b1').color, '#ff0000');
});

test('first sync: a real difference beside a cosmetic one still makes a copy', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, back } = await twoDevices(cloud);
  d2.edit('b1', { issues: [{ id: 'i2', title: 'Plan the launch' }] }, 30);
  d1.edit('b1', { starred: true, issues: [{ id: 'i1', title: 'Write the brief' }] }, 20);
  await d1.timers.fire();
  await back();

  assert.equal(d2.ids().length, 2);
  const copy = d2.get(d2.ids().find((id) => id !== 'b1'));
  assert.equal(copy.title, 'Roadmap (conflict copy)');
  assert.deepEqual(copy.issues.map((i) => i.title), ['Write the brief']);
  assert.deepEqual(d2.notices, ['Roadmap']);
});

test('live path: a star and a colour changed on two devices make no copy', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [roadmap()]);
  await d1.start();
  const d2 = device(cloud, []);
  await d2.start();
  d2.edit('b1', { color: '#ff0000' }, 30);
  d1.edit('b1', { starred: true }, 20);
  await d1.timers.fire(); // the other device\'s edit gets there first
  await d2.timers.fire();

  assert.deepEqual(d2.ids(), ['b1'], 'no copy');
  assert.deepEqual(d2.notices, []);
  assert.equal(cloudBoards(cloud).length, 1);
  assert.equal(cloud.doc('users/A/boards/b1').color, '#ff0000', 'the newer copy is the project');
  assert.equal(cloud.doc('users/A/boards/b1').starred, false);
  assert.equal(d2.timers.count, 0, 'nothing left to send');

  // And the other way round: the cloud\'s copy is the newer; this device takes it.
  const cloud2 = fakeFirestore();
  const e1 = device(cloud2, [roadmap()]);
  await e1.start();
  const e2 = device(cloud2, []);
  await e2.start();
  e2.edit('b1', { color: '#ff0000' }, 15);
  e1.edit('b1', { starred: true }, 20);
  await e1.timers.fire();
  await e2.timers.fire();
  assert.deepEqual(e2.ids(), ['b1']);
  assert.deepEqual(e2.notices, []);
  assert.equal(e2.get('b1').starred, true);
  assert.equal(cloudBoards(cloud2).length, 1);
});

test('live path: a real difference still makes a copy', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [roadmap()]);
  await d1.start();
  const d2 = device(cloud, []);
  await d2.start();
  d2.edit('b1', { color: '#ff0000', title: 'Roadmap 2027' }, 30);
  d1.edit('b1', { starred: true }, 20);
  await d1.timers.fire();
  await d2.timers.fire();
  assert.equal(d2.ids().length, 2, 'the title is typed work: the older side is kept');
  assert.deepEqual(d2.notices, ['Roadmap 2027']);
});
