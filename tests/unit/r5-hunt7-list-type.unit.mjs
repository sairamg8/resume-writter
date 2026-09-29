// R5-HUNT7-LIST-TYPE: a lettered or Roman-numbered list (a., b. / i., ii. / A. / I.) turned into 1., 2.
// when pasted, and when an imported description was edited. parseRichText read the list type, but
// sanitizeRichText (every paste, and every value the editor adopts, then stores on the next keystroke)
// wrote each list back as a bare <ol>, with a start only when the marker was a number. It now writes
// type= and the list's start, so the preview, PDF, Word, Markdown and ATS text keep 'a.' / 'i.'. Two
// numbered lists side by side also stay two lists: the second no longer carries on the first's count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText, sanitizeForInsert, parseRichText, richTextToPlain } from '../../src/utils/richText.js';

const markers = (html) => parseRichText(html).map((b) => b.marker);

test('an imported <ol type="a"> keeps its letters once the editor stores it', () => {
  const stored = sanitizeRichText('<ol type="a"><li>x</li><li>y</li></ol>');
  assert.equal(stored, '<ol type="a"><li>x</li><li>y</li></ol>');
  assert.deepEqual(markers(stored), ['a.', 'b.']);
  assert.equal(richTextToPlain(stored), 'a. x\nb. y');
});

test('i., I., A. lists and a lettered list starting at c. keep their numbering', () => {
  assert.deepEqual(markers(sanitizeRichText('<ol type="i"><li>x</li><li>y</li></ol>')), ['i.', 'ii.']);
  assert.deepEqual(markers(sanitizeRichText('<ol type="I"><li>x</li><li>y</li></ol>')), ['I.', 'II.']);
  assert.deepEqual(markers(sanitizeRichText('<ol style="list-style-type: upper-alpha"><li>x</li></ol>')), ['A.']);
  const c = sanitizeRichText('<ol type="a" start="3"><li>x</li><li>y</li></ol>');
  assert.equal(c, '<ol type="a" start="3"><li>x</li><li>y</li></ol>');
  assert.deepEqual(markers(c), ['c.', 'd.']);
  assert.deepEqual(markers(sanitizeRichText('<ol><li>a<ol type="a"><li>b</li><li>c</li></ol></li></ol>')), ['1.', 'a.', 'b.']);
});

test('a lettered list pasted from Word for desktop stays lettered', () => {
  const item = (marker, text) => "<p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>"
    + `<![if !supportLists]><span><span style='mso-list:Ignore'>${marker}<span>&nbsp;&nbsp; </span></span></span><![endif]>${text}<o:p></o:p></p>`;
  const pasted = sanitizeForInsert(item('a)', 'Led the migration') + item('b)', 'Cut costs 30%'));
  assert.deepEqual(markers(pasted), ['a.', 'b.']);
});

test('two numbered lists side by side keep their own numbering', () => {
  const stored = sanitizeRichText('<ol><li>one</li><li>two</li></ol><ol><li>again</li></ol>');
  assert.equal(stored, '<ol><li>one</li><li>two</li></ol><ol><li>again</li></ol>');
  assert.deepEqual(markers(stored), ['1.', '2.', '1.']);
});

test('the stored HTML is stable', () => {
  for (const html of ['<ol type="a"><li>x</li></ol>', '<ol type="I" start="4"><li>x</li></ol><ol><li>y</li></ol>']) {
    const once = sanitizeRichText(html);
    assert.equal(sanitizeRichText(once), once, html);
  }
});
