// A burst of keystrokes must not make React give up and drop one when signed in either (R2-142). The
// signed-out half (tests/pdf/114-keystroke-burst) is the store's `saving` and the preview's status. Signed
// in, the cloud sync reports 'syncing' on every change of the résumés once its first sync is done
// (cloudSyncQueue.js), and useCloudSync set it with the raw state setter: every keystroke, in App, the
// component that has just re-rendered from the keystroke's own update. React skips setting a state to the
// value it holds only when the component has no update waiting on either copy of its fiber; in a burst it
// always has one, so each 'syncing' left another waiting, the nested-update count climbed, and at about the
// 50th key React threw error #185 ("Maximum update depth exceeded") from the input's onChange: that key lost.
// Here useAppStore and useCloudSync run in one component, as App.jsx has them, signed in over a stand-in
// Firestore (tests/pdf/fake-firestore.mjs through useCloudSync._setCloudIoForTest). The keys are flushSync
// commits ~9 ms apart in a loop that never yields, as a discrete event's commits on a busy page are: React's
// Default-lane work cannot run between them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { fakeFirestore, syncModules, resumePath } from './fake-firestore.mjs';
import { DATA_VERSION } from '../../src/utils/dataVersion.js';

// No Firebase in this test's build, whatever .env holds: the hook's own Firestore is null and the stand-in
// is the only cloud it reaches. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

let mods;
let cloudSync;
let appStore;
before(async () => {
  await setup();
  mods = await syncModules(loadModule);
  cloudSync = await loadModule('/src/hooks/useCloudSync.js');
  appStore = await loadModule('/src/hooks/useResumeStore.js');
});
after(async () => {
  cloudSync?._setCloudIoForTest?.(null);
  delete globalThis.localStorage;
  await teardown();
});

const KEY = 'cpwtcv_v1';
const KEYS = 100; // past React's limit of 50 nested updates
const GAP_MS = 9;
const GAVE_UP = 'React gave up on the burst: error #185, and the key that threw is lost';
const USER = { uid: 'u', email: 'someone@example.com' };
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
/** ~`ms` of a busy page: time passes, but nothing else (no timer, no React work) gets a turn. */
const busy = (ms) => { const end = Date.now() + ms; while (Date.now() < end) { /* the page is busy */ } };

class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const cv = {
  id: 'resume_a', name: 'resume_a', template: 'classic', dataVersion: DATA_VERSION, updatedAt: 1, sections: [],
  settings: { accentColor: '#1a7f5a', fontSizeBase: 11, sidebarSingleColumn: false },
  personal: { name: 'Casey', title: 'Staff Engineer' },
  coverLetter: { recipientName: 'Morgan Blake', body: '<p>Dear Morgan,</p>' },
};

describe('a burst of keystrokes while signed in and synced (R2-142)', () => {
  it('100 edits of Full Name ~9 ms apart, each a sync commit: nothing thrown, no key lost, and the sync still sends the last', { timeout: 30_000 }, async () => {
    const cloud = fakeFirestore({ [resumePath('u', cv.id)]: cv });
    cloudSync._setCloudIoForTest(mods.io.cloudIo(cloud.fs, cloud.db));
    globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({
      resumes: [cv], activeId: cv.id, dataVersion: DATA_VERSION, deletedIds: [], deletedInfo: {}, syncedUid: 'u', cloudVersions: { [cv.id]: 1 },
    })]]);
    let current = null;
    function App() {
      const store = appStore.useAppStore();
      const sync = cloudSync.useCloudSync({ user: USER, appState: store.appState, store });
      current = { store, sync };
      return null;
    }
    const view = mount(App, {});
    try {
      // Signed in: the first sync reads the account and is done.
      for (let t = 0; t < 250 && current.sync.syncStatus !== 'synced'; t += 1) { await wait(20); view.act(() => {}); }
      assert.equal(current.sync.syncStatus, 'synced', 'the first sync is done: from now on every change is reported \'syncing\'');
      await wait(400); // past the load's own save
      view.act(() => {});

      assert.doesNotThrow(() => {
        for (let i = 1; i <= KEYS; i += 1) {
          busy(GAP_MS);
          view.act(() => current.store.updatePersonal('name', 'K'.repeat(i)));
        }
      }, GAVE_UP);
      assert.equal(current.store.activeResume.personal.name, 'K'.repeat(KEYS), 'every key arrived');
      await wait(25); // React renders what the burst left waiting
      view.act(() => {});
      assert.equal(current.sync.syncStatus, 'syncing', 'the change is queued for the cloud');

      // The flush (1.5 s after the last change) sends the last key, and the status comes back.
      for (let t = 0; t < 400 && current.sync.syncStatus !== 'synced'; t += 1) { await wait(20); view.act(() => {}); }
      assert.equal(current.sync.syncStatus, 'synced', 'synced again');
      assert.equal(cloud.resumes('u')[cv.id]?.personal?.name, 'K'.repeat(KEYS), 'the cloud holds the last key');
    } finally {
      await view.unmount();
    }
  });
});
