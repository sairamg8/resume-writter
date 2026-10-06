// A-5: two bounds of the rich-text reader change its output on a huge input, on purpose, and are pinned here at their
// edges. A Roman numeral from 100 000 on prints as digits (a start of 1e15 was 10^12 "m"s; there is no numeral to
// write for it). A Word list marker longer than 257 characters is no marker (the text of nested markers is read once,
// cut at that length, which keeps the reading linear; real markers are "1.", "(a)", "iv."). What is shorter is
// unchanged, and both bounds are far past anything a document holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText, richTextToPlain } from '../../src/utils/richText.js';

test('Roman numerals up to 99 999 are letters and from 100 000 on digits', () => {
  const plain = richTextToPlain('<ol type="i" start="99999"><li>x</li><li>y</li></ol>');
  assert.ok(plain.startsWith(`${'m'.repeat(99)}cmxcix. x\n100000. y`), plain.slice(-40));
  const upper = richTextToPlain('<ol type="I" start="3999"><li>x</li><li>y</li></ol>');
  assert.equal(upper, 'MMMCMXCIX. x\nMMMM. y');
  assert.ok(richTextToPlain('<ol type="i" start="1000000000000000"><li>x</li></ol>').startsWith('1000000000000000. x'));
});

const isBullet = (marker) => /^[•–·]$/.test(marker);
const item = (marker) => `<p style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore">${marker}</span><![endif]>text</p>`;

test('a Word list marker of 257 characters is a marker and of 258 is not', () => {
  const digits = (n) => '1'.repeat(n);
  assert.equal(isBullet(parseRichText(item(`${digits(256)}.`))[0].marker), false, '257 characters');
  assert.equal(isBullet(parseRichText(item(`${digits(257)}.`))[0].marker), true, '258 characters');
  // The same length spread over nested elements and white space, as Word writes it.
  const spread = `<b>${digits(200)}</b> <i>${digits(57)}</i>.`;
  assert.equal(isBullet(parseRichText(item(spread))[0].marker), true, 'cut where the text is 258 characters');
});

test('ordinary Word list markers are unchanged by the cap', () => {
  for (const [marker, want] of [['1.', '1.'], ['(a)', 'a.'], ['iv.', 'iv.'], ['12)', '12.'], ['•', '•']]) {
    assert.equal(parseRichText(item(marker))[0].marker, want, marker);
  }
});
