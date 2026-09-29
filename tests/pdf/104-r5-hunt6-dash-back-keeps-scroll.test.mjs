// R5-HUNT6-DASH-BACK-LOSES-SCROLL: RouteFrame left Back and Forward's window scroll to the browser. But the
// editor (fixed, the full window) and the workspace (its own <main>) leave the document nothing to
// scroll, and the browser puts the saved offset back before React draws the Dashboard again, so it was
// clamped to 0: Back from a card's Edit, lower on the Dashboard, opened it at its top every time. Now
// RouteFrame records each entry's window offset from the scroll events and puts it back on Back and
// Forward; a new visit still opens at the top. The real AppRoutes over the real store, in a
// MemoryRouter, mounted with react-dom/client over tests/pdf/fake-dom.mjs; the page it leaves for is
// the Terms page (in the entry, as the Dashboard is), and the test clamps the window to 0 there as the
// editor does.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

let visits = 0;
async function app() {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { AppRoutes } = await loadModule('/src/AppRoutes.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { navigate: null, where: null };
  function Probe() {
    box.navigate = useNavigate();
    box.where = useLocation().pathname;
    return null;
  }
  // A key of its own for each test's first entry: the offsets are kept for the tab's life, and a
  // MemoryRouter's first entry is always 'default'.
  visits += 1;
  const first = { pathname: '/', key: `visit${visits}` };
  function Page({ ready }) {
    const store = useAppStore();
    if (!ready) return null;
    return createElement(MemoryRouter, { initialEntries: [first], useTransitions: false },
      createElement(Probe), createElement(AppRoutes, { store, auth, sync, seed: { waiting: false } }));
  }
  const view = mount(Page, { ready: false });
  const scrolls = [];
  view.window.scrollY = 0;
  view.window.scrollTo = (x, y) => { scrolls.push(y); view.window.scrollY = y; };
  view.update({ ready: true });
  await settle();
  return {
    scrolls,
    where: () => box.where,
    /** The user scrolls the window to `y` (the browser fires scroll). */
    scroll(y) { view.window.scrollY = y; view.act(() => view.window.dispatchEvent({ type: 'scroll' })); },
    async go(to) { view.act(() => box.navigate(to)); await settle(); },
    async close() { await view.unmount(); delete globalThis.localStorage; },
  };
}

it('Back to the Dashboard returns it to where it was scrolled, not its top', async () => {
  const page = await app();
  try {
    page.scroll(800);
    await page.go('/terms');
    assert.equal(page.where(), '/terms');
    assert.equal(page.scrolls.at(-1), 0, 'a new page opens at the top');
    // The page shown has nothing to scroll that far: the window is clamped, as under the editor.
    page.scroll(0);
    await page.go(-1);
    assert.equal(page.where(), '/');
    assert.equal(page.scrolls.at(-1), 800, `Back left the Dashboard at its top: ${JSON.stringify(page.scrolls)}`);
    // Forward to a page left at its top is the browser's, as before; Back again finds the new offset.
    page.scroll(640);
    const calls = page.scrolls.length;
    await page.go(1);
    assert.equal(page.where(), '/terms');
    assert.equal(page.scrolls.length, calls, 'Forward to a page left at its top moved the window');
    await page.go(-1);
    assert.equal(page.scrolls.at(-1), 640, 'the offset the Dashboard was left at the second time');
  } finally { await page.close(); }
});

it('a new visit to the Dashboard still opens at its top', async () => {
  const page = await app();
  try {
    page.scroll(800);
    await page.go('/terms');
    page.scroll(300);
    await page.go('/');
    assert.equal(page.where(), '/');
    assert.equal(page.scrolls.at(-1), 0);
  } finally { await page.close(); }
});
