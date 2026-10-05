// Typing-freeze finding 7a (the sweep of what a paste or an import reaches): the rich-text editor, when it shows a value, looked for
// a picture's data: URL inside a tag with /<[^>]*\bdata:[^\s"'>,;]*;base64,/i, which read a stored value of 100 000
// "<" to its end from each of them (seconds, each time the value is shown: an import, another résumé, a cloud pull; time
// squared). It reads it once now, with the same answer (R4-ED-02's picture tests still hold).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount } from './fake-dom.mjs';

before(setup);
after(teardown);

const LIMIT_MS = 1000;
const N = 100_000;

describe('the editor shows a long value in linear time (typing-freeze 7a)', () => {
  it('the editor shows a stored value of "<" x 100 000 without reading it 100 000 times', async () => {
    const { default: RichTextEditor } = await loadModule('/src/components/RichTextEditor.jsx');
    const stored = [];
    const start = performance.now();
    const view = mount(RichTextEditor, { label: 'Description', value: '<'.repeat(N), onChange: (v) => stored.push(v) });
    const ms = performance.now() - start;
    try {
      assert.deepEqual(stored, [], 'no picture data in it: showing it writes nothing');
      assert.ok(ms < LIMIT_MS, `showing the value took ${ms.toFixed(0)} ms`);
    } finally { await view.unmount(); }
  });
});
