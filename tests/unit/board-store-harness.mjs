// The board store's test harness (not a test file itself): tabs are instances of
// src/hooks/useBoardStore.js (a ?tab query each) sharing one fake localStorage, which sends a
// 'storage' event to every other tab's window, as a browser does, and can be made full. React
// is replaced by a stub whose useSyncExternalStore just reads the snapshot, so useBoardStore()
// hands out the actions outside a component. Events arrive later, as in a browser: `await
// settle()` delivers them. Used by board-store*.unit.mjs.
import { register } from 'node:module';

const REACT_STUB = 'export const useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();';
const HOOKS = `export async function resolve(specifier, context, next) {
  if (specifier === 'react') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(REACT_STUB)}), shortCircuit: true };
  return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

/** localStorage shared by every tab: each write reaches the other tabs as a 'storage' event. */
export class SharedStorage {
  constructor() { this.map = new Map(); this.windows = new Set(); this.quota = Infinity; this.writes = []; }
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
    this.writes.push(k);
    this.fire(k, oldValue, String(v));
  }
  removeItem(k) {
    const oldValue = this.getItem(k);
    this.map.delete(k);
    this.fire(k, oldValue, null);
  }
  /** As a browser does it: later (a task), in every other tab — never inside the writer's own call. */
  fire(key, oldValue, newValue) {
    const self = globalThis.window;
    for (const w of this.windows) if (w !== self) queueMicrotask(() => w.dispatch({ key, oldValue, newValue }));
  }
  /** Full from now on: nothing more fits (the backups aside, which setItemWithRoom may remove). */
  fill() { this.quota = [...this.map].reduce((n, [k, v]) => n + k.length + v.length, 0); }
}

let tabCount = 0;

/** A tab: its own window and its own store module; `run(fn)` calls fn(module) as that tab. */
export async function openTab(storage) {
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
  return {
    run, win,
    store: () => run((m) => m.useBoardStore()),
    boards: () => run((m) => m.snapshot().boards),
    open: () => run((m) => m.subscribe(() => {})),
  };
}

/** Let every queued 'storage' event (and those they cause) reach its tab. */
export const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });

/** A fresh shared storage, installed as globalThis.localStorage. */
export function freshStorage() {
  const storage = new SharedStorage();
  globalThis.localStorage = storage;
  return storage;
}

/** The boards `storage` holds under the v2 key, else the v1 key; null when neither. */
export function savedBoards(storage) {
  const raw = storage.getItem('cpwtcv_boards_v2') ?? storage.getItem('cpwtcv_boards_v1');
  return raw ? JSON.parse(raw).boards : null;
}

/** Every issue (v2) or card (v1) title of a board. */
export const titlesOf = (board) => (board.issues ? board.issues.map((i) => i.title) : board.lists.flatMap((l) => l.cards.map((c) => c.title)));
/** Every due date of a board's issues (v2) or cards (v1). */
export const duesOf = (board) => (board.issues ? board.issues.map((i) => i.due) : board.lists.flatMap((l) => l.cards.map((c) => c.due)));
export const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
