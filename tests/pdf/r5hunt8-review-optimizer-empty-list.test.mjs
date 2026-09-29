// Review of R5-HUNT8-OPTIMIZER-EMPTY-BULLET-APPLY-AT-END: an empty bullet was filled only in an
// editor that already held some text. A list started from the toolbar in an empty box is
// <ul><li><br></li></ul> (<ol> for a numbered one); the STAR Optimizer opened there found "no text"
// and Apply added a second, bulleted list under it, the empty bullet left printing a bare "•" (and a
// numbered list got a bulleted item). Now that empty bullet is filled too; a truly empty box still
// gets a new bullet. The editor is mounted over tests/pdf/fake-dom.mjs. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let RichTextEditor;
let dom;
before(async () => {
  await setup();
  ({ default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx'));
  dom = await import('./fake-dom.mjs');
  dom.withInnerHtml();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

function editor(value, typed) {
  const stored = [];
  const props = { label: 'Description', value, onChange: (v) => stored.push(v) };
  const view = dom.mount(RichTextEditor, props);
  const el = [...dom.elements(view.container)].find((e) => e.getAttribute('role') === 'textbox');
  if (typed !== undefined) el.innerHTML = typed;
  const body = () => [...dom.elements(view.document.body)];
  return {
    view,
    el,
    stored,
    caretIn(node, offset = 0) { view.document.getSelection().collapse(node, offset); },
    open() {
      const button = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      view.act(() => dom.reactProps(button).onMouseDown({ preventDefault() {} }));
      return dom.reactProps(body().find((e) => e.tagName === 'TEXTAREA')).value;
    },
    apply(result) {
      view.act(() => dom.reactProps(body().find((e) => e.tagName === 'TEXTAREA')).onChange({ target: { value: result } }));
      view.act(() => dom.reactProps(body().find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'))).onClick());
    },
  };
}

describe('STAR Optimizer · the only, empty bullet of an editor with no text yet (review of R5-HUNT8)', () => {
  it('a bulleted list just started is filled, not followed by a second list', async () => {
    const e = editor('', '<ul><li><br></li></ul>');
    try {
      e.caretIn(e.el.firstChild.firstChild, 0);
      assert.equal(e.open(), '');
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Cut costs by 30%</li></ul>');
      assert.equal(e.stored.at(-1), e.el.innerHTML, 'the change is saved');
    } finally { await e.view.unmount(); }
  });

  it('a numbered list just started stays numbered', async () => {
    const e = editor('', '<ol><li><br></li></ol>');
    try {
      e.caretIn(e.el.firstChild.firstChild, 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ol><li>Cut costs by 30%</li></ol>');
    } finally { await e.view.unmount(); }
  });

  it('an empty bullet as it is stored (<li>&nbsp;</li>) is filled too', async () => {
    const e = editor('<ul><li><br></li></ul>');
    try {
      e.caretIn(e.el.firstChild.firstChild.firstChild, 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Cut costs by 30%</li></ul>');
    } finally { await e.view.unmount(); }
  });

  it('an empty box still gets the result as a new bullet (the guard)', async () => {
    const e = editor('');
    try {
      e.caretIn(e.el, 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Cut costs by 30%</li></ul>');
    } finally { await e.view.unmount(); }
  });
});
