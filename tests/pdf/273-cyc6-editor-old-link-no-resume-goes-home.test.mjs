// An old editor bookmark (#/resume/<id>?tab=design, written before the docks) for a résumé this browser does not hold
// (deleted, or on another device): two things happened in the same effect pass. useOpenResume sent the page home, and
// useEditorTab, which rewrites the old ?tab=design to ?dock=design in place, navigated back to the résumé's own
// address afterwards. The later navigation won and nothing re-ran useOpenResume, so the page stayed on
// /resume/<id> drawing nothing (the Editor renders null without a résumé): a blank screen with no header.
// Now the redirect home is the later navigation. The real Editor over a store with no résumés, in a MemoryRouter.
// Run: node --test tests/pdf/273-cyc6-editor-old-link-no-resume-goes-home.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

async function openMissing(address) {
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
  let where = null;
  function Where() { const l = useLocation(); where = `${l.pathname}${l.search}`; return null; }
  function App() {
    return createElement(MemoryRouter, { initialEntries: [address] },
      createElement(Where),
      createElement(Routes, null,
        createElement(Route, { path: '/resume/:id', element: createElement(Editor, { store, auth, sync }) }),
        createElement(Route, { path: '/', element: createElement('p', null, 'THE DASHBOARD') })));
  }
  const view = mount(App, {});
  try {
    await settle(view);
    return { text: view.container.textContent, where };
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
}

it('an old ?tab=design link to a résumé the browser does not hold goes to the dashboard, not to a blank page', async () => {
  const seen = await openMissing('/resume/resume_gone?tab=design');
  assert.equal(seen.where, '/', 'the router ends on the dashboard');
  assert.match(seen.text, /THE DASHBOARD/);
});

it('an unknown ?tab= value on a missing résumé goes to the dashboard too', async () => {
  const seen = await openMissing('/resume/resume_gone?tab=foo&dock=bar');
  assert.equal(seen.where, '/');
  assert.match(seen.text, /THE DASHBOARD/);
});
