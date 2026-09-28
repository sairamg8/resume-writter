// R4-DVIS-14: the Dashboard called /boards "Boards" (a Columns2 icon) while the sidebar, the top bar's
// menu and the page's own title all call it "Projects", and its brand was a blue FileText square with a
// 20 px "CPWT-CV" where the workspace's top bar shows the brand-blue "CV" square and a 15 px name. The
// Dashboard's button now reads "Projects" (the sidebar's LayoutGrid icon) and still opens /boards, and
// its mark is the top bar's. The fake DOM has no layout, so this pins the text and classes on the real
// Dashboard, mounted with react-dom/client over tests/pdf/fake-dom.mjs; cypress/e2e/26-mobile-layout.cy.js
// checks the renamed button is in reach on a phone.
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

it('the Dashboard calls /boards "Projects", as the sidebar and the top bar do, and the button still opens it', async () => {
  const page = await dashboard();
  try {
    const buttons = page.all().filter((el) => el.tagName === 'BUTTON');
    assert.ok(!buttons.some((el) => text(el) === 'Boards'), 'no "Boards" button: the workspace calls them projects');
    const projects = buttons.find((el) => text(el) === 'Projects');
    assert.ok(projects, 'a "Projects" button in the Dashboard\'s header');
    page.view.act(() => reactProps(projects).onClick({ preventDefault() {}, stopPropagation() {} }));
    assert.equal(page.where(), '/boards', 'Projects opens the projects list');
  } finally { await page.close(); }
});

it('the Dashboard\'s brand is the top bar\'s mark: the brand-blue "CV" square and the 15 px name', async () => {
  const page = await dashboard();
  try {
    const all = page.all();
    const mark = all.find((el) => el.tagName === 'SPAN' && text(el) === 'CV');
    assert.ok(mark, 'the "CV" mark');
    for (const t of ['size-7', 'rounded-md', 'bg-brand', 'text-white']) assert.ok(tokens(mark).includes(t), `the mark has ${t}, as the TopBar's`);
    const name = all.find((el) => el.tagName === 'SPAN' && text(el) === 'CPWT-CV');
    assert.ok(name, 'the name beside the mark');
    for (const t of ['text-[15px]', 'font-semibold', 'text-ink']) assert.ok(tokens(name).includes(t), `the name has ${t}, as the TopBar's`);
    assert.ok(!tokens(name).includes('text-xl'), 'not the old 20 px name');
    const old = all.filter((el) => tokens(el).includes('bg-blue-600') && tokens(el).includes('w-8'));
    assert.deepEqual(old, [], 'no old blue FileText square');
  } finally { await page.close(); }
});
