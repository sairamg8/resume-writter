// The Export menu says what each item exports (R2-131). On the Cover Letter tab, PDF and Word export
// the letter, while Markdown, ATS Text and JSON Resume export the résumé — and the menu read the same
// on both tabs, so "Export ATS Text (.txt)" on the letter tab silently downloaded the résumé's text.
// The letter tab's menu now names the letter on PDF and Word and the résumé on the text exports; the
// résumé tab's menu is unchanged.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};
const HANDLERS = {
  onExportPDF: noop, onExportWord: noop, onExportJSON: noop, onExportMarkdown: noop,
  onExportAtsText: noop, onExportJsonResume: noop, onImportJSON: noop, onImportError: noop,
};

/** The open menu's item labels, the Export toggle itself left out. */
async function menuLabels(props) {
  const { ExportDropdown } = await loadModule('/src/components/ExportDropdown.jsx');
  const { mount, elements, reactProps } = await import('./fake-dom.mjs');
  const view = mount(ExportDropdown, { exporting: null, ...HANDLERS, ...props });
  try {
    const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
    view.act(() => reactProps(buttons()[0]).onClick());
    return buttons().slice(1).map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  } finally {
    await view.unmount();
  }
}

describe('the Export menu names what each item exports (R2-131)', () => {
  it('on the Cover Letter tab: PDF and Word name the letter; Markdown, ATS Text and JSON Resume the résumé', async () => {
    const labels = await menuLabels({ letter: true });
    assert.deepEqual(labels.slice(0, 5), [
      'Export Cover Letter PDF',
      'Export Cover Letter Word',
      'Export Résumé as Markdown (.md)',
      'Export Résumé as ATS Text (.txt)',
      'Export Résumé as JSON Resume (.json)',
    ]);
  });

  it('on the résumé tab the menu reads as before', async () => {
    const labels = await menuLabels({});
    assert.deepEqual(labels.slice(0, 5), ['Export PDF', 'Export Word', 'Export Markdown (.md)', 'Export ATS Text (.txt)', 'Export JSON Resume (.json)']);
  });

  it('useEditorExports tells the menu which tab it exports from', async () => {
    const { useEditorExports } = await loadModule('/src/hooks/useEditorExports.js');
    const { mount } = await import('./fake-dom.mjs');
    const seen = {};
    function Harness({ activeTab }) {
      seen[activeTab] = useEditorExports({ resume: { personal: {}, sections: [] }, activeTab, authUser: null, importResume: noop, navigate: noop }).letterTab;
      return null;
    }
    for (const tab of ['resume', 'coverletter']) {
      const view = mount(Harness, { activeTab: tab });
      await view.unmount();
    }
    assert.deepEqual(seen, { resume: false, coverletter: true });
  });

  it('the editor header passes that to the menu', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../../src/components/EditorHeader.jsx', import.meta.url), 'utf8');
    assert.match(src, /<ExportDropdown[\s\S]*?letter=\{exportMenu\.letterTab\}[\s\S]*?\/>/);
  });
});
