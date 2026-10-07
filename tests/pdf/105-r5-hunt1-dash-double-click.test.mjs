// R5-HUNT1-DASHBOARD-DOUBLE-CLICK-DUPLICATE-RECORDS: the editor is a lazy route and React Router opens
// it as a transition, so the Dashboard stays on screen, and clickable, while the editor's code loads.
// The second click of a double-click on a card's Copy, on New Cover (with none or one résumé) or on
// the dashed New Cover Letter card ran again and made a second copy or letter, saved and synced. /new
// guards this with a once-per-visit ref (NewResume.jsx) and the letter picker ignores a second pick
// (R4-DVIS-07); the Dashboard now does the same: one copy, one letter, per visit.
// The Dashboard is mounted over the real store in a MemoryRouter with no <Routes>, so it stays on
// screen after it navigates, as it does while the editor's chunk is on its way.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';
import { cardMenuItem, plainButton } from './card-menu.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const KEY = 'cpwtcv_v1';
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const cv = (id, name, extra = {}) => ({ ...resume({ personal: { name: 'Wren Calloway', title: 'Harbor Pilot' } }), id, name, updatedAt: 1000, ...extra });

const offline = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

/** `plain`: the card menu's code cannot be had, so a card shows plain Edit / Copy / Delete buttons (ResumeCard). */
async function dashboard(resumes, { plain = false } = {}) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  const realMenu = _lazyForTest.loaders.menu;
  if (plain) _lazyForTest.loaders.menu = offline;
  globalThis.localStorage = new MemoryStorage(resumes.length ? [[KEY, JSON.stringify({ resumes, activeId: resumes[0].id })]] : []);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null, navigate: null };
  function Where() {
    const at = useLocation();
    box.where = at.pathname + at.search;
    box.navigate = useNavigate();
    return null;
  }
  function Page() {
    box.store = useAppStore();
    return createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
      createElement(Where), createElement(Dashboard, { store: box.store, auth, sync }));
  }
  const view = mount(Page, {});
  await settle();
  const all = (within = view.document.body) => [...elements(within)];
  const button = (label, within) => {
    const found = all(within).find((el) => el.tagName === 'BUTTON' && text(el) === label);
    assert.ok(found, `no button "${label}"`);
    return found;
  };
  const card = (name) => {
    const found = all().find((el) => el.getAttribute('data-testid') === 'resume-card'
      && all(el).some((p) => p.tagName === 'P' && p.getAttribute('title') === name));
    assert.ok(found, `no card "${name}"`);
    return found;
  };
  // Two clicks in a row on the same button, before anything settles: a double-click.
  const doubleClick = async (el) => {
    const event = { preventDefault() {}, stopPropagation() {}, target: el, currentTarget: el };
    view.act(() => reactProps(el).onClick(event));
    view.act(() => reactProps(el).onClick(event));
    await settle();
  };
  // A card's menu item pressed twice in a row, before anything settles. The menu closes on the first press, so the
  // second goes to the item's handler as it stood (the guard under test is the Dashboard's, not the menu's).
  const doubleAction = async (name, label) => {
    const item = await cardMenuItem(view, card(name), label);
    const event = { preventDefault() {}, stopPropagation() {}, target: item, currentTarget: item };
    // Its handler is taken before the first press: the menu closes on it, and the item leaves the page.
    const { onClick } = reactProps(item);
    view.act(() => onClick(event));
    view.act(() => onClick(event));
    await settle();
  };
  // The plain buttons, once the menu's failed import has put them on the card.
  const plainCopy = async (name) => {
    for (let i = 0; i < 500 && !all(card(name)).some((el) => el.tagName === 'BUTTON' && text(el) === 'Copy'); i += 1) {
      await new Promise((r) => { setTimeout(r, 10); });
      view.act(() => {});
    }
    return plainButton(card(name), 'Copy');
  };
  return {
    button, card, doubleClick, doubleAction, plainCopy,
    resumes: () => box.store.appState.resumes,
    where: () => box.where,
    // The browser's Back while the editor's code is still on its way: the dashboard never went away.
    async back() {
      view.act(() => { box.navigate(-1); });
      await settle();
    },
    async close() {
      await view.unmount();
      _lazyForTest.loaders.menu = realMenu;
      delete globalThis.localStorage;
    },
  };
}

it("a double-click on a card's Copy (in its menu) makes one copy, and opens it", async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV')]);
  try {
    await page.doubleAction('Harbor Pilot CV', 'Copy');
    const copies = page.resumes().filter((r) => r.name === 'Harbor Pilot CV (Copy)');
    assert.equal(copies.length, 1, `one copy: ${page.resumes().map((r) => r.name).join(' | ')}`);
    assert.equal(page.resumes().length, 2);
    assert.equal(page.where(), `/resume/${copies[0].id}`);
  } finally { await page.close(); }
});

it("a double-click on a card's plain Copy button (the menu's code unreachable) makes one copy, and opens it", async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV')], { plain: true });
  try {
    await page.doubleClick(await page.plainCopy('Harbor Pilot CV'));
    const copies = page.resumes().filter((r) => r.name === 'Harbor Pilot CV (Copy)');
    assert.equal(copies.length, 1, `one copy: ${page.resumes().map((r) => r.name).join(' | ')}`);
    assert.equal(page.resumes().length, 2);
    assert.equal(page.where(), `/resume/${copies[0].id}`);
  } finally { await page.close(); }
});

it('a double-click on New Cover with one résumé makes one letter, and opens it', async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV')]);
  try {
    await page.doubleClick(page.button('New Cover'));
    const letters = page.resumes().filter((r) => r.kind === 'letter');
    assert.equal(letters.length, 1, 'one letter');
    assert.equal(letters[0].personal.name, 'Wren Calloway', 'from the one résumé');
    assert.equal(page.where(), `/resume/${letters[0].id}?tab=coverletter`);
  } finally { await page.close(); }
});

it('a double-click on New Cover with no résumé makes one blank letter', async () => {
  const page = await dashboard([]);
  try {
    await page.doubleClick(page.button('New Cover'));
    const letters = page.resumes().filter((r) => r.kind === 'letter');
    assert.equal(letters.length, 1, 'one letter');
    assert.equal(page.where(), `/resume/${letters[0].id}?tab=coverletter`);
  } finally { await page.close(); }
});

it('a double-click on the dashed New Cover Letter card makes one letter', async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV'), cv('resume_l', 'Contoso letter', { kind: 'letter' })]);
  try {
    await page.doubleClick(page.button('New Cover Letter'));
    const letters = page.resumes().filter((r) => r.kind === 'letter');
    assert.equal(letters.length, 2, `the one there was and one new: ${letters.map((r) => r.name).join(' | ')}`);
    const made = letters.find((r) => r.id !== 'resume_l');
    assert.equal(page.where(), `/resume/${made.id}?tab=coverletter`);
  } finally { await page.close(); }
});

// Review follow-up: Back before the editor arrives leaves the Dashboard mounted with its guard used, so
// Copy and New Cover did nothing until the page mounted again. Back at "/" is a new visit.
it("Back to the dashboard before the editor opens: a card's Copy works again, once", async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV')]);
  try {
    await page.doubleAction('Harbor Pilot CV', 'Copy');
    assert.equal(page.resumes().length, 2, 'one copy');
    await page.back();
    assert.equal(page.where(), '/');
    await page.doubleAction('Harbor Pilot CV', 'Copy');
    const copies = page.resumes().filter((r) => r.name === 'Harbor Pilot CV (Copy)');
    assert.equal(copies.length, 2, `a second copy after Back, and only one: ${page.resumes().map((r) => r.name).join(' | ')}`);
    assert.equal(page.where(), `/resume/${copies[1].id}`);
  } finally { await page.close(); }
});

it('Back to the dashboard before the editor opens: New Cover works again, once', async () => {
  const page = await dashboard([]);
  try {
    await page.doubleClick(page.button('New Cover'));
    assert.equal(page.resumes().filter((r) => r.kind === 'letter').length, 1, 'one letter');
    await page.back();
    assert.equal(page.where(), '/');
    await page.doubleClick(page.button('New Cover'));
    const letters = page.resumes().filter((r) => r.kind === 'letter');
    assert.equal(letters.length, 2, 'a second letter after Back, and only one');
    assert.equal(page.where(), `/resume/${letters[1].id}?tab=coverletter`);
  } finally { await page.close(); }
});
