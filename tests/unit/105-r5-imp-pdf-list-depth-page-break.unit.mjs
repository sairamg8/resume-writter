// IMP-REV-5 (R4-SW-I-01 review): the PDF import's list depth started afresh on every page, so an
// award's sub-point that the page break put atop the next page ("– For the tapir parser") was read as
// level 0 and became an award of its own — the defect R4-SW-I-01 fixed on one page. The items open
// where a page ends, set in one block across it, stay open at the top of the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const head = [item('Robin Vale', 40, 760, 80), item('robin.vale@example.com', 40, 746, 120), item('AWARDS', 40, 720, 50)];
const pages = [
  [...head, item('•', 40, 60, 4), item('Best Paper Award – 2022', 49, 60, 130)],
  [item('–', 49, 780, 5), item('For the tapir parser', 58, 780, 95), item('•', 40, 766, 4), item('Dean List – 2021', 49, 766, 80)],
];

test('a sub-point atop the next page nests under the award the last page ended with', () => {
  const lines = pdfLinesOfPages(pages).filter((l) => l.text);
  assert.deepEqual(lines.slice(-3).map((l) => [l.text, l.depth || 0]), [['• Best Paper Award – 2022', 0], ['– For the tapir parser', 1], ['• Dean List – 2021', 0]]);
  const awards = resumeFromText(pdfLinesOfPages(pages)).sections.find((s) => s.type === 'awards')?.items || [];
  assert.deepEqual(awards.map((a) => a.title), ['Best Paper Award', 'Dean List']);
  assert.match(awards[0].description, /For the tapir parser/);
});

test('a list atop a page at the last page\'s marker x is siblings, as on one page', () => {
  const next = [[...head, item('•', 40, 60, 4), item('Best Paper Award – 2022', 49, 60, 130)],
    [item('•', 40, 780, 4), item('Dean List – 2021', 49, 780, 80)]];
  assert.deepEqual(pdfLinesOfPages(next).filter((l) => l.text).slice(-2).map((l) => l.depth || 0), [0, 0]);
});
