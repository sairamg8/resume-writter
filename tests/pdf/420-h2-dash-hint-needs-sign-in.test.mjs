// H2 hunt: the empty Documents page says "Documents saved to your account? Sign in to see them." to a signed-out visitor
// (24c9114). A build with no cloud (no Firebase keys: cloudAvailable false, AuthBar draws no Sign in) has no account to sign
// in to, so the line sent the visitor to a button that does not exist. The line shows only where signing in is possible, when
// the auth state is known (not while it loads), and the list is empty.
// The real Dashboard over the real store in a MemoryRouter (tests/pdf/fake-dom.mjs).
// Run: node --test tests/pdf/420-h2-dash-hint-needs-sign-in.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const HINT = 'Documents saved to your account? Sign in to see them.';

async function page({ auth: extra = {}, resumes = [] }) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage(resumes.length ? [['cpwtcv_v1', JSON.stringify({ resumes, activeId: resumes[0].id })]] : []);
  const auth = { user: null, authLoading: false, cloudAvailable: true, signInWithGoogle() {}, signOut() {}, ...extra };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  function Page() {
    const store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false }, createElement(Dashboard, { store, auth, sync }));
  }
  const view = mount(Page, {});
  await settle();
  return {
    text: () => view.container.textContent.replace(/\s+/g, ' '),
    close: async () => { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('signed out where signing in is possible, with nothing in the list: the hint shows', async () => {
  const p = await page({});
  try {
    assert.match(p.text(), /No resumes yet/);
    assert.ok(p.text().includes(HINT), p.text());
  } finally { await p.close(); }
});

it('a build with no accounts (cloudAvailable false): no hint, there is no Sign in to point to', async () => {
  const p = await page({ auth: { cloudAvailable: false } });
  try {
    assert.match(p.text(), /No resumes yet/);
    assert.ok(!p.text().includes(HINT), 'the hint names a sign-in that this build does not have');
  } finally { await p.close(); }
});

it('while the sign-in state is still loading, or with a résumé in the list: no hint', async () => {
  const loading = await page({ auth: { authLoading: true } });
  try {
    assert.ok(!loading.text().includes(HINT), 'shown while auth loads');
  } finally { await loading.close(); }
  const some = await page({ resumes: [{ ...resume({ personal: { name: 'Wren Calloway' } }), id: 'resume_a', name: 'Pilot CV', updatedAt: 1000 }] });
  try {
    assert.ok(!some.text().includes(HINT), 'shown beside documents');
  } finally { await some.close(); }
});
