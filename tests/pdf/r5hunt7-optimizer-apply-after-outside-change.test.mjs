// R5-HUNT7-OPTIMIZER-APPLY-AFTER-OUTSIDE-CHANGE: a description changed in another tab (or by a cloud
// pull) while the STAR Optimizer was open replaced the editor's nodes (adopt), and the Range saved for
// the statement no longer covered it: in a browser it collapsed to the editor's start, and Apply wrote
// the rewrite there as loose text above the bullets, the original bullet left as it was. Now a Range
// that no longer covers the statement the optimizer opened on is found again by its text in the new
// content, and replaced there; with no such statement left, the rewrite is a new bullet.
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

const BEFORE = '<ul><li>Led the team</li><li>Handled QA for releases</li></ul>';
const OTHER_TAB = '<ul><li>Led the whole team</li><li>Handled QA for releases</li></ul>';

function editor(value) {
  const stored = [];
  const props = { label: 'Description', value, onChange: (v) => stored.push(v) };
  const view = dom.mount(RichTextEditor, props);
  const el = [...dom.elements(view.container)].find((e) => e.getAttribute('role') === 'textbox');
  const walk = function* (n) { yield n; for (const c of n.childNodes) yield* walk(c); };
  const text = (t) => [...walk(el)].find((n) => n.nodeType === 3 && n.nodeValue.includes(t));
  const body = () => [...dom.elements(view.document.body)];
  return {
    view,
    el,
    stored,
    caret(t, i = 1) { view.document.getSelection().collapse(text(t), i); },
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

describe('STAR Optimizer · Apply after the description changed elsewhere (R5-HUNT7)', () => {
  it('the rewrite replaces the statement it opened on, in the new content', () => {
    const e = editor(BEFORE);
    try {
      e.caret('Handled QA', 3);
      assert.equal(e.open(), 'Handled QA for releases');
      e.outside(OTHER_TAB);
      assert.equal(e.el.innerHTML, OTHER_TAB, 'the other tab\'s save is shown');
      e.apply('Owned QA for 12 releases, cutting escaped defects by 40%');
      assert.equal(e.el.innerHTML, '<ul><li>Led the whole team</li><li>Owned QA for 12 releases, cutting escaped defects by 40%</li></ul>');
      assert.equal(e.stored.at(-1), e.el.innerHTML, 'the change is saved');
    } finally { e.view.unmount(); }
  });

  it('a saved Range collapsed to the editor\'s start (a browser\'s live range) is not written there', () => {
    const e = editor(BEFORE);
    const doc = e.view.document;
    const made = [];
    const create = doc.createRange;
    doc.createRange = function () { const r = create.call(this); made.push(r); return r; };
    try {
      e.caret('Handled QA', 3);
      e.open();
      doc.createRange = create;
      e.outside(OTHER_TAB);
      // What the DOM does to a live Range whose nodes innerHTML removed: its boundaries move to (el, 0).
      for (const r of made) { r.setStart(e.el, 0); r.setEnd(e.el, 0); }
      e.apply('Owned QA for 12 releases');
      assert.equal(e.el.innerHTML, '<ul><li>Led the whole team</li><li>Owned QA for 12 releases</li></ul>', 'no loose text above the list, no old bullet');
    } finally { doc.createRange = create; e.view.unmount(); }
  });

  it('a statement no longer there: the rewrite is a new bullet, nothing else changes', () => {
    const e = editor(BEFORE);
    try {
      e.caret('Handled QA', 3);
      e.open();
      e.outside('<ul><li>Led the team</li><li>Ran QA</li></ul>');
      e.apply('Owned QA for 12 releases');
      assert.equal(e.el.innerHTML, '<ul><li>Led the team</li><li>Ran QA</li></ul><ul><li>Owned QA for 12 releases</li></ul>');
    } finally { e.view.unmount(); }
  });
});
