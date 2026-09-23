import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

describe('AUD-23: Export error handling and JSON Resume import safety', () => {
  it('useEditorExports: Markdown, ATS text and JSON Resume exports are wrapped in runExport and capture errors', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { mount } = await import('./fake-dom.mjs');

    let hook;
    function Harness({ resume }) {
      hook = useEditorExports({
        resume,
        activeTab: 'resume',
        authUser: null,
        importResume: () => {},
        navigate: () => {},
      });
      return null;
    }

    const sample = {
      personal: { name: 'Alex Developer', title: 'Engineer' },
      sections: [],
    };

    const view = mount(Harness, { resume: sample });
    try {
      assert.equal(hook.exportError, null);
      assert.equal(hook.exporting, null);

      const flush = async () => {
        for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
      };

      // Markdown export: in Node test environment without browser downloadBlob globals,
      // it should be caught by runExport and set exportError.
      await hook.handleExportMarkdown();
      await flush();
      assert.ok(hook.exportError, 'Markdown export should catch error in exportError');
      assert.match(hook.exportError, /Markdown export failed/);
      assert.equal(hook.exporting, null, 'exporting state should reset to null');

      // Clear error and test ATS text export
      view.act(() => hook.setExportError(null));
      await hook.handleExportAtsText();
      await flush();
      assert.ok(hook.exportError, 'ATS text export should catch error in exportError');
      assert.match(hook.exportError, /ATS text export failed/);
      assert.equal(hook.exporting, null, 'exporting state should reset to null');

      // Clear error and test JSON Resume export
      view.act(() => hook.setExportError(null));
      await hook.handleExportJsonResume();
      await flush();
      assert.ok(hook.exportError, 'JSON Resume export should catch error in exportError');
      assert.match(hook.exportError, /JSON Resume export failed/);
      assert.equal(hook.exporting, null, 'exporting state should reset to null');
    } finally {
      view.unmount();
    }
  });

  it('useEditorExports: handleImportJSON catches importResume exceptions and sets exportError', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { mount } = await import('./fake-dom.mjs');

    let hook;
    function Harness() {
      hook = useEditorExports({
        resume: { personal: { name: 'Alex' } },
        activeTab: 'resume',
        authUser: null,
        importResume: () => {
          throw new Error('Database disk full');
        },
        navigate: () => {},
      });
      return null;
    }

    const view = mount(Harness);
    try {
      assert.equal(hook.exportError, null);
      view.act(() => {
        hook.handleImportJSON({ personal: { name: 'Alex' }, sections: [] });
      });
      assert.ok(hook.exportError, 'handleImportJSON must set exportError when import throws');
      assert.match(hook.exportError, /Import failed \(Database disk full\)/);
    } finally {
      view.unmount();
    }
  });

  it('ExportDropdown: FileReader error during JSON Resume conversion invokes onImportError', async () => {
    const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
    const { mount, elements, reactProps } = await import('./fake-dom.mjs');

    let importError = null;
    const view = mount(ExportDropdown, {
      exporting: null,
      onExportPDF: () => {},
      onExportWord: () => {},
      onExportJSON: () => {},
      onExportMarkdown: () => {},
      onExportAtsText: () => {},
      onExportJsonResume: () => {},
      onImportJSON: () => {
        throw new Error('Storage write failed during import');
      },
      onImportError: (err) => { importError = err; },
    });

    try {
      const all = [...elements(view.container)];
      const fileInput = all.find((el) => el.tagName === 'INPUT' && el.type === 'file');
      assert.ok(fileInput, 'File input element should exist');

      const origFileReader = globalThis.FileReader;
      globalThis.FileReader = class MockFileReader {
        readAsText(file) {
          setTimeout(() => {
            this.onload?.({ target: { result: file.content } });
          }, 0);
        }
      };

      try {
        const fakeFile = { content: JSON.stringify({ basics: { name: 'Bob' } }) };
        reactProps(fileInput).onChange({ target: { files: [fakeFile], value: '' } });

        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(importError, 'onImportError should be called on conversion/import error');
        assert.match(importError, /Could not import file/);
      } finally {
        globalThis.FileReader = origFileReader;
      }
    } finally {
      view.unmount();
    }
  });
});
