// The dashboard's word that a demo account's originals are on their way (V2VF1S-3). The restore
// tests read `waiting` from the demo restore itself (tests/pdf/18-cloud-sync-restore.test.mjs),
// and the e2e build has no cloud, so its originals never wait: nothing failed when useDemoSeed's
// `waiting`, its hand-over to the dashboard (AppRoutes) or the notice was taken away — the owner
// then saw a dashboard without their originals and no word that they were coming. Here the real
// useDemoSeed, AppRoutes and Dashboard are mounted with react-dom/client (tests/pdf/fake-dom.mjs)
// under a sync whose cloud gives no answer, as App.jsx wires them.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { settle } from './fake-firestore.mjs';
import { elements, mount } from './fake-dom.mjs';

// The demo accounts of this test's build (VITE_DEMO_ACCOUNTS): a made-up one, never the owner's,
// so the owner's private résumé on a dev checkout never takes part. Read when setup() starts Vite.
const DEMO = { uid: 'u', email: 'demo@example.com', displayName: 'Demo' };
process.env.VITE_DEMO_ACCOUNTS = DEMO.email;

let AppRoutes;
let useDemoSeed;
before(async () => {
  await setup();
  ({ AppRoutes } = await loadModule('/src/AppRoutes.jsx'));
  ({ useDemoSeed } = await loadModule('/src/hooks/useDemoSeed.js'));
});
after(teardown);

const NOTICE = 'Your originals come back as soon as your account can be reached again.';
const cv = (id, updatedAt = 1, extra = {}) => ({ id, name: id, updatedAt, sections: [], dataVersion: 99, template: 'classic', ...extra });
/** One of a demo account's originals ("Keep as my original", src/utils/demoSeed.js). */
const orig = (id, updatedAt = 1, extra = {}) => cv(id, updatedAt, { keep: true, ...extra });

/** The dashboard's store: only another résumé left, no original; `restored` = what restoreResumes got. */
function dashboardStore() {
  const restored = [];
  const store = {
    appState: { resumes: [cv('resume_b', 1, { name: 'Another résumé' })], deletedIds: [], activeId: null, jobs: [] },
    persistError: null,
    recovery: null,
    restored,
    restoreResumes: (list) => { restored.push(list.map((r) => r.name)); },
  };
  return store;
}

/**
 * What useCloudSync gives the app once the account's list is known — the cloud holds original A —
 * with `answer` as readCloudCopies's: null when the cloud gives no answer (cloudSyncEngine.js).
 */
const syncWith = (answer) => ({
  syncStatus: 'error', lastSynced: null, isOnline: true, heldResumes: [],
  account: { uid: DEMO.uid, cloud: true, cloudOriginals: [orig('orig_a', 5, { name: 'My original' })], cloudDeleted: [] },
  readCloudCopies: () => Promise.resolve(answer),
});

/** App.jsx's pages, signed in as the demo account, at the dashboard: the demo restore's hook, then the routes. */
function Page({ store, sync }) {
  const auth = { user: DEMO, authLoading: false, cloudAvailable: true, signInWithGoogle: () => {}, signOut: () => {} };
  const seed = useDemoSeed({ user: auth.user, appState: store.appState, store, sync });
  return createElement(MemoryRouter, { initialEntries: ['/'] },
    createElement(AppRoutes, { store, auth, sync, seed }));
}

/** The dashboard's role=status notices on screen, by their text. */
const notices = (view) => [...elements(view.container)]
  .filter((el) => el.getAttribute('role') === 'status')
  .map((el) => el.textContent.trim());

describe('a demo account whose originals wait for its cloud', () => {
  it('the dashboard says they come back once the account can be reached (role=status)', async () => {
    const store = dashboardStore();
    const view = mount(Page, { store, sync: syncWith(null) });
    try {
      await settle(); // the restore asks the cloud, which gives no answer
      assert.ok([...elements(view.container)].some((el) => el.textContent.trim() === 'Another résumé'), 'the dashboard is on screen');
      assert.deepEqual(store.restored, [], 'nothing comes back without the cloud\'s answer (V2W1a-0)');
      assert.deepEqual(notices(view), [NOTICE], 'before: a dashboard without the originals and no word that they are coming');
    } finally { await view.unmount(); }
  });

  it('once the cloud answers, the originals come back and the notice goes', async () => {
    const store = dashboardStore();
    const view = mount(Page, { store, sync: syncWith(null) });
    try {
      await settle();
      assert.deepEqual(notices(view), [NOTICE]);
      // The retry's first sync gets through: useCloudSync reports the account again.
      view.update({ store, sync: syncWith({ docs: [orig('orig_a', 9, { name: 'My original, edited' })], deleted: [] }) });
      await settle();
      assert.deepEqual(store.restored, [['My original, edited']]);
      assert.deepEqual(notices(view), []);
    } finally { await view.unmount(); }
  });

  it('a cloud that answers at once: no notice at any point', async () => {
    const store = dashboardStore();
    const view = mount(Page, { store, sync: syncWith({ docs: [], deleted: [] }) });
    try {
      assert.deepEqual(notices(view), [], 'the first render');
      await settle();
      assert.deepEqual([store.restored, notices(view)], [[['My original']], []]);
    } finally { await view.unmount(); }
  });
});
