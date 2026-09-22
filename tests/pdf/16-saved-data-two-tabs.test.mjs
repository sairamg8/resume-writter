// Two tabs of the app share one saved store (localStorage `cpwtcv_v1`), and each saved its whole
// résumé list on every change without ever reading the other's saves: a résumé created in one tab
// was erased by the next edit in the other, and an edit made there was undone (bug audit
// 2026-09-22). Signed out, nothing brought it back. The store now takes another tab's save as it
// happens (the `storage` event), keeping what this tab changed that storage has not seen — the job
// and board stores' rule (keepUnsaved) — and this tab's own open résumé.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in; `writes` counts this tab's saves. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); this.writes = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.writes += 1; this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const cv = (id, updatedAt = 1, extra = {}) => ({
  id, name: id, template: 'classic', dataVersion: 11, updatedAt, settings: {}, sections: [],
  personal: { name: id }, coverLetter: {}, ...extra,
});
const storeOf = (resumes, extra = {}) => ({ resumes, activeId: resumes[0]?.id ?? null, dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null, ...extra });
const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** This tab: useAppStore mounted as the app mounts it (StrictMode) over a saved `state`. */
async function openTab(state) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify(state)]]);
  globalThis.localStorage = storage;
  let current = null;
  function Probe() {
    current = useAppStore();
    return null;
  }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  await settle();
  return {
    store: () => current,
    storage,
    saved: () => JSON.parse(storage.getItem(KEY)),
    act: async (fn) => { view.act(fn); await settle(); },
    /** Another tab saves `state`: storage holds it, and this tab is told, as a browser tells it. */
    async otherTabSaves(state) {
      const value = JSON.stringify(state);
      storage.map.set(KEY, value);
      view.act(() => { view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: value }); });
      await settle();
      return value;
    },
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

describe('two tabs of the app', () => {
  it('a résumé created in the other tab survives this tab’s next edit', async () => {
    const tab = await openTab(storeOf([cv('resume_a')]));
    try {
      await tab.otherTabSaves(storeOf([cv('resume_a'), cv('resume_b', 5, { name: 'Made in tab 2' })]));
      await tab.act(() => tab.store().updatePersonal('name', 'Edited in tab 1'));
      const saved = tab.saved();
      assert.deepEqual(saved.resumes.map((r) => r.id), ['resume_a', 'resume_b'], 'before: tab 1 wrote its own list and B was gone');
      assert.equal(saved.resumes[0].personal.name, 'Edited in tab 1');
      assert.equal(saved.resumes[1].name, 'Made in tab 2');
    } finally { await tab.close(); }
  });

  it('an edit made in the other tab is shown here and not undone by this tab’s next save', async () => {
    const tab = await openTab(storeOf([cv('resume_a'), cv('resume_b')]));
    try {
      await tab.otherTabSaves(storeOf([cv('resume_a', 7, { name: 'Renamed in tab 2' }), cv('resume_b')]));
      assert.equal(tab.store().appState.resumes[0].name, 'Renamed in tab 2');
      await tab.act(() => { tab.store().setActiveId('resume_b'); });
      await tab.act(() => tab.store().updatePersonal('name', 'B edited here'));
      assert.deepEqual(tab.saved().resumes.map((r) => r.name), ['Renamed in tab 2', 'resume_b']);
      assert.equal(tab.saved().resumes[1].personal.name, 'B edited here');
    } finally { await tab.close(); }
  });

  it('a résumé deleted in the other tab stays deleted here', async () => {
    const tab = await openTab(storeOf([cv('resume_a'), cv('resume_b')]));
    try {
      await tab.otherTabSaves(storeOf([cv('resume_b')], { deletedIds: ['resume_a'], deletedInfo: { resume_a: { version: 1, at: 9, owner: null } } }));
      assert.deepEqual(tab.store().appState.resumes.map((r) => r.id), ['resume_b']);
      await tab.act(() => tab.store().updatePersonal('name', 'B edited'));
      assert.deepEqual(tab.saved().resumes.map((r) => r.id), ['resume_b']);
      assert.deepEqual(tab.saved().deletedIds, ['resume_a']);
    } finally { await tab.close(); }
  });

  it('keeps its own open résumé, and does not write back a save it only took', async () => {
    const tab = await openTab(storeOf([cv('resume_a'), cv('resume_b')]));
    try {
      const writes = tab.storage.writes;
      const theirs = await tab.otherTabSaves(storeOf([cv('resume_a'), cv('resume_b', 3, { name: 'B in tab 2' })], { activeId: 'resume_b' }));
      assert.equal(tab.store().appState.activeId, 'resume_a');
      assert.equal(tab.store().activeResume.id, 'resume_a');
      assert.equal(tab.storage.getItem(KEY), theirs, 'storage holds the other tab’s save as it wrote it');
      assert.equal(tab.storage.writes, writes, 'no write back — two tabs would answer each other for ever');
    } finally { await tab.close(); }
  });
});
