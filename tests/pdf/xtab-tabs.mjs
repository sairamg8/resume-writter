// Several tabs of the app over ONE localStorage, for the cross-tab tests (typing-freeze 5, tests 160-162).
// Each tab is the real useAppStore mounted as the app mounts it (StrictMode, react-dom/client over
// fake-dom.mjs) in a window of its own. A write to the résumé store's key by one tab queues a `storage`
// event for every other tab — and only when the value changed, as a browser does — which the test
// delivers when it chooses: a tab typing meanwhile has its own save held (a coalesced write), and a
// write made before the event arrives is the race two tabs typing at once run into. Writes are
// flushed by the tab's own `pagehide` listener, so no timer decides when anything is saved.
import { createElement, StrictMode } from 'react';
import { loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

export const KEY = 'cpwtcv_v1';

const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** The one localStorage every tab shares; `writer` is the tab whose code is running (its writes raise no event for it). */
class SharedStorage {
  constructor(entries) { this.map = new Map(entries); this.tabs = []; this.writer = null; this.writes = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const value = String(v);
    const changed = this.map.get(k) !== value;
    this.map.set(k, value);
    if (k !== KEY) return;
    this.writes += 1;
    if (changed) for (const tab of this.tabs) if (tab !== this.writer) tab.inbox.push(value);
  }
  removeItem(k) { this.map.delete(k); }
}

export const storeOf = (resumes) => ({ resumes, activeId: resumes[0].id, dataVersion: DATA_VERSION, deletedIds: [], deletedInfo: {}, syncedUid: null });

/** A résumé with a few entries, saved at the current data version (so loading it changes nothing). */
export function savedResume(extra = {}) {
  const entry = (id, role = '') => ({ id, company: `Co ${id}`, role, location: '', startDate: '', endDate: '', current: false, description: '' });
  return {
    id: 'resume_x', name: 'Casey', template: 'classic', dataVersion: DATA_VERSION, updatedAt: 1,
    settings: { accentColor: '#1a7f5a', font: 'notosans', tfProbe: 'x' },
    personal: { name: 'Casey Example', jobTitle: '', website: '', email: '', phone: '', summary: '[A:][B:][C:]', hiddenFields: [] },
    coverLetter: {},
    sections: [
      { id: 'sec_exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [entry('e_a'), entry('e_b'), entry('e_c')] },
      { id: 'sec_edu', type: 'experience', title: 'Other', visible: true, settings: {}, items: [entry('o_a')] },
    ],
    ...extra,
  };
}

/** `n` tabs open on the saved store `state`, all up to date. Returns `{ tabs, storage, close }`. */
export async function openTabs(n, state) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new SharedStorage([[KEY, JSON.stringify(state)]]);
  globalThis.localStorage = storage;
  // A clock of the test's own: Date.now() and setTimeout stand still until `tick`. Whether an edit is written
  // at once (after a quiet spell) or held for the coalesced save, and when a held save's timer rings, then
  // depends on nothing but the test — not on how fast the machine is. A timer set while a tab's code runs
  // rings as that tab's: its write is that tab's.
  const real = { now: Date.now, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  let clock = 1_800_000_000_000;
  const timers = [];
  Date.now = () => clock;
  globalThis.setTimeout = (fn, ms = 0, ...args) => {
    const timer = { at: clock + ms, who: storage.writer, run: () => fn(...args), cancelled: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer && 'cancelled' in timer) timer.cancelled = true; else real.clearTimeout(timer); };
  function tick(ms) {
    clock += ms;
    for (const timer of timers.filter((x) => x.at <= clock && !x.cancelled).sort((x, y) => x.at - y.at)) {
      timer.cancelled = true;
      const was = storage.writer;
      storage.writer = timer.who;
      try { timer.run(); } finally { storage.writer = was; }
    }
  }
  /** Runs `fn` as `tab`: what it writes raises its event for the others, not for `tab`. */
  async function as(tab, fn) {
    const was = storage.writer;
    storage.writer = tab;
    try { await fn(); await settle(); } finally { storage.writer = was; }
  }

  const tabs = [];
  for (let i = 0; i < n; i += 1) {
    let current = null;
    function Probe() { current = useAppStore(); return null; }
    const tab = { name: 'ABCDEFG'[i], inbox: [] };
    storage.tabs.push(tab);
    let view;
    await as(tab, () => { view = mount(() => createElement(StrictMode, null, createElement(Probe))); });
    const hear = (count = Infinity) => {
      for (const value of tab.inbox.splice(0, count)) view.act(() => { view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: value }); });
    };
    Object.assign(tab, {
      view,
      store: () => current,
      resume: () => current.appState.resumes.find((r) => r.id === 'resume_x'),
      /**
       * Changes this tab's state as the editor does (a store call), held for the coalesced save — or written
       * at once after a quiet spell. The storage events that reached this tab are heard first, as a browser
       * delivers them within a moment; `race: true` skips that, the edit and its write made before this
       * tab has heard the other's save (the window two tabs typing at once run into).
       */
      edit: (fn, { race = false } = {}) => as(tab, () => {
        if (!race) hear();
        view.act(() => fn(current));
      }),
      /** Writes what this tab holds (leaving the page flushes it); the events waiting are heard first unless `race`. */
      flush: ({ race = false } = {}) => as(tab, () => {
        if (!race) hear();
        view.act(() => { view.window.dispatchEvent({ type: 'pagehide' }); });
      }),
      /** Delivers the storage events this tab has not heard (`count`: only that many, the oldest first). */
      deliver: (count = Infinity) => as(tab, () => hear(count)),
      saving: () => current.saving,
    });
    tabs.push(tab);
  }
  const api = {
    tabs, storage, tick,
    saved: () => JSON.parse(storage.getItem(KEY)),
    /** Every tab writes what it holds and hears everything, until nothing is left to say. */
    async quiesce() {
      for (let round = 0; round < 40; round += 1) {
        let busy = false;
        for (const tab of tabs) {
          if (tab.inbox.length) { await tab.deliver(); busy = true; }
          if (tab.saving()) { await tab.flush(); busy = true; }
        }
        if (!busy) return;
      }
      throw new Error('the tabs never went quiet: they answer each other for ever');
    },
    async close() {
      Date.now = real.now;
      globalThis.setTimeout = real.setTimeout;
      globalThis.clearTimeout = real.clearTimeout;
      for (const tab of [...tabs].reverse()) await as(tab, () => tab.view.unmount());
      delete globalThis.localStorage;
    },
  };
  await api.quiesce(); // the tabs' own loads wrote the store: every one has heard it
  return api;
}

/** Every tab holds the résumé storage holds — the same in all of them. */
export function assertConverged(assert, { tabs, saved }) {
  const stored = saved().resumes;
  for (const tab of tabs) {
    assert.deepEqual(JSON.parse(JSON.stringify(tab.store().appState.resumes)), stored, `tab ${tab.name} holds another résumé than storage does`);
  }
}

/** Types `text` into a personal field of `tab`'s résumé a character at a time, at `at` (default: the end). */
export async function type(tab, field, text, at = null) {
  for (let i = 0; i < text.length; i += 1) {
    const now = tab.resume().personal[field] ?? '';
    const pos = at === null ? now.length : at + i;
    await tab.edit((s) => s.updatePersonal(field, now.slice(0, pos) + text[i] + now.slice(pos)));
  }
}

