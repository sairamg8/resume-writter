// Another tab's save leaves the résumés it did not change as they were here (R2-142). Taking it
// (the storage event) put a copy parsed from its JSON in place of every résumé, changed or not: the
// résumé open here became a new object with the same content, so its preview (PdfPreview builds on
// a new `input`) and the dashboard's thumbnails were built again for nothing — with two windows
// side by side, at every save of the one being typed in. Now a résumé whose saved copy reads the
// same is the very object this tab holds; the one the other tab changed is taken as before.
// The real useAppStore under StrictMode, effects included (react-dom/client over tests/pdf/fake-dom.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** A localStorage stand-in; `saves` counts the writes of the résumé store. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); this.saves = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (k === KEY) this.saves += 1; this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const cv = (id, name) => ({
  id, name: id, template: 'classic', dataVersion: 11, updatedAt: 1, sections: [],
  settings: { accentColor: '#1a7f5a' }, personal: { name }, coverLetter: {},
});
const store = (resumes) => ({ resumes, activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null });

async function openStore() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify(store([cv('resume_a', 'Casey Example'), cv('resume_b', 'Jordan Sample')]))]]);
  globalThis.localStorage = storage;
  let current = null;
  function Probe() { current = useAppStore(); return null; }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  await wait(400); // past the load's own save
  await settle();
  return {
    view, storage, settle,
    store: () => current,
    /** The other tab writes `value` and this one hears of it. */
    otherTabSaves(value) {
      const raw = JSON.stringify(value);
      storage.map.set(KEY, raw);
      view.act(() => { view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: raw }); });
    },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('another tab’s save leaves what it did not change as it was (R2-142)', () => {
  it('the other tab edits résumé B: résumé A open here is the same object, B is taken', async () => {
    const s = await openStore();
    try {
      const a = s.store().activeResume;
      assert.equal(a.id, 'resume_a');
      const b = { ...cv('resume_b', 'Jordan Q. Sample'), updatedAt: 2 };
      s.otherTabSaves(store([cv('resume_a', 'Casey Example'), b]));
      await s.settle();
      assert.equal(s.store().activeResume, a, 'before: a copy of A with the same content — its preview built again');
      assert.equal(s.store().appState.resumes.find((r) => r.id === 'resume_b').personal.name, 'Jordan Q. Sample', 'B taken');
    } finally { await s.close(); }
  });

  it('what was taken as the same is still weighed as the saved copy: a later save of A by the other tab is taken', async () => {
    const s = await openStore();
    try {
      const b = { ...cv('resume_b', 'Jordan Q. Sample'), updatedAt: 2 };
      s.otherTabSaves(store([cv('resume_a', 'Casey Example'), b]));
      await s.settle();
      const a2 = { ...cv('resume_a', 'Casey R. Example'), updatedAt: 3 };
      s.otherTabSaves(store([a2, b]));
      await s.settle();
      assert.equal(s.store().activeResume.personal.name, 'Casey R. Example', 'A is not held here as an edit of this tab');
    } finally { await s.close(); }
  });

  it('A changed there with the same updatedAt still reads as changed: it is taken', async () => {
    const s = await openStore();
    try {
      const a = s.store().activeResume;
      s.otherTabSaves(store([cv('resume_a', 'Casey Changed'), cv('resume_b', 'Jordan Sample')]));
      await s.settle();
      assert.notEqual(s.store().activeResume, a);
      assert.equal(s.store().activeResume.personal.name, 'Casey Changed');
    } finally { await s.close(); }
  });
});
