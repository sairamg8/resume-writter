// R4-DUX-17: the editor's Export → "Import JSON, PDF, Word or text" added a NEW résumé that kept the
// file's name and opened it with no word said (the JSON way passed no notice), so a user restoring a
// backup thought they had overwritten the one open. The menu item now says "Import as a new résumé",
// and every editor import — JSON or document — opens with a notice that it is a new résumé and the
// open one is unchanged. The dashboard's document import keeps its own notice alone. Fictional data.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

let ExportDropdown;
let useEditorExports;
let importDocument;
before(async () => {
  await setup();
  ({ ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx'));
  ({ useEditorExports } = await loadModule('/src/hooks/useEditorExports.js'));
  importDocument = await loadModule('/src/utils/importDocument.js');
});
after(teardown);

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
/** A picked file: a name and its bytes, as a File gives them. */
const fileOf = (name, body) => ({ name, arrayBuffer: async () => new TextEncoder().encode(body).buffer });
const NEW_ONE = /Imported as a new résumé: the one you had open is unchanged/;

function editor(went) {
  let hook;
  function Harness() {
    hook = useEditorExports({
      resume: { id: 'resume_open', name: 'Backup CV', personal: { name: 'Robin Vale' }, sections: [] },
      activeTab: 'resume', authUser: null,
      importResume: () => 'resume_new',
      navigate: (...args) => went.push(args),
    });
    return null;
  }
  const view = mount(Harness, {});
  return { view, hook: () => hook };
}

describe('the editor\'s Import says it makes a new résumé (R4-DUX-17)', () => {
  it('the menu item is "Import as a new résumé"', async () => {
    const noop = () => {};
    const view = mount(ExportDropdown, { exporting: false, onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onImportJSON: noop, onImportFile: noop });
    try {
      const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
      view.act(() => reactProps(buttons().find((el) => text(el) === 'Export')).onClick());
      const labels = buttons().map(text);
      assert.ok(labels.includes('Import as a new résumé (JSON, PDF, Word or text)'), labels.join(' | '));
    } finally {
      await view.unmount();
    }
  });

  it('a JSON backup opens with the notice that it is a new résumé', async () => {
    const went = [];
    const { view, hook } = editor(went);
    try {
      view.act(() => hook().handleImportJSON({ name: 'Backup CV', personal: { name: 'Robin Vale' }, sections: [] }));
      assert.equal(hook().exportError, null);
      assert.equal(went[0]?.[0], '/resume/resume_new');
      assert.match(went[0]?.[1]?.state?.importNotice || '', NEW_ONE);
    } finally {
      await view.unmount();
    }
  });

  it('a cover letter\'s JSON opens on its tab with the notice that it is a new cover letter', async () => {
    const went = [];
    const { view, hook } = editor(went);
    try {
      view.act(() => hook().handleImportJSON({ name: 'Contoso letter', kind: 'letter', personal: { name: 'Robin Vale' }, sections: [] }));
      assert.equal(hook().exportError, null);
      assert.equal(went[0]?.[0], '/resume/resume_new?tab=coverletter');
      const notice = went[0]?.[1]?.state?.importNotice || '';
      assert.match(notice, /Imported as a new cover letter: the one you had open is unchanged/);
      assert.doesNotMatch(notice, /résumé/);
    } finally {
      await view.unmount();
    }
  });

  it('a document opens with the same notice, and still the best-effort one', async () => {
    const went = [];
    const { view, hook } = editor(went);
    try {
      await hook().handleImportFile(fileOf('robin.md', '# Robin Vale\n**Product Designer**\n\n## Experience\n### **Fabrikam Studio** — *Lead Designer*\n*2019 – 2023*'));
      assert.equal(went[0]?.[0], '/resume/resume_new');
      const notice = went[0]?.[1]?.state?.importNotice || '';
      assert.match(notice, NEW_ONE);
      assert.match(notice, /as best we could read it/);
    } finally {
      await view.unmount();
    }
  });

  it('the dashboard\'s document import (no notice given) keeps the best-effort notice alone', async () => {
    const went = [];
    const id = await importDocument.importDocument(fileOf('robin.txt', 'Robin Vale\nProduct Designer\nrobin@example.org'), {
      importResume: () => 'resume_dash', navigate: (...args) => went.push(args), onError: (m) => assert.fail(m),
    });
    assert.equal(id, 'resume_dash');
    assert.equal(went[0]?.[1]?.state?.importNotice, importDocument.IMPORT_NOTICE);
  });
});
