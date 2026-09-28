// R4-DVIS-28: from lg (1024 px) the Dashboard put three cards to a row beside the 288 px Career History
// sidebar, so up to ~1150 px (an iPad in landscape, a small laptop) each card was ~200 px wide and its
// name, cut to one line, showed only ~21 characters: a long name and its "(Copy)" looked the same, and
// nothing showed the full name. Both grids (the résumés and the cover letters) now go to three columns
// only from xl (1280 px, ~292 px cards), two at lg (~312 px), and a card's name shows in full on hover
// (its title). The fake DOM has no layout, so this pins the classes and the title on the real Dashboard
// and ResumeCards, mounted with react-dom/client over tests/pdf/fake-dom.mjs, with fictional résumés.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount } from './fake-dom.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

const LONG = 'Senior Harbor Pilot, Northern Coast CV';

/** The Dashboard over two résumés: a long-named one and its copy. */
async function dashboard() {
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const one = Object.assign(resume({ personal: { name: 'Wren Calloway' } }), { name: LONG, updatedAt: 1000 });
  const copy = Object.assign(resume({ personal: { name: 'Wren Calloway' } }), { name: `${LONG} (Copy)`, updatedAt: 2000 });
  const noop = () => {};
  const store = {
    appState: { resumes: [one, copy], activeId: one.id }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop, createLetter: noop,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
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

it('the résumé and cover-letter grids are three to a row only from xl, two at lg beside the sidebar', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    for (const label of ['New Resume', 'New Cover Letter']) {
      const tile = all.find((el) => el.tagName === 'BUTTON' && tokens(el).includes('border-dashed') && text(el) === label);
      assert.ok(tile, `the dashed "${label}" tile`);
      const grid = tile.parentNode;
      assert.ok(tokens(grid).includes('grid'), `${label}: its grid`);
      for (const t of ['grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-3']) assert.ok(tokens(grid).includes(t), `${label}'s grid has ${t}: ${tokens(grid).join(' ')}`);
      assert.ok(!tokens(grid).includes('lg:grid-cols-3'), `${label}'s grid is not three to a row at lg: ~200 px cards beside the sidebar cut names at ~21 characters`);
    }
  } finally { await page.close(); }
});

it('a card\'s name, cut to fit, shows in full on hover, so a résumé and its "(Copy)" can be told apart', async () => {
  const page = await dashboard();
  try {
    const names = page.all().filter((el) => el.tagName === 'P' && tokens(el).includes('truncate') && text(el).startsWith(LONG));
    assert.deepEqual(names.map(text), [LONG, `${LONG} (Copy)`], 'both cards\' names, in the store\'s order');
    for (const name of names) assert.equal(name.getAttribute('title'), text(name), `the full name on hover: ${text(name)}`);
  } finally { await page.close(); }
});
