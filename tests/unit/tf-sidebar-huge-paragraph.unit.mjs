// Typing-freeze 7b: a pasted paragraph of 200 000 characters is cut into paragraphs of a few
// thousand before textkit lays it out (splitHugeBlocks), because textkit's time on one paragraph
// grows with the square of its length. These pin what the cut does and leaves alone: a block of
// 12 000 characters or fewer is the same object, a longer one keeps every word and format in order,
// cuts at spaces (or inside text with none, never inside a character), and a list item's marker
// stays on its first piece.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitHugeBlocks, HUGE_BLOCK } from '../../src/templates/pdf/shared/splitHugeBlock.js';

const run = (text, extra = {}) => ({ text, bold: false, italic: false, underline: false, strike: false, href: null, ...extra });
const block = (runs, extra = {}) => ({ runs, align: null, indent: 0, marker: null, inList: false, ...extra });
const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const textOf = (blocks) => blocks.map((b) => b.runs.map((r) => r.text).join(''));

test('a block of HUGE_BLOCK characters or fewer comes back as it is', () => {
  const small = block([run(words(2000).slice(0, HUGE_BLOCK))]);
  const out = splitHugeBlocks([small]);
  assert.equal(out.length, 1);
  assert.equal(out[0], small);
});

test('a long block is cut into pieces that keep every word in order, none longer than 9 000 characters', () => {
  const text = words(60000);
  const out = splitHugeBlocks([block([run(text)])]);
  assert.ok(out.length > 20, `${out.length} pieces`);
  const pieces = textOf(out);
  assert.equal(pieces.join(' '), text, 'only the spaces a cut fell on are gone, and a cut falls on one space');
  for (const piece of pieces) {
    assert.ok(piece.length <= 9000, `a piece of ${piece.length} characters`);
    assert.ok(!piece.startsWith(' ') && !piece.endsWith(' '), 'a piece does not start or end with a space');
  }
});

test('a cut after a run of spaces drops all of them, and a format is kept across a cut', () => {
  const text = `${'a '.repeat(3500)}   ${'b '.repeat(8000)}`.trim();
  const out = splitHugeBlocks([block([run(text.slice(0, 5000), { bold: true }), run(text.slice(5000), { href: 'https://x.io' })])]);
  assert.ok(out.length >= 3);
  assert.equal(textOf(out).join(' ').replace(/ +/g, ' '), text.replace(/ +/g, ' '));
  assert.ok(out[0].runs[0].bold && out[0].runs[0].href === null);
  assert.ok(out.at(-1).runs.every((r) => r.href === 'https://x.io' && !r.bold));
  for (const piece of textOf(out)) assert.ok(!/^ | $/.test(piece));
});

test('text with no space is cut where it stands, never inside a surrogate pair or after a joiner', () => {
  for (const unit of ['山田太郎', '🚀', 'é', '👨‍👩‍👧', 'x']) {
    const text = `x${unit.repeat(Math.ceil(30000 / unit.length))}`; // odd, so a cut can fall inside a pair
    const out = textOf(splitHugeBlocks([block([run(text)])]));
    assert.ok(out.length > 3, unit);
    assert.equal(out.join(''), text, `${unit}: nothing lost`);
    for (const piece of out) {
      assert.ok(!/^[\udc00-\udfff̀-ͯ‍]/.test(piece), `${unit}: a piece starts inside a character`);
      assert.ok(!/[\ud800-\udbff]$/.test(piece), `${unit}: a piece ends inside a pair`);
      assert.ok(!piece.endsWith('‍'), `${unit}: a piece ends on a joiner`);
    }
  }
});

test('the pieces after the first continue the paragraph: no marker, no gap above, the same indent and alignment', () => {
  const item = block([run(words(8000))], { marker: '•', indent: 2, align: 'justify', inList: true, list: { id: 1 } });
  const [first, ...rest] = splitHugeBlocks([block([run('before')]), item]).slice(1);
  assert.equal(first.marker, '•');
  assert.ok(!first.joined);
  assert.ok(rest.length >= 1);
  for (const piece of rest) {
    assert.equal(piece.marker, null);
    assert.equal(piece.joined, true);
    assert.equal(piece.indent, 2);
    assert.equal(piece.align, 'justify');
  }
});

test('a line break inside a long block stays where it was', () => {
  const out = textOf(splitHugeBlocks([block([run(words(5000)), run('\n'), run(words(5000))])]));
  assert.equal(out.join(' ').replace(/ +/g, ' '), `${words(5000)}\n${words(5000)}`);
});
