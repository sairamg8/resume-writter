// UI rebuild B1 (hunt B1-H2-12/18): the Dashboard made a new React.lazy() at every mount, so a remount (Back)
// suspended once more and committed the Suspense fallback (null): Career History was absent from the first
// commit even with its chunk loaded, and a restored scroll offset could be clamped. The piece is made once
// per loader now, so a remount renders a loaded piece synchronously.
// The real Dashboard over tests/pdf/fake-dom.mjs, mounted twice.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';
import { MemoryStorage } from './resume-tab.mjs';

before(async () => {
  patchFakeDom();
  await setup();
});
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
async function until(check, what) {
  for (let i = 0; i < 500; i += 1) {
    if (check()) return;
    await new Promise((r) => { setTimeout(r, 10); });
  }
  assert.fail(`never: ${what}`);
}
const cv = (id, name, updatedAt) => ({ ...resume({ personal: { name: `${name} Person`, title: 'Analyst' } }), id, name, updatedAt });

it('a second mount shows Career History, the cards\' menus and (once Import is pressed) the import dialog in its first commit, with no waiting', async () => {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/CareerHistoryPanel.jsx');
  await loadModule('/src/components/ImportDialog.jsx');
  _lazyForTest.warmed.clear();
  globalThis.localStorage = new MemoryStorage([]);
  const noop = () => {};
  const resumes = [cv('resume_a', 'Older CV', 1000), cv('resume_b', 'Newest CV', 3000)];
  const store = {
    appState: { resumes, activeId: 'resume_a' }, persistError: null, recovery: null,
    duplicateResume: noop, deleteResume: noop, renameResume: noop, createLetter: () => null,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  // A card's ⋯ button once its menu's code is in (the kit's Menu gives it aria-expanded); until then the card draws its own.
  const menus = (view) => [...elements(view.document.body)].filter((el) => el.getAttribute('data-testid') === 'resume-card-more');
  const menusIn = (view) => menus(view).length === 2 && menus(view).every((el) => el.hasAttribute('aria-expanded'));
  const open = () => mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  const panel = (view) => [...elements(view.document.body)].some((el) => el.tagName === 'BUTTON' && text(el) === 'Open Job Tracker →');
  try {
    const first = open();
    await until(() => panel(first) && menusIn(first), 'the panel and the cards\' menus on the first mount');
    // The fourth piece: Import's dialog loads when Import is first pressed; a remount keeps it loaded.
    const dialogOf = (view) => [...elements(view.document.body)].find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed');
    const pressImport = (view) => view.act(() => reactProps([...elements(view.document.body)].find((el) => el.tagName === 'BUTTON' && text(el) === 'Import')).onClick({}));
    pressImport(first);
    await until(() => dialogOf(first), 'the import dialog on the first mount');
    await first.unmount();
    const second = open();
    assert.ok(panel(second), 'the panel is in the first commit of the second mount');
    assert.ok(menusIn(second), 'and so is the menu of each card (B5a): no ⋯ button redrawn once the loaded menu is in');
    pressImport(second);
    assert.ok(dialogOf(second), 'the import dialog is in the commit of the press itself on the second mount: no waiting for its code');
    await second.unmount();
  } finally {
    delete globalThis.localStorage;
  }
});
