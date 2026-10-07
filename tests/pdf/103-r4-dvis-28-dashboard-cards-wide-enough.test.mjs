// R4-DVIS-28: from lg (1024 px) the Dashboard put three cards to a row beside the 288 px Career History
// sidebar, so up to ~1150 px (an iPad in landscape, a small laptop) each card was ~200 px wide and its
// name, cut to one line, showed only ~21 characters: a long name and its "(Copy)" looked the same, and
// nothing showed the full name. Both grids (the résumés and the cover letters) now go to three columns
// only from xl (1280 px, ~292 px cards), two at lg (~312 px), and a card's name shows in full on hover
// (its title). The fake DOM has no layout, so this pins the classes and the title on the real Dashboard
// and ResumeCards, mounted with react-dom/client over tests/pdf/fake-dom.mjs, with fictional résumés.
// B5a (Documents page): Career History moved below the documents, so the cards have the whole row: both
// grids are two to a row on a phone, three from md (~307 px cards at 1024 px) and four from xl (~250 px at
// 1280, the canvas), and the dashed New Resume tile is the first cell of the résumés' grid.
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

it('the résumé and cover-letter grids are two to a row on a phone, three from md and four from xl, with no sidebar beside them', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    for (const label of ['New Resume', 'New Cover Letter']) {
      const tile = all.find((el) => el.tagName === 'BUTTON' && tokens(el).includes('border-dashed') && text(el).startsWith(label));
      assert.ok(tile, `the dashed "${label}" tile`);
      const grid = tile.parentNode;
      assert.ok(tokens(grid).includes('grid'), `${label}: its grid`);
      for (const t of ['grid-cols-2', 'md:grid-cols-3', 'xl:grid-cols-4']) assert.ok(tokens(grid).includes(t), `${label}'s grid has ${t}: ${tokens(grid).join(' ')}`);
      assert.ok(!tokens(grid).includes('lg:grid-cols-4'), `${label}'s grid is not four to a row at lg: narrower cards cut names`);
      assert.ok(!all.some((el) => el.tagName === 'ASIDE'), 'no sidebar takes a column from the cards');
      if (label === 'New Resume') {
        assert.equal(grid.childNodes[0], tile, 'the dashed New Resume tile is the first cell of the grid');
        assert.equal(grid.childNodes.length, 3, 'the tile and the two cards');
      } else assert.equal(grid.childNodes.at(-1), tile, 'the New Cover Letter tile follows the letters');
    }
  } finally { await page.close(); }
});

// The name is no longer one `truncate` line (R5 follow-up, tests/pdf/104-r5-dash-card-name-two-lines): a
// touch screen shows no title, so it wraps to two lines and a "(Copy)" ending is never cut. The title
// stays, for a mouse, on the name's <p>.
it('a card\'s name shows in full on hover, so a résumé and its "(Copy)" can be told apart', async () => {
  const page = await dashboard();
  try {
    const names = page.all().filter((el) => el.tagName === 'P' && el.getAttribute('title') != null && text(el).startsWith(LONG));
    assert.deepEqual(names.map(text), [LONG, `${LONG} (Copy)`], 'both cards\' names, in the store\'s order');
    for (const name of names) assert.equal(name.getAttribute('title'), text(name), `the full name on hover: ${text(name)}`);
  } finally { await page.close(); }
});
