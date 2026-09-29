// R5-HUNT6-SIGN-IN-ERROR-STALE: an old sign-in error bubble came back under "Sign in with Google"
// after signing out, although a later sign-in (from another tab, or another header) worked. AuthBar's
// signInError was cleared only by a new click on its own button or by the bubble's X; a sign-in that
// reached this header through onAuthStateChanged left it set, and the signed-out branch showed it
// again as soon as `user` went back to null. Now any signed-in user clears the old message.
// AuthBar mounted with react-dom/client over tests/pdf/fake-dom.mjs, props changed as useAuth would.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const fbError = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
const settle = async (view) => { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };

describe('a sign-in error after a later sign-in elsewhere (R5-HUNT6-SIGN-IN-ERROR-STALE)', () => {
  it('signing in another way, then out, does not bring the old error back', async () => {
    const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
    const props = {
      user: null, authLoading: false, cloudAvailable: true, signOut() {},
      signInWithGoogle: async () => { throw fbError('auth/popup-blocked'); },
      syncStatus: 'synced', lastSynced: null, isOnline: true, heldResumes: [],
    };
    const view = mount(AuthBar, props);
    const alert = () => [...elements(view.container)].find((el) => el.getAttribute('role') === 'alert');
    const button = () => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && /Sign in with Google/.test(el.textContent));
    const quiet = console.error;
    try {
      console.error = () => {};
      view.act(() => { reactProps(button()).onClick({}); });
      await settle(view);
      console.error = quiet;
      assert.ok(alert(), 'setup: the popup-blocked error shows');

      // Signed in from another tab: onAuthStateChanged hands this header a user.
      view.update({ ...props, user: { uid: 'u1', displayName: 'Ada', photoURL: null } });
      await settle(view);
      // Later, Sign out.
      view.update({ ...props, user: null });
      await settle(view);
      assert.equal(alert(), undefined, `the old error came back: ${alert()?.textContent}`);
      assert.ok(button(), 'the sign-in button is back');
    } finally { console.error = quiet; await view.unmount(); }
  });
});
