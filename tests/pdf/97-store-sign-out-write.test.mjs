// A sign-out's list leaving this browser reaches storage at once (R2-142). Since saves were
// coalesced (R2-077) a change within a moment of the last write is held — and so was the store
// once its account signed out (leaveAccount, R2-005, which takes that account's résumés off this
// browser) when the user had typed just before: for that moment storage still held the account's
// résumés, and a browser closed with no pagehide (killed, crashed) showed them to whoever opened it
// next. Now the list changing hands (syncedUid) is written at once, typing and all — what the cloud
// lacks kept aside for the account, so nothing typed is lost — while typing with the account
// unchanged is still coalesced.
// The real useAppStore under StrictMode, effects included (react-dom/client over tests/pdf/fake-dom.mjs).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, StrictMode } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const UID = 'uid_casey';
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

const cv = { id: 'resume_a', name: 'A', template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name: '' }, coverLetter: {} };

/** The store of account UID's list, synced: its cloud holds resume_a as it is here. */
async function openStore() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify({
    resumes: [cv], activeId: 'resume_a', dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid: UID, cloudVersions: { resume_a: 1 },
  })]]);
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
    saved: () => JSON.parse(storage.getItem(KEY)),
    async type(text) {
      for (let i = 1; i <= text.length; i += 1) { view.act(() => current.updatePersonal('name', text.slice(0, i))); }
      await settle();
    },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('a sign-out right after typing reaches storage at once (R2-142)', () => {
  it('the account\'s list is off storage at once, what was typed kept aside for it', async () => {
    const s = await openStore();
    try {
      await s.type('Casey Example'); // the first key is written; the rest wait a moment
      s.view.act(() => s.store().leaveAccount(UID));
      await s.settle();
      const saved = s.saved();
      assert.deepEqual([saved.resumes.length, saved.syncedUid], [0, null], 'before: storage still held the signed-out account\'s résumés');
      assert.equal(saved.stashed?.[UID]?.resumes?.[0]?.personal?.name, 'Casey Example', 'what its cloud lacks is kept aside, whole');
      assert.equal(s.store().saving, false, 'nothing waits');
    } finally { await s.close(); }
  });

  it('typing while the account stays is still coalesced: a couple of writes, not one per key', async () => {
    const s = await openStore();
    try {
      const saves = s.storage.saves;
      await s.type('Alexandra Q. Example');
      assert.ok(s.storage.saves - saves <= 2, `${s.storage.saves - saves} whole-store writes for 20 keys`);
      await wait(700);
      await s.settle();
      assert.deepEqual([s.saved().resumes[0].personal.name, s.saved().syncedUid], ['Alexandra Q. Example', UID]);
    } finally { await s.close(); }
  });
});
