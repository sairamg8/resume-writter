// R5-HUNT7-LIST-TYPE (review): a lettered list copied from Word for desktop from its third item on
// ('c)', 'd)') was pasted as i., ii. — every letter that is also a Roman digit (c, d, l, m) read as
// a Roman list, and a lettered or Roman list never kept where it starts. The typed marker now gives
// both: 'c)' starts at c., 'iv.' at iv., while 'i.', 'v.' and 'x.' alone stay Roman.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForInsert, sanitizeRichText, parseRichText } from '../../src/utils/richText.js';

const markers = (html) => parseRichText(html).map((b) => b.marker);
const item = (marker, text) => "<p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>"
  + `<![if !supportLists]><span><span style='mso-list:Ignore'>${marker}<span>&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>`;
const paste = (...ms) => sanitizeForInsert(ms.map((m, i) => item(m, `Item ${i + 1}`)).join(''));

test('a lettered Word list copied from c) on starts at c., not i.', () => {
  const pasted = paste('c)', 'd)');
  assert.deepEqual(markers(pasted), ['c.', 'd.']);
  assert.equal(sanitizeRichText(pasted), pasted);
  assert.deepEqual(markers(paste('D.', 'E.')), ['D.', 'E.']);
  assert.deepEqual(markers(paste('(m)', '(n)')), ['m.', 'n.']);
});

test('a Roman Word list keeps where it starts', () => {
  assert.deepEqual(markers(paste('iv.', 'v.')), ['iv.', 'v.']);
  assert.deepEqual(markers(paste('v.', 'vi.')), ['v.', 'vi.']);
  assert.deepEqual(markers(paste('XII.', 'XIII.')), ['XII.', 'XIII.']);
  assert.deepEqual(markers(paste('i.', 'ii.')), ['i.', 'ii.']);
});

test('a Word list from its first item is unchanged', () => {
  assert.deepEqual(markers(paste('a)', 'b)')), ['a.', 'b.']);
  assert.deepEqual(markers(paste('A.', 'B.')), ['A.', 'B.']);
  assert.deepEqual(markers(paste('3.', '4.')), ['3.', '4.']);
});
