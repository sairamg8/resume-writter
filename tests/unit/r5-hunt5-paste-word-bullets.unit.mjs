// R5-HUNT5-PASTE-WORD-BULLETS-BECOME-MIDDOT-PARAGRAPHS: Word for desktop puts a list on the clipboard
// as <p style="mso-list:l0 level1 lfo1"> paragraphs, with the marker ('·' in Symbol, then &nbsp;s) as
// text inside <![if !supportLists]>…<![endif]>. The parser kept that marker and nothing read mso-list,
// so a pasted Word list was stored as paragraphs starting with '·' — no list in the PDF, Word export,
// Design → Lists or the ATS bullets. It now becomes <ul>/<ol> items, nested by the mso-list level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText, sanitizeForInsert, parseRichText } from '../../src/utils/richText.js';
import { extractBulletsFromItem } from '../../src/utils/atsChecker.js';

const item = (cls, level, list, marker, font, text) => `<p class=${cls} style='text-indent:-.25in;mso-list:${list} level${level} lfo1'>`
  + `<![if !supportLists]><span style='font-family:${font}'><span style='mso-list:Ignore'>${marker}`
  + `<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>`
  + `${text}<o:p></o:p></p>\r\n`;

const BULLETS = '<html><body lang=EN-US><!--StartFragment-->'
  + item('MsoListParagraphCxSpFirst', 1, 'l0', '·', 'Symbol', 'Led migration of 40 services')
  + item('MsoListParagraphCxSpMiddle', 2, 'l0', 'o', '"Courier New"', 'Across 3 regions')
  + item('MsoListParagraphCxSpLast', 1, 'l0', '·', 'Symbol', 'Cut costs 30%')
  + '<p class=MsoNormal>After the list<o:p></o:p></p><!--EndFragment--></body></html>';

test('a bulleted list pasted from Word becomes a nested <ul> without the Symbol marker', () => {
  assert.equal(sanitizeForInsert(BULLETS),
    '<ul><li>Led migration of 40 services<ul><li>Across 3 regions</li></ul></li><li>Cut costs 30%</li></ul><p>After the list</p>');
  const blocks = parseRichText(BULLETS);
  assert.deepEqual(blocks.map((b) => b.marker), ['•', '–', '•', null]);
  assert.deepEqual(extractBulletsFromItem({ description: sanitizeRichText(BULLETS) }).slice(0, 1), ['Led migration of 40 services']);
});

test('a numbered list pasted from Word becomes an <ol>, in the older comment form too', () => {
  const numbered = item('MsoListParagraphCxSpFirst', 1, 'l1', '1.', 'Calibri', 'First')
    + item('MsoListParagraphCxSpLast', 1, 'l1', '2.', 'Calibri', 'Second');
  assert.equal(sanitizeRichText(numbered), '<ol><li>First</li><li>Second</li></ol>');
  const comments = numbered.replace(/<!\[if !supportLists\]>/g, '<!--[if !supportLists]-->').replace(/<!\[endif\]>/g, '<!--[endif]-->');
  assert.equal(sanitizeRichText(comments), '<ol><li>First</li><li>Second</li></ol>');
});

test('a Word paragraph without mso-list stays a paragraph', () => {
  assert.equal(sanitizeRichText('<p class=MsoListParagraph>Plain<o:p></o:p></p>'), '<p>Plain</p>');
});
