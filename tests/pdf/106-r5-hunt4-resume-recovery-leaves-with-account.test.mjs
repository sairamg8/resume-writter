// The résumé list's recovery notice and raw backups leave this browser with the account whose list
// they copy (R5-HUNT4-recovery-backup-survives-signout). Since R2-005 an account's résumés leave the
// browser when it signs out, or when another account signs in (cloudSyncLeave.leaveAccount); but the
// copies storageBackup.backupRaw made of a store that could not be read in full
// (`cpwtcv_v1_backup_<ms>`: every résumé, photos and contact details included) and the notice
// offering them (`cpwtcv_v1_recovery`) stayed, and the Dashboard offered "Download the copy" to
// whoever used the browser next. Run as the app runs it: the engine, its Firestore calls and the
// store's own updaters (tests/pdf/fake-firestore.mjs, liveStore), with the store's leaveRecovery
// as useAppStore makes it. Fictional data only.
import { before, after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { fakeFirestore, syncPage, syncModules, resumePath, settle } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';
// A namespace import: without the fix forgetRecovery is not there, and the tests below fail at
// their assertions (fail-first), not at loading the file.
import * as storageBackup from '../../src/utils/storageBackup.js';

const { backupRaw, pendingRecovery, rememberRecovery, _resetUnpersistedNotices } = storageBackup;

let mods;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
});
after(() => { delete globalThis.localStorage; return teardown(); });

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); _resetUnpersistedNotices(); });

const KEY = 'cpwtcv_v1';
const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: DATA_VERSION, ...extra });
const ALICE = cv('resume_alice', 5, { name: 'Alice', personal: { phone: '555-0100', email: 'alice@x' } });
const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const backups = () => [...localStorage.map.keys()].filter((k) => k.startsWith(`${KEY}_backup_`));

/** A page whose store has useAppStore's leaveRecovery; the store could not be read in full. */
function damagedPage(cloud, state) {
  const raw = JSON.stringify({ resumes: [ALICE, 'not a résumé'] });
  rememberRecovery(KEY, { backupKey: backupRaw(KEY, raw) });
  const p = syncPage(mods, cloud, state);
  p.left = 0;
  p.store.leaveRecovery = () => { p.left += 1; storageBackup.forgetRecovery?.(KEY); };
  return p;
}
const signInAs = async (p, cloud, user) => { cloud.auth = user?.uid ?? null; p.sync.start(user); await settle(); };

describe('the résumés\' recovery notice and backups leave with the account (R5-HUNT4)', () => {
  it('A signs out: the notice and A\'s raw backup leave the browser with A\'s résumés', async () => {
    const cloud = fakeFirestore({ [resumePath('A', ALICE.id)]: ALICE });
    const p = damagedPage(cloud, { resumes: [] });
    await signInAs(p, cloud, A);
    assert.ok(pendingRecovery(KEY), 'signed in, the notice is A\'s to see');
    await signInAs(p, cloud, null);
    assert.deepEqual(p.store.state.resumes, []);
    assert.equal(pendingRecovery(KEY), null, 'before: the Dashboard still offered "Download the copy" to whoever came next');
    assert.deepEqual(backups(), [], 'before: every résumé A had stayed in cpwtcv_v1_backup_*');
    assert.equal(JSON.stringify([...localStorage.map.values()]).includes('555-0100'), false);
  });

  it('B signs in while the list is still A\'s: the notice and backup leave with A\'s list', async () => {
    const cloud = fakeFirestore({ [resumePath('B', 'resume_b')]: cv('resume_b') });
    const p = damagedPage(cloud, { resumes: [ALICE], syncedUid: 'A', cloudVersions: { [ALICE.id]: 5 } });
    await signInAs(p, cloud, B);
    assert.equal(pendingRecovery(KEY), null);
    assert.deepEqual(backups(), []);
  });

  it('a list no account synced is this browser\'s: signing in keeps its notice and backup', async () => {
    const cloud = fakeFirestore({});
    const p = damagedPage(cloud, { resumes: [ALICE] });
    await signInAs(p, cloud, A);
    assert.equal(p.left, 0);
    assert.ok(pendingRecovery(KEY));
    assert.equal(backups().length, 1);
  });

  // The real store, as App.jsx hands it to useCloudSync (liveStore over { appState, store }).
  const ticks = async (n = 5) => { for (let i = 0; i < n; i += 1) await new Promise((r) => { setImmediate(r); }); };
  async function realStore(saved) {
    localStorage.setItem(KEY, JSON.stringify(saved));
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    let store = null;
    function Page() { store = useAppStore(); return null; }
    const view = mount(Page, {});
    await ticks(); // useAppStore's effect backs up what it could not read and keeps the notice
    return { view, store: () => store, live: mods.actions.liveStore(() => ({ appState: store.appState, store })) };
  }

  it('useAppStore: A\'s list leaving takes the notice off the Dashboard, and its backup out of storage', async () => {
    const page = await realStore({ resumes: [ALICE, { name: 'no id' }], activeId: ALICE.id, syncedUid: 'A', cloudVersions: { [ALICE.id]: 5 } });
    try {
      assert.ok(page.store().recovery?.backupKey, 'the store was not read in full: the Dashboard offers the copy');
      assert.equal(backups().length, 1);
      page.view.act(() => page.live.leaveAccount('A'));
      await ticks();
      assert.deepEqual(page.store().appState.resumes, [], 'A\'s résumés leave (R2-005)');
      assert.equal(page.store().recovery, null, 'before: the Dashboard still showed "Download the copy"');
      assert.equal(pendingRecovery(KEY), null);
      assert.deepEqual(backups(), [], 'before: A\'s raw store stayed in cpwtcv_v1_backup_*');
    } finally { await page.view.unmount(); }
  });

  it('useAppStore: another account\'s leave (the list is not its) keeps the notice and backup', async () => {
    const page = await realStore({ resumes: [ALICE, { name: 'no id' }], activeId: ALICE.id, syncedUid: 'A', cloudVersions: { [ALICE.id]: 5 } });
    try {
      page.view.act(() => page.live.leaveAccount('B'));
      await ticks();
      assert.equal(page.store().appState.resumes.length, 1, 'the list is A\'s, not B\'s: it stays');
      assert.ok(page.store().recovery?.backupKey);
      assert.ok(pendingRecovery(KEY));
      assert.equal(backups().length, 1);
    } finally { await page.view.unmount(); }
  });
});
