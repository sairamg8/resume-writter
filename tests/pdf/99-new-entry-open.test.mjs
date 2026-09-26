// R4-ED-07: "Add Experience" (and every Add button) added a collapsed card labelled 'New Entry' at the
// bottom of the section, which had to be found and clicked before any field showed — for every new
// entry, and for the first entry of a newly added section. Now a card whose entry nobody has filled in
// yet opens, so its fields are ready to type in; an entry with content stays collapsed, as before.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const noop = () => {};
const inputs = (el) => [...elements(el)].filter((e) => e.tagName === 'INPUT' && e.getAttribute('aria-label') !== 'Section title');
/** The entry cards of the section, each with its title and the text boxes it shows. */
const cards = (view) => [...elements(view.container)]
  .filter((e) => e.tagName === 'DIV' && /\bborder rounded-lg overflow-hidden\b/.test(e.getAttribute('class') || ''))
  .map((card) => ({ title: card.childNodes[0].textContent, fields: inputs(card).length }));

async function editor(sec, addItem = noop, justAdded = false) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const props = (s) => ({
    section: s, template: 'classic', settings: {}, updateSectionSettings: noop, updateSection: noop, justAdded,
    removeSection: noop, addItem, updateItem: noop, removeItem: noop, reorderItems: noop,
  });
  const view = mount(SortableSection, props(sec));
  return { view, show: (s) => view.update(props(s)) };
}

describe('a new entry opens with its fields showing (R4-ED-07)', () => {
  it('Add Experience adds an open card; the filled entry above it stays collapsed', async () => {
    const sec = { id: 'sec_exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'exp_1', role: 'Lamplighter', company: 'Harbor Lights', description: '' },
    ] };
    const added = [];
    const { view, show } = await editor(sec, (sid, item) => added.push(item));
    try {
      assert.deepEqual(cards(view), [{ title: 'Lamplighter', fields: 0 }], 'a filled entry opens collapsed');
      const add = [...elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Add Experience'));
      view.act(() => reactProps(add).onClick());
      assert.equal(added.length, 1);
      show({ ...sec, items: [...sec.items, added[0]] });
      const [filled, fresh] = cards(view);
      assert.deepEqual(filled, { title: 'Lamplighter', fields: 0 });
      assert.equal(fresh.title, 'New Entry');
      assert.ok(fresh.fields >= 3, `the new card shows its fields (${fresh.fields})`);
    } finally { await view.unmount(); }
  });

  it('a newly added section\'s first entry is open, for every card-based type', async () => {
    const { SECTION_TYPE_DEFAULTS } = await loadModule('/src/utils/defaultData.js');
    for (const type of ['experience', 'education', 'skills', 'projects', 'certifications', 'awards', 'volunteering', 'references', 'custom']) {
      // Add Section marks the section it made as just added (R4-LO-20: a blank one saved earlier stays shut).
      const { view } = await editor(SECTION_TYPE_DEFAULTS[type](`sec_${type}`), noop, true);
      try {
        const [card] = cards(view);
        assert.ok(card && card.fields > 0, `${type}: the first entry shows its fields`);
      } finally { await view.unmount(); }
    }
  });
});
