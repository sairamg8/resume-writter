// R4-DUX-28: a failed export's advice fits what the export does.
//
// Every failed export said "<label> failed (…). Check your connection and try again." — the
// Markdown, ATS text, JSON Resume, JSON and cover-letter text files too, which are made in the
// browser with no network, so the advice sent the user after the wrong cause. Now only PDF and
// Word (which load their renderer's code, and the PDF its fonts, over the network) point at the
// connection; the local ones say "Try again, or reload the page if it keeps failing."
//
// The hook is mounted as Editor.jsx mounts it (react-dom/client through tests/pdf/fake-dom.mjs),
// as tests/pdf/60-export-filename.test.mjs does; every export runs for real and fails at the last
// step, when the browser is asked to save the file (the download link's click() throws).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); });
};

const NETWORK = [['handleExportPDF', 'PDF export'], ['handleExportWord', 'Word export']];
const LOCAL = [
  ['handleExportMarkdown', 'Markdown export'],
  ['handleExportAtsText', 'ATS text export'],
  ['handleExportJsonResume', 'JSON Resume export'],
  ['handleExportJSON', 'JSON export'],
  ['handleExportLetterText', 'Cover letter text export'],
];

describe('R4-DUX-28: export failure advice', () => {
  it('only PDF and Word blame the connection; local exports say to try again or reload', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const state = { hook: null };
    function Editor({ resume: data }) {
      state.hook = useEditorExports({ resume: data, activeTab: 'resume', authUser: null, importResume: () => {}, navigate: () => {} });
      return null;
    }
    const view = mount(Editor, { resume: resume() });
    const make = view.document.createElement.bind(view.document);
    view.document.createElement = (tag) => {
      const el = make(tag);
      if (String(tag).toLowerCase() === 'a') el.click = () => { throw new Error('Download blocked'); };
      return el;
    };
    try {
      const run = async (name) => {
        view.act(() => state.hook.setExportError(null));
        await state.hook[name]();
        await flush();
        return state.hook.exportError;
      };
      for (const [name, label] of NETWORK) {
        assert.equal(await run(name), `${label} failed (Download blocked). Check your connection and try again.`, name);
      }
      for (const [name, label] of LOCAL) {
        const message = await run(name);
        assert.equal(message, `${label} failed (Download blocked). Try again, or reload the page if it keeps failing.`, name);
        assert.doesNotMatch(message, /connection/i, name);
      }
    } finally {
      await view.unmount();
    }
  });
});
