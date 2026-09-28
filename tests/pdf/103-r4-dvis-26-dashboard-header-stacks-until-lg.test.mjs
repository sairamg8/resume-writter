// R4-DVIS-26: from md (768 px) the Dashboard's header put its actions in one row beside the logo, but
// those actions (Import, Job Tracker, Projects, New Cover, New Resume, a divider and the full sign-in)
// are ~800 px wide and a tablet has ~610 px beside the logo, so up to ~985 px they wrapped into two
// ragged, left-aligned rows with New Resume and the sign-in under Import. The header now stacks until lg,
// as on a phone: the logo with the compact sign-in on top, the five actions in one row under it; from
// lg (1024 px, where they fit beside the logo) it is the row it was. The fake DOM has no layout, so this
// pins the breakpoint classes on the real Dashboard, mounted with react-dom/client over
// tests/pdf/fake-dom.mjs, signed out with no résumés; cypress/e2e/26-mobile-layout.cy.js checks the
// phone header's actions are in reach.
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

it('the Dashboard\'s header stacks until lg, and is one row beside the logo from lg', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const newResume = all.find((el) => el.tagName === 'BUTTON' && text(el) === 'New Resume');
    assert.ok(newResume, 'the header\'s New Resume');
    const header = all.find((el) => tokens(el).includes('max-w-7xl') && tokens(el).includes('justify-between') && el.contains(newResume));
    assert.ok(header, 'the header row');
    for (const t of ['flex-col', 'lg:flex-row', 'items-stretch', 'lg:items-center']) assert.ok(tokens(header).includes(t), `the header has ${t}: ${tokens(header).join(' ')}`);
    for (const t of ['md:flex-row', 'md:items-center']) assert.ok(!tokens(header).includes(t), `no ${t}: on a tablet the actions wrapped into two rows beside the logo`);

    const [brand, actions] = header.childNodes;
    assert.ok(actions.contains(newResume), 'the actions are the header\'s second part');
    assert.ok(tokens(brand).includes('lg:w-auto') && !tokens(brand).includes('md:w-auto'), `the logo row spans the header until lg: ${tokens(brand).join(' ')}`);
    assert.ok(tokens(brand).includes('shrink-0'), 'the logo is never squeezed by the actions beside it');

    // The compact sign-in is beside the logo until lg; the full one ends the actions' row from lg.
    const compact = brand.childNodes.at(-1);
    assert.ok(tokens(compact).includes('lg:hidden') && !tokens(compact).includes('md:hidden'), `the compact sign-in shows until lg: ${tokens(compact).join(' ')}`);
    assert.ok(hasSignIn(compact), 'the compact sign-in');
    const full = actions.childNodes.at(-1);
    assert.ok(tokens(full).includes('hidden') && tokens(full).includes('lg:block') && !tokens(full).includes('md:block'), `the full sign-in shows from lg: ${tokens(full).join(' ')}`);
    assert.ok(hasSignIn(full), 'the full sign-in');
    const divider = actions.childNodes.find((el) => tokens(el).includes('w-px'));
    assert.ok(divider, 'the divider before the full sign-in');
    assert.ok(tokens(divider).includes('lg:block') && !tokens(divider).includes('md:block'), 'the divider shows from lg, with the full sign-in');

    for (const label of ['Import', 'Job Tracker', 'Projects', 'New Cover', 'New Resume']) {
      assert.ok(actions.childNodes.some((el) => el.tagName === 'BUTTON' && text(el) === label), `${label} is in the actions' row`);
    }
  } finally { await page.close(); }
});
