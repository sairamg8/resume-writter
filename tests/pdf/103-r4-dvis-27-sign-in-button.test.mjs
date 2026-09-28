// R4-DVIS-27: from 640 px up, signed out, the Dashboard's toolbar put a 30 px "Sign in with Google"
// button with 12 px text (AuthBar's full button: px-3 py-1.5 text-xs) beside 38 px buttons with 14 px
// text (Import, Job Tracker, Projects, New Cover: py-1.5 sm:py-2, text-xs sm:text-sm). AuthBar's full
// button, which only the Dashboard's toolbar shows (from md up), is now sized as they are; the compact
// icon button of the phone header, the editor and the workspace top bar is unchanged. The fake DOM
// has no layout, so this pins the classes on the real Dashboard, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs as tests/pdf/103-r4-dvis-14-dashboard-projects-brand.test.mjs mounts it.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
// What makes the toolbar's buttons 38 px tall with 14 px text from sm up: the padding, the text size and the border.
const TOOLBAR_SIZE = ['py-1.5', 'sm:py-2', 'text-xs', 'sm:text-sm', 'sm:px-4', 'border'];

it('signed out, the Dashboard toolbar\'s Sign in with Google is sized as the buttons beside it', async () => {
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const store = { appState: { resumes: [], activeId: null }, persistError: null, recovery: null };
  const auth = { user: null, authLoading: false, cloudAvailable: true, signInWithGoogle: async () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  try {
    const buttons = [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
    const jobTracker = buttons.find((el) => text(el) === 'Job Tracker');
    assert.ok(jobTracker, 'the toolbar\'s Job Tracker button');
    for (const t of TOOLBAR_SIZE) assert.ok(tokens(jobTracker).includes(t), `Job Tracker has ${t}: the size the sign-in button must match`);
    const signIn = buttons.find((el) => text(el) === 'Sign in with Google');
    assert.ok(signIn, 'the toolbar\'s full Sign in with Google button');
    for (const t of TOOLBAR_SIZE) assert.ok(tokens(signIn).includes(t), `Sign in with Google has ${t}, as Job Tracker: ${tokens(signIn).join(' ')}`);
    // The phone header's icon-only button (AuthBar compact) stays as it was.
    const compact = buttons.find((el) => el.getAttribute('aria-label') === 'Sign in with Google' && !text(el));
    assert.ok(compact, 'the compact icon button of the phone header');
    assert.ok(tokens(compact).includes('p-1.5'), 'the compact button keeps its padding');
    for (const t of ['sm:py-2', 'sm:text-sm', 'sm:px-4']) assert.ok(!tokens(compact).includes(t), `the compact button is not resized (${t})`);
  } finally {
    await view.unmount();
    delete globalThis.localStorage;
  }
});
