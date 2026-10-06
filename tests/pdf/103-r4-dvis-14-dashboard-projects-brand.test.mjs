// R4-DVIS-14: the Dashboard called /boards "Boards" while the sidebar, the top bar's menu and the page's own
// title all call it "Projects", and its brand was a blue FileText square. B2 (UI rebuild): the Dashboard's
// header is the shared AppBar, so "Projects" is a nav link (still to /boards) and the brand is a link to "/"
// with the canvas CV mark (cv-* classes). The fake DOM has no layout, so this pins the text and classes on
// the real Dashboard, mounted with react-dom/client over tests/pdf/fake-dom.mjs; cypress/e2e/26-mobile-layout.cy.js
// checks the phone's Projects tab is in reach.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(setup);
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

/** The Dashboard of a first visit (no résumés), signed out; `where()` is the address it went to. */
async function dashboard() {
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage([]);
  const store = { appState: { resumes: [], activeId: null }, persistError: null, recovery: null };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { where: null };
  function Where() {
    box.where = useLocation().pathname;
    return null;
  }
  function Page() {
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), createElement(Dashboard, { store, auth, sync, publicLinks: null }));
  }
  const view = mount(Page, {});
  return {
    view,
    where: () => box.where,
    all: () => [...elements(view.container)],
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

it('the Dashboard calls /boards "Projects", as the sidebar and the top bar do, and the nav link still opens it', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    assert.ok(!all.some((el) => (el.tagName === 'BUTTON' || el.tagName === 'A') && text(el) === 'Boards'), 'no "Boards" entry: the workspace calls them projects');
    const projects = all.find((el) => el.getAttribute('data-testid') === 'app-bar-nav-projects');
    assert.ok(projects, 'a "Projects" link in the Dashboard\'s bar');
    assert.equal(projects.tagName, 'A');
    assert.equal(text(projects), 'Projects');
    page.view.act(() => reactProps(projects).onClick({ button: 0, preventDefault() {}, stopPropagation() {} }));
    assert.equal(page.where(), '/boards', 'Projects opens the projects list');
  } finally { await page.close(); }
});

it('the Dashboard\'s brand is the bar\'s link to "/": the brand-blue "CV" mark and the name', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const mark = all.find((el) => el.tagName === 'SPAN' && text(el) === 'CV');
    assert.ok(mark, 'the "CV" mark');
    for (const t of ['bg-cv-brand', 'rounded-cv-control', 'text-white']) assert.ok(tokens(mark).includes(t), `the mark has ${t}`);
    const name = all.find((el) => el.tagName === 'SPAN' && text(el) === 'CPWT-CV');
    assert.ok(name, 'the name beside the mark');
    assert.ok(tokens(name).includes('font-bold'), 'the name is bold');
    const brand = mark.parentNode;
    assert.equal(brand.tagName, 'A', 'the brand is a link');
    assert.equal(brand.getAttribute('href'), '/');
    assert.ok(brand.contains(name), 'the mark and the name are one link');
    const old = all.filter((el) => tokens(el).includes('bg-blue-600') && tokens(el).includes('w-8'));
    assert.deepEqual(old, [], 'no old blue FileText square');
  } finally { await page.close(); }
});
