// R2-142 (docs/tracking/STATUS.md, "thousands of short blocks in one field"): react-pdf lays each paragraph and
// list item of a field out as a node and, for every page, lays out again every node after it, so a field's
// build time follows its pages times its blocks: 1 000 bullets of 100 characters build in 6.6 s, 2 000 in
// 23.4 s on CI, past the PDF worker's 20 s, so the preview and Export both fail. A paste that would take a
// rich-text field past MAX_FIELD_BLOCKS (1 500) paragraphs and bullets now goes in up to that many, the field's
// own blocks counted, and a line under the field says so (as C-2's cut does for 200 000 characters). An
// ordinary paste is unchanged, and so is plain text, which is one block however many lines it has.
// Counts blocks, never time. Fictional text.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps, withInnerHtml } from './fake-dom.mjs';

before(async () => { await setup(); withInnerHtml(); });
after(teardown);

const LIMIT = 1500;
const bullets = (n, from = 0) => `<ul>${Array.from({ length: n }, (_, i) => `<li>Item ${from + i}</li>`).join('')}</ul>`;

/** A rich-text field holding `value`, whose browser insertions are kept, with the pasting and the line under it. */
async function editor(value = '') {
  const mod = await loadModule('/src/components/RichTextEditor.jsx');
  const cap = await loadModule('/src/utils/richTextCap.js');
  const rich = await loadModule('/src/utils/richText.js');
  const view = mount(mod.default, { label: 'Summary', value, onChange() {} });
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const inserted = [];
  view.document.execCommand = (command, ui, html) => { inserted.push({ command, html }); return true; };
  const paste = (data) => view.act(() => reactProps(box).onPaste({ clipboardData: { getData: (t) => data[t] ?? '' }, preventDefault() {} }));
  const notice = () => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'paste-cut');
  return { cap, rich, view, inserted, paste, notice };
}

describe('a paste that would take a field past 1 500 blocks is cut where the limit falls (R2-142)', () => {
  it('an ordinary paste goes in whole, with no line', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/html': bullets(3) });
      assert.deepEqual(t.inserted.map((c) => c.html), [t.rich.sanitizeForInsert(bullets(3))]);
      assert.equal(t.notice(), undefined);
    } finally { await t.view.unmount(); }
  });

  it('2 000 bullets into an empty field: the first 1 500 go in, and a line says so; the next ordinary paste clears it', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/html': bullets(2000) });
      assert.equal(t.inserted.length, 1);
      const html = t.inserted[0].html;
      assert.equal(t.cap.countBlocks(html), LIMIT, 'only the first 1 500 reach the browser');
      assert.ok(html.includes('Item 1499') && !html.includes('Item 1500'), 'the cut falls after the 1 500th');
      assert.equal(t.rich.parseRichText(html).length, LIMIT, 'and what is left reads as 1 500 blocks');
      assert.match(t.notice()?.textContent ?? '', /at most 1,500 paragraphs and bullets/);
      t.paste({ 'text/html': bullets(2) });
      assert.equal(t.notice(), undefined, 'the next, ordinary paste clears it');
    } finally { await t.view.unmount(); }
  });

  it('exactly 1 500 go in whole; 1 501 go in as 1 500', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/html': bullets(LIMIT) });
      assert.equal(t.cap.countBlocks(t.inserted[0].html), LIMIT);
      assert.equal(t.notice(), undefined);
      t.paste({ 'text/html': bullets(LIMIT + 1) });
      assert.equal(t.cap.countBlocks(t.inserted[1].html), LIMIT);
      assert.ok(t.notice());
    } finally { await t.view.unmount(); }
  });

  it('the paragraphs of a pasted page are counted as the bullets of a list are', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/html': Array.from({ length: 1600 }, (_, i) => `<p>Line ${i}</p>`).join('') });
      assert.equal(t.cap.countBlocks(t.inserted[0].html), LIMIT);
      assert.ok(t.notice());
    } finally { await t.view.unmount(); }
  });

  it('the field\'s own blocks count: 1 490 in it, 20 pasted, 10 go in', async () => {
    const t = await editor(bullets(1490));
    try {
      t.paste({ 'text/html': bullets(20, 5000) });
      const html = t.inserted[0].html;
      assert.equal(t.cap.countBlocks(html), 10);
      assert.ok(html.includes('Item 5009') && !html.includes('Item 5010'));
      assert.ok(t.notice());
    } finally { await t.view.unmount(); }
  });

  it('a full field takes no more bullets, but a phrase still goes into a line', async () => {
    const t = await editor(bullets(LIMIT));
    try {
      t.paste({ 'text/html': bullets(5) });
      assert.equal(t.cap.countBlocks(t.inserted[0].html), 0, 'no bullet goes in');
      assert.ok(t.notice(), 'and the line says why');
      t.paste({ 'text/html': '<p>just a phrase</p>' });
      assert.equal(t.inserted[1].html, 'just a phrase', 'one paragraph is unwrapped into the line: it adds no block');
      assert.equal(t.notice(), undefined);
    } finally { await t.view.unmount(); }
  });

  it('plain text of thousands of lines is one block, and is not cut', async () => {
    const t = await editor();
    try {
      const lines = Array.from({ length: 3000 }, (_, i) => `Line ${i}`);
      t.paste({ 'text/plain': lines.join('\n') });
      assert.equal(t.inserted[0].html, lines.join('<br>'));
      assert.equal(t.notice(), undefined);
    } finally { await t.view.unmount(); }
  });

  it('a paste past the 200 000-character cut still says that, not the blocks', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/plain': 'x'.repeat(300_000) });
      assert.match(t.notice()?.textContent ?? '', /first 200,000 characters/);
    } finally { await t.view.unmount(); }
  });
});

describe('capBlocks and countBlocks', () => {
  it('count a <p and an <li, not <pre or <param, and nothing in nothing', async () => {
    const { cap } = await editor().then(async (t) => { await t.view.unmount(); return t; });
    assert.equal(cap.countBlocks('<p>a</p><pre>x</pre><param><ul><li>b</li></ul>'), 2);
    assert.equal(cap.countBlocks(null), 0);
    assert.equal(cap.countBlocks(undefined), 0);
    assert.equal(cap.countBlocks('plain<br>text'), 0);
  });

  it('a cut inside a nested list leaves well-formed HTML of exactly that many blocks, and no empty list', async () => {
    const { cap, rich } = await editor().then(async (t) => { await t.view.unmount(); return t; });
    const html = rich.sanitizeForInsert('<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>');
    const two = cap.capBlocks(html, 2);
    assert.equal(two.cut, true);
    assert.deepEqual(rich.parseRichText(two.html).map((b) => b.runs.map((r) => r.text).join('')), ['a', 'b']);
    assert.equal((two.html.match(/<ul/g) || []).length, (two.html.match(/<\/ul>/g) || []).length, 'every list is closed');
    const none = cap.capBlocks(html, 0);
    assert.deepEqual([none.html, none.cut], ['', true], 'room for none: nothing, not an empty list');
    const all = cap.capBlocks(html, 4);
    assert.deepEqual([all.html, all.cut], [html, false], 'room for all: the same string');
  });
});
