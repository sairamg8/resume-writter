// R4-SW-WT-02: text after a nested list — '<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul> for 3
// regions</li></ul>' — is one bullet to the ATS score ("Led migration for 3 regions", R4-LO-16) and the PDF
// prints it so, but the STAR Optimizer opened "for 3 regions" alone (no verb, too brief) or "Led migration"
// alone, and Apply rewrote half of the bullet the ATS grades. Now a caret anywhere in a list item's own
// text opens the item's whole statement — every run outside its nested lists, and its paragraphs — the
// same text extractBulletsFromItem reads; Apply writes the result in the first run and deletes the
// others, the nested list left as it was. Nested items stay statements of their own, and a <br> inside
// an item still splits it in lines (R4-CL-04). The editor is mounted over tests/pdf/fake-dom.mjs, its
// content set from the same HTML the ATS reader gets (withInnerHtml). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let statementRange;
let RichTextEditor;
let extractBulletsFromItem;
let dom;
before(async () => {
  await setup();
  ({ statementRange, default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx'));
  ({ extractBulletsFromItem } = await loadModule('/src/utils/atsChecker.js'));
  dom = await import('./fake-dom.mjs');
  dom.withInnerHtml();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

const NESTED = '<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul> for 3 regions</li><li>Built CI</li></ul>';
const PARAGRAPHS = '<ul><li><p>Owned billing</p><p>for 3 regions</p></li></ul>';

/** The editor mounted with `html` in it; `text(t)` the text node holding `t`; `caret(t, i)` puts the caret there. */
function editor(html) {
  let emitted = null;
  const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: (v) => { emitted = v; } });
  const el = [...dom.elements(view.container)].find((e) => e.getAttribute('role') === 'textbox');
  el.innerHTML = html;
  const walk = function* (n) { yield n; for (const c of n.childNodes) yield* walk(c); };
  const text = (t) => [...walk(el)].find((n) => n.nodeType === 3 && n.nodeValue.includes(t));
  return {
    view,
    el,
    emitted: () => emitted,
    text,
    caret(t, i = 1) {
      const node = text(t);
      assert.ok(node, `a text node holding "${t}"`);
      globalThis.document.getSelection().collapse(node, i);
    },
    opened: () => statementRange(el)?.toString().replace(/\s+/g, ' ').trim(),
    /** Open the optimizer on the caret's statement, type `result` and Apply; returns the text it opened on. */
    apply(result) {
      const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));
      const area = [...dom.elements(view.document.body)].find((e) => e.tagName === 'TEXTAREA');
      const was = dom.reactProps(area).value;
      view.act(() => dom.reactProps(area).onChange({ target: { value: result } }));
      const button = [...dom.elements(view.document.body)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'));
      view.act(() => dom.reactProps(button).onClick());
      return was;
    },
  };
}

describe('STAR Optimizer · a list item\'s own text is one statement, as the ATS reads it (R4-SW-WT-02)', () => {
  it('a caret after the nested list, or before it, opens the whole outer bullet the ATS scores', () => {
    const e = editor(NESTED);
    try {
      const ats = extractBulletsFromItem({ description: NESTED });
      assert.ok(ats.includes('Led migration for 3 regions'), `the ATS bullet: ${ats}`);
      e.caret(' for 3 regions', 3);
      assert.equal(e.opened(), 'Led migration for 3 regions', 'caret after the nested list');
      e.caret('Led migration', 2);
      assert.equal(e.opened(), 'Led migration for 3 regions', 'caret before the nested list');
      e.caret('Cut costs', 2);
      assert.equal(e.opened(), 'Cut costs by 30%', 'a nested item is still its own statement');
      e.caret('Built CI', 2);
      assert.equal(e.opened(), 'Built CI', 'the next item is its own statement');
    } finally {
      e.view.unmount();
    }
  });

  it('Apply writes the bullet in the first run, drops the later run, and keeps the nested list', () => {
    const e = editor(NESTED);
    try {
      e.caret(' for 3 regions', 3);
      const was = e.apply('Led the migration of 40 services across 3 regions');
      assert.equal(was, 'Led migration for 3 regions', 'the optimizer opened on the whole bullet');
      const outer = e.el.childNodes[0].childNodes[0];
      assert.equal(outer.nodeName, 'LI');
      const nested = [...outer.childNodes].find((n) => n.nodeName === 'UL');
      assert.ok(nested, 'the nested list is still in the item');
      assert.equal(nested.textContent, 'Cut costs by 30%', 'its item is untouched');
      assert.equal(outer.textContent, 'Led the migration of 40 services across 3 regionsCut costs by 30%', 'no leftover of " for 3 regions"');
      assert.ok(e.emitted() != null, 'the change is emitted');
      assert.deepEqual(extractBulletsFromItem({ description: e.el.innerHTML }), ['Led the migration of 40 services across 3 regions', 'Cut costs by 30%', 'Built CI']);
    } finally {
      e.view.unmount();
    }
  });

  it('an item\'s paragraphs are one statement too, and Apply leaves one', () => {
    const e = editor(PARAGRAPHS);
    try {
      assert.deepEqual(extractBulletsFromItem({ description: PARAGRAPHS }), ['Owned billing for 3 regions']);
      e.caret('for 3 regions', 2);
      assert.equal(e.opened(), 'Owned billing for 3 regions');
      e.caret('Owned billing', 2);
      assert.equal(e.apply('Owned billing for 3 regions, cutting errors by 40%'), 'Owned billing for 3 regions');
      assert.deepEqual(extractBulletsFromItem({ description: e.el.innerHTML }), ['Owned billing for 3 regions, cutting errors by 40%']);
    } finally {
      e.view.unmount();
    }
  });

  it('an item split by <br> is still read line by line (R4-CL-04)', () => {
    const e = editor('<ul><li>Led migration<br>for 3 regions<ul><li>Cut costs by 30%</li></ul></li></ul>');
    try {
      e.caret('for 3 regions', 2);
      assert.equal(e.opened(), 'for 3 regions');
    } finally {
      e.view.unmount();
    }
  });
});
