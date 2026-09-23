// Unit tests for the board store (src/hooks/useBoardStore.js) in Node: two tabs are two
// instances of the module (a ?tab query each) sharing one fake localStorage, which sends a
// 'storage' event to every other tab's window, as a browser does. React is replaced by a stub
// whose useSyncExternalStore just reads the snapshot, so useBoardStore() hands out the actions
// outside a component. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const REACT_STUB = 'export const useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();';
const HOOKS = `export async function resolve(specifier, context, next) {
  if (specifier === 'react') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(REACT_STUB)}), shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

/** localStorage shared by every tab: each write reaches the other tabs as a 'storage' event. */
class SharedStorage {
  constructor() { this.map = new Map(); this.windows = new Set(); this.quota = Infinity; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const used = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + String(v).length > this.quota) {
      throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    }
    const oldValue = this.getItem(k);
    this.map.set(k, String(v));
    this.fire(k, oldValue, String(v));
  }
  removeItem(k) {
    const oldValue = this.getItem(k);
    this.map.delete(k);
    this.fire(k, oldValue, null);
  }
  fire(key, oldValue, newValue) {
    const self = globalThis.window;
    for (const w of this.windows) if (w !== self) w.dispatch({ key, oldValue, newValue });
  }
}

let storage;
let tabCount = 0;

/** A tab: its own window and its own store module; `run(fn)` calls fn(module) as that tab. */
async function openTab() {
  tabCount += 1;
  const listeners = new Set();
  const win = {
    addEventListener: (type, fn) => { if (type === 'storage') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'storage') listeners.delete(fn); },
    dispatch: (e) => run(() => [...listeners].forEach((fn) => fn(e))),
    listeners,
  };
  storage.windows.add(win);
  const mod = await import(`../../src/hooks/useBoardStore.js?tab=${tabCount}`);
  function run(fn) {
    const prev = globalThis.window;
    globalThis.window = win;
    try { return fn(mod); } finally { globalThis.window = prev; }
  }
  return { run, win, store: () => run((m) => m.useBoardStore()) };
}

/** The boards storage holds now (whichever board key this build writes). */
function savedBoards() {
  const raw = storage.getItem('cpwtcv_boards_v2') ?? storage.getItem('cpwtcv_boards_v1');
  return raw ? JSON.parse(raw).boards : null;
}

beforeEach(() => {
  storage = new SharedStorage();
  globalThis.localStorage = storage;
});

test('B-15: moving one of two cards that were saved with the same id leaves the other in place', async () => {
  const card = (id, title) => ({ id, title, checklist: [] });
  const board = {
    id: 'b', title: 'Merged',
    lists: [
      { id: 'l1', title: 'One', cards: [card('dup', 'Card in One')] },
      { id: 'l2', title: 'Two', cards: [card('dup', 'Card in Two'), card('z', 'Z')] },
    ],
  };
  storage.setItem('cpwtcv_boards_v1', JSON.stringify({ boards: [board], dataVersion: 1 }));
  const A = await openTab();
  A.run((m) => m.subscribe(() => {}));
  A.run(() => A.store().moveCard('b', { cardId: 'dup', toListId: 'l2', toIndex: 1 }));
  const after = A.run((m) => m.snapshot().boards.find((b) => b.id === 'b'));
  const titles = after.lists.flatMap((l) => l.cards.map((c) => c.title)).sort();
  assert.deepEqual(titles, ['Card in One', 'Card in Two', 'Z']);
});
