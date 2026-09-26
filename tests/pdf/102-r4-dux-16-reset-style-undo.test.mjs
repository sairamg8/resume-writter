// R4-DUX-16: a section's ⋯ menu → Reset style replaced its settings with the factory defaults at once —
// Grids, title style, order, group roles, spacing — with no question and no notice, while Delete section
// just below asks. Now the reset shows a 'Section style reset' notice whose Undo puts the section's own
// settings back.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, useState } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => {
  await setup();
  patchFakeDom();
});
after(teardown);

const OWN = { columns: 3, titleStyle: 'stacked', itemGap: 14, hideDates: true };
const skills = () => ({
  id: 'sec_skills', type: 'skills', title: 'Toolbox', visible: true, settings: { ...OWN },
  items: [{ id: 'sk_1', category: 'Tools', skills: 'Figma, Lathe' }],
});

describe('Reset style can be undone (R4-DUX-16)', () => {
  it('shows "Section style reset" with Undo, and Undo puts the section\'s settings back', async () => {
    const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
    const noop = () => {};
    let current = null;
    function Page() {
      const [sec, setSec] = useState(skills);
      current = sec;
      return h(ToastProvider, null, h(SortableSection, {
        section: sec, template: 'classic', settings: {}, updateSectionSettings: noop,
        updateSection: (id, fn) => setSec((s) => (s.id === id ? fn(s) : s)),
        removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
      }));
    }
    const view = mount(Page, {});
    const all = () => [...elements(view.document.body)];
    const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
    try {
      view.act(() => reactProps(all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Section options')).onClick());
      const reset = button('Reset style');
      assert.ok(reset, 'the options menu is open');
      view.act(() => reactProps(reset).onClick());
      assert.notDeepEqual(current.settings, OWN, 'the reset replaced the section\'s settings');

      const notice = all().find((el) => el.getAttribute('data-toast') !== null);
      assert.ok(notice, 'a notice is shown after Reset style');
      assert.match(notice.textContent, /Section style reset/);
      const undo = [...elements(notice)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
      assert.ok(undo, 'the notice has Undo');
      view.act(() => reactProps(undo).onClick());
      assert.deepEqual(current.settings, OWN, 'Undo put the section\'s own settings back');
      assert.equal(current.items[0].skills, 'Figma, Lathe', 'the entries are untouched');
    } finally { await view.unmount(); }
  });
});
