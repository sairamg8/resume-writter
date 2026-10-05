// Typing-freeze 7: the rich-text editor stopped saving from compositionstart until a compositionend,
// and a browser can drop that event (focus moves, some phone keyboards, a re-render): the typed text
// was never saved and a reload lost it. Now blur, unmount and an input the browser says is outside any
// composition end it and save what the box holds; the normal IME orders still save and never double.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps, withInnerHtml } from './fake-dom.mjs';

before(async () => { await setup(); withInnerHtml(); });
after(teardown);

async function editor(value) {
  const { default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx');
  const stored = [];
  const props = { ariaLabel: 'Professional summary', value, onChange: (v) => stored.push(v) };
  const view = mount(RichTextEditor, props);
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const fire = (name, event = {}) => view.act(() => reactProps(box)[name](event));
  view.document.activeElement = box;
  return { view, box, stored, fire, props };
}

describe('a lost compositionend cannot stop the editor saving (typing-freeze 7)', () => {
  it('compositionstart + input + blur, no compositionend: the typed text is saved', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.fire('onInput');
      assert.deepEqual(t.stored, [], 'nothing is saved mid-word');
      t.view.document.activeElement = t.view.document.body;
      t.fire('onBlur');
      assert.deepEqual(t.stored, ['<p>Old ka</p>']);
      t.box.innerHTML = '<p>Old kab</p>';
      t.fire('onInput');
      assert.equal(t.stored.at(-1), '<p>Old kab</p>', 'the next keystroke saves again: the flag is not stuck');
    } finally { await t.view.unmount(); }
  });

  it('compositionstart + unmount: the typed text is saved as the box goes away', async () => {
    const t = await editor('<p>Old</p>');
    t.fire('onCompositionStart');
    t.box.innerHTML = '<p>Old ka</p>';
    t.fire('onInput');
    await t.view.unmount();
    assert.deepEqual(t.stored, ['<p>Old ka</p>']);
  });

  it('an input outside any composition while the flag is set ends it and saves', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old k</p>';
      t.fire('onInput', { nativeEvent: { isComposing: false } });
      assert.deepEqual(t.stored, ['<p>Old k</p>']);
      t.box.innerHTML = '<p>Old ka</p>';
      t.fire('onInput');
      assert.equal(t.stored.at(-1), '<p>Old ka</p>');
    } finally { await t.view.unmount(); }
  });

  it('an outside value that waited during a stuck composition is shown at blur, the old text not written back', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.view.update({ ...t.props, value: '<p>NEW</p>' });
      t.view.document.activeElement = t.view.document.body;
      t.fire('onBlur');
      assert.equal(t.box.innerHTML, '<p>NEW</p>');
      assert.deepEqual(t.stored, []);
    } finally { await t.view.unmount(); }
  });

  it('a blur with no composition saves nothing', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onBlur');
      assert.deepEqual(t.stored, []);
    } finally { await t.view.unmount(); }
  });

  it('input then compositionend (Chrome, Firefox): saved once at the end, no characters lost or doubled', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.fire('onInput', { nativeEvent: { isComposing: true } });
      assert.deepEqual(t.stored, []);
      t.fire('onCompositionEnd');
      assert.deepEqual(t.stored, ['<p>Old ka</p>']);
    } finally { await t.view.unmount(); }
  });

  it('compositionend then input (Safari): saved with the whole word', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.fire('onCompositionEnd');
      t.fire('onInput', { nativeEvent: { isComposing: false } });
      assert.equal(t.stored.at(-1), '<p>Old ka</p>');
      assert.ok(t.stored.every((v) => v === '<p>Old ka</p>'), 'never a doubled or partial value');
    } finally { await t.view.unmount(); }
  });
});
