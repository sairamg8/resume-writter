// R4-IMP-12: a document import showed nothing while the file was read (pdf.js alone can take seconds
// on a slow line), so a second click and a second pick imported the résumé twice, and whichever read
// ended last navigated to its copy — even from a page the user had since left. Now the Import control
// says "Reading…" and is disabled while a document is read, a second pick meanwhile is ignored, and a
// read that ends after its page is gone still imports but no longer navigates. The real Dashboard is
// mounted with react-dom/client (tests/pdf/fake-dom.mjs), and the editor's useEditorExports in a harness;
// each is fed a file whose bytes the test hands over when it chooses.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
let useEditorExports;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  ({ useEditorExports } = await loadModule('/src/hooks/useEditorExports.js'));
});
after(teardown);

const TEXT = 'Robin Vale\nProduct Designer\nrobin@example.org\n\nEXPERIENCE\nFabrikam Studio - Lead Designer\n2019 - 2023 | Leeds, UK\n* Designed the booking flow.';
/**
 * A picked document whose bytes arrive only on `release()`, as a big PDF's do while pdf.js loads;
 * `reads` counts the times the import asked for them.
 */
function heldFile(name) {
  let release;
  const bytes = new Promise((resolve) => { release = () => resolve(new TextEncoder().encode(TEXT).buffer); });
  const file = { name, reads: 0, arrayBuffer: () => { file.reads += 1; return bytes; } };
  return { file, release };
}
const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
/** Waits, up to 20 s, for `done()`: the first import loads the reader through Vite's loader. */
const until = async (done) => { for (const end = Date.now() + 20_000; !done() && Date.now() < end;) await new Promise((r) => { setImmediate(r); }); };

let path;
function Where() { path = useLocation().pathname; return null; }
/** The Dashboard at '/', while `show`; the router, and `path`, stay when it goes. */
function Page({ store, show = true }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] },
    createElement(Where), show ? createElement(Dashboard, { store, auth, sync }) : null);
}
const dashboardStore = (imported) => ({
  appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
  persistError: null,
  recovery: null,
  importResume: (r) => { imported.push(r); return 'resume_new'; },
});
const fileInput = (view) => [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
const importButton = (view) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && /Import|Reading/.test(el.textContent));

describe('Dashboard → Import of a document that takes a while to read', () => {
  it('says "Reading…", is disabled, and ignores a second pick until the first is read', async () => {
    const imported = [];
    const view = mount(Page, { store: dashboardStore(imported) });
    try {
      const first = heldFile('robin.txt');
      const second = heldFile('robin-again.txt');
      assert.equal(importButton(view).textContent.trim(), 'Import');
      view.act(() => reactProps(fileInput(view)).onChange({ target: { files: [first.file], value: '' } }));
      const busy = importButton(view);
      assert.match(busy.textContent, /Reading…/, 'the Import button says the file is being read');
      assert.equal(reactProps(busy).disabled, true, 'and cannot be clicked again');
      // The same pick again, as a user who saw nothing happen would make.
      view.act(() => reactProps(fileInput(view)).onChange({ target: { files: [second.file], value: '' } }));
      await until(() => first.file.reads > 0);
      await flush();
      assert.equal(second.file.reads, 0, 'the second pick is not read');
      first.release();
      await until(() => imported.length);
      await flush();
      assert.equal(imported.length, 1, 'one résumé, not two');
      assert.equal(second.file.reads, 0);
      assert.equal(path, '/resume/resume_new', 'the import still opens its résumé');
    } finally {
      await view.unmount();
    }
  });

  it('once read, Import is back', async () => {
    const imported = [];
    const view = mount(Page, { store: dashboardStore(imported) });
    try {
      const first = heldFile('robin.txt');
      view.act(() => reactProps(fileInput(view)).onChange({ target: { files: [first.file], value: '' } }));
      first.release();
      await until(() => imported.length);
      await flush();
      const button = importButton(view);
      assert.equal(button.textContent.trim(), 'Import');
      assert.notEqual(reactProps(button).disabled, true);
    } finally {
      await view.unmount();
    }
  });

  it('a read that ends after the Dashboard is left imports, but does not navigate', async () => {
    const imported = [];
    const store = dashboardStore(imported);
    const view = mount(Page, { store });
    try {
      const first = heldFile('robin.txt');
      view.act(() => reactProps(fileInput(view)).onChange({ target: { files: [first.file], value: '' } }));
      view.update({ store, show: false });
      await flush();
      first.release();
      await until(() => imported.length);
      await flush();
      assert.equal(imported.length, 1, 'the résumé is still imported');
      assert.equal(path, '/', 'and the user is left where they are');
    } finally {
      await view.unmount();
    }
  });
});

describe('the editor\'s Import of a document that takes a while to read', () => {
  function harness(imported, went) {
    const out = {};
    function Harness() {
      out.hook = useEditorExports({
        resume: { personal: { name: 'Alex' }, sections: [] }, activeTab: 'resume', authUser: null,
        importResume: (r) => { imported.push(r); return 'resume_doc'; },
        navigate: (...args) => went.push(args),
      });
      return null;
    }
    return { out, view: mount(Harness, {}) };
  }

  it('is importing until read, and a second pick meanwhile imports nothing', async () => {
    const imported = [];
    const went = [];
    const { out, view } = harness(imported, went);
    try {
      const first = heldFile('robin.txt');
      const second = heldFile('robin-again.txt');
      let pending;
      let again;
      view.act(() => { pending = out.hook.handleImportFile(first.file); again = out.hook.handleImportFile(second.file); });
      assert.equal(out.hook.importing, true, 'the Export menu is told a document is being read');
      // Both files' bytes arrive, so nothing is left waiting whichever way the picks went.
      first.release();
      second.release();
      assert.equal(await pending, 'resume_doc');
      assert.equal(await again, null, 'the second pick is ignored');
      await flush();
      assert.equal(imported.length, 1, 'one résumé, not two');
      assert.equal(second.file.reads, 0);
      assert.equal(out.hook.importing, false);
      assert.deepEqual(went.map(([to]) => to), ['/resume/resume_doc']);
    } finally {
      await view.unmount();
    }
  });

  it('a read that ends after the editor is gone imports, but does not navigate', async () => {
    const imported = [];
    const went = [];
    const { out, view } = harness(imported, went);
    const first = heldFile('robin.txt');
    let pending;
    view.act(() => { pending = out.hook.handleImportFile(first.file); });
    await view.unmount();
    first.release();
    assert.equal(await pending, 'resume_doc');
    assert.equal(imported.length, 1, 'the résumé is still imported');
    assert.deepEqual(went, [], 'and nothing navigates');
  });
});
