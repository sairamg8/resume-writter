// There was no way to duplicate an entry or a section (R2-151). An entry's card now has a
// Duplicate button and a section's ⋯ menu a "Duplicate section": the copy lands right after the
// original, with the same content and fresh unique ids (the section's and every entry's), so
// editing or deleting the copy never touches the original.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The section actions over one résumé held in `box.r`. */
async function actionsOn(r) {
  const { createSectionActions } = await loadModule('/src/hooks/useResumeSectionActions.js');
  const box = { r };
  return { box, ...createSectionActions((fn) => { box.r = fn(box.r); }) };
}

function sample() {
  return resume({ sections: [
    section('experience', [
      { role: 'Keeper', company: 'Lighthouse', hiddenFields: ['location'], description: '<ul><li>Lit it</li></ul>' },
      { role: 'Pilot', company: 'Harbor' },
    ]),
    section('skills', [{ category: 'Knots', skills: 'Bowline' }]),
  ] });
}

describe('duplicate an entry or a section (R2-151)', () => {
  it('an entry: a copy right after it, fresh id, same content, deep', async () => {
    const r = sample();
    const { box, duplicateItem, updateItem } = await actionsOn(r);
    const [exp] = r.sections;
    duplicateItem(exp.id, exp.items[0].id);
    const items = box.r.sections[0].items;
    assert.deepEqual(items.map((i) => i.role), ['Keeper', 'Keeper', 'Pilot']);
    assert.notEqual(items[1].id, items[0].id);
    const { id: _a, ...copy } = items[1];
    const { id: _b, ...orig } = items[0];
    assert.deepEqual(copy, orig);
    assert.notEqual(items[1].hiddenFields, items[0].hiddenFields, 'a list of its own');
    updateItem(exp.id, items[1].id, (i) => ({ ...i, role: 'Copy' }));
    assert.deepEqual(box.r.sections[0].items.map((i) => i.role), ['Keeper', 'Copy', 'Pilot']);
  });

  it('a section: a copy right after it, fresh section and entry ids, same content', async () => {
    const r = sample();
    const { box, duplicateSection } = await actionsOn(r);
    duplicateSection(r.sections[0].id);
    const [orig, copy, skills] = box.r.sections;
    assert.equal(skills.type, 'skills');
    assert.equal(copy.type, 'experience');
    assert.notEqual(copy.id, orig.id);
    const ids = box.r.sections.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]);
    assert.equal(new Set(ids).size, ids.length, 'every id unique');
    assert.deepEqual(copy.items.map((i) => i.role), ['Keeper', 'Pilot']);
    assert.deepEqual(copy.settings, orig.settings);
    assert.notEqual(copy.settings, orig.settings, 'settings of its own');
  });

  it('the editor offers both', async () => {
    const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
    const r = sample();
    const calls = [];
    const noop = () => {};
    const view = mount(SortableSection, {
      section: r.sections[0], template: r.template, settings: r.settings, updateSection: noop, updateSectionSettings: noop,
      removeSection: noop, addItem: noop, updateItem: noop, removeItem: noop, reorderItems: noop,
      duplicateSection: (...a) => calls.push(['section', ...a]), duplicateItem: (...a) => calls.push(['item', ...a]),
    });
    try {
      const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
      const titled = (t) => buttons().find((b) => reactProps(b).title === t || reactProps(b)['aria-label'] === t);
      const entryDup = buttons().filter((b) => reactProps(b)['aria-label'] === 'Duplicate entry');
      assert.equal(entryDup.length, 2, 'one per entry');
      view.act(() => reactProps(entryDup[1]).onClick({ stopPropagation() {} }));
      view.act(() => reactProps(titled('Section options')).onClick());
      const menuItem = buttons().find((b) => b.textContent.includes('Duplicate section'));
      assert.ok(menuItem, 'in the section menu');
      view.act(() => reactProps(menuItem).onClick());
      assert.deepEqual(calls, [['item', r.sections[0].id, r.sections[0].items[1].id], ['section', r.sections[0].id]]);
    } finally { await view.unmount(); }
  });
});
