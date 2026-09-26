// R4-ED-04: dragging selected text to another spot in the same rich-text field copied it. onDrop
// always cancelled the browser's drop and inserted the dragged text at the drop point itself, so the
// browser's move never ran and the text stayed where it was too. And in Firefox, which has no
// caretRangeFromPoint, the drop point was ignored: the text went over the current selection. Now a
// drag that starts in the field is left to the browser, which moves it (the input events that follow
// store the result); a drop from elsewhere is inserted at the drop point, found with
// caretPositionFromPoint where caretRangeFromPoint is missing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const text = (value) => ({ getData: (type) => (type === 'text/plain' ? value : '') });

async function editor() {
  const { default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx');
  const stored = [];
  const view = mount(RichTextEditor, { label: 'Description', value: '', onChange: (v) => stored.push(v) });
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const line = box.appendChild(globalThis.document.createTextNode('Led the migration'));
  const commands = [];
  globalThis.document.execCommand = (command, _ui, value) => { commands.push([command, value]); return true; };
  const fire = (name, event = {}) => view.act(() => reactProps(box)[name]?.({ preventDefault() {}, ...event }));
  return { view, box, line, stored, commands, fire };
}

describe('dragging text inside a rich-text field moves it (R4-ED-04)', () => {
  it('a drag that starts in the field is left to the browser: not cancelled, nothing inserted by the editor', async () => {
    const { view, commands, fire } = await editor();
    try {
      fire('onDragStart');
      let prevented = false;
      fire('onDrop', { dataTransfer: text('migration'), clientX: 5, clientY: 5, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, false, 'the browser\'s move runs');
      assert.deepEqual(commands, [], 'the editor inserts no copy of its own');
      fire('onDragEnd');
    } finally { await view.unmount(); }
  });

  it('after that drag ends, a drop from elsewhere is inserted by the editor again', async () => {
    const { view, commands, fire } = await editor();
    try {
      fire('onDragStart');
      fire('onDragEnd');
      let prevented = false;
      fire('onDrop', { dataTransfer: text('Kafka'), clientX: 5, clientY: 5, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      assert.deepEqual(commands, [['insertHTML', 'Kafka']]);
    } finally { await view.unmount(); }
  });

  it('with no caretRangeFromPoint (Firefox), a drop goes at the drop point, not over the selection', async () => {
    const { view, line, commands, fire } = await editor();
    const doc = globalThis.document;
    try {
      assert.equal(doc.caretRangeFromPoint, undefined);
      doc.getSelection().collapse(line, 0);
      doc.caretPositionFromPoint = (x, y) => (x === 40 && y === 8 ? { offsetNode: line, offset: 8 } : null);
      fire('onDrop', { dataTransfer: text('data '), clientX: 40, clientY: 8 });
      const at = doc.getSelection().getRangeAt(0);
      assert.equal(at.startContainer, line);
      assert.equal(at.startOffset, 8, 'the caret is where the text was dropped');
      assert.deepEqual(commands, [['insertHTML', 'data ']]);
    } finally { await view.unmount(); }
  });
});
