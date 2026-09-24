// Every change to the résumé store — each keystroke in a field — serialised the whole store (all
// résumés, their photos as base64) and wrote it to localStorage at once, on the main thread
// (R2-077). Now a change after a quiet spell is still written at once, and the changes that follow
// it within a moment are written together, a short wait after the last one (and at least every
// couple of seconds while typing goes on). Nothing typed is lost: leaving the page (pagehide,
// beforeunload), hiding it (visibilitychange), or the store unmounting writes what waits. A write
// that storage refuses still shows as persistError, and the next write that succeeds clears it.
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

/** A localStorage stand-in; `saves` counts the writes of the résumé store; `full` refuses them. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); this.saves = 0; this.full = false; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.full) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    if (k === KEY) this.saves += 1;
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

const cv = { id: 'resume_a', name: 'A', template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name: '' }, coverLetter: {} };

async function openStore() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [cv], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: null })]]);
  globalThis.localStorage = storage;
  let current = null;
  function Probe() { current = useAppStore(); return null; }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  await wait(400); // past the first save's moment: the next change is one after a quiet spell
  return {
    view, storage, settle,
    store: () => current,
    savedName: () => JSON.parse(storage.getItem(KEY)).resumes[0].personal.name,
    async type(text) {
      for (let i = 1; i <= text.length; i += 1) { view.act(() => current.updatePersonal('name', text.slice(0, i))); }
      await settle();
    },
    fire(target, type) { view.act(() => target.dispatchEvent({ type })); },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('the résumé store’s saves while typing (R2-077)', () => {
  it('typing 20 characters writes the store a couple of times, not 20; a moment later it holds them all', async () => {
    const s = await openStore();
    try {
      const saves = s.storage.saves;
      await s.type('Alexandra Q. Example');
      assert.ok(s.storage.saves - saves <= 2, `before: ${s.storage.saves - saves} whole-store writes for 20 keystrokes`);
      await wait(700);
      await s.settle();
      assert.equal(s.savedName(), 'Alexandra Q. Example');
    } finally { await s.close(); }
  });

  for (const [how, leave] of [
    ['pagehide', (s) => s.fire(s.view.window, 'pagehide')],
    ['beforeunload', (s) => s.fire(s.view.window, 'beforeunload')],
    ['the tab hidden', (s) => { s.view.document.hidden = true; s.view.document.visibilityState = 'hidden'; s.fire(s.view.document, 'visibilitychange'); }],
  ]) {
    it(`nothing typed is lost: ${how} writes what waits, at once`, async () => {
      const s = await openStore();
      try {
        await s.type('Sam Example');
        leave(s);
        assert.equal(s.savedName(), 'Sam Example');
      } finally { await s.close(); }
    });
  }

  it('the store unmounting writes what waits', async () => {
    const s = await openStore();
    await s.type('Jo Example');
    await s.close();
    assert.equal(JSON.parse(s.storage.getItem(KEY)).resumes[0].personal.name, 'Jo Example');
  });

  it('typing that goes on is still written every couple of seconds', async () => {
    const s = await openStore();
    try {
      const saves = s.storage.saves;
      for (let i = 1; i <= 30; i += 1) {
        s.view.act(() => s.store().updatePersonal('name', `x${i}`));
        await wait(100);
      }
      assert.ok(s.storage.saves - saves >= 2, `only ${s.storage.saves - saves} writes over 3 s of typing`);
      assert.ok(s.storage.saves - saves <= 6, `${s.storage.saves - saves} writes over 3 s of typing`);
    } finally { await s.close(); }
  });

  it('a write storage refuses shows as persistError; the next that succeeds clears it', async () => {
    const s = await openStore();
    try {
      s.storage.full = true;
      await s.type('Refused');
      s.fire(s.view.window, 'pagehide');
      await s.settle();
      assert.equal(s.store().persistError?.name, 'QuotaExceededError');
      s.storage.full = false;
      await s.type('Refused, then kept');
      s.fire(s.view.window, 'pagehide');
      await s.settle();
      assert.equal(s.store().persistError, null);
      assert.equal(s.savedName(), 'Refused, then kept');
    } finally { await s.close(); }
  });
});
