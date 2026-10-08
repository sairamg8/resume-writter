// Navigation hunt (cycle 2): /resume/<id> with no résumé in the browser at all. A fresh browser given an old link, or the
// last résumé deleted on the dashboard and Back pressed to its editor: the store's open résumé is then undefined. The
// Editor is written for that (useOpenResume sends the page to the dashboard, and the page renders null meanwhile), but
// the template gallery's memoised props read `resume.id` while the page was still being rendered, before that null — so
// the page threw "Cannot read properties of undefined (reading 'id')" and showed the crash screen instead of going home.
// The real Editor page over a store with no résumés, in a MemoryRouter (tests/pdf/fake-dom.mjs).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage } from './resume-tab.mjs';

// No Firebase in this build, whatever .env holds. Read when setup() starts Vite.
for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']) process.env[key] = '';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const settle = async (view) => { for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };

it('an address for a résumé when the browser holds none goes to the dashboard, not to the crash screen', async () => {
  const { Editor } = await loadModule('/src/pages/Editor.jsx');
  globalThis.localStorage = new MemoryStorage();
  const store = {
    appState: { resumes: [], deletedIds: [], activeId: null, syncedUid: null },
    activeResume: undefined,
    persistError: null, persistReason: null, saving: false, savedAt: null,
    setActiveId() {},
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  function App() {
    return createElement(MemoryRouter, { initialEntries: ['/resume/resume_gone?tab=coverletter'] },
      createElement(Routes, null,
        createElement(Route, { path: '/resume/:id', element: createElement(Editor, { store, auth, sync }) }),
        createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') })));
  }
  const view = mount(App, {});
  try {
    await settle(view);
    assert.match(view.container.textContent, /THE DASHBOARD/);
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
