// Signing out in another tab takes this tab's unsaved résumés off the list too (R5-HUNT3-OTHER-TAB-SIGNOUT-KEEPS-UNSAVED-RESUMES-UNOWNED).
// Tab A's sign-out writes the store with no résumés and no owner (leaveAccount, R2-005). Tab B took
// that save but kept every résumé it had changed that storage had not seen yet (keepUnsaved: a
// keystroke its coalesced save still held, an edit a full storage refused), under syncedUid null:
// still on screen after the sign-out, and a list with no owner is the browser's own, which the next
// account to sign in sent to its own cloud. Now what tab B changed is kept aside for the account that
// left (stashed[uid], as leaveAccount keeps tab A's own), and written at once; the list is the other
// tab's. A list that had no owner still keeps its unsaved résumés when an account signs in there.
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

class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const cv = (id, name) => ({ id, name: id, template: 'classic', dataVersion: 11, updatedAt: 1, settings: {}, sections: [], personal: { name }, coverLetter: {} });
const store = (resumes, syncedUid, extra = {}) => ({
  resumes, activeId: resumes[0]?.id ?? null, dataVersion: 11, deletedIds: [], deletedInfo: {}, syncedUid,
  cloudVersions: syncedUid ? Object.fromEntries(resumes.map((r) => [r.id, r.updatedAt])) : {}, ...extra,
});

async function openStore(value) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const storage = new MemoryStorage([[KEY, JSON.stringify(value)]]);
  globalThis.localStorage = storage;
  let current = null;
  function Probe() { current = useAppStore(); return null; }
  const view = mount(() => createElement(StrictMode, null, createElement(Probe)));
  const settle = async () => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  await settle();
  await wait(400); // past the load's own save: the next change is one after a quiet spell
  await settle();
  return {
    view, settle,
    store: () => current,
    saved: () => JSON.parse(storage.getItem(KEY)),
    /** Types `text` into the open résumé's name: the first key is written, the rest held a moment. */
    async type(text) {
      for (let i = 1; i <= text.length; i += 1) { view.act(() => current.updatePersonal('name', text.slice(0, i))); }
      await settle();
    },
    /** The other tab writes `v` and this one hears of it. */
    otherTabSaves(v) {
      const raw = JSON.stringify(v);
      storage.map.set(KEY, raw);
      view.act(() => { view.window.dispatchEvent({ type: 'storage', key: KEY, newValue: raw }); });
    },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

describe('a sign-out in another tab takes this tab\'s unsaved résumés with the account (R5-HUNT3)', () => {
  it('a résumé typed in here just before is kept aside for the account, not left with no owner', async () => {
    const s = await openStore(store([cv('resume_a', 'Casey'), cv('resume_b', 'Jordan')], UID));
    try {
      await s.type('Casey Example');
      // Tab A signs out: its list leaves (nothing its cloud lacked there), written at once.
      s.otherTabSaves(store([], null, { stashed: {} }));
      await s.settle();
      const here = s.store().appState;
      assert.deepEqual(here.resumes.map((r) => r.id), [], 'before: resume_a stayed on screen with no owner');
      assert.equal(here.syncedUid, null);
      assert.equal(here.stashed?.[UID]?.resumes?.[0]?.personal?.name, 'Casey Example', 'what was typed is kept aside for the account');
      const saved = s.saved();
      assert.deepEqual(saved.resumes, [], 'storage holds no résumé of the account either');
      assert.equal(saved.stashed?.[UID]?.resumes?.[0]?.personal?.name, 'Casey Example', 'the stash is written');
      assert.equal(s.store().saving, false, 'at once');
      // This tab's own auth then hears of the sign-out: nothing of the account comes back.
      s.view.act(() => s.store().leaveAccount(UID));
      await s.settle();
      assert.deepEqual(s.store().appState.resumes, []);
    } finally { await s.close(); }
  });

  it('what the other tab kept aside for the account is kept too, this tab\'s newer copy in it', async () => {
    const s = await openStore(store([cv('resume_a', 'Casey'), cv('resume_b', 'Jordan')], UID));
    try {
      await s.type('Casey Example');
      const theirs = { ...cv('resume_b', 'Jordan Changed'), updatedAt: 5 };
      s.otherTabSaves(store([], null, { stashed: { [UID]: { resumes: [theirs, { ...cv('resume_a', 'Casey Old'), updatedAt: 4 }], versions: { resume_a: 1, resume_b: 1 } } } }));
      await s.settle();
      const kept = s.store().appState.stashed?.[UID]?.resumes || [];
      assert.deepEqual(kept.map((r) => [r.id, r.personal.name]).sort(), [['resume_a', 'Casey Example'], ['resume_b', 'Jordan Changed']]);
      assert.deepEqual(s.store().appState.resumes, []);
    } finally { await s.close(); }
  });

  it('another account signing in there: the list is its own, this tab\'s change kept aside for the account that left', async () => {
    const s = await openStore(store([cv('resume_a', 'Casey')], UID));
    try {
      await s.type('Casey Example');
      s.otherTabSaves(store([cv('resume_z', 'Riley')], 'uid_riley', { stashed: {} }));
      await s.settle();
      const here = s.store().appState;
      assert.deepEqual(here.resumes.map((r) => r.id), ['resume_z']);
      assert.equal(here.syncedUid, 'uid_riley');
      assert.equal(here.stashed?.[UID]?.resumes?.[0]?.personal?.name, 'Casey Example');
    } finally { await s.close(); }
  });

  it('a list with no owner keeps its unsaved résumé when an account signs in there, as before', async () => {
    const s = await openStore(store([cv('resume_a', 'Casey')], null));
    try {
      await s.type('Casey Example');
      s.otherTabSaves(store([cv('resume_a', 'Casey')], UID));
      await s.settle();
      const here = s.store().appState;
      assert.equal(here.resumes.find((r) => r.id === 'resume_a')?.personal?.name, 'Casey Example');
      assert.equal(here.stashed, undefined);
    } finally { await s.close(); }
  });
});
