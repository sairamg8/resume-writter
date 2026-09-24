// Sign-in failures were swallowed (R2-086): AuthBar caught signInWithGoogle's error and logged it,
// so with popups blocked, or on a deploy domain missing from Firebase's authorized domains, the
// Google button flipped to "Signing in…" and back and nothing else happened. Now the header says
// what went wrong, in words that say what to do (role="alert", dismissable, gone on the next try);
// the user closing the popup themselves is not an error and says nothing.
// AuthBar mounted with react-dom/client over tests/pdf/fake-dom.mjs; the button's handler is called
// as React set it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const fbError = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
const settle = async (view) => { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };

async function signInFailing(error, props = {}) {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  let calls = 0;
  const view = mount(AuthBar, {
    user: null, authLoading: false, cloudAvailable: true, signOut() {},
    signInWithGoogle: async () => { calls += 1; if (error) throw error; },
    ...props,
  });
  const quiet = console.error;
  const button = () => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && /Sign in with Google/.test(el.textContent + (el.getAttribute('aria-label') || '')));
  const alert = () => [...elements(view.container)].find((el) => el.getAttribute('role') === 'alert');
  return {
    view, alert, calls: () => calls,
    async click() {
      console.error = () => {};
      try { view.act(() => { reactProps(button()).onClick({}); }); await settle(view); } finally { console.error = quiet; }
    },
  };
}

describe('a failed Google sign-in (R2-086)', () => {
  it('popup blocked: the header says to allow pop-ups', async () => {
    const bar = await signInFailing(fbError('auth/popup-blocked'));
    try {
      await bar.click();
      assert.ok(bar.alert(), 'before: nothing on screen');
      assert.match(bar.alert().textContent, /pop-?ups?/i);
    } finally { await bar.view.unmount(); }
  });

  it('unauthorized domain: the header says this address is not set up for sign-in', async () => {
    const bar = await signInFailing(fbError('auth/unauthorized-domain'), { compact: true });
    try {
      await bar.click();
      assert.ok(bar.alert(), 'before: nothing on screen');
      assert.match(bar.alert().textContent, /address|domain/i);
    } finally { await bar.view.unmount(); }
  });

  it('any other failure still says sign-in failed', async () => {
    const bar = await signInFailing(fbError('auth/internal-error'));
    try {
      await bar.click();
      assert.match(bar.alert()?.textContent || '', /sign-in failed/i);
    } finally { await bar.view.unmount(); }
  });

  it('the user closing the popup is not an error: nothing is shown', async () => {
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      const bar = await signInFailing(fbError(code));
      try {
        await bar.click();
        assert.equal(bar.alert(), undefined, code);
      } finally { await bar.view.unmount(); }
    }
  });

  it('the message can be dismissed, and goes on the next try', async () => {
    const bar = await signInFailing(fbError('auth/popup-blocked'));
    try {
      await bar.click();
      const dismiss = [...elements(bar.alert())].find((el) => el.tagName === 'BUTTON');
      assert.ok(dismiss, 'no dismiss button');
      bar.view.act(() => reactProps(dismiss).onClick({}));
      assert.equal(bar.alert(), undefined);
      await bar.click();
      assert.ok(bar.alert());
      assert.equal(bar.calls(), 2);
    } finally { await bar.view.unmount(); }
  });
});
