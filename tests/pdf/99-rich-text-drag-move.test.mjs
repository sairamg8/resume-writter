// R4-ED-04: dragging selected text to another spot in the same rich-text field copied it. onDrop
// always cancelled the browser's drop and inserted the dragged text at the drop point, so the source
// was never deleted and the text ended up in both places. And in Firefox, which has no
// caretRangeFromPoint, the drop point was ignored: the text went over the current selection. Now a
// drag that starts in the field (its dragstart marks the drag with the editor's own id) is moved by
// the editor: the source is deleted and the text, sanitized, goes in at the drop point. A drop from
// elsewhere (no mark — even when an earlier drag of this editor never saw its dragend) only inserts,
// at the drop point, found with caretPositionFromPoint where caretRangeFromPoint is missing.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

/** A drop's or a drag's data: `values` by type, and what a dragstart sets on it. */
const transfer = (values = {}) => ({
  values,
  getData: (type) => values[type] ?? '',
  setData(type, value) { values[type] = value; },
});
const text = (value) => transfer({ 'text/plain': value });

async function editor() {
  const { default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx');
  const stored = [];
  const view = mount(RichTextEditor, { label: 'Description', value: '', onChange: (v) => stored.push(v) });
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const line = box.appendChild(globalThis.document.createTextNode('Led the migration'));
  const commands = [];
  const doc = globalThis.document;
  doc.execCommand = (command, _ui, value) => {
    const range = doc.getSelection().getRangeAt(0);
    commands.push([command, value, range && [range.startOffset, range.endOffset]]);
    return true;
  };
  // Firefox's API only: the drop point x is the character offset in the line.
  doc.caretPositionFromPoint = (x) => ({ offsetNode: line, offset: x });
  const fire = (name, event = {}) => view.act(() => reactProps(box)[name]?.({ preventDefault() {}, ...event }));
  /** Select `from`–`to` of the line and start dragging it, as the browser does; the drag's data. */
  const dragStart = (from, to) => {
    const range = doc.createRange();
    range.setStart(line, from);
    range.setEnd(line, to);
    doc.getSelection().addRange(range);
    const data = transfer({ 'text/plain': line.nodeValue.slice(from, to) });
    fire('onDragStart', { dataTransfer: data });
    return data;
  };
  return { view, box, line, stored, commands, fire, dragStart };
}

describe('dragging text inside a rich-text field moves it (R4-ED-04)', () => {
  it('a drag that starts in the field deletes the source and inserts the text at the drop point', async () => {
    const { view, commands, fire, dragStart } = await editor();
    try {
      const data = dragStart(8, 17); // 'migration'
      let prevented = false;
      fire('onDrop', { dataTransfer: data, clientX: 4, clientY: 5, preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, 'the editor does the move, sanitized, not the browser');
      assert.deepEqual(commands, [['delete', undefined, [8, 17]], ['insertHTML', 'migration', [4, 4]]]);
    } finally { await view.unmount(); }
  });

  it('a drop from elsewhere only inserts, even after a drag of the field that never saw its dragend', async () => {
    const { view, commands, fire, dragStart } = await editor();
    try {
      dragStart(0, 3); // no dragend follows: the dragged node went away before it fired
      fire('onDrop', { dataTransfer: text('Kafka'), clientX: 4, clientY: 5 });
      assert.deepEqual(commands, [['insertHTML', 'Kafka', [4, 4]]], 'nothing of the field is deleted');
      commands.length = 0;
      fire('onDrop', { dataTransfer: text('Kafka'), clientX: 0, clientY: 5 });
      assert.deepEqual(commands, [['insertHTML', 'Kafka', [0, 0]]]);
    } finally { await view.unmount(); }
  });

  it('with no caretRangeFromPoint (Firefox), a drop goes at the drop point, not over the selection', async () => {
    const { view, line, commands, fire } = await editor();
    const doc = globalThis.document;
    try {
      assert.equal(doc.caretRangeFromPoint, undefined);
      doc.getSelection().collapse(line, 0);
      fire('onDrop', { dataTransfer: text('data '), clientX: 8, clientY: 8 });
      const at = doc.getSelection().getRangeAt(0);
      assert.equal(at.startContainer, line);
      assert.equal(at.startOffset, 8, 'the caret is where the text was dropped');
      assert.deepEqual(commands, [['insertHTML', 'data ', [8, 8]]]);
    } finally { await view.unmount(); }
  });
});
