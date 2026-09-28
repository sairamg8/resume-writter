// R4-DPH-24: a section's ⋯ menu was drawn inside its card (absolute, under the button), and the card
// is overflow-hidden, so the card cut it off at every width: on a collapsed section (Collapse All, or
// its own chevron) only the menu's top few pixels showed, and on a short one Delete section could not
// be reached. The menu is the kit's Menu now: it opens in a portal at the end of <body>, placed beside
// the button and kept inside the window, with every item it had — Customize layout, Reset style,
// Duplicate section, Delete section — and a pick closes it. The fake DOM has no layout, so this reads
// where the menu is drawn and what could clip it, on the real SortableSection (tests/pdf/fake-dom.mjs,
// loaded through Vite; tests/unit/ui-dom-harness.mjs for the kit's focus and animation frames).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

before(async () => {
  await setup();
  patchFakeDom();
});
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const section = () => ({
  id: 'sec_exp', type: 'experience', title: 'Experience', visible: true, settings: {},
  items: [{ id: 'exp_1', company: 'Acme', role: 'Developer', startDate: 'Jan 2020', endDate: '', current: true, description: '' }],
});

it('R4-DPH-24: a collapsed section\'s ⋯ menu opens outside its card, where nothing clips it, with every item; a pick closes it', async () => {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const noop = () => {};
  const calls = [];
  const view = mount(SortableSection, {
    section: section(), template: 'classic', settings: {},
    updateSection: noop, updateSectionSettings: noop, removeSection: noop,
    addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
    duplicateSection: (id) => calls.push(id),
  });
  try {
    const all = () => [...elements(view.document.body)];
    const buttonWith = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
    const title = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Section title');
    assert.ok(title, 'the section has its title box');
    const header = title.parentNode;
    const card = header.parentNode;
    assert.ok(classes(card).includes('overflow-hidden'), `the section card clips what it holds: ${classes(card).join(' ')}`);

    // Collapsed, as after Collapse All: the card is its header alone.
    const chevron = header.childNodes.filter((el) => el.tagName === 'BUTTON').at(-1);
    view.act(() => reactProps(chevron).onClick());
    assert.ok(!buttonWith('Add Experience'), 'the section is collapsed');

    const trigger = [...elements(header)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('title') === 'Section options');
    assert.ok(trigger, 'the ⋯ button is in the section header');
    view.act(() => reactProps(trigger).onClick(ev()));

    const del = buttonWith('Delete section');
    assert.ok(del, 'the menu is open, with Delete section');
    assert.ok(!card.contains(del), 'the menu is not drawn inside the section card');
    for (let n = del.parentNode; n && n !== view.document.body; n = n.parentNode) {
      assert.ok(!classes(n).includes('overflow-hidden'), `nothing around the menu clips it: ${classes(n).join(' ')}`);
    }
    for (const item of ['Customize layout', 'Reset style', 'Duplicate section']) {
      const found = buttonWith(item);
      assert.ok(found && !card.contains(found), `${item} is in the menu, outside the card`);
    }

    view.act(() => reactProps(buttonWith('Duplicate section')).onClick());
    assert.deepEqual(calls, ['sec_exp'], 'Duplicate section duplicates this section');
    assert.ok(!buttonWith('Delete section'), 'the pick closed the menu');
  } finally {
    await view.unmount();
  }
});
