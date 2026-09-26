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

// R4-CL-04: lines split by Shift+Enter inside a paragraph — Chrome stores
// `Built the billing API<div>Handled QA<br>Cut costs by 20%</div>`, and a pasted or imported
// description `<p>A<br>B</p>` — opened as the whole block, its lines glued ("Handled QACut costs by
// 20%"), and Apply replaced both. The caret's line is the statement, bounded by <br> as bare text is.
describe('STAR Optimizer · a paragraph split by <br> is read line by line (R4-CL-04)', () => {
  /** `<tag>lines[0]<br>lines[1]…</tag>` in `host`, built by hand; returns the element and its text nodes. */
  function brBlock(document, host, tag, lines) {
    const block = host.appendChild(document.createElement(tag));
    const texts = lines.map((t, i) => {
      if (i) block.appendChild(document.createElement('br'));
      return block.appendChild(document.createTextNode(t));
    });
    return { block, texts };
  }

  for (const tag of ['div', 'p']) {
    it(`opens on the caret's line of a <${tag}>, not on its lines glued together`, () => {
      const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
      try {
        const el = box(view);
        el.appendChild(globalThis.document.createTextNode('Built the billing API'));
        const { texts: [qa, costs] } = brBlock(globalThis.document, el, tag, ['Handled QA', 'Cut costs by 20%']);
        globalThis.document.getSelection().collapse(costs, 3);
        assert.equal(statementRange(el).toString(), 'Cut costs by 20%');
        globalThis.document.getSelection().collapse(qa, 0);
        assert.equal(statementRange(el).toString(), 'Handled QA');
      } finally {
        view.unmount();
      }
    });
  }

  it('a caret set just before the <br> is on the line that break ends', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const { block } = brBlock(globalThis.document, el, 'div', ['Handled QA', 'Cut costs by 20%']);
      globalThis.document.getSelection().collapse(block, 1);
      assert.equal(statementRange(el).toString(), 'Handled QA');
    } finally {
      view.unmount();
    }
  });

  it('Apply replaces only the caret\'s line, and the other line stays', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const { block, texts: [, costs] } = brBlock(globalThis.document, el, 'div', ['Handled QA', 'Cut costs by 20%']);
      globalThis.document.getSelection().collapse(costs, 0);
      const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));
      const area = [...dom.elements(view.container)].find((e) => e.tagName === 'TEXTAREA');
      assert.equal(dom.reactProps(area).value, 'Cut costs by 20%', 'it opens on the one line');
      view.act(() => dom.reactProps(area).onChange({ target: { value: 'Reduced costs by 20%' } }));
      const apply = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'));
      view.act(() => dom.reactProps(apply).onClick());
      assert.ok(block.textContent.startsWith('Handled QA'), `the other line is kept: ${block.textContent}`);
      assert.ok(block.textContent.endsWith('Reduced costs by 20%'), block.textContent);
      assert.ok(!block.textContent.includes('Cut costs'), block.textContent);
    } finally {
      view.unmount();
    }
  });

  it('a list item split by <br> is read line by line too, never glued', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const ul = el.appendChild(globalThis.document.createElement('ul'));
      const { texts: [, second] } = brBlock(globalThis.document, ul, 'li', ['Led the migration', 'of 40 services']);
      globalThis.document.getSelection().collapse(second, 2);
      assert.equal(statementRange(el).toString(), 'of 40 services');
    } finally {
      view.unmount();
    }
  });
});

// R4-LO-12: a <br> inside an inline wrapper — `<p><b>Handled QA<br>Cut costs by 20%</b></p>`, bold
// lines split by Shift+Enter — was not seen, as only the paragraph's own children were looked at: both
// lines opened glued together and Apply replaced both. A list item holding a nested list opened with
// the nested items' text too, and Apply wiped them. A line is now bounded by a <br> at any depth, and
// by a block inside the statement.
describe('STAR Optimizer · a line break inside bold or a link, and a nested list (R4-LO-12)', () => {
  /** `<p><b>lines[0]<br>lines[1]</b></p>` in `host`; returns the <b> and its text nodes. */
  function wrappedLines(document, host, lines) {
    const b = host.appendChild(document.createElement('p')).appendChild(document.createElement('b'));
    const texts = lines.map((t, i) => {
      if (i) b.appendChild(document.createElement('br'));
      return b.appendChild(document.createTextNode(t));
    });
    return { b, texts };
  }

  it('opens on the caret\'s line of a bold run split by <br>', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const { b, texts: [qa, costs] } = wrappedLines(globalThis.document, el, ['Handled QA', 'Cut costs by 20%']);
      globalThis.document.getSelection().collapse(costs, 3);
      assert.equal(statementRange(el).toString(), 'Cut costs by 20%');
      globalThis.document.getSelection().collapse(qa, 2);
      assert.equal(statementRange(el).toString(), 'Handled QA');
      globalThis.document.getSelection().collapse(b, 1);
      assert.equal(statementRange(el).toString(), 'Handled QA', 'a caret just before the <br> is on the line it ends');
    } finally {
      view.unmount();
    }
  });

  it('reads a line through several wrappers: plain, bold and a link on one line', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const d = globalThis.document;
      const p = el.appendChild(d.createElement('p'));
      p.appendChild(d.createTextNode('Built '));
      const b = p.appendChild(d.createElement('b'));
      const api = b.appendChild(d.createTextNode('the API'));
      b.appendChild(d.createElement('br'));
      b.appendChild(d.createTextNode('Cut costs '));
      const a = p.appendChild(d.createElement('a'));
      const link = a.appendChild(d.createTextNode('by 20%'));
      d.getSelection().collapse(api, 1);
      assert.equal(statementRange(el).toString(), 'Built the API');
      d.getSelection().collapse(link, 1);
      assert.equal(statementRange(el).toString(), 'Cut costs by 20%');
    } finally {
      view.unmount();
    }
  });

  it('Apply replaces only the caret\'s line, and the bold line before it stays', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const { b, texts: [, costs] } = wrappedLines(globalThis.document, el, ['Handled QA', 'Cut costs by 20%']);
      globalThis.document.getSelection().collapse(costs, 0);
      const open = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.getAttribute('title')?.includes('Optimizer'));
      view.act(() => dom.reactProps(open).onMouseDown({ preventDefault() {} }));
      const area = [...dom.elements(view.container)].find((e) => e.tagName === 'TEXTAREA');
      assert.equal(dom.reactProps(area).value, 'Cut costs by 20%', 'it opens on the one line');
      view.act(() => dom.reactProps(area).onChange({ target: { value: 'Reduced costs by 20%' } }));
      const apply = [...dom.elements(view.container)].find((e) => e.tagName === 'BUTTON' && e.textContent.includes('Apply to Resume'));
      view.act(() => dom.reactProps(apply).onClick());
      assert.equal(b.textContent, 'Handled QAReduced costs by 20%', 'the first line is kept, the second replaced');
    } finally {
      view.unmount();
    }
  });

  it('a list item with a nested list opens on its own line, not its sub-items', () => {
    const view = dom.mount(RichTextEditor, { label: 'Description', value: '', onChange: () => {} });
    try {
      const el = box(view);
      const d = globalThis.document;
      const outer = el.appendChild(d.createElement('ul')).appendChild(d.createElement('li'));
      const led = outer.appendChild(d.createTextNode('Led the migration'));
      const inner = outer.appendChild(d.createElement('ul')).appendChild(d.createElement('li'));
      const cut = inner.appendChild(d.createTextNode('Cut costs by 30%'));
      d.getSelection().collapse(led, 2);
      assert.equal(statementRange(el).toString(), 'Led the migration');
      d.getSelection().collapse(cut, 2);
      assert.equal(statementRange(el).toString(), 'Cut costs by 30%');
    } finally {
      view.unmount();
    }
  });
});
