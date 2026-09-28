// R4-DVIS-35: the Design tab in an editor panel dragged narrow (240-280 px, usePanelResize's least is
// 240). (1) Typography's "Add a Google Font" row: the box (flex-1, no min-w-0) could not narrow below its
// default 20 characters (about 160 px), so with Add beside it the row needed about 212 px of the 174 px
// inside the section, and Add was pushed past the section's edge and cut off. The box now narrows
// (min-w-0). (2) The amber Reset Design Settings box: in its confirm step the two buttons (about 156 px,
// shrink-0) and the text beside it needed about 218 px of 182 px, so Yes, Reset and Cancel ran out of
// the box and Cancel was cut at the panel's edge. The row now wraps (flex-wrap), and its text takes the
// room left (flex-1, at least 96 px), so the buttons go under the text only when they cannot sit
// beside it: at the usual 360 px they stay where they were. The real panel is mounted
// (react-dom/client over tests/pdf/fake-dom.mjs); fake-dom has no layout, so the class tokens are checked.
// Run: node --test tests/pdf/103-r4-dvis-35-narrow-design-panel.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** The class tokens of `el`, as a set. */
const tokens = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

/** The Design panel for a Classic résumé; `button(text)` finds a button by its exact text. */
async function designPanel() {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  const view = mount(DesignPanel, {
    resume: resume({ template: 'classic', personal: { name: 'Morgan Ashby', email: 'morgan@example.com' } }),
    updateSetting: () => {},
    setTemplate: () => {},
    resetSettings: () => {},
  });
  const all = () => [...elements(view.container)];
  const button = (text) => {
    const el = all().find((b) => b.tagName === 'BUTTON' && b.textContent.trim() === text);
    assert.ok(el, `the "${text}" button is on the Design tab`);
    return el;
  };
  return { view, all, button, click: (text) => view.act(() => reactProps(button(text)).onClick()) };
}

it('R4-DVIS-35: the Add a Google Font box narrows, so Add stays inside Typography in a narrow panel', async () => {
  const p = await designPanel();
  try {
    p.click('Typography');
    const box = p.all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === 'custom-font-input');
    assert.ok(box, 'the Add a Google Font box is open');
    assert.ok(tokens(box).has('flex-1'), 'the box takes the row\'s room');
    assert.ok(tokens(box).has('min-w-0'), 'and can narrow below its default 20 characters, leaving Add room');
    const add = [...box.parentNode.childNodes].find((el) => el.tagName === 'BUTTON');
    assert.equal(add?.textContent.trim(), 'Add', 'Add sits beside the box');
  } finally {
    await p.view.unmount();
  }
});

it('R4-DVIS-35: Yes, Reset and Cancel go under the text when the Reset box is too narrow to hold them beside it', async () => {
  const p = await designPanel();
  try {
    p.click('Reset');
    const yes = p.button('Yes, Reset');
    const buttons = yes.parentNode;
    assert.equal(p.button('Cancel').parentNode, buttons, 'Yes, Reset and Cancel are one group');
    const row = buttons.parentNode;
    const got = tokens(row);
    assert.ok(got.has('justify-between'), 'the row holding the text and the buttons');
    assert.ok(got.has('flex-wrap'), 'the buttons wrap under the text rather than run out of the box');
    assert.equal(got.has('flex-nowrap'), false);

    const text = [...row.childNodes].find((el) => el !== buttons && el.nodeType === 1);
    assert.match(text.textContent, /^Reset Design Settings/, 'the text beside the buttons');
    const t = tokens(text);
    // A basis of 0 (flex-1): the text's one-line width does not claim a line of its own, so at the usual
    // panel width the buttons stay beside it; its least width decides when they go under it.
    assert.ok(t.has('flex-1'), 'the text takes the room the buttons leave, not its one-line width');
    assert.ok([...t].some((c) => c.startsWith('min-w-') && c !== 'min-w-0'), 'and keeps a readable least width before the buttons wrap');
  } finally {
    await p.view.unmount();
  }
});
