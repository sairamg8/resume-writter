// UI redesign B2 (hunt B2-H1-6): the real routes hand the account and the sync to the Terms and Privacy pages, so
// their app bar shows the real account (a signed-in visitor an avatar, not a Sign in button) and a build without
// cloud shows neither. The pages' own tests pass the props by hand, so a route that dropped them stayed green.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
const signedIn = { user: { uid: 'u1', displayName: 'Ada Lovelace', email: 'ada@example.com', photoURL: null }, authLoading: false, cloudAvailable: true, signInWithGoogle() {}, signOut() {} };
const noCloud = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };

async function open(path, auth) {
  const { AppRoutes } = await loadModule('/src/AppRoutes.jsx');
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(AppRoutes, { store: {}, auth, sync, seed: { waiting: false } })));
}

for (const path of ['/terms', '/privacy']) {
  describe(`${path} through the app's routes`, () => {
    it('shows the signed-in account in the app bar, not a Sign in button', async () => {
      const html = await open(path, signedIn);
      assert.match(html, /data-testid="account-button"/);
      assert.equal(html.includes('data-testid="sign-in-button"'), false);
    });

    it('shows no account control in a build without cloud', async () => {
      const html = await open(path, noCloud);
      assert.match(html, /data-testid="app-bar"/);
      assert.equal(html.includes('data-testid="account-button"'), false);
      assert.equal(html.includes('data-testid="sign-in-button"'), false);
    });
  });
}
