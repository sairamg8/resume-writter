// C-2 (typing-freeze hunt: "5.7 MB plain paste: 6.8 s + 6.9 s stall"; measured on CI in Chromium at
// ~1.9 s of one long task for the résumé summary). One paste into a rich-text field takes in at most
// 200,000 characters, as plain text, and a line under the field says so. An ordinary paste is unchanged.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps, withInnerHtml } from './fake-dom.mjs';

before(async () => { await setup(); withInnerHtml(); });
after(teardown);

const LIMIT = 200000;

async function editor() {
  const mod = await loadModule('/src/components/RichTextEditor.jsx');
  const view = mount(mod.default, { label: 'Summary', value: '', onChange() {} });
  const box = [...elements(view.container)].find((el) => el.getAttribute('role') === 'textbox');
  const inserted = [];
  view.document.execCommand = (command, ui, value) => { inserted.push({ command, value }); return true; };
  const paste = (data) => view.act(() => reactProps(box).onPaste({ clipboardData: { getData: (t) => data[t] ?? '' }, preventDefault() {} }));
  const notice = () => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === 'paste-cut');
  return { mod, view, inserted, paste, notice };
}

describe('a huge paste into a rich-text field is cut (C-2)', () => {
  it('an ordinary paste goes in whole, with no line', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/plain': 'Led a team of 8.\nShipped v2.' });
      assert.deepEqual(t.inserted.map((c) => c.value), ['Led a team of 8.<br>Shipped v2.']);
      assert.equal(t.notice(), undefined);
    } finally { await t.view.unmount(); }
  });

  it('a 5.7 MB paste inserts its first 200,000 characters and says so', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/plain': 'x'.repeat(5_700_000) });
      assert.equal(t.inserted.length, 1);
      assert.equal(t.inserted[0].value.length, LIMIT, 'only the first part is handed to the browser');
      assert.ok(t.notice(), 'the line is shown');
      t.paste({ 'text/plain': 'short' });
      assert.equal(t.notice(), undefined, 'the next, ordinary paste clears it');
    } finally { await t.view.unmount(); }
  });

  it('a huge page of HTML goes in as its first plain-text part, not as 5 MB of markup', async () => {
    const t = await editor();
    try {
      t.paste({ 'text/html': `<p>${'a'.repeat(1_000_000)}</p>`, 'text/plain': 'b'.repeat(5000) });
      assert.equal(t.inserted[0].value, 'b'.repeat(5000));
      assert.ok(t.notice());
    } finally { await t.view.unmount(); }
  });

  it('the cut never splits a surrogate pair', async () => {
    const { mod } = await editor().then(async (t) => { await t.view.unmount(); return t; });
    const cut = mod.cutPaste('a'.repeat(LIMIT - 1) + '😀' + 'b');
    assert.equal(cut.length, LIMIT - 1);
  });
});
