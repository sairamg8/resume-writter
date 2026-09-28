// R4-DPH-23: a Languages row is its two fields in a grid, then the eye, Duplicate and Delete. The grid's
// tracks were `2fr 3fr` (each at least as wide as its field) and the grid itself had no min-w-0, so it
// held the text box's own width (about 160 px) and the level list's widest option (about 124 px). On a
// 375 px phone the row has about 300 px and in the default 360 px editor panel about 285, so the three
// buttons were pushed past the section card's edge, whose overflow-hidden cut Duplicate and Delete off:
// a language could not be deleted. The fields give up width now (min-w-0 on the grid, its tracks and its
// fields) and the buttons keep theirs; an Interests row's box may shrink the same way. The fake DOM has
// no layout, so this reads the classes the browser lays out by, on the real LanguageItem and InterestItem
// (tests/pdf/fake-dom.mjs, loaded through Vite).
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

before(setup);
after(teardown);

const classes = (el) => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
const noop = () => {};

/** The row's own buttons (eye, Duplicate, Delete): each keeps its size. */
function assertButtonsKeepTheirSize(row, what) {
  const buttons = row.childNodes.filter((el) => el.tagName === 'BUTTON');
  assert.equal(buttons.length, 3, `${what}: the eye, Duplicate and Delete`);
  for (const b of buttons) assert.ok(classes(b).includes('shrink-0'), `${what}: a button keeps its size: ${classes(b).join(' ')}`);
}

it('R4-DPH-23: a language row\'s fields shrink, so its eye, Duplicate and Delete stay inside the card', async () => {
  const { LanguageItem } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
  const view = mount(LanguageItem, {
    item: { id: 'l1', language: 'English', proficiency: 'Native' }, onUpdate: noop, onRemove: noop, onDuplicate: noop,
  });
  try {
    const all = [...elements(view.container)];
    const input = all.find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Language');
    const select = all.find((el) => el.tagName === 'SELECT' && el.getAttribute('aria-label') === 'Proficiency');
    assert.ok(input, 'the Language box is on the row');
    assert.ok(select, 'the Proficiency list is on the row');

    const grid = input.parentNode;
    assert.ok(select.parentNode === grid, 'both fields sit in one grid');
    const own = classes(grid);
    assert.ok(own.includes('grid') && own.includes('flex-1'), `the grid fills the row: ${own.join(' ')}`);
    assert.ok(own.includes('min-w-0'), `the grid may shrink below its fields' widths: ${own.join(' ')}`);
    assert.ok(own.includes('grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'), `its tracks may shrink too: ${own.join(' ')}`);
    assert.ok(!own.includes('grid-cols-[2fr_3fr]'), `not tracks at least as wide as their fields: ${own.join(' ')}`);
    for (const field of [input, select]) {
      const cls = classes(field);
      assert.ok(cls.includes('w-full') && cls.includes('min-w-0'), `${field.getAttribute('aria-label')} fits its track: ${cls.join(' ')}`);
    }
    assertButtonsKeepTheirSize(grid.parentNode, 'Languages');
  } finally {
    await view.unmount();
  }
});

it('R4-DPH-23: an Interests row\'s box may shrink the same way', async () => {
  const { InterestItem } = await loadModule('/src/components/SectionEditorLeafItems.jsx');
  const view = mount(InterestItem, {
    item: { id: 'i1', interests: 'Photography, Hiking, Open Source' }, onUpdate: noop, onRemove: noop, onDuplicate: noop,
  });
  try {
    const input = [...elements(view.container)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Interests');
    assert.ok(input, 'the Interests box is on the row');
    const cls = classes(input);
    assert.ok(cls.includes('flex-1') && cls.includes('min-w-0'), `the box fills the row and may shrink: ${cls.join(' ')}`);
    assertButtonsKeepTheirSize(input.parentNode, 'Interests');
  } finally {
    await view.unmount();
  }
});
