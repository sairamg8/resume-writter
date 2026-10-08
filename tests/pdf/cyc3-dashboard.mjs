// The real Dashboard over tests/pdf/fake-dom.mjs for the cyc3 tests (as 178-ui-b1-lazy-fallbacks does): `custom`
// replaces loaders for the run; `made` lists the letters the store was asked for, by source résumé id.
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { loadModule } from './harness.mjs';
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

export async function dashboard(resumes, custom = {}) {
  const { Dashboard, _lazyForTest } = await loadModule('/src/pages/Dashboard.jsx');
  await loadModule('/src/components/NewLetterModal.jsx');
  await loadModule('/src/components/ImportDialog.jsx');
  const { loaders, warmed } = _lazyForTest;
  const real = { ...loaders };
  warmed.clear();
  Object.assign(loaders, custom);
  globalThis.localStorage = new MemoryStorage([]);
  const savedError = console.error;
  console.error = () => {};
  const made = [];
  const noop = () => {};
  const store = {
    appState: { resumes, activeId: resumes[0]?.id }, persistError: null, recovery: null,
    createLetter: (fromId) => { made.push(fromId); return `letter_${made.length}`; },
    renameResume: noop,
  };
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: noop, signOut: noop };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  const view = mount(() => createElement(MemoryRouter, { initialEntries: ['/'], useTransitions: false },
    createElement(Dashboard, { store, auth, sync, publicLinks: null })), {});
  const all = () => [...elements(view.document.body)];
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && text(el) === label);
  return {
    made, all, button, view,
    dialog: () => all().find((el) => el.getAttribute('role') === 'dialog' && el.getAttribute('data-state') !== 'closed'),
    press(label) { view.act(() => reactProps(button(label)).onClick({})); },
    async close() {
      await view.unmount();
      Object.assign(loaders, real);
      console.error = savedError;
      delete globalThis.localStorage;
    },
  };
}
