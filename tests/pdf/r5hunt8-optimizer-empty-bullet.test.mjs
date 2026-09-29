// R5-HUNT8-OPTIMIZER-EMPTY-BULLET-APPLY-AT-END: the STAR Optimizer opened from an empty bullet
// (Chrome's <li><br></li>, made by Enter at the end of a bullet) or an empty line found no statement,
// and Apply added its result at the end of the description as a new bullet: after the last one, in a
// bulleted list under a numbered one, and the empty bullet stayed and printed as a bare "•". Now the
// result fills the empty bullet or line the caret was in. An empty editor still gets a new bullet.
// The editor is mounted over tests/pdf/fake-dom.mjs. Fictional data only.
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

// `typed`: what the box holds after typing, before any save comes back (Chrome's Enter writes an
// empty bullet as <li><br></li>; the stored value, sanitized, holds it as <li>&nbsp;</li>).
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

describe('STAR Optimizer · opened from an empty bullet or line (R5-HUNT8)', () => {
  it('the result fills the empty bullet, not a new one after the last', async () => {
    const e = editor('<ul><li>Led the team</li><li>Ran QA</li></ul>', '<ul><li>Led the team</li><li><br></li><li>Ran QA</li></ul>');
    try {
      e.caretIn(e.el.firstChild.childNodes[1], 0);
      assert.equal(e.open(), '');
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Led the team</li><li>Cut costs by 30%</li><li>Ran QA</li></ul>');
      assert.equal(e.stored.at(-1), e.el.innerHTML, 'the change is saved');
    } finally { await e.view.unmount(); }
  });

  it('an empty bullet as it is stored (<li>&nbsp;</li>) is filled too', async () => {
    const e = editor('<ul><li>Led the team</li><li><br></li><li>Ran QA</li></ul>');
    try {
      assert.equal(e.el.innerHTML, '<ul><li>Led the team</li><li>&nbsp;</li><li>Ran QA</li></ul>');
      e.caretIn(e.el.firstChild.childNodes[1].firstChild, 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Led the team</li><li>Cut costs by 30%</li><li>Ran QA</li></ul>');
    } finally { await e.view.unmount(); }
  });

  it('in a numbered list it stays a numbered item', async () => {
    const e = editor('<ol><li>Led the team</li></ol>', '<ol><li>Led the team</li><li><br></li></ol>');
    try {
      e.caretIn(e.el.firstChild.childNodes[1], 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ol><li>Led the team</li><li>Cut costs by 30%</li></ol>');
    } finally { await e.view.unmount(); }
  });

  it('an empty paragraph between two is filled as a paragraph', async () => {
    const e = editor('<p>Led the team</p><p><br></p><p>Ran QA</p>');
    try {
      e.caretIn(e.el.childNodes[1], 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<p>Led the team</p><p>Cut costs by 30%</p><p>Ran QA</p>');
    } finally { await e.view.unmount(); }
  });

  it('a blank line between line breaks is filled there', async () => {
    const e = editor('Led the team', 'Led the team<br><br>Ran QA');
    try {
      e.caretIn(e.el, 2); // between the two <br>s
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, 'Led the team<br>Cut costs by 30%<br>Ran QA');
    } finally { await e.view.unmount(); }
  });

  it('an empty editor still gets the result as a new bullet (the guard)', async () => {
    const e = editor('');
    try {
      e.caretIn(e.el, 0);
      e.open();
      e.apply('Cut costs by 30%');
      assert.equal(e.el.innerHTML, '<ul><li>Cut costs by 30%</li></ul>');
    } finally { await e.view.unmount(); }
  });
});
