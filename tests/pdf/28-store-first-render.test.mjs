// The résumé store's first render writes nothing to localStorage (VM4-9). useAppStore reads the
// saved store in a useState initializer, which React's StrictMode runs twice in development; it
// used to back up an unreadable store and keep its notice from there. The server renderer runs
// no effects, so what a render writes shows here on its own. That the backup and the notice still
// come, from the effect, is checked by cypress/e2e/07-regressions-store.cy.js (R4-6, M2, R8-10).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in that keeps a list of every write made to it. */
class RecordingStorage {
  constructor(entries) { this.map = new Map(entries); this.writes = []; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.writes.push(`set ${k}`); this.map.set(k, String(v)); }
  removeItem(k) { this.writes.push(`remove ${k}`); this.map.delete(k); }
}

/** Render useAppStore once, as the app does (under StrictMode), over `entries`: what it returned. */
async function firstRender(entries) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new RecordingStorage(entries);
  let store = null;
  function Probe() {
    store = useAppStore();
    return null;
  }
  try {
    renderToString(createElement(StrictMode, null, createElement(Probe)));
    return { store, writes: localStorage.writes, keys: [...localStorage.map.keys()] };
  } finally {
    delete globalThis.localStorage;
  }
}

it('an unreadable saved store: the render starts empty and writes nothing — no backup, no notice (VM4-9)', async () => {
  const { store, writes, keys } = await firstRender([[KEY, '{ not json']]);
  assert.deepEqual(store.appState.resumes, []);
  // Before: ['set cpwtcv_v1_backup_…', 'set cpwtcv_v1_recovery'], from the initializer.
  assert.deepEqual(writes, []);
  assert.deepEqual(keys, [KEY]);
});

it('a store with one résumé that cannot be read: the render keeps the rest and writes nothing', async () => {
  const good = { id: 'resume_ok', name: 'Kept', personal: { name: 'Sam' }, sections: [] };
  const { store, writes } = await firstRender([[KEY, JSON.stringify({ resumes: [{ name: 'no id' }, good], activeId: 'resume_ok' })]]);
  assert.deepEqual(store.appState.resumes.map((r) => r.id), ['resume_ok']);
  assert.equal(store.appState.activeId, 'resume_ok');
  assert.deepEqual(writes, []);
});

it('a notice kept from an earlier visit still shows on the first render (R4-0), before any effect', async () => {
  // Guard: the notice now comes from the effect for a new repair, never later for a kept one.
  const notice = { backupKey: `${KEY}_backup_1000`, earlier: [] };
  const { store, writes } = await firstRender([
    [KEY, JSON.stringify({ resumes: [] })], [`${KEY}_backup_1000`, '{ old'], [`${KEY}_recovery`, JSON.stringify(notice)],
  ]);
  assert.deepEqual(store.recovery, notice);
  assert.deepEqual(writes, []);
});
