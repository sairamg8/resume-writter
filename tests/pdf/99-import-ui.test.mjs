// R2-148: the Import of the Dashboard and of the editor's Export menu took .json alone. Their file
// pickers now offer .json, .pdf, .docx, .txt and .md; a document goes through the best-effort reader
// (src/utils/importDocument.js) into a new résumé by the same importResume, and the editor it opens
// says the import was best-effort, until dismissed. A .json file still goes the way it always went.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let Dashboard;
let useEditorExports;
let useImportNotice;
let EditorAlerts;
before(async () => {
  await setup();
  ({ Dashboard } = await loadModule('/src/pages/Dashboard.jsx'));
  ({ useEditorExports } = await loadModule('/src/hooks/useEditorExports.js'));
  ({ useImportNotice } = await loadModule('/src/hooks/useImportNotice.js'));
  ({ EditorAlerts } = await loadModule('/src/components/EditorHeader.jsx'));
});
after(teardown);

const TEXT = 'Robin Vale\nProduct Designer\nrobin@example.org\n\nEXPERIENCE\nFabrikam Studio - Lead Designer\n2019 - 2023 | Leeds, UK\n* Designed the booking flow.';
/** A picked file: a name and its bytes, as a File gives them. */
const fileOf = (name, text) => ({ name, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const flush = async () => { for (let i = 0; i < 20; i += 1) await new Promise((r) => { setImmediate(r); }); };
/** Waits, up to 20 s, for `done()`: the first import loads the reader through Vite's loader. */
const until = async (done) => { for (const end = Date.now() + 20_000; !done() && Date.now() < end;) await new Promise((r) => { setImmediate(r); }); };

function DashboardPage({ store }) {
  const auth = { user: null, authLoading: false, cloudAvailable: false, signInWithGoogle: () => {}, signOut: () => {} };
  const sync = { syncStatus: 'idle', lastSynced: null, isOnline: true, heldResumes: [] };
  return createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Dashboard, { store, auth, sync }));
}

const dashboardStore = (imported) => ({
  appState: { resumes: [], deletedIds: [], activeId: null, jobs: [] },
  persistError: null,
  recovery: null,
  importResume: (r) => { imported.push(r); return 'resume_new'; },
});

describe('Dashboard → Import of a document', () => {
  it('the picker offers .json first, then PDF, Word, text and Markdown', async () => {
    const view = mount(DashboardPage, { store: dashboardStore([]) });
    try {
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
      assert.equal(reactProps(input).accept, '.json,.pdf,.docx,.txt,.md');
    } finally {
      await view.unmount();
    }
  });

  it('a .txt résumé is read into a new résumé through importResume', async () => {
    const imported = [];
    const view = mount(DashboardPage, { store: dashboardStore(imported) });
    try {
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
      view.act(() => reactProps(input).onChange({ target: { files: [fileOf('robin.txt', TEXT)], value: '' } }));
      await until(() => imported.length);
      assert.equal(imported.length, 1, view.container.textContent);
      const [r] = imported;
      assert.equal(r.personal.name, 'Robin Vale');
      assert.equal(r.personal.email, 'robin@example.org');
      const [job] = r.sections.find((s) => s.type === 'experience').items;
      assert.deepEqual([job.company, job.role, job.startDate, job.endDate, job.location], ['Fabrikam Studio', 'Lead Designer', '2019', '2023', 'Leeds, UK']);
    } finally {
      await view.unmount();
    }
  });

  it('a file with no text says so, and imports nothing', async () => {
    const imported = [];
    const view = mount(DashboardPage, { store: dashboardStore(imported) });
    const saved = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...rest) => (ms >= 4000 ? 0 : saved(fn, ms, ...rest));
    const quiet = console.error;
    console.error = () => {};
    try {
      const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.type === 'file');
      view.act(() => reactProps(input).onChange({ target: { files: [fileOf('empty.md', '  \n ')], value: '' } }));
      await until(() => /No text could be read/.test(view.container.textContent));
      assert.match(view.container.textContent, /No text could be read from that file/);
      assert.deepEqual(imported, []);
    } finally {
      globalThis.setTimeout = saved;
      console.error = quiet;
      await view.unmount();
    }
  });
});

describe('the editor\'s Import of a document', () => {
  it('imports it and opens it with the best-effort notice', async () => {
    let hook;
    const imported = [];
    const went = [];
    function Harness() {
      hook = useEditorExports({
        resume: { personal: { name: 'Alex' }, sections: [] }, activeTab: 'resume', authUser: null,
        importResume: (r) => { imported.push(r); return 'resume_doc'; },
        navigate: (...args) => went.push(args),
      });
      return null;
    }
    const view = mount(Harness, {});
    try {
      await hook.handleImportFile(fileOf('robin.md', `# Robin Vale\n**Product Designer**\n\n## Experience\n### **Fabrikam Studio** — *Lead Designer*\n*2019 – 2023*`));
      assert.equal(imported[0]?.personal.name, 'Robin Vale');
      assert.equal(imported[0]?.personal.title, 'Product Designer');
      assert.equal(went[0]?.[0], '/resume/resume_doc');
      assert.match(went[0]?.[1]?.state?.importNotice || '', /as best we could read it/);
    } finally {
      await view.unmount();
    }
  });

  it('the notice shows over the editor until Dismiss, which takes it off the page for good', async () => {
    let path;
    function Page() {
      const notice = useImportNotice();
      const location = useLocation();
      path = location.pathname;
      return createElement(EditorAlerts, { exportError: null, onDismiss: () => {}, persistError: null, importNotice: notice.notice, onDismissImport: notice.dismiss });
    }
    const Routed = () => createElement(MemoryRouter, { initialEntries: [{ pathname: '/resume/resume_doc', state: { importNotice: 'Imported best-effort: check it.' } }] }, createElement(Page));
    const view = mount(Routed, {});
    try {
      assert.match(view.container.textContent, /Imported best-effort: check it\./);
      const dismiss = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent === 'Dismiss');
      view.act(() => reactProps(dismiss).onClick());
      await flush();
      assert.doesNotMatch(view.container.textContent, /Imported best-effort/);
      assert.equal(path, '/resume/resume_doc', 'the editor stays on the résumé');
    } finally {
      await view.unmount();
    }
  });
});
