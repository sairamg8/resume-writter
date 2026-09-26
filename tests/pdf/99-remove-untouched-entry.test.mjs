// R4-ED-06: deleting an entry nobody has filled in goes without asking; one with content asks
// "Delete this entry?" first. Any non-empty text field counted as content, and a new language row
// starts with proficiency 'Professional', so deleting a fresh, untouched row always asked. Now a field
// that still holds the value a new entry starts with is not content.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const section = (type, items) => ({ id: `sec_${type}`, type, title: type, visible: true, settings: {}, items });

/** Click the delete button of `section`'s only entry; what confirm() was asked and whether it went. */
async function remove(sec) {
  const { SortableSection } = await loadModule('/src/components/SectionEditor.jsx');
  const asked = [];
  const removed = [];
  const noop = () => {};
  const view = mount(SortableSection, {
    section: sec, template: 'classic', settings: {}, updateSectionSettings: noop, updateSection: noop,
    removeSection: noop, addItem: noop, updateItem: noop, reorderItems: noop,
    removeItem: (sid, iid) => removed.push(iid),
  });
  const saved = globalThis.confirm;
  globalThis.confirm = (text) => { asked.push(text); return true; };
  try {
    const del = [...elements(view.container)].filter((el) => el.tagName === 'BUTTON'
      && (el.getAttribute('aria-label') === 'Delete entry' || /hover:text-red-500/.test(el.getAttribute('class') || '')));
    assert.equal(del.length, 1, 'one delete button');
    view.act(() => reactProps(del[0]).onClick({ stopPropagation() {} }));
    return { asked, removed };
  } finally {
    globalThis.confirm = saved;
    await view.unmount();
  }
}

describe('deleting an untouched entry does not ask (R4-ED-06)', () => {
  it('a new language row, as Add Language makes it, goes without asking', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const item = NEW_ITEM.languages();
    assert.equal(item.proficiency, 'Professional', 'a new row starts at Professional');
    const { asked, removed } = await remove(section('languages', [item]));
    assert.deepEqual(asked, []);
    assert.deepEqual(removed, [item.id]);
  });

  it('a language row with a language typed, or a level changed, still asks', async () => {
    for (const item of [
      { id: 'lang_1', language: 'Spanish', proficiency: 'Professional' },
      { id: 'lang_2', language: '', proficiency: 'Native' },
    ]) {
      const { asked, removed } = await remove(section('languages', [item]));
      assert.deepEqual(asked, ['Delete this entry?'], JSON.stringify(item));
      assert.deepEqual(removed, [item.id]);
    }
  });

  it('other entries are as before: a new one goes without asking, one with text asks', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    for (const type of ['experience', 'certifications', 'interests', 'my-custom']) {
      const fresh = (Object.hasOwn(NEW_ITEM, type) ? NEW_ITEM[type] : NEW_ITEM.custom)();
      assert.deepEqual((await remove(section(type, [fresh]))).asked, [], `${type}: fresh`);
      const key = Object.keys(fresh).find((k) => k !== 'id' && typeof fresh[k] === 'string');
      assert.deepEqual((await remove(section(type, [{ ...fresh, [key]: 'Something' }]))).asked, ['Delete this entry?'], `${type}: ${key} typed`);
    }
  });

  it('an entry whose only content is its bullets (older data, which prints them) still asks', async () => {
    const { NEW_ITEM } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
    const item = { ...NEW_ITEM.experience(), bullets: ['Kept the light burning'] };
    assert.deepEqual((await remove(section('experience', [item]))).asked, ['Delete this entry?']);
    const blank = { ...NEW_ITEM.experience(), bullets: ['', '  '] };
    assert.deepEqual((await remove(section('experience', [blank]))).asked, [], 'empty bullets are no content');
  });
});
