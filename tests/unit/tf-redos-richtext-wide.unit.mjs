// Typing-freeze finding 7a: reading a Word list marker's text, the reader put the marker's children on its work
// list with push(...children), and a call takes only about 120 000 arguments: a marker with 200 000 elements in it
// (a pasted or imported document) threw a RangeError. They are put on one at a time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText, richTextToPlain } from '../../src/utils/richText.js';

test('a Word list marker with 200 000 elements in it is read, and its paragraph kept', () => {
  const html = `<p style="mso-list:l0 level1 lfo1"><![if !supportLists]>${'<b>x</b>'.repeat(200_000)}<![endif]>the item</p>`;
  const start = performance.now();
  const blocks = parseRichText(html);
  const ms = performance.now() - start;
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].runs.map((r) => r.text).join(''), 'the item');
  assert.ok(ms < 2000, `took ${ms.toFixed(0)} ms`);
  assert.equal(richTextToPlain(html), '• the item');
});
