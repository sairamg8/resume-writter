// R5-HUNT7 review of R5-HUNT7-OPTIMIZER-APPLY-AFTER-OUTSIDE-CHANGE: after a description changed in
// another tab (or by a cloud pull) while the STAR Optimizer was open, Apply found its statement again
// by its text, and took the first place that text was: a word selected in one bullet that an earlier
// bullet also has, or the second of two equal bullets, and Apply rewrote the other bullet. Now, of
// several places with that text, the one with the same text around it, nearest its old place, is taken.
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

function editor(value) {
  const stored = [];
  const props = { label: 'Description', value, onChange: (v) => stored.push(v) };
  const view = dom.mount(RichTextEditor, props);
  const el = [...dom.elements(view.container)].find((e) => e.getAttribute('role') === 'textbox');
  const walk = function* (n) { yield n; for (const c of n.childNodes) yield* walk(c); };
  // The `nth` text node (from 0) that holds `t`.
  const text = (t, nth = 0) => [...walk(el)].filter((n) => n.nodeType === 3 && n.nodeValue.includes(t))[nth];
  const body = () => [...dom.elements(view.document.body)];
  return {
    view,
    el,
    stored,
    caret(t, nth = 0) { view.document.getSelection().collapse(text(t, nth), 1); },
    select(line, word) {
      const node = text(line);
      const from = node.nodeValue.indexOf(word);
      const range = view.document.createRange();
      range.setStart(node, from);
      range.setEnd(node, from + word.length);
      view.document.getSelection().removeAllRanges();
      view.document.getSelection().addRange(range);
    },
    open() {
      const button = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      view.act(() => dom.reactProps(button).onMouseDown({ preventDefault() {} }));
      return dom.reactProps(body().find((e) => e.tagName === 'TEXTAREA')).value;
    },
    outside(next) {
      view.document.activeElement = view.document.body; // focus is in the optimizer's dialog
      view.update({ ...props, value: next });
    },
    apply(result) {
      view.act(() => dom.reactProps(body().find((e) => e.tagName === 'TEXTAREA')).onChange({ target: { value: result } }));
      view.act(() => dom.reactProps(body().find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'))).onClick());
    },
  };
}

describe('STAR Optimizer · Apply after an outside change finds the place it opened on (R5-HUNT7 review)', () => {
  it('a word selected in a bullet that an earlier bullet also has: the selected one is rewritten', async () => {
    const e = editor('<ul><li>Led QA hiring</li><li>Handled QA for releases</li></ul>');
    try {
      e.select('Handled QA', 'QA');
      assert.equal(e.open(), 'QA');
      e.outside('<ul><li>Led QA hiring</li><li>Handled QA for all releases</li></ul>');
      e.apply('quality assurance');
      assert.equal(e.el.innerHTML, '<ul><li>Led QA hiring</li><li>Handled quality assurance for all releases</li></ul>');
      assert.equal(e.stored.at(-1), e.el.innerHTML, 'the change is saved');
    } finally { await e.view.unmount(); }
  });

  it('the second of two equal bullets: the second is rewritten, the first stays', async () => {
    const e = editor('<ul><li>Led the team</li><li>Ran tests</li><li>Led the team</li></ul>');
    try {
      e.caret('Led the team', 1);
      assert.equal(e.open(), 'Led the team');
      e.outside('<ul><li>Led the team</li><li>Ran all tests</li><li>Led the team</li></ul>');
      e.apply('Led a team of 6 engineers');
      assert.equal(e.el.innerHTML, '<ul><li>Led the team</li><li>Ran all tests</li><li>Led a team of 6 engineers</li></ul>');
    } finally { await e.view.unmount(); }
  });

  it('with one place only, it is still found after the bullets moved', async () => {
    const e = editor('<ul><li>Led the team</li><li>Handled QA for releases</li></ul>');
    try {
      e.caret('Handled QA');
      e.open();
      e.outside('<ul><li>Built the pipeline</li><li>Led the team</li><li>Handled QA for releases</li></ul>');
      e.apply('Owned QA for 12 releases');
      assert.equal(e.el.innerHTML, '<ul><li>Built the pipeline</li><li>Led the team</li><li>Owned QA for 12 releases</li></ul>');
    } finally { await e.view.unmount(); }
  });
});
