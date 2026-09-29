// R5-HUNT3-richtext-stale-while-focused-overwrites: a summary, description or cover-letter body
// changed from outside while its box had the caret (another tab's save, a résumé switch with the
// mouse Back button) was never shown: the editor skipped every new value while focused and nothing
// took it in later, so the box kept the old text and the next keystroke wrote it back over the newer
// value. Now an outside value is shown at once when nothing was typed since the box last matched the
// store, else when the box loses focus; the editor's own echo is still left alone, keeping the caret.
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
  const setValue = (v) => view.update({ ...props, value: v });
  /** The user types: the box's content changes and the browser fires input; the store echoes it. */
  const type = (html) => {
    box.innerHTML = html;
    fire('onInput');
    setValue(stored.at(-1));
  };
  view.document.activeElement = box; // the caret is in the box
  return { view, box, stored, fire, setValue, type };
}

describe('a rich-text box with the caret takes in a value changed from outside (R5-HUNT3)', () => {
  it('another tab\'s newer summary is shown, and the next keystroke builds on it', async () => {
    const t = await editor('<p>Old summary</p>');
    try {
      t.type('<p>Old summary.</p>');
      t.setValue('<p>NEW TEXT</p>'); // tab 2's save reaches the store
      assert.equal(t.box.innerHTML, '<p>NEW TEXT</p>', 'the box shows the store\'s summary');
      t.type('<p>NEW TEXT!</p>');
      assert.deepEqual(t.stored, ['<p>Old summary.</p>', '<p>NEW TEXT!</p>'], 'the old text is never written back');
    } finally { await t.view.unmount(); }
  });

  it('a switch to another résumé with the box focused replaces its content', async () => {
    const t = await editor('<p>Summary of B</p>');
    try {
      t.setValue('<p>Summary of A</p>');
      assert.equal(t.box.innerHTML, '<p>Summary of A</p>');
      t.type('<p>Summary of A.</p>');
      assert.deepEqual(t.stored, ['<p>Summary of A.</p>']);
    } finally { await t.view.unmount(); }
  });

  it('a value that comes while a word is being composed is shown when the box loses focus', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.setValue('<p>NEW TEXT</p>');
      assert.equal(t.box.innerHTML, '<p>Old ka</p>', 'the word being composed is left alone');
      t.view.document.activeElement = t.view.document.body;
      t.fire('onBlur');
      assert.equal(t.box.innerHTML, '<p>NEW TEXT</p>', 'shown once the box loses focus');
    } finally { await t.view.unmount(); }
  });

  it('its own echo is left alone while focused: the DOM is not rewritten, so the caret stays', async () => {
    const t = await editor('<p>Led</p>');
    try {
      t.box.innerHTML = '<p style="color:red">Led the team</p>';
      t.fire('onInput');
      const before = t.box.firstChild;
      t.setValue(t.stored.at(-1));
      assert.equal(t.box.firstChild, before, 'the box\'s nodes are the ones the user is typing in');
      assert.equal(t.box.innerHTML, '<p style="color:red">Led the team</p>');
    } finally { await t.view.unmount(); }
  });

  // Review: a word composed with an IME ends (compositionend) before the box loses focus, and on
  // most Android keyboards every word is composed, so the blur path above is rarely what runs.
  it('a value that comes while a word is being composed is shown when the composition ends, and the old text is not written back', async () => {
    const t = await editor('<p>Old</p>');
    try {
      t.fire('onCompositionStart');
      t.box.innerHTML = '<p>Old ka</p>';
      t.setValue('<p>NEW TEXT</p>'); // another tab's save reaches the store mid-word
      t.fire('onCompositionEnd');
      assert.equal(t.box.innerHTML, '<p>NEW TEXT</p>', 'the store\'s newer text is shown');
      assert.deepEqual(t.stored, [], 'the text typed over the old value is not written over the newer one');
      t.fire('onInput'); // Firefox fires input after compositionend
      t.type('<p>NEW TEXT!</p>');
      assert.deepEqual(t.stored.filter((v) => !v.includes('Old')), t.stored, 'the old text is never written back');
      assert.equal(t.stored.at(-1), '<p>NEW TEXT!</p>');
    } finally { await t.view.unmount(); }
  });

  // Review: an outside value equal to one this editor wrote earlier (another tab's undo back to it,
  // a stale copy saved elsewhere) was taken for its own echo and never shown.
  it('an outside value equal to text this editor wrote earlier is shown, not taken for its echo', async () => {
    const t = await editor('<p>A</p>');
    try {
      t.type('<p>AB</p>');
      t.type('<p>ABC</p>');
      t.setValue('<p>AB</p>'); // another tab puts back the earlier text
      assert.equal(t.box.innerHTML, '<p>AB</p>', 'the box shows what the store holds');
      t.type('<p>ABD</p>');
      assert.deepEqual(t.stored, ['<p>AB</p>', '<p>ABC</p>', '<p>ABD</p>'], 'the next keystroke builds on the store\'s text');
    } finally { await t.view.unmount(); }
  });
});
