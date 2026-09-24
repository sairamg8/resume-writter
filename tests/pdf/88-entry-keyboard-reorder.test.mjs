// Entries could not be reordered from the keyboard (R2-115): each entry's drag handle carried
// tabIndex -1 after dnd-kit's attributes, so Tab never reached it and the KeyboardSensor the
// section registers (Space to lift, arrows to move) never ran. The grip is now in the tab order,
// named, and shows while it has focus (it is hidden until hover otherwise).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

describe('entry grips take keyboard focus (R2-115)', () => {
  it('each entry grip is tabbable, named, keyed and visible on focus', async () => {
    const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
    const r = resume({ sections: [section('experience', [{ role: 'First' }, { role: 'Second' }])] });
    const noop = () => {};
    const view = mount(SortableSection, {
      section: r.sections[0], template: r.template, settings: r.settings, updateSection: noop, updateSectionSettings: noop,
      removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
    });
    try {
      const grips = [...elements(view.container)].filter((el) => el.getAttribute?.('aria-roledescription') === 'sortable');
      // The section's own grip, then one per entry.
      assert.equal(grips.length, 3);
      for (const grip of grips.slice(1)) {
        const props = reactProps(grip);
        assert.equal(props.tabIndex, 0, 'in the tab order');
        assert.equal(typeof props.onKeyDown, 'function', 'the KeyboardSensor listens');
        assert.match(props['aria-label'] || '', /reorder|move/i, 'named for a screen reader');
        assert.match(props.className, /focus(-visible)?:opacity-100/, 'visible while focused');
      }
    } finally { await view.unmount(); }
  });
});
