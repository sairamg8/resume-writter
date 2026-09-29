// R4-SW-I-02: Word's built-in list styles (List Bullet, List Bullet 2, List Number …) keep their
// numbering in styles.xml, so a paragraph in one holds only <w:pStyle w:val="ListBullet2"/>. The Word
// import read a paragraph as a list item only by its own <w:numPr>, and its level only by its own
// <w:ilvl>: a style-only item was a plain line, and a List Bullet 2 sub-point a top-level item — an
// award of its own. A built-in list style is a list item now, at its style's level unless the
// paragraph names one; List Paragraph, which numbers nothing, is one only with a numPr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { docxXmlLines } from '../../src/utils/importFile.js';

const p = (text, props = '') => `<w:p><w:pPr>${props}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const style = (id) => `<w:pStyle w:val="${id}"/>`;
const num = (lvl) => `<w:numPr>${lvl === undefined ? '' : `<w:ilvl w:val="${lvl}"/>`}<w:numId w:val="3"/></w:numPr>`;
const doc = (...paras) => `<w:document><w:body>${paras.join('')}</w:body></w:document>`;

test('a style-only List Bullet is a list item at level 0, List Bullet 2 at level 1', () => {
  const lines = docxXmlLines(doc(
    p('Top', style('ListBullet')),
    p('Sub', style('ListBullet2')),
    p('Sub2', style('ListBullet2') + num()),
    p('Third', style('ListNumber3')),
  ));
  assert.deepEqual(lines.map((l) => [l.text, l.depth || 0]), [['• Top', 0], ['• Sub', 1], ['• Sub2', 1], ['• Third', 2]]);
});

test('a direct w:ilvl wins over the style\'s level', () => {
  const [line] = docxXmlLines(doc(p('Deep', style('ListBullet2') + num(3))));
  assert.deepEqual([line.text, line.depth], ['• Deep', 3]);
});

test('List Paragraph with no numPr, and a plain style, stay plain lines', () => {
  const lines = docxXmlLines(doc(p('Intro', style('ListParagraph')), p('Body', style('Normal')), p('Item', style('ListParagraph') + num(0))));
  assert.deepEqual(lines.map((l) => [l.text, l.depth || 0]), [['Intro', 0], ['Body', 0], ['• Item', 0]]);
});

test('an award\'s List Bullet 2 sub-point stays its description', () => {
  const xml = doc(p('Robin Vale'), p('AWARDS'),
    p('Best Paper Award – 2021', style('ListBullet')), p('For the tapir parser', style('ListBullet2')),
    p('Dean&apos;s List – 2019', style('ListBullet')));
  const awards = resumeFromText(docxXmlLines(xml)).sections.find((s) => s.type === 'awards')?.items || [];
  assert.deepEqual(awards.map((a) => a.title), ['Best Paper Award', 'Dean\'s List']);
  assert.equal(awards[0].description, '<ul><li>For the tapir parser</li></ul>');
});
