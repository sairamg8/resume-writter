// Typing-freeze finding 7a: numberMarker wrote a Roman numeral with a loop that took one turn per "m", so a
// pasted <ol type="i" start="999999999999999"> (or a value=) kept the editor busy for 10^12 turns, once for each
// item. Pinned here: a start past 100 000 prints as digits at once; every smaller number prints the Roman
// numeral it always did (the old reader is kept in tests/fixtures/typing-freeze-reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richTextToPlain, sanitizeRichText } from '../../src/utils/richText.js';
import * as before from '../fixtures/typing-freeze-reference/richText.mjs';

const LIMIT_MS = 1000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a Roman list starting at an enormous number is read at once', () => {
  for (const [type, start] of [['i', '999999999999999'], ['I', '1000000'], ['i', `1${'0'.repeat(300)}`], ['I', '100000']]) {
    const html = `<ol type="${type}" start="${start}">${'<li>x</li>'.repeat(200)}</ol>`;
    const { out, ms } = timed(() => richTextToPlain(html));
    assert.ok(out.startsWith(`${Number.parseInt(start, 10)}. x\n`), out.slice(0, 40));
    assert.ok(ms < LIMIT_MS, `start ${start.slice(0, 20)}: took ${ms.toFixed(0)} ms`);
  }
  const { ms } = timed(() => sanitizeRichText('<ol type="i"><li value="999999999999999">x</li><li value="999999999999999999999">y</li></ol>'));
  assert.ok(ms < LIMIT_MS, `value=: took ${ms.toFixed(0)} ms`);
});

test('Roman numerals below 100 000 print as they did', () => {
  const numbers = [];
  for (let n = 1; n <= 2500; n += 1) numbers.push(n);
  numbers.push(3999, 4000, 4999, 5000, 12345, 40000, 99998); // the list prints n and n + 1: 99999 would reach 100 000
  for (const n of numbers) {
    for (const type of ['i', 'I']) {
      const html = `<ol type="${type}" start="${n}"><li>x</li><li>y</li></ol>`;
      assert.equal(richTextToPlain(html), before.richTextToPlain(html), `${type} ${n}`);
    }
  }
});
