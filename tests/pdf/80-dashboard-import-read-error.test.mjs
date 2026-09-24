// R2-085, R2-091, R2-117: Dashboard → Import set only `reader.onload`, so a file the browser will not
// hand over — a removed drive, a revoked permission, a folder — ended in silence. The editor's
// Import (ExportDropdown, AUD-23) and the Job Tracker's (readImportFile, J-23) already say so; the
// Dashboard now shows the same message, and imports nothing. The real Dashboard is mounted with
// react-dom/client (tests/pdf/fake-dom.mjs) and its file input fed a file whose read fails.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
});
after(teardown);

function Page({ store }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }));
}

/** A FileReader stand-in whose read ends the way `outcome` says: 'error' or 'abort'. */
const failingReader = (outcome) => class {
  readAsText() { setTimeout(() => this[`on${outcome}`]?.({ target: { error: new Error('NotReadableError') } }), 0); }
};

describe('Dashboard → Import, a file the browser cannot read', () => {
  for (const outcome of ['error', 'abort']) {
    it(`says so, and imports nothing (${outcome})`, async () => {
      const imported = [];
      const store = {
        appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
        persistError: null,
        recovery: null,
        importResume: (r) => { imported.push(r); return 'x'; },
      };
      const view = mount(Page, { store });
      const saved = { FileReader: globalThis.FileReader, setTimeout: globalThis.setTimeout };
      // The message's 4 s timer, held here to run while the page is still mounted.
      const later = [];
      globalThis.setTimeout = (fn, ms, ...rest) => (ms === 4000 ? later.push(fn) : saved.setTimeout(fn, ms, ...rest));
      globalThis.FileReader = failingReader(outcome);
      try {
        const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
        assert.ok(input, 'the Import file input');
        view.act(() => reactProps(input).onChange({ target: { files: [{ name: 'resume.json' }], value: '' } }));
        await new Promise((resolve) => { setTimeout(resolve, 50); });
        assert.match(view.container.textContent, /could not be read/i);
        assert.deepEqual(imported, []);
        view.act(() => later.forEach((fn) => fn()));
        assert.doesNotMatch(view.container.textContent, /could not be read/i, 'and goes, as the other import errors do');
      } finally {
        Object.assign(globalThis, saved);
        await view.unmount();
      }
    });
  }
});
