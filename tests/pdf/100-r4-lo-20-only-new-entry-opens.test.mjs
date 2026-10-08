// R4-LO-20: R4-ED-07 opened the card of every entry nobody had filled in, so a blank entry left from
// an earlier visit opened on load and again each time its section was re-expanded. Now only the entry
// the user just added opens: the one Add makes, or a section's first one when Add Section made it.
// And an entry counted as untouched when its text fields were empty, whatever else it held: one
// marked current (which prints 'Present'), or holding a number, a list or true, was deleted without
// asking. Now any such value is content; only the id and how the entry shows (visible, hiddenFields)
// are not.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { resumeTab } from './resume-tab.mjs';

before(setup);
after(teardown);

const inputs = (el) => [...elements(el)].filter((e) => e.tagName === 'INPUT' && e.getAttribute('aria-label') !== 'Section title');
/** The entry cards within `root`, each with its title and how many text boxes it shows (0: collapsed). */
const cards = (root) => [...elements(root)]
  .filter((e) => e.tagName === 'DIV' && /\bborder rounded-lg overflow-hidden\b/.test(e.getAttribute('class') || ''))
  .map((card) => ({ title: card.childNodes[0].textContent, fields: inputs(card).length }));

describe('only the entry just added opens (R4-LO-20)', () => {
  it('a blank entry saved earlier stays collapsed on load, beside Add, and on re-expanding its section', async () => {
    const r = resume({ sections: [section('experience', [{ role: 'Lamplighter', company: 'Harbor Lights' }, {}])] });
    const tab = await resumeTab(r);
    try {
      const exp = () => tab.card('Professional Experience');
      assert.deepEqual(cards(exp()).map((c) => c.fields), [0, 0], 'on load: the filled and the blank entry are collapsed');

      tab.click(tab.button('Add Experience', exp()));
      const [, blank, added] = cards(exp());
      assert.equal(blank.fields, 0, 'the blank entry from before stays collapsed');
      assert.equal(added.title, 'New Entry');
      assert.ok(added.fields >= 3, `the entry just added shows its fields (${added.fields})`);

      const toggle = exp().childNodes[0].lastChild; // the section's collapse button
      tab.click(toggle);
      assert.deepEqual(cards(exp()), [], 'collapsed');
      tab.click(exp().childNodes[0].lastChild);
      assert.equal(cards(exp())[1].fields, 0, 'on re-expanding, the blank entry from before stays collapsed');
    } finally { await tab.close(); }
  });

  it('a section Add Section makes opens its first entry; a blank section saved earlier does not', async () => {
    const r = resume({ sections: [section('awards', [{}])] });
    r.sections[0].title = 'Earlier Awards';
    const tab = await resumeTab(r);
    try {
      assert.deepEqual(cards(tab.card('Earlier Awards')).map((c) => c.fields), [0], 'the saved blank award is collapsed');
      tab.click(tab.button('Add Section'));
      tab.click(tab.button('Awards & Honors'));
      const [first] = cards(tab.card('Awards & Honors'));
      assert.ok(first && first.fields > 0, 'the new section\'s first entry shows its fields');
      assert.deepEqual(cards(tab.card('Earlier Awards')).map((c) => c.fields), [0]);
    } finally { await tab.close(); }
  });
});

/** Click the delete button of `sec`'s only entry; what confirm() was asked. */
async function remove(sec) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const asked = [];
  const noop = () => {};
  const view = mount(SortableSection, {
    section: sec, template: 'classic', settings: {}, updateSectionSettings: noop, updateSection: noop,
    removeSection: noop, addItem: noop, updateItem: noop, reorderItems: noop, removeItem: noop,
  });
  const saved = globalThis.confirm;
  globalThis.confirm = (text) => { asked.push(text); return true; };
  try {
    const del = [...elements(view.container)].filter((el) => el.tagName === 'BUTTON'
      && (el.getAttribute('aria-label') === 'Delete entry' || /hover:text-red-500/.test(el.getAttribute('class') || '')));
    assert.equal(del.length, 1, 'one delete button');
    view.act(() => reactProps(del[0]).onClick({ stopPropagation() {} }));
    return asked;
  } finally {
    globalThis.confirm = saved;
    await view.unmount();
  }
}

const one = (type, item) => ({ id: `sec_${type}`, type, title: type, visible: true, settings: {}, items: [item] });

describe('an entry holding anything but text is not untouched (R4-LO-20)', () => {
  it('an entry marked current, or holding a number, a list or an object, asks before it goes', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    for (const [type, extra] of [
      ['experience', { current: true }],
      ['education', { gpa: 3.9 }],
      ['projects', { startDate: 2020 }],
      ['custom', { tags: ['Chess'] }],
      ['custom', { link: { href: 'https://example.com' } }],
    ]) {
      const asked = await remove(one(type, { ...NEW_ITEM[type](), ...extra }));
      assert.deepEqual(asked, ['Delete this entry?'], `${type}: ${JSON.stringify(extra)}`);
    }
  });

  it('a new entry of every type, or one only hidden or with blank lists, still goes without asking', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    for (const type of Object.keys(NEW_ITEM)) {
      assert.deepEqual(await remove(one(type, NEW_ITEM[type]())), [], `${type}: as Add makes it`);
    }
    for (const extra of [{ visible: false }, { hiddenFields: ['location'] }, { bullets: ['', ' '] }, { current: false }, { gpa: null }]) {
      assert.deepEqual(await remove(one('experience', { ...NEW_ITEM.experience(), ...extra })), [], JSON.stringify(extra));
    }
  });
});
