// Typing-freeze finding 7b (review round 1): the Markdown reader's emphasis search kept one global regex for line ends
// between calls, so the first call on a text with U+2028 or U+2029 in it (which "." does not cross, so an italic or
// strike-through run may not either) came out right, and a later call on the same text started its check from where the
// last one had stopped, missed the line end and took the run across it. The same input must read the same every time,
// and as the old reader did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines } from '../../src/utils/importText.js';
import * as before from '../fixtures/typing-freeze-reference/importText.mjs';

const LS = ' ';
const PS = ' ';

test('a text with a line separator in it is read the same on every call, as the old reader reads it', () => {
  for (const md of [`*a${LS}b_*`, `**${LS}a_*`, `*a${LS}*_*`, `~~a${PS}b~~`, `_a${PS}b_`, `*a${LS}b*`]) {
    const want = before.markdownLines(md);
    for (let call = 0; call < 3; call += 1) assert.deepEqual(markdownLines(md), want, `${JSON.stringify(md)}, call ${call + 1}`);
  }
});

test('a document with the same separator line twice, a heading between, reads both copies the same', () => {
  const md = `*a${LS}b_*\n# Heading\n*a${LS}b_*`;
  const lines = markdownLines(md);
  assert.equal(lines[0].text, lines[2].text);
  assert.deepEqual(lines, before.markdownLines(md));
});

const PIECES = ['*', '**', '*x*', '_', '__', '_x_', '~~', '~~x~~', ' *a', ' _a', 'a_b_c', '**b**', ' ', 'x', 'foo', 'a', 'b', LS, PS, LS, PS, '\n', '\\', '`', '[a](b)'];

test('the same lines as the old reader on 20 000 seeded texts with line separators, each read twice', () => {
  let seed = 31;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 20_000; doc += 1) {
    let md = '';
    for (let i = 0, k = 1 + Math.floor(random() * 10); i < k; i += 1) md += PIECES[Math.floor(random() * PIECES.length)];
    const want = before.markdownLines(md);
    assert.deepEqual(markdownLines(md), want, JSON.stringify(md));
    assert.deepEqual(markdownLines(md), want, `again: ${JSON.stringify(md)}`);
  }
});
