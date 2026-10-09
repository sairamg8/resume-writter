// CYC8-S12: a document import refuses a file over 20 MB (MAX_IMPORT_BYTES), but the JSON path of the
// Dashboard's Import and the editor's read any file whole with FileReader.readAsText: a huge file picked
// by mistake stalled the tab. Now the JSON path refuses a file over the same size, unread, with the same
// message as the document import's. A file under the cap is read as before. The real Dashboard and
// ExportDropdown over tests/pdf/fake-dom.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

let Dashboard;
let ExportDropdown;
let importDocument;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  ({ ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx'));
  importDocument = await loadModule('/src/utils/importDocument.js');
});
after(teardown);

function Page({ store }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }));
}

/** A FileReader stand-in that counts the files it is asked to read. */
function countingReader(reads) {
  return class { readAsText(file) { reads.push(file.name); } };
}

describe('the JSON import refuses a file over the size cap, unread', () => {
  it('the cap is the document import\'s: 20 MB', () => {
    assert.equal(importDocument.MAX_IMPORT_BYTES, 20 * 1024 * 1024);
    assert.match(importDocument.TOO_BIG, /too large to be a résumé \(over 20 MB\)/);
  });

  it('Dashboard → Import: a huge .json says so and is never read; one at the cap is read', async () => {
    const store = {
      appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
      persistError: null,
      recovery: null,
      importResume: () => 'x',
    };
    const view = mount(Page, { store });
    const saved = { FileReader: globalThis.FileReader };
    const reads = [];
    globalThis.FileReader = countingReader(reads);
    try {
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
      assert.ok(input, 'the Import file input');
      const target = { files: [{ name: 'huge.json', size: importDocument.MAX_IMPORT_BYTES + 1 }], value: 'huge.json' };
      view.act(() => reactProps(input).onChange({ target }));
      assert.deepEqual(reads, [], 'the file was not read');
      assert.match(view.container.textContent, /too large to be a résumé \(over 20 MB\)/);
      assert.equal(target.value, '', 'the picker is cleared, so the same file can be picked again');
      view.act(() => reactProps(input).onChange({ target: { files: [{ name: 'ok.json', size: importDocument.MAX_IMPORT_BYTES }], value: '' } }));
      assert.deepEqual(reads, ['ok.json'], 'a file at the cap is read');
    } finally {
      Object.assign(globalThis, saved);
      await view.unmount();
    }
  });

  it('editor → Import: a huge .json reports the error and is never read', async () => {
    const noop = () => {};
    const errors = [];
    const view = mount(ExportDropdown, {
      exporting: false, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onImportJSON: noop, onImportFile: noop,
      onImportError: (message) => errors.push(message),
    });
    const saved = { FileReader: globalThis.FileReader };
    const reads = [];
    globalThis.FileReader = countingReader(reads);
    try {
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
      assert.ok(input, 'the Import file input');
      view.act(() => reactProps(input).onChange({ target: { files: [{ name: 'huge.json', size: importDocument.MAX_IMPORT_BYTES + 1 }], value: '' } }));
      assert.deepEqual(reads, []);
      assert.deepEqual(errors, [importDocument.TOO_BIG]);
      view.act(() => reactProps(input).onChange({ target: { files: [{ name: 'ok.json', size: 1000 }], value: '' } }));
      assert.deepEqual(reads, ['ok.json']);
    } finally {
      Object.assign(globalThis, saved);
      await view.unmount();
    }
  });
});
