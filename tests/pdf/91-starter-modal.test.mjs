// Dashboard → New Resume → the role starters (R2-157). The gate pinned the starters' own content
// (tests/unit/starter-templates.unit.mjs, 16-saved-data-starter-skills) but not the picker that
// offers them, nor what the store makes of a pick: only Cypress clicked it. So a card that passed
// another starter's id, a blank that built a starter, a close that created a résumé, or a store
// that ignored the starter passed. The real Dashboard is mounted over the fake DOM (as in
// 80-dashboard-import-read-error) with a spy store; the store's own createResume is then run as
// the Dashboard calls it (useAppStore, as 91-page-size-control runs it). Since R3-012 New Resume opens its
// own page (/new, NewResume.jsx), the looks drawn with the user's résumé and these starters below them; the
// page is mounted beside the Dashboard while the address is /new, and Back leaves it.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
let NewResume;
let STARTER_TEMPLATES;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  ({ NewResume } = await loadModule('/src/pages/NewResume.jsx'));
  ({ STARTER_TEMPLATES } = await loadModule('/src/utils/starterTemplates.js'));
});
after(teardown);

const TITLE = 'Or start blank, or from a role example';

/** Lets React run what it scheduled — the router commits a navigation as a transition — for `ms`, or until `ready()`. */
async function settle(ready = () => false, ms = 500) {
  for (let waited = 0; waited < ms && !ready(); waited += 10) await new Promise((r) => { setTimeout(r, 10); });
}

/** Where the router is: the path the Dashboard navigated to. */
function Where({ seen }) {
  seen.path = useLocation().pathname;
  return null;
}

/** New Resume's page while the address is /new. */
function NewPage({ store }) {
  return useLocation().pathname === '/new' ? createElement(NewResume, { store }) : null;
}

function Page({ store, seen }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }),
    createElement(NewPage, { store }), createElement(Where, { seen }));
}

/**
 * The Dashboard over a store that records createResume's arguments (`created`) and answers
 * 'resume_new': `await open()` clicks New Resume, `picker()` is New Resume's starters (or null),
 * `pick(h3)` clicks the card whose heading reads `h3`, `close()` clicks the page's Back, `seen.path`.
 */
function dashboard() {
  const created = [];
  const seen = {};
  const store = {
    appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
    persistError: null,
    recovery: null,
    createResume: (...args) => { created.push(args); return 'resume_new'; },
  };
  const view = mount(Page, { store, seen });
  const all = () => [...elements(view.container)];
  const picker = () => {
    const h2 = all().find((el) => el.tagName === 'H2' && el.textContent.trim() === TITLE);
    return h2 ? h2.parentNode.parentNode : null;
  };
  const clickEl = (el) => view.act(() => reactProps(el).onClick());
  return {
    created,
    seen,
    picker,
    async open() {
      const button = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'New Resume');
      assert.ok(button, 'New Resume');
      clickEl(button);
      await settle(() => picker());
      assert.equal(seen.path, '/new', 'New Resume opens its page');
      assert.ok(picker(), 'with the starters');
    },
    headings: () => [...elements(picker())].filter((el) => el.tagName === 'H3').map((el) => el.textContent.trim()),
    pick(text) {
      let el = [...elements(picker())].find((h) => h.tagName === 'H3' && h.textContent.trim() === text);
      assert.ok(el, `the "${text}" card`);
      while (el.tagName !== 'BUTTON') el = el.parentNode;
      clickEl(el);
    },
    close() {
      const button = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Back');
      assert.ok(button, 'the page\'s Back');
      clickEl(button);
    },
    unmount: () => view.unmount(),
  };
}

describe('New Resume → the starter picker (R2-157)', () => {
  it('offers Start from Scratch and every role starter, by name', async () => {
    const view = dashboard();
    try {
      assert.equal(view.picker(), null, 'closed until New Resume');
      await view.open();
      assert.deepEqual(view.headings(), ['Start from Scratch (Blank)', ...STARTER_TEMPLATES.map((t) => t.name)]);
      assert.deepEqual(view.created, [], 'opening creates nothing');
    } finally { await view.unmount(); }
  });

  it('each starter\'s card creates a résumé from that starter, opens it in the editor and closes the picker', async () => {
    assert.ok(STARTER_TEMPLATES.length >= 3);
    for (const starter of STARTER_TEMPLATES) {
      const view = dashboard();
      try {
        await view.open();
        view.pick(starter.name);
        assert.deepEqual(view.created, [['Untitled Resume', starter.id]], starter.id);
        await settle(() => view.seen.path !== '/new');
        assert.equal(view.picker(), null, `${starter.id}: closed`);
        assert.equal(view.seen.path, '/resume/resume_new', `${starter.id}: the editor`);
      } finally { await view.unmount(); }
    }
  });

  it('Start from Scratch creates a blank résumé — no starter — and opens it', async () => {
    const view = dashboard();
    try {
      await view.open();
      view.pick('Start from Scratch (Blank)');
      assert.deepEqual(view.created, [[]]);
      await settle(() => view.seen.path !== '/new');
      assert.equal(view.picker(), null);
      assert.equal(view.seen.path, '/resume/resume_new');
    } finally { await view.unmount(); }
  });

  it('Back leaves it: nothing created, back on the dashboard', async () => {
    const view = dashboard();
    try {
      await view.open();
      view.close();
      await settle(() => view.seen.path !== '/new');
      assert.equal(view.picker(), null);
      assert.deepEqual(view.created, []);
      assert.equal(view.seen.path, '/');
    } finally { await view.unmount(); }
  });
});

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** The store's own createResume(...args), as the Dashboard calls it, over a store holding `r`: its state after, and the id it answered. */
async function created(r, args) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let id = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) {
      done = true;
      id = store.createResume(...args);
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return { state: store.appState, id };
}

/** `r` without the time it was made. */
const timeless = (r) => {
  const copy = { ...r };
  delete copy.updatedAt;
  return copy;
};

describe('what the store makes of a pick (R2-157)', () => {
  it('a starter: a new résumé holding the starter — its name, template, settings, person and sections — made the open one', async () => {
    const { buildResumeFromStarter } = await loadModule('/src/utils/starterTemplates.js');
    for (const starter of STARTER_TEMPLATES) {
      const existing = resume({ personal: { name: 'Avery Stone' } });
      const { state, id } = await created(existing, ['Untitled Resume', starter.id]);
      assert.equal(state.resumes.length, 2, starter.id);
      assert.equal(state.resumes[0].id, existing.id, `${starter.id}: the résumé already there is kept`);
      const made = state.resumes.find((x) => x.id === id);
      assert.ok(made, `${starter.id}: stored under the id it answered`);
      assert.equal(state.activeId, id, `${starter.id}: the open one`);
      assert.deepEqual(timeless(made), timeless(buildResumeFromStarter(starter.id, id)), starter.id);
      assert.equal(made.name, starter.name);
      assert.equal(made.template, starter.template || 'classic');
      assert.deepEqual(made.personal, starter.personal);
    }
  });

  it('no starter: a blank résumé, as a new one is', async () => {
    const { createBlankResume } = await loadModule('/src/utils/defaultData.js');
    const { state, id } = await created(resume(), []);
    const made = state.resumes.find((x) => x.id === id);
    assert.ok(made);
    assert.equal(state.activeId, id);
    assert.deepEqual(timeless(made), timeless(createBlankResume({ id, name: 'Untitled Resume' })));
    assert.equal(made.personal.name, '', 'no starter\'s person');
  });
});
