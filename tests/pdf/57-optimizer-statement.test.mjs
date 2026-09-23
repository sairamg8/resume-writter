// The STAR Optimizer opens on the statement being edited, and Apply puts its result in place of
// that statement as text (AUD-09). The fix landed with a Playwright spec only, which `yarn test`
// never runs — so nothing in the push gate covered it. This is that cover: the statement the caret
// picks out, and what Apply leaves behind, over the fake DOM's Range and insertText.
// Real Chromium still checks the rest: tests/playwright/bullet-optimizer.spec.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

let statementRange;
let RichTextEditor;
let dom;
before(async () => {
  await setup();
  ({ statementRange, default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx'));
  dom = await import('./fake-dom.mjs');
});
after(teardown);

/** `<ul><li>a</li><li>b</li></ul>` built by hand — the fake DOM parses no HTML. */
function bullets(document, host, texts) {
  const ul = host.appendChild(document.createElement('ul'));
  return texts.map((t) => {
    const li = ul.appendChild(document.createElement('li'));
    li.appendChild(document.createTextNode(t));
    return li;
  });
}

/** The editor's contenteditable box in a mounted RichTextEditor. */
const box = (view) => [...dom.elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');

describe('STAR Optimizer · the statement it opens on (AUD-09)', () => {
  it('is the bullet the caret is in, not the whole field and not the first one', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      assert.ok(el, 'the editor has a contenteditable box');
      const [first, second] = bullets(globalThis.document, el, ['Led the migration', 'Cut p95 to <200ms']);
      globalThis.document.getSelection().collapse(second.firstChild, 4);
      assert.equal(statementRange(el).toString(), 'Cut p95 to <200ms');
      globalThis.document.getSelection().collapse(first.firstChild, 0);
      assert.equal(statementRange(el).toString(), 'Led the migration');
    } finally {
      view.unmount();
    }
  });

  it('is the selection when there is one', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const [li] = bullets(globalThis.document, el, ['Led the migration of 40 services']);
      const range = globalThis.document.createRange();
      range.setStart(li.firstChild, 4);
      range.setEnd(li.firstChild, 17);
      globalThis.document.getSelection().addRange(range);
      assert.equal(statementRange(el).toString(), 'the migration');
    } finally {
      view.unmount();
    }
  });

  it('is nothing at all when the caret is not in this editor — the optimizer opens blank, as it should', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      bullets(globalThis.document, el, ['Led the migration']);
      globalThis.document.getSelection().removeAllRanges();
      assert.equal(statementRange(el), null, 'no caret, no statement');
      const elsewhere = globalThis.document.body.appendChild(globalThis.document.createElement('div'));
      elsewhere.appendChild(globalThis.document.createTextNode('another field'));
      globalThis.document.getSelection().collapse(elsewhere.firstChild, 2);
      assert.equal(statementRange(el), null, 'a caret in another field is not this editor\'s statement');
    } finally {
      view.unmount();
    }
  });

  it('the modal is mounted only while open, so it never reopens on the last statement', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const [li] = bullets(globalThis.document, el, ['Led the migration']);
      const textareas = () => [...dom.elements(view.container)].filter((e) => e.tagName === 'TEXTAREA');
      assert.deepEqual(textareas(), [], 'nothing of the optimizer is in the tree while it is closed');

      globalThis.document.getSelection().collapse(li.firstChild, 0);
      const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      assert.ok(open, 'the toolbar offers the optimizer');
      view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));

      const statement = textareas().find((t) => String(dom.reactProps(t).value || '').includes('Led the migration'));
      assert.ok(statement, 'it opens on the statement the caret was in, not on an empty field');
    } finally {
      view.unmount();
    }
  });
});

describe('STAR Optimizer · what Apply leaves behind (AUD-09)', () => {
  /** Open the optimizer on the caret's statement and apply `text`, as the modal's Apply does. */
  const applyTo = (view, el, caret, text) => {
    globalThis.document.getSelection().collapse(caret, 0);
    const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
    view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));
    const apply = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'));
    assert.ok(apply, 'the modal offers Apply to Resume');
    const area = [...dom.elements(view.container)].find((e) => e.tagName === 'TEXTAREA');
    view.act(() => dom.reactProps(area).onChange({ target: { value: text } }));
    view.act(() => dom.reactProps(apply).onClick());
  };

  it('replaces the statement it opened on, rather than adding the result beside it', () => {
    let emitted = null;
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: (v) => { emitted = v; } });
    try {
      const el = box(view);
      const [first, second] = bullets(globalThis.document, el, ['Did the migration', 'Kept the lights on']);
      applyTo(view, el, first.firstChild, 'Led the migration of 40 services, cutting deploy time 65%');

      assert.equal(first.textContent, 'Led the migration of 40 services, cutting deploy time 65%', 'the bullet it opened on is the one that changed');
      assert.equal(second.textContent, 'Kept the lights on', 'the other bullets are left alone');
      assert.ok(emitted != null, 'the change is emitted, so it is stored');
    } finally {
      view.unmount();
    }
  });

  it('puts the result in as text: "<200ms" stays a number, not markup', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const [li] = bullets(globalThis.document, el, ['Made it faster']);
      applyTo(view, el, li.firstChild, 'Cut p95 latency to <200ms for <b>every</b> request');

      assert.equal(li.textContent, 'Cut p95 latency to <200ms for <b>every</b> request');
      assert.deepEqual([...dom.elements(li)].filter((e) => e !== li).map((e) => e.tagName), [], 'nothing in it was read as markup');
    } finally {
      view.unmount();
    }
  });
});
