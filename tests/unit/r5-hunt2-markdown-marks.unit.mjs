// R5-HUNT2-md-export-drops-rich-text-marks: the Markdown export (Export → Markdown (.md)) keeps the
// bold, italics and strike-through the PDF and the Word export draw. Every run was written as its text
// alone, so "I <strong>led</strong> a <em>team</em>" printed "I led a team" and a bullet's bold "40%"
// came out plain. Now bold prints "**…**", italics "*…*" and strike-through GFM's "~~…~~", each mark
// next to the text it marks (never a space), and the app's Markdown import reads the text back without
// them. Underline has no Markdown of its own and is left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { markdownLines } from '../../src/utils/importText.js';

const md = (summary, description = '') => generateMarkdownResume({
  personal: { name: 'Robin Sample', summary },
  sections: [{ id: 's', type: 'experience', title: 'Experience', visible: true,
    items: [{ id: 'e', company: 'Acme', role: 'Dev', description }] }],
});

test('the summary keeps its bold and italics', () => {
  const out = md('<p>I <strong>led</strong> a <em>team</em></p>');
  assert.ok(out.includes('## Professional Summary\nI **led** a *team*\n'), out);
});

test('a bullet keeps its bold, and a struck word its strike-through', () => {
  const out = md('', '<ul><li>Cut costs <strong>40%</strong></li></ul><p>Moved from <s>Java</s> to Go</p>');
  assert.ok(out.includes('- Cut costs **40%**\n'), out);
  assert.ok(out.includes('Moved from ~~Java~~ to Go'), out);
});

test('a mark never sits next to a space, and one shared by two runs stays open across them', () => {
  const out = md('<p>A<b> spaced </b>word, <b>Bold <i>both</i></b> end, <u>under</u> line</p>');
  assert.ok(out.includes('A **spaced** word, **Bold *both*** end, under line'), out);
});

test('a line break inside a bold run closes and reopens its mark on each line', () => {
  const out = md('<p><strong>one<br>two</strong></p>');
  assert.ok(out.includes('**one**  \n**two**'), out);
});

test('a bold link keeps its link inside the mark', () => {
  const out = md('<p>See <strong><a href="https://ex.com">site</a></strong></p>');
  assert.ok(out.includes('See **[site](https://ex.com)**'), out);
});

test('the .md reads back through the Markdown import as the words, marks off', () => {
  const out = md('<p>I <strong>led</strong> a <em>team</em></p>', '<ul><li>Cut costs <strong>40%</strong></li></ul><p>Moved from <s>Java</s> to Go</p>');
  const texts = markdownLines(out).map((l) => l.text);
  assert.ok(texts.includes('I led a team'), texts.join(' | '));
  assert.ok(texts.includes('• Cut costs 40%'), texts.join(' | '));
  assert.ok(texts.includes('Moved from Java to Go'), texts.join(' | '));
});
