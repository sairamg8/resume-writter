// R2-142 (the PDF build of a huge field): a PLAIN text field — a name, a company, a skills line — of 100 000
// characters took 4-14 s to build, 200 000 more than the PDF worker's 20 s, because textkit lays one paragraph out
// in time that grows with its square. The rich text path cuts a long block into paragraphs (typing-freeze 7b,
// splitHugeBlock.js: tf-sidebar-huge-paragraph.unit.mjs); plain text went to textkit whole. Text (PdfText.jsx)
// now cuts what it is given when it is more than HUGE_BLOCK characters: lines of a few thousand (breakHugeText,
// breakHugeChildren). These pin what the cut does and, above all, what it leaves alone: text of HUGE_BLOCK
// characters or fewer, and children with an element in them, come back as the very same value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakHugeText, breakHugeChildren, HUGE_BLOCK } from '../../src/templates/pdf/shared/splitHugeBlock.js';

const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

test('text of HUGE_BLOCK characters or fewer is the same string, whatever it holds', () => {
  const edge = words(3000).slice(0, HUGE_BLOCK);
  assert.equal(edge.length, HUGE_BLOCK);
  assert.ok(breakHugeText(edge) === edge);
  for (const text of ['', ' ', 'Pat Lee', 'a\nb\n\n', '山田太郎', 'x'.repeat(HUGE_BLOCK)]) assert.ok(breakHugeText(text) === text, JSON.stringify(text.slice(0, 20)));
  for (const odd of [undefined, null, 7, false, ['a']]) assert.ok(breakHugeText(odd) === odd, 'a value that is no string is returned as it is');
});

test('a long text is cut into lines that keep every word in order, none longer than 9 000 characters', () => {
  const text = words(60000);
  const out = breakHugeText(text);
  const lines = out.split('\n');
  assert.ok(lines.length > 20, `${lines.length} lines`);
  assert.equal(lines.join(' '), text, 'only the spaces a cut fell on are gone, and a cut falls on one space');
  for (const line of lines) {
    assert.ok(line.length <= 9000, `a line of ${line.length} characters`);
    assert.ok(!line.startsWith(' ') && !line.endsWith(' '), 'a line does not start or end with a space');
  }
});

test('a cut after a run of spaces drops all of them', () => {
  const text = `${'a '.repeat(3500)}   ${'b '.repeat(8000)}`.trim();
  const lines = breakHugeText(text).split('\n');
  assert.ok(lines.length >= 3);
  assert.equal(lines.join(' ').replace(/ +/g, ' '), text.replace(/ +/g, ' '));
  for (const line of lines) assert.ok(!/^ | $/.test(line));
});

test('text with no space is cut where it stands, never inside a surrogate pair, a combining mark or a joined emoji', () => {
  for (const unit of ['山田太郎', '🚀', 'é', '👨‍👩‍👧', 'x']) {
    const text = `x${unit.repeat(Math.ceil(30000 / unit.length))}`; // odd, so a cut can fall inside a pair
    const lines = breakHugeText(text).split('\n');
    assert.ok(lines.length > 3, unit);
    assert.equal(lines.join(''), text, `${unit}: nothing lost`);
    for (const line of lines) {
      assert.ok(!/^[\udc00-\udfff̀-ͯ‍]/.test(line), `${unit}: a line starts inside a character`);
      assert.ok(!/[\ud800-\udbff]$/.test(line), `${unit}: a line ends inside a pair`);
      assert.ok(!line.endsWith('‍'), `${unit}: a line ends on a joiner`);
    }
  }
});

test('the line breaks a text already has stay where they are: only a line that is itself long is cut', () => {
  const mid = words(2000); // 10 889 characters: no line of its own past the limit, though the whole text is
  const big = words(5000); // 28 889 characters
  assert.ok(mid.length <= HUGE_BLOCK && big.length > HUGE_BLOCK);
  const text = `first\n${mid}\nsecond\n\n${big}\nlast`;
  assert.ok(text.length > HUGE_BLOCK);
  const out = breakHugeText(text);
  assert.equal(out, `first\n${mid}\nsecond\n\n${breakHugeText(big)}\nlast`, 'the short lines and the blank one are as they were; the long one is cut');
  assert.ok(breakHugeText(big).includes('\n'));
});

test('children that are one string: cut when long, the very same string when not', () => {
  const short = 'Acme, Inc.';
  assert.ok(breakHugeChildren(short) === short);
  const long = words(30000);
  const out = breakHugeChildren(long);
  assert.equal(typeof out, 'string');
  assert.ok(out.includes('\n'));
  assert.equal(out, breakHugeText(long));
});

test('children that are several strings, numbers and nothing: the text is all of them together', () => {
  const part = words(2000); // 10 889 characters: three of them make one paragraph, no one of them past the limit
  assert.ok(part.length < HUGE_BLOCK);
  const children = [part, ' ', part, null, false, 7, part];
  const out = breakHugeChildren(children);
  assert.equal(typeof out, 'string');
  assert.equal(out.replace(/\n/g, ' ').replace(/ +/g, ' '), [part, ' ', part, '7', part].join('').replace(/ +/g, ' '));
  assert.ok(breakHugeChildren([[part, [' ', part]], part]).includes('\n'), 'lists inside lists too');
});

test('children that are short, or hold an element, or are not text at all come back as the very same value', () => {
  const short = ['Pat', ' ', 'Lee', null, 3];
  assert.ok(breakHugeChildren(short) === short);
  const element = { type: 'span', props: { children: 'x' } };
  const withElement = [words(5000), element, words(5000), words(5000)];
  assert.ok(breakHugeChildren(withElement) === withElement, 'a paragraph with a link or a styled run in it is left as it is');
  const nested = [[words(5000), element]];
  assert.ok(breakHugeChildren(nested) === nested);
  for (const odd of [undefined, null, 5, true, element, () => 'x']) assert.ok(breakHugeChildren(odd) === odd);
});
