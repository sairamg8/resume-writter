// Shared by the 182-ui-b5a-* tests (not a test itself): the real Dashboard over tests/pdf/fake-dom.mjs with a
// store whose actions are recorded, a confirm that answers as the test says, and a public-link stub. The
// pieces that load on demand (the card menu, the letter picker, Career History) are the real ones unless a
// test names them in `fail` (their import() then rejects, as offline) or hands its own loader in `custom`.
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { MemoryStorage } from './resume-tab.mjs';

export const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
export async function until(check, what) {
  for (let i = 0; i < 500; i += 1) {
    if (check()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  throw new Error(`never: ${what}`);
}
const offline = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));

export const cv = (id, name, updatedAt, extra = {}) => Object.assign(resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), { id, name, updatedAt }, extra);
export const letter = (id, name, updatedAt) => cv(id, name, updatedAt, { kind: 'letter' });

/**
 * - `calls`: what the store and the stubs were asked, in order: { duplicate, deleted: [id, uid], unpublished: [uid, id], renamed, made, asked: [confirm texts] }
 * - `all()`, `button(label)`, `cards()`, `more(card)` (a card's ⋯ button), `item(label)` (an open menu's item), `press(el)`, `settle()`
 * - `close()`
 */
export async function dashboard(resumes, { fail = [], custom = {}, answer = true, user = null, persistError = null, recovery = null, originalsWaiting = false } = {}) {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  await loadModule('/src/components/CardMenu.jsx');
  await loadModule('/src/components/ImportDialog.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  warmed.clear();
  for (const key of fail) loaders[key] = offline;
  Object.assign(loaders, custom);
  globalThis.localStorage = new MemoryStorage([]);
  const savedConfirm = globalThis.confirm;
  const savedError = console.error;
  const savedLocation = globalThis.location;
  globalThis.location = { reload: () => { calls.reloads += 1; }, assign: () => { calls.reloads += 1; } };
  console.error = () => {};
  const calls = { duplicate: [], deleted: [], unpublished: [], renamed: [], made: [], asked: [], dismissed: 0, reloads: 0 };
  globalThis.confirm = (question) => { calls.asked.push(question); return answer; };
  const store = {
    appState: { resumes, activeId: resumes[0]?.id, syncedUid: user?.uid ?? null }, persistError, recovery,
    dismissRecovery: () => { calls.dismissed += 1; },
    duplicateResume: (id) => { calls.duplicate.push(id); return `${id}_copy`; },
    deleteResume: (id, uid) => { calls.deleted.push([id, uid]); },
    renameResume: (id, name) => { calls.renamed.push([id, name]); },
    createLetter: (fromId) => { calls.made.push(fromId); return `letter_${calls.made.length}`; },
  };
  const publicLinks = { unpublishResume: (uid, id) => { calls.unpublished.push([uid, id]); return Promise.resolve(); } };
  const auth = { user, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks, originalsWaiting })), {});
  const proto = Object.getPrototypeOf(view.document.body);
  proto.scrollIntoView ??= () => {};
  const all = () => [...elements(view.document.body)];
  const ev = () => ({ preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} });
  const page = {
    calls, view, loaders, all, text: () => text(view.document.body),
    button: (label) => all().find((el) => el.tagName === 'BUTTON' && (text(el) === label || el.getAttribute('aria-label') === label)),
    cards: () => all().filter((el) => el.getAttribute('data-testid') === 'resume-card'),
    more: (card) => [...elements(card)].find((el) => el.getAttribute('data-testid') === 'resume-card-more'),
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && text(el).startsWith(label)),
    press: (el) => view.act(() => reactProps(el).onClick(ev())),
    hover: (el) => view.act(() => reactProps(el).onMouseEnter?.(ev())),
    async settle() { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setTimeout(r, 10); }); view.act(() => {}); } },
    /** Opens a card's menu and waits for its items (its code arrives behind React.lazy). */
    async openMenu(card) {
      page.press(page.more(card));
      await until(() => page.item('Edit'), 'the card menu opened');
    },
    async close() {
      await view.unmount();
      Object.assign(loaders, real);
      console.error = savedError;
      globalThis.confirm = savedConfirm;
      globalThis.location = savedLocation;
      if (savedLocation === undefined) delete globalThis.location;
      delete globalThis.localStorage;
    },
  };
  return page;
}
