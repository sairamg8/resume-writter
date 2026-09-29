// R4-SW-I-01: a PDF's list items carried no depth: the PDF import kept each line's x but never set a
// nested item's level, so the parser read every item as level 0 and an award's or a certificate's
// sub-point ("– For the tapir parser", printed right of its parent) became an entry of its own. A
// marker right of an open item's, at or past where that item's text starts, is nested under it now,
// as Word's list level and Markdown's indent already say; markers at one x stay siblings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const awards = (page) => resumeFromText(pdfLinesOfPages([page])).sections.find((s) => s.type === 'awards')?.items || [];
const head = [item('Robin Vale', 40, 760, 80), item('robin.vale@example.com', 40, 746, 120), item('AWARDS', 40, 720, 50)];

test('a sub-point printed right of its award is its description, not an award of its own', () => {
  const page = [...head,
    item('•', 40, 690, 4), item('Best Paper Award – 2022', 48, 690, 130),
    item('–', 56, 676, 5), item('For the tapir parser', 64, 676, 95),
    item('•', 40, 662, 4), item('Dean List – 2021', 48, 662, 80)];
  const lines = pdfLinesOfPages([page]).filter((l) => l.text);
  assert.deepEqual(lines.slice(-3).map((l) => [l.text, l.depth || 0]), [['• Best Paper Award – 2022', 0], ['– For the tapir parser', 1], ['• Dean List – 2021', 0]]);
  const found = awards(page);
  assert.deepEqual(found.map((a) => a.title), ['Best Paper Award', 'Dean List']);
  assert.equal(found[0].description, '<ul><li>For the tapir parser</li></ul>');
});

test('as the app prints one: the nested marker where its parent\'s text starts, two levels deep', () => {
  const page = [...head,
    item('•', 40, 690, 4), item('Best Paper Award – 2022', 49, 690, 130),
    item('–', 49, 676, 5), item('For the tapir parser', 58, 676, 95),
    item('·', 58, 662, 2.8), item('Out of 300 papers', 67, 662, 90)];
  const lines = pdfLinesOfPages([page]).filter((l) => l.text);
  assert.deepEqual(lines.slice(-3).map((l) => [l.text, l.depth || 0]), [['• Best Paper Award – 2022', 0], ['– For the tapir parser', 1], ['• Out of 300 papers', 2]]);
  assert.deepEqual(awards(page).map((a) => a.title), ['Best Paper Award']);
});

test('markers at one x are siblings; a title line at the margin ends the list', () => {
  const page = [item('Robin Vale', 40, 760, 80), item('EXPERIENCE', 40, 720, 70),
    item('Acme', 40, 690, 40), item('2020 – Present', 450, 690, 80), item('Engineer', 40, 676, 60),
    item('•', 48, 650, 4), item('Built the billing service', 56, 650, 120),
    item('•', 48, 636, 4), item('Ran the on-call rota', 56, 636, 100),
    item('Globex', 40, 610, 40), item('2018 – 2020', 450, 610, 70), item('Analyst', 40, 596, 50),
    item('•', 48, 570, 4), item('Wrote the reports', 56, 570, 90)];
  const listed = pdfLinesOfPages([page]).filter((l) => l.text.startsWith('•'));
  assert.deepEqual(listed.map((l) => l.depth || 0), [0, 0, 0]);
});

test('centred items, whose x moves with their length, stay siblings', () => {
  const page = [...head,
    item('• A long award for the tapir parser 2022', 200, 690, 200),
    item('• Dean List 2021', 260, 676, 80)];
  assert.deepEqual(pdfLinesOfPages([page]).filter((l) => l.text).slice(-2).map((l) => l.depth || 0), [0, 0]);
  assert.equal(awards(page).length, 2);
});

// Right-aligned items (the editor's Align right; PdfRichText sets them as it sets centred ones, the
// marker leading the text) end at one right edge, and their x moves with their length: a shorter item
// after a longer one sits right of it, at or past where its text starts. Read as nested, every award
// after the first folded into the first one's description.
test('right-aligned items, which all end at the block\'s right edge, stay siblings', () => {
  const page = [...head,
    item('• Best Paper Award for the tapir parser – 2022', 300, 690, 240),
    item('• Dean List – 2021', 440, 676, 100),
    item('• Hackathon – 2020', 438, 662, 102)];
  assert.deepEqual(pdfLinesOfPages([page]).filter((l) => l.text).slice(-3).map((l) => l.depth || 0), [0, 0, 0]);
  assert.deepEqual(awards(page).map((a) => [a.title, a.date, a.description || '']),
    [['Best Paper Award for the tapir parser', '2022', ''], ['Dean List', '2021', ''], ['Hackathon', '2020', '']]);
});

test('an item whose wrapped first line ran to the edge (justified) still nests the sub-point under it', () => {
  const page = [...head,
    item('•', 40, 690, 4), item('Best Paper Award for the tapir parser in the year of the', 49, 690, 491),
    item('conference 2022', 49, 676, 80),
    item('–', 49, 662, 5), item('For the tapir parser and everything else in the whole world ok', 58, 662, 482)];
  assert.deepEqual(pdfLinesOfPages([page]).filter((l) => l.text).slice(-2).map((l) => l.depth || 0), [0, 1]);
});
