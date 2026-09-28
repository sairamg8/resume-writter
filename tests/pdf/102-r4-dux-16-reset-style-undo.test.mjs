// R4-DUX-16: a section's ⋯ menu → Reset style replaced its settings with the factory defaults at once —
// Grids, title style, order, group roles, spacing — with no question and no notice, while Delete section
// just below asks. Now the reset shows a 'Section style reset' notice whose Undo puts the section's own
// settings back — only while the section still holds what the reset wrote (ids repeat across résumés).
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

/** SortableSection in the kit's ToastProvider, its section held in state; Reset style clicked. */
async function resetStyle() {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
  const noop = () => {};
  const state = { current: null, set: null };
  function Page() {
    const [sec, setSec] = useState(skills);
    state.current = sec;
    state.set = setSec;
    return h(ToastProvider, null, h(SortableSection, {
      section: sec, template: 'classic', settings: {}, updateSectionSettings: noop,
      updateSection: (id, fn) => setSec((s) => (s.id === id ? fn(s) : s)),
      removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
    }));
  }
  const view = mount(Page, {});
  const all = () => [...elements(view.document.body)];
  view.act(() => reactProps(all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Section options')).onClick());
  const reset = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Reset style');
  assert.ok(reset, 'the options menu is open');
  view.act(() => reactProps(reset).onClick());
  assert.notDeepEqual(state.current.settings, OWN, 'the reset replaced the section\'s settings');
  const notice = all().find((el) => el.getAttribute('data-toast') !== null);
  assert.ok(notice, 'a notice is shown after Reset style');
  assert.match(notice.textContent, /Section style reset/);
  const undoButton = [...elements(notice)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
  assert.ok(undoButton, 'the notice has Undo');
  return { view, state, undo: () => view.act(() => reactProps(undoButton).onClick()) };
}

describe('Reset style can be undone (R4-DUX-16)', () => {
  it('shows "Section style reset" with Undo, and Undo puts the section\'s settings back', async () => {
    const { view, state, undo } = await resetStyle();
    try {
      undo();
      assert.deepEqual(state.current.settings, OWN, 'Undo put the section\'s own settings back');
      assert.equal(state.current.items[0].skills, 'Figma, Lathe', 'the entries are untouched');
    } finally { await view.unmount(); }
  });

  it('Undo writes nothing once the section holds other settings: a later edit, or another résumé\'s section with the same id', async () => {
    for (const replace of [
      (s) => ({ ...s, settings: { ...s.settings, itemGap: 20 } }),
      () => ({ id: 'sec_skills', type: 'skills', title: 'Other résumé', visible: true, settings: { columns: 1 }, items: [] }),
    ]) {
      const { view, state, undo } = await resetStyle();
      try {
        view.act(() => state.set(replace));
        const held = state.current;
        undo();
        assert.equal(state.current, held, 'the section is left as it is');
        assert.notDeepEqual(state.current.settings, OWN);
      } finally { await view.unmount(); }
    }
  });
});
