// Typing-freeze finding 7 (the sweep of what a paste or an import reaches): a multi-line field cut the white space off its end, when it was
// left, with /\s+$/, which tried each character of a long run in the middle of the text (100 000 spaces, seconds; time
// squared). trimEnd does the same cut.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const LIMIT_MS = 1000;
const N = 100_000;

describe('a multi-line field is left in linear time (typing-freeze 7)', () => {
  it('a multi-line field left with a run of 100 000 spaces in its text is saved in linear time, without its trailing white space', async () => {
    const { default: InlineEdit } = await loadModule('/src/components/ui/InlineEdit.jsx');
    const committed = [];
    const view = mount(InlineEdit, { value: 'old', multiline: true, onCommit: (v) => committed.push(v) });
    try {
      const button = [...elements(view.container)].find((el) => el.tagName === 'BUTTON');
      view.act(() => reactProps(button).onClick());
      const field = [...elements(view.container)].find((el) => el.tagName === 'TEXTAREA');
      assert.ok(field, 'clicking the text opens its field');
      const draft = `a${' '.repeat(N)}b \n\t `;
      view.act(() => reactProps(field).onChange({ target: { value: draft, tagName: 'DIV' } }));
      const start = performance.now();
      view.act(() => reactProps(field).onBlur());
      const ms = performance.now() - start;
      assert.deepEqual(committed, [`a${' '.repeat(N)}b`]);
      assert.ok(ms < LIMIT_MS, `leaving the field took ${ms.toFixed(0)} ms`);
    } finally { await view.unmount(); }
  });
});
