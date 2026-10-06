// R4-DVIS-26: the Dashboard's actions (~800 px with the sign-in) wrapped into two ragged rows beside the
// logo on a tablet, so the compact (icon-only) sign-in sat beside the logo until lg and the full one came
// from lg. B2 (UI rebuild): the header is the shared AppBar (src/components/AppBar.jsx): the brand, the
// three areas (below md the phone tab bar replaces them) and the account at the right, the compact
// sign-in shown until lg and the full one from lg; the page's actions (Import, New Cover, New Resume) are
// one row under the bar, and "Job Tracker" and "Projects" are the bar's nav links, same destinations. The
// fake DOM has no layout, so this pins the breakpoint classes on the real Dashboard, mounted with
// react-dom/client over tests/pdf/fake-dom.mjs, signed out with no résumés; cypress/e2e/26-mobile-layout.cy.js
// checks the phone header's actions are in reach.
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
/** Whether `el` holds a "Sign in with Google" button: its text on the full one, its label on the compact icon. */
const hasSignIn = (el) => [...elements(el)].some((b) => b.tagName === 'BUTTON'
  && [text(b), b.getAttribute('aria-label')].includes('Sign in with Google'));

/** The Dashboard of a first visit (no résumés), signed out, in a build with accounts (so both sign-ins show). */
async function dashboard() {
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const store = { appState: { resumes: [], activeId: null }, persistError: null, recovery: null };
  const auth = { user: null, authLoading: false, cloudAvailable: true, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  function Page() {
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Dashboard, { store, auth, sync, publicLinks: null }));
  }
  const view = mount(Page, {});
  return {
    view,
    all: () => [...elements(view.container)],
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

it('the header is the AppBar: the compact sign-in shows until lg, the full one from lg, the actions are one row under the bar', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const header = all.find((el) => el.getAttribute('data-testid') === 'app-bar');
    assert.ok(header, 'the app bar');
    const newResume = all.find((el) => el.tagName === 'BUTTON' && text(el) === 'New Resume');
    assert.ok(newResume && header.contains(newResume), 'New Resume is in the header, under the bar row');
    const [bar, actionsBox] = header.childNodes;
    assert.ok(!bar.contains(newResume) && actionsBox.contains(newResume), 'the actions are a second row, not squeezed beside the logo');
    const row = actionsBox.childNodes[0];
    assert.ok(tokens(row).includes('flex-wrap'), 'the row wraps rather than overflows');

    // The compact sign-in shows until lg; the full one from lg.
    const wrappers = [...elements(bar)].filter((el) => tokens(el).includes('lg:hidden') || tokens(el).includes('lg:block'));
    const compact = wrappers.find((el) => tokens(el).includes('lg:hidden'));
    assert.ok(compact && !tokens(compact).includes('md:hidden'), 'the compact sign-in shows until lg');
    assert.ok(hasSignIn(compact), 'the compact sign-in');
    const full = wrappers.find((el) => tokens(el).includes('lg:block'));
    assert.ok(full && tokens(full).includes('hidden') && !tokens(full).includes('md:block'), `the full sign-in shows from lg: ${full && tokens(full).join(' ')}`);
    assert.ok(hasSignIn(full), 'the full sign-in');

    for (const label of ['Import', 'New Cover', 'New Resume']) {
      assert.ok([...elements(row)].some((el) => el.tagName === 'BUTTON' && text(el) === label), `${label} is in the actions' row`);
    }
    // Job Tracker and Projects are the bar's nav links now, not buttons in the row.
    for (const label of ['Job Tracker', 'Projects']) {
      assert.ok(![...elements(row)].some((el) => text(el) === label), `${label} is not in the actions' row`);
    }
    const links = [...elements(bar)].filter((el) => el.tagName === 'A' && /^app-bar-nav-/.test(el.getAttribute('data-testid') ?? ''));
    assert.deepEqual(links.map((a) => [text(a), a.getAttribute('href')]), [['Documents', '/'], ['Applications', '/jobs'], ['Projects', '/boards']]);
  } finally { await page.close(); }
});

it('the Dashboard mounts the phone tab bar and keeps room under the page for it', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const tabs = all.find((el) => el.getAttribute('data-testid') === 'bottom-tab-bar');
    assert.ok(tabs, 'the bottom tab bar');
    const root = page.view.container.childNodes[0];
    assert.ok(root.contains(tabs));
    assert.ok(tokens(root).includes('pb-20') && tokens(root).includes('md:pb-0'), `the page leaves 80 px under it on a phone: ${tokens(root).join(' ')}`);
    assert.ok(all.some((el) => el.getAttribute('data-testid') === 'bottom-tab-applications'), 'its Applications tab');
  } finally { await page.close(); }
});
