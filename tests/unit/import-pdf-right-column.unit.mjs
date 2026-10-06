// The PDF import on a Sidebar page whose side column is on the right (Design → Layout → Details Right):
// the main column is at the left, so it was read first — its summary, its jobs — and the side column's
// name, contacts and short sections after them; the résumé took its first line for its name. The name
// is set far larger than any heading or entry and heads the right column, so a run of two columns that
// starts the page is read right column first when the right one holds the larger text. A right column
// with no larger text (a grid, a page of two equal columns) is still read after the left one.
// The round trip through the app's own PDF: tests/pdf/99-import-roundtrip-right-sidebar.test.mjs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const texts = (pages) => pdfLinesOfPages(pages).map((l) => l.text).filter(Boolean);

// A fictional person: the main column at x 40 (to 360), the side column at x 400 (to 555). No baseline
// of one column is on a baseline of the other.
const SIDE = [
  item('Robin Vale', 400, 800, 110, 18), item('Product Designer', 400, 780, 90),
  item('CONTACT', 400, 750, 45), item('robin@example.org', 400, 735, 95), item('+1 555 0100', 400, 720, 60),
  item('SKILLS', 400, 690, 35), item('Figma, Sketch', 400, 675, 70),
  item('LANGUAGES', 400, 650, 55), item('English: Native', 400, 635, 80),
];
const MAIN = [
  item('PROFILE', 40, 795, 45, 11),
  item('I design calm tools for people who work with data all day, and', 40, 772, 320, 11),
  item('ships them.', 40, 757, 55, 11),
  item('EXPERIENCE', 40, 727, 65, 11),
  item('Lead Designer', 40, 709, 70, 11), item('Mar 2021 – Present', 280, 709, 80, 11),
  item('Fabrikam Studio', 40, 695, 80, 11),
  item('• Shipped the new editor.', 40, 681, 120, 11),
];

describe('a two-column PDF page whose larger text heads the right column', () => {
  test('the right column is read first, then the main one', () => {
    assert.deepEqual(texts([[...MAIN, ...SIDE]]), [
      'Robin Vale', 'Product Designer', 'CONTACT', 'robin@example.org', '+1 555 0100', 'SKILLS', 'Figma, Sketch',
      'LANGUAGES', 'English: Native',
      'PROFILE', 'I design calm tools for people who work with data all day, and ships them.', 'EXPERIENCE',
      'Lead Designer\tMar 2021 – Present', 'Fabrikam Studio', '• Shipped the new editor.',
    ], 'before: "PROFILE", the summary and the job first, "Robin Vale" after them');
  });

  test('read into a résumé: the name, the job title, the contacts, the summary and the job', () => {
    const r = resumeFromText(pdfLinesOfPages([[...MAIN, ...SIDE]]));
    assert.deepEqual([r.personal.name, r.personal.title, r.personal.email, r.personal.phone], ['Robin Vale', 'Product Designer', 'robin@example.org', '+1 555 0100']);
    assert.equal(r.personal.summary, '<p>I design calm tools for people who work with data all day, and ships them.</p>');
    assert.deepEqual(r.sections.map((s) => s.type), ['skills', 'languages', 'experience']);
    const [job] = r.sections[2].items;
    assert.deepEqual([job.role, job.company, job.startDate, job.current], ['Lead Designer', 'Fabrikam Studio', 'Mar 2021', true]);
  });

  test('the same page with the side column on the left is read as before', () => {
    const moved = (its, dx) => its.map((it) => ({ ...it, x: it.x + dx }));
    const page = [...moved(SIDE, -360), ...moved(MAIN, 190)];
    assert.deepEqual(texts([page]).slice(0, 3), ['Robin Vale', 'Product Designer', 'CONTACT']);
  });
});

describe('a right column with no larger text is read after the left one', () => {
  test('two columns of one size: the left, then the right', () => {
    const flat = SIDE.map((it) => ({ ...it, h: 11 }));
    const out = texts([[...flat, ...MAIN]]);
    assert.equal(out[0], 'PROFILE');
    assert.equal(out[out.length - 1], 'English: Native');
  });
});
