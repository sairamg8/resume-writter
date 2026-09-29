// R5-HUNT5-PASTE-WORD-BULLETS-BECOME-MIDDOT-PARAGRAPHS, review: the first fix turned every block with
// an inline mso-list into a new list item, dropped every <![if !supportLists]> marker, and read only
// the inline style. So an Outlook / Word-HTML list that is already <ol><li style="mso-list:…"> was
// wrapped in a second <ul> and printed as bullets; a "List Bullet" style paragraph (mso-list only in
// the <style> sheet) lost its bullet and became plain text; and a marker Word never closed took the
// rest of the paragraph's text with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText, parseRichText } from '../../src/utils/richText.js';

const marker = (m, font = 'Symbol') => `<![if !supportLists]><span style='font-family:${font}'><span style='mso-list:Ignore'>${m}`
  + `<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>`;

test('an Outlook list already in <ol><li style="mso-list:…"> stays one numbered list', () => {
  const html = "<ol style='margin-top:0in' start=1 type=1><li class=MsoListParagraph style='margin-left:0in;mso-list:l0 level1 lfo1'>One<o:p></o:p></li>"
    + "<li class=MsoListParagraph style='margin-left:0in;mso-list:l0 level1 lfo1'>Two<o:p></o:p></li></ol>";
  assert.equal(sanitizeRichText(html), '<ol><li>One</li><li>Two</li></ol>');
  assert.deepEqual(parseRichText(html).map((b) => [b.marker, b.indent]), [['1.', 1], ['2.', 1]]);
});

test('a "List Bullet" style paragraph (mso-list in the style sheet only) keeps its bullet', () => {
  const html = '<style>p.MsoListBullet{mso-list:l0 level1 lfo1}</style>'
    + `<p class=MsoListBullet>${marker('·')}One<o:p></o:p></p>\r\n<p class=MsoListBullet2>${marker('o', '"Courier New"')}Sub<o:p></o:p></p>\r\n`
    + `<p class=MsoListNumber>${marker('1.', 'Calibri')}First<o:p></o:p></p>`;
  assert.equal(sanitizeRichText(html), '<ul><li>One<ul><li>Sub</li></ul></li></ul><ol><li>First</li></ol>');
});

test('a list marker Word never closed does not swallow the text after it', () => {
  const html = "<p style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>·</span> Led the migration</p><p>More</p>";
  assert.match(sanitizeRichText(html), /Led the migration/);
});
