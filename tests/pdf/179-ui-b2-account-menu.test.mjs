// UI redesign B2 (cluster account): the account control in the canvas look, every live function kept
// (parity SHEL-020..032, 111, 116, 124, MOBI-010..013). AuthBar is mounted over fake-dom.mjs and its
// handlers are called as React set them; the avatar menu (name, e-mail, the sync line in the sync icon's
// own words, Keyboard shortcuts only when onShortcuts is passed, Sign out), the signed-out button with its
// Signing in state, all seven sign-in failure wordings and the silent cases, the loading placeholder, the
// no-cloud build, and the seven sync states with the held items named. Fictional people.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const user = { uid: 'u1', displayName: 'Alex Johnson', email: 'alex@example.com', photoURL: null };
const fbError = (code) => Object.assign(new Error(`Firebase: Error (${code}).`), { code });
const settle = async (view) => { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };

async function bar(props = {}) {
  const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
  const base = {
    user, authLoading: false, cloudAvailable: true, signInWithGoogle: async () => {}, signOut() {},
    syncStatus: 'synced', lastSynced: null, isOnline: true, heldResumes: [], ...props,
  };
  const view = mount(AuthBar, base);
  const all = () => [...elements(view.container)];
  const by = (id) => all().find((el) => el.getAttribute('data-testid') === id);
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (el, e = {}) => view.act(() => { reactProps(el).onClick({ detail: 1, ...e }); });
  return { view, all, by, text, click, set: (next) => view.update({ ...base, ...next }) };
}

describe('the avatar menu', () => {
  it('opens from the avatar with the name, the e-mail, the sync line and Sign out, and no Keyboard shortcuts', async () => {
    const b = await bar({ lastSynced: new Date(2026, 0, 5, 9, 41) });
    try {
      assert.equal(b.by('account-menu'), undefined, 'the menu is closed at first');
      b.click(b.by('account-button'));
      const menu = b.by('account-menu');
      assert.ok(menu, 'the avatar opens the menu');
      assert.ok(b.text(menu).includes('Alex Johnson') && b.text(menu).includes('alex@example.com'), `name and e-mail: ${b.text(menu)}`);
      assert.equal(b.text(b.by('account-sync-line')), b.by('sync-status').getAttribute('aria-label'), 'the sync line says what the sync icon says');
      assert.match(b.text(b.by('account-sync-line')), /^Synced /);
      assert.equal(b.by('account-shortcuts'), undefined, 'Keyboard shortcuts is absent without onShortcuts');
      assert.ok(!/Keyboard shortcuts/.test(b.text(menu)));
      assert.equal(b.text(b.by('account-sign-out')), 'Sign out');
    } finally { await b.view.unmount(); }
  });

  it('is 288 px wide, and 224 px in the editor\'s narrow split panel (hideName) so the panel does not clip its left edge', async () => {
    const wide = await bar();
    try {
      wide.click(wide.by('account-button'));
      const cls = (wide.by('account-menu').getAttribute('class') ?? '').split(/\s+/);
      assert.ok(cls.includes('w-72') && !cls.includes('w-56'), `the full menu: ${cls.join(' ')}`);
    } finally { await wide.view.unmount(); }
    const narrow = await bar({ hideName: true });
    try {
      narrow.click(narrow.by('account-button'));
      const cls = (narrow.by('account-menu').getAttribute('class') ?? '').split(/\s+/);
      assert.ok(cls.includes('w-56') && !cls.includes('w-72'), `the narrow-panel menu: ${cls.join(' ')}`);
    } finally { await narrow.view.unmount(); }
  });

  it('Keyboard shortcuts appears only when onShortcuts is passed, runs it and closes the menu', async () => {
    let calls = 0;
    const b = await bar({ onShortcuts: () => { calls += 1; } });
    try {
      b.click(b.by('account-button'));
      const entry = b.by('account-shortcuts');
      assert.ok(entry, 'the entry is there');
      assert.match(b.text(entry), /^Keyboard shortcuts\s*\?$/);
      b.click(entry);
      assert.equal(calls, 1);
      assert.equal(b.by('account-menu'), undefined, 'the menu closed');
    } finally { await b.view.unmount(); }
  });

  it('Sign out signs out and closes the menu; a pointer elsewhere closes it too; the avatar toggles it', async () => {
    let outs = 0;
    const b = await bar({ signOut: () => { outs += 1; } });
    try {
      b.click(b.by('account-button'));
      b.click(b.by('account-sign-out'));
      assert.equal(outs, 1);
      assert.equal(b.by('account-menu'), undefined);
      b.click(b.by('account-button'));
      b.click(b.by('account-button'));
      assert.equal(b.by('account-menu'), undefined, 'a second press on the avatar closes it');
      b.click(b.by('account-button'));
      const elsewhere = b.view.document.body.appendChild(b.view.document.createElement('div'));
      b.view.act(() => { b.view.document.dispatchEvent({ type: 'pointerdown', target: elsewhere }); });
      assert.equal(b.by('account-menu'), undefined, 'a pointer outside closes it');
      b.click(b.by('account-button'));
      b.view.act(() => { b.view.document.dispatchEvent({ type: 'pointerdown', target: b.by('account-menu') }); });
      assert.ok(b.by('account-menu'), 'a pointer inside does not');
      b.view.act(() => { b.view.document.dispatchEvent({ type: 'keydown', key: 'Escape' }); });
      assert.ok(b.by('account-menu'), 'the live menu has no Escape handler, so none is added');
    } finally { await b.view.unmount(); }
  });

  it('the avatar: first name from sm unless hideName, the photo with no referrer, an initial as written, "U" when nameless', async () => {
    const { default: AuthBar } = await loadModule('/src/components/AuthBar.jsx');
    const html = (u, extra = {}) => renderToStaticMarkup(createElement(AuthBar, { user: u, cloudAvailable: true, signOut() {}, isOnline: true, ...extra }));
    assert.match(html(user), /<span class="[^"]*hidden sm:block[^"]*">Alex<\/span>/);
    assert.match(html(user, { hideName: true }), /<span class="[^"]*sm:sr-only[^"]*">Alex<\/span>/);
    assert.match(html({ ...user, photoURL: 'https://img.example/a.png' }), /<img[^>]*referrerPolicy="no-referrer"/i);
    assert.match(html({ ...user, displayName: 'alex johnson' }), />a<\/div>/, 'the initial is displayName[0], not upper-cased');
    assert.match(html({ ...user, displayName: null }), />U<\/div>/);
  });
});

describe('the sync states, as the chip and as the menu line', () => {
  const CASES = [
    ['Offline', { isOnline: false }, 'Offline — changes saved locally'],
    ['Cannot reach your account', { syncStatus: 'offline' }, 'Cannot reach your account — changes saved locally, will retry'],
    ['Syncing', { syncStatus: 'syncing' }, 'Syncing…'],
    ['Synced <time>', { syncStatus: 'synced', lastSynced: new Date(2026, 0, 5, 9, 41) }, /^Synced \d/],
    ['Sync error', { syncStatus: 'error' }, 'Sync error — will retry'],
    ['Stopped, one held résumé named', { syncStatus: 'stopped', heldResumes: [{ id: 'r1', name: 'My CV' }] }, '“My CV” not synced (a large photo?) — saved in this browser'],
    ['Stopped, several held', { syncStatus: 'stopped', heldResumes: [{ id: 'r1', name: 'A' }, { id: 'r2', name: 'B' }] }, '2 résumés not synced (large photos?) — saved in this browser'],
    ['Stopped, none to blame', { syncStatus: 'stopped', heldResumes: [] }, 'Sync stopped (a large photo?) — saved in this browser'],
    ['Sync is off', { syncStatus: 'off' }, 'Sync is off — changes are saved in this browser'],
  ];
  for (const [name, props, want] of CASES) {
    it(`${name}: the chip and the menu line carry the same words`, async () => {
      const b = await bar(props);
      try {
        const label = b.by('sync-status').getAttribute('aria-label');
        if (want instanceof RegExp) assert.match(label, want); else assert.equal(label, want);
        b.click(b.by('account-button'));
        assert.equal(b.text(b.by('account-sync-line')), label);
      } finally { await b.view.unmount(); }
    });
  }

  it('a long held name is clipped, and no status shows no chip and no line', async () => {
    const b = await bar({ syncStatus: 'stopped', heldResumes: [{ id: 'r1', name: 'x'.repeat(40) }] });
    try { assert.match(b.by('sync-status').getAttribute('aria-label'), /^“x{31}…” not synced/); } finally { await b.view.unmount(); }
    const idle = await bar({ syncStatus: 'idle' });
    try {
      assert.equal(idle.by('sync-status'), undefined);
      idle.click(idle.by('account-button'));
      assert.equal(idle.by('account-sync-line'), undefined);
    } finally { await idle.view.unmount(); }
  });

  it('the chip keeps its tap words, and the state shows in its colour', async () => {
    const b = await bar({ syncStatus: 'error' });
    try {
      assert.match(b.by('sync-status').getAttribute('class'), /cv-bad/);
      b.view.act(() => { reactProps(b.by('sync-status')).onPointerDown({ pointerType: 'touch' }); });
      b.click(b.by('sync-status'));
      assert.ok(b.view.container.textContent.includes('Sync error — will retry'), 'a tap opens the words');
      b.set({ syncStatus: 'synced' });
      assert.match(b.by('sync-status').getAttribute('class'), /cv-good/);
    } finally { await b.view.unmount(); }
  });
});

describe('signed out, loading, no cloud', () => {
  it('no cloud: nothing at all; loading: a placeholder circle', async () => {
    const none = await bar({ cloudAvailable: false });
    try { assert.equal(none.view.container.childNodes.length, 0, 'no account UI without a cloud'); } finally { await none.view.unmount(); }
    const loading = await bar({ authLoading: true });
    try {
      assert.ok(loading.by('account-loading'), 'the placeholder');
      assert.equal(loading.by('sign-in-button'), undefined);
      assert.equal(loading.by('account-button'), undefined);
    } finally { await loading.view.unmount(); }
  });

  it('the Google button: label on the full button, icon only when compact; Signing in disables it and says so', async () => {
    let release;
    const signInWithGoogle = () => new Promise((r) => { release = r; });
    const full = await bar({ user: null, signInWithGoogle });
    try {
      assert.equal(full.text(full.by('sign-in-button')), 'Sign in with Google');
      assert.equal(reactProps(full.by('sign-in-button')).disabled, false);
      full.click(full.by('sign-in-button'));
      assert.equal(full.text(full.by('sign-in-button')), 'Signing in…');
      assert.equal(reactProps(full.by('sign-in-button')).disabled, true, 'a second click is not possible while signing in');
      release();
      await settle(full.view);
      assert.equal(full.text(full.by('sign-in-button')), 'Sign in with Google');
    } finally { await full.view.unmount(); }
    const compact = await bar({ user: null, compact: true, signInWithGoogle });
    try {
      assert.equal(compact.text(compact.by('sign-in-button')), '', 'no label on the compact button');
      assert.equal(compact.by('sign-in-button').getAttribute('aria-label'), 'Sign in with Google');
      assert.equal(compact.by('sign-in-button').getAttribute('title'), 'Sign in with Google');
      compact.click(compact.by('sign-in-button'));
      assert.equal(reactProps(compact.by('sign-in-button')).disabled, true);
      assert.equal(compact.text(compact.by('sign-in-button')), '', 'the compact button never shows the label');
      release();
      await settle(compact.view);
    } finally { await compact.view.unmount(); }
  });

  const WORDINGS = [
    ['auth/popup-blocked', 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.'],
    ['auth/unauthorized-domain', /^Sign-in is not set up for this address( \([^)]+\))?\. Open the app at its main address to sign in\.$/],
    ['auth/network-request-failed', 'Could not reach Google to sign in. Check your connection, then try again.'],
    ['auth/web-storage-unsupported', 'This browser blocks what Google sign-in needs (site data or third-party cookies). Allow them for this site, then try again.'],
    ['auth/operation-not-supported-in-this-environment', 'This browser blocks what Google sign-in needs (site data or third-party cookies). Allow them for this site, then try again.'],
    ['auth/too-many-requests', 'Too many sign-in attempts. Wait a minute, then try again.'],
    ['auth/internal-error', 'Sign-in failed (auth/internal-error). Try again; your résumés stay saved in this browser.'],
  ];
  for (const [code, want] of WORDINGS) {
    it(`${code}: the popover says what to do, and Dismiss clears it`, async () => {
      const b = await bar({ user: null, signInWithGoogle: async () => { throw fbError(code); } });
      const quiet = console.error;
      try {
        console.error = () => {};
        b.click(b.by('sign-in-button'));
        await settle(b.view);
        console.error = quiet;
        const alert = b.all().find((el) => el.getAttribute('role') === 'alert');
        assert.ok(alert, 'the failure shows');
        const said = b.text(alert);
        if (want instanceof RegExp) assert.match(said, want); else assert.equal(said, want);
        b.click([...elements(alert)].find((el) => el.tagName === 'BUTTON'));
        assert.equal(b.all().find((el) => el.getAttribute('role') === 'alert'), undefined, 'Dismiss clears it');
      } finally { console.error = quiet; await b.view.unmount(); }
    });
  }

  it('a non-Firebase error (a build with no cloud) says "Sign-in failed: <message>"; closing the popup says nothing', async () => {
    const quiet = console.error;
    const b = await bar({ user: null, signInWithGoogle: async () => { throw new Error('Cloud sync is not configured'); } });
    try {
      console.error = () => {};
      b.click(b.by('sign-in-button'));
      await settle(b.view);
      assert.equal(b.text(b.all().find((el) => el.getAttribute('role') === 'alert')), 'Sign-in failed: Cloud sync is not configured');
    } finally { console.error = quiet; await b.view.unmount(); }
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      const s = await bar({ user: null, signInWithGoogle: async () => { throw fbError(code); } });
      try {
        console.error = () => {};
        s.click(s.by('sign-in-button'));
        await settle(s.view);
        assert.equal(s.all().find((el) => el.getAttribute('role') === 'alert'), undefined, code);
      } finally { console.error = quiet; await s.view.unmount(); }
    }
  });
});
