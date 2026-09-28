// R4-SW-WT-02 (review): Apply writes a list item's whole statement in its first run and deletes the later
// runs with execCommand. In Chrome that left empty lines in the item: '<li>Led migration<ul><li>Cut costs
// by 30%</li></ul> for 3 regions</li>' saved as '<li>Led the migration…<br><ul>…</ul><p><br></p></li>'
// (Playwright, run 36459579010), and the PDF printed each as a blank line inside the bullet. Apply now
// removes the empty <p> and the <br> it made, and keeps every <p> and <br> the item already had. The fake
// DOM's delete and insertText are plain Range edits, so this test adds Chrome's two placeholders to them,
// as that run saw them; tests/playwright/bullet-optimizer.spec.mjs checks the same in Chromium. Fictional data.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let RichTextEditor;
let parseRichText;
let dom;
before(async () => {
  await setup();
  ({ default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx'));
  ({ parseRichText } = await loadModule('/src/utils/richText.js'));
  dom = await import('./fake-dom.mjs');
  dom.withInnerHtml();
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
});
after(teardown);

const NESTED = '<ul><li>Led migration<ul><li>Cut costs by 30%</li></ul> for 3 regions</li><li>Built CI</li></ul>';

/**
 * document.execCommand with the placeholders Chrome left (run 36459579010): a delete that empties a line
 * leaves <p><br></p> there, and insertText over the text before a nested list leaves a <br> before it.
 */
function withChromePlaceholders() {
  const doc = globalThis.document;
  const exec = doc.execCommand;
  doc.execCommand = function (command, ui, text) {
    const range = doc.getSelection().getRangeAt(0);
    const at = range.startContainer;
    const i = range.startOffset;
    const done = exec.call(doc, command, ui, text);
    if (command === 'delete' && at.nodeType === 1) {
      const p = doc.createElement('p');
      p.appendChild(doc.createElement('br'));
      at.insertBefore(p, at.childNodes[i] ?? null);
    }
    if (command === 'insertText' && at.nodeType === 1) {
      const list = [...at.childNodes].find((n) => n.nodeName === 'UL');
      if (list) at.insertBefore(doc.createElement('br'), list);
    }
    return done;
  };
  return () => { doc.execCommand = exec; };
}

/** The editor holding `html`, the caret in the text node holding `t`; Apply `result` and return what it emits. */
function applyAt(html, t, result) {
  let emitted = null;
  const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: (v) => { emitted = v; } });
  try {
    const el = [...dom.elements(view.container)].find((e) => e.getAttribute('role') === 'textbox');
    el.innerHTML = html;
    const walk = function* (n) { yield n; for (const c of n.childNodes) yield* walk(c); };
    const node = [...walk(el)].find((n) => n.nodeType === 3 && n.nodeValue.includes(t));
    assert.ok(node, `a text node holding "${t}"`);
    globalThis.document.getSelection().collapse(node, 2);
    const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
    view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));
    const area = [...dom.elements(view.document.body)].find((e) => e.tagName === 'TEXTAREA');
    view.act(() => dom.reactProps(area).onChange({ target: { value: result } }));
    const button = [...dom.elements(view.document.body)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'));
    view.act(() => dom.reactProps(button).onClick());
    return emitted;
  } finally {
    view.unmount();
  }
}

describe('STAR Optimizer · Apply leaves no empty line in the item it rewrote (R4-SW-WT-02)', () => {
  it('the repro: no <br> before the nested list and no <p><br></p> after it', () => {
    const restore = withChromePlaceholders();
    try {
      const saved = applyAt(NESTED, ' for 3 regions', 'Led the migration of 40 services across 3 regions');
      assert.equal(saved, '<ul><li>Led the migration of 40 services across 3 regions<ul><li>Cut costs by 30%</li></ul></li><li>Built CI</li></ul>');
      // What the PDF prints: the bullet, its sub-item, the next bullet — no blank line among them.
      const lines = parseRichText(saved).flatMap((b) => b.runs.map((r) => r.text).join('').split('\n'));
      assert.equal(lines.length, 3, JSON.stringify(lines));
      assert.ok(!lines.some((l) => !l.trim()), `no blank line: ${JSON.stringify(lines)}`);
    } finally {
      restore();
    }
  });

  it('the <p>s and <br>s the item already had stay', () => {
    const restore = withChromePlaceholders();
    try {
      // The first paragraph is the user's and holds the result; a nested item's own <br> is not the item's.
      const saved = applyAt('<ul><li><p>Owned billing</p><ul><li>Cut A<br>Cut B</li></ul><p>for 3 regions</p></li></ul>', 'for 3 regions', 'Owned billing for 3 regions');
      assert.equal(saved, '<ul><li><p>Owned billing for 3 regions</p><ul><li>Cut A<br>Cut B</li></ul></li></ul>');
    } finally {
      restore();
    }
  });
});
