// Dashboard → New Resume: the content and the look in one step (R2-139, D1). The role starters were text
// only, and each quietly put the new résumé on a template (Classic, Modern, Executive…) it never named.
// Now each starter says its template, and a row of looks above them — every card of the Design panel's
// picker, pictures included — puts the new résumé on another template or design; left on "Each starter's
// own", a pick creates exactly what it did before. The store then makes the résumé on that look.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
let STARTER_TEMPLATES;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  ({ STARTER_TEMPLATES } = await loadModule('/src/utils/starterTemplates.js'));
});
after(teardown);

function Page({ store }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }));
}

/** The Dashboard with New Resume open, over a store that records createResume's arguments. */
function newResume() {
  const created = [];
  const store = {
    appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
    persistError: null,
    recovery: null,
    createResume: (...args) => { created.push(args); return 'resume_new'; },
  };
  const view = mount(Page, { store });
  const all = () => [...elements(view.container)];
  const click = (el) => view.act(() => reactProps(el).onClick());
  click(all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'New Resume'));
  const byTestid = (id) => all().find((el) => el.getAttribute('data-testid') === id);
  const card = (h3) => {
    let el = all().find((x) => x.tagName === 'H3' && x.textContent.trim() === h3);
    while (el.tagName !== 'BUTTON') el = el.parentNode;
    return el;
  };
  return { view, created, click, byTestid, card };
}

describe('New Resume: the content and the look in one step (D1)', () => {
  it('each starter names the template it comes on', async () => {
    const v = newResume();
    try {
      const { templateLabel } = await loadModule('/src/constants/templates.js');
      for (const s of STARTER_TEMPLATES) assert.match(v.card(s.name).textContent, new RegExp(`Template: ${templateLabel(s.template)}`), s.id);
    } finally { await v.view.unmount(); }
  });

  it('offers every card of the picker as a look, each with its picture; "Each starter\'s own" is picked at first', async () => {
    const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
    const v = newResume();
    try {
      for (const c of pickerCards({})) {
        const b = v.byTestid(`look-${c.testid}`);
        assert.ok(b, c.testid);
        assert.ok([...elements(b)].some((el) => el.getAttribute('data-look-thumb') === 'page'), `${c.testid}: its picture`);
      }
      assert.match(v.byTestid('look-own').className, /border-blue-500/);
    } finally { await v.view.unmount(); }
  });

  it('a look picked, then a starter: the résumé is made from that starter on that look, and every starter says so', async () => {
    const v = newResume();
    try {
      v.click(v.byTestid('look-template-sidebar-single'));
      for (const s of STARTER_TEMPLATES) assert.match(v.card(s.name).textContent, /Template: Sidebar · Single column/, s.id);
      v.click(v.card(STARTER_TEMPLATES[0].name));
      assert.deepEqual(v.created, [['Untitled Resume', STARTER_TEMPLATES[0].id, { engine: 'sidebar', preset: '', variant: { sidebarSingleColumn: true } }]]);
    } finally { await v.view.unmount(); }
  });

  it('a design picked, then Start from Scratch: a blank résumé on the design', async () => {
    const v = newResume();
    try {
      v.click(v.byTestid('look-preset-harbor'));
      v.click(v.card('Start from Scratch (Blank)'));
      assert.deepEqual(v.created, [['Untitled Resume', null, { engine: 'classic', preset: 'harbor', variant: null }]]);
    } finally { await v.view.unmount(); }
  });

  it('the store makes it: the starter\'s content on the look picked, as picking it in Design would', async () => {
    const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
    const storage = new Map();
    globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k), key: () => null, length: 0 };
    let store = null;
    let done = false;
    function Probe() {
      store = useAppStore();
      if (!done) {
        done = true;
        store.createResume('Untitled Resume', STARTER_TEMPLATES[1].id, { engine: 'minimal', preset: 'nordic', variant: null });
        store.createResume('Untitled Resume', null, { engine: 'sidebar', preset: '', variant: { sidebarSingleColumn: true } });
        store.createResume('Untitled Resume', STARTER_TEMPLATES[1].id);
      }
      return null;
    }
    try { renderToString(createElement(Probe)); } finally { delete globalThis.localStorage; }
    const [onDesign, blank, own] = store.appState.resumes;
    assert.equal(onDesign.template, 'minimal');
    assert.equal(onDesign.settings.templatePreset, 'nordic');
    assert.equal(onDesign.settings.font, 'lato', 'the design\'s look');
    assert.equal(onDesign.personal.name, 'Sarah Chen', 'the starter\'s content');
    assert.equal(blank.template, 'sidebar');
    assert.equal(blank.settings.sidebarSingleColumn, true);
    assert.equal(own.template, STARTER_TEMPLATES[1].template, 'no look: the starter\'s own, as before');
  });
});
