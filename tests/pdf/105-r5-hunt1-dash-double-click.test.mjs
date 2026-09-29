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
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage, settle } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const KEY = 'cpwtcv_v1';
const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const cv = (id, name, extra = {}) => ({ ...resume({ personal: { name: 'Wren Calloway', title: 'Harbor Pilot' } }), id, name, updatedAt: 1000, ...extra });

async function dashboard(resumes) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { Dashboard } = await loadModule('/src/pages/Dashboard.jsx');
  globalThis.localStorage = new MemoryStorage(resumes.length ? [[KEY, JSON.stringify({ resumes, activeId: resumes[0].id })]] : []);
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle() {}, signOut() {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const box = { store: null, where: null };
  function Where() {
    const at = useLocation();
    box.where = at.pathname + at.search;
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
    const found = all().find((el) => el.tagName === 'DIV' && el.className.startsWith('group bg-white rounded-2xl')
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
  return {
    button, card, doubleClick,
    resumes: () => box.store.appState.resumes,
    where: () => box.where,
    async close() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

it("a double-click on a card's Copy makes one copy, and opens it", async () => {
  const page = await dashboard([cv('resume_a', 'Harbor Pilot CV')]);
  try {
    await page.doubleClick(page.button('Copy', page.card('Harbor Pilot CV')));
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
