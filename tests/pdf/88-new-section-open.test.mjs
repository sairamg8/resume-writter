// After 'Collapse All', a newly added section opened collapsed, hiding its entry and its Add button
// (R2-113): Collapse/Expand All reached every section as it mounted, the new one too. It now reaches
// the sections that were there when it was pressed; one added since opens, as a new section always has.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

// Collapse/Expand All reaches a section from an effect: let React run it and commit what it set.
const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); };

const store = new Proxy({}, { get: () => () => {} });

describe('a section added after Collapse All opens (R2-113)', () => {
  it('the new section shows its Add button; the collapsed ones stay collapsed', async () => {
    const { EditorResumeTab } = await loadModule('/src/components/EditorResumeTab.jsx');
    const r = resume({ sections: [section('experience', [{ role: 'Quillwright' }])] });
    const props = {
      resume: r, store, personalOpen: false, setPersonalOpen() {}, allExpanded: true, forceOpenKey: 0,
      toggleAllSections() {}, addSectionOpen: false, setAddSectionOpen() {},
    };
    const view = mount(EditorResumeTab, props);
    try {
      assert.ok(view.container.textContent.includes('Add Experience'), 'open at first');
      view.update({ ...props, allExpanded: false, forceOpenKey: 1 }); // Collapse All
      await settle();
      assert.ok(!view.container.textContent.includes('Add Experience'), 'Collapse All collapses it');
      const added = { ...r, sections: [...r.sections, section('awards', [])] };
      view.update({ ...props, resume: added, allExpanded: false, forceOpenKey: 1 }); // Add Section → Awards
      await settle();
      assert.ok(view.container.textContent.includes('Add Award'), 'the new section is open');
      assert.ok(!view.container.textContent.includes('Add Experience'), 'the collapsed one stays collapsed');
      view.update({ ...props, resume: added, allExpanded: true, forceOpenKey: 2 }); // Expand All
      await settle();
      view.update({ ...props, resume: added, allExpanded: false, forceOpenKey: 3 }); // Collapse All again
      await settle();
      assert.ok(!view.container.textContent.includes('Add Award'), 'a later Collapse All reaches it');
    } finally { await view.unmount(); }
  });
});
