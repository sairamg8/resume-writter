// R2-148: the PDF import reads a two-column page a column at a time. pdf.js gives a page's text as
// items with their place; grouped by baseline across the whole width, a side column beside a main
// one came back interleaved line by line. Now a gutter no line crosses splits a run of lines that
// really is two columns — each side with lines of its own, one after another — and the left column
// is read first, then the right. One column with fields at the right margin (a date, a location
// under it, two contacts, a grid's two cells) is still read line by line. Also: the name and the job
// title set on one line in two sizes are two fields, and a language's level set apart from it is
// its level. The round trip through the Sidebar and Compact templates: tests/pdf/99-import-roundtrip-columns.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLinesOfPages, pdfPageLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const texts = (pages) => pdfLinesOfPages(pages).map((l) => l.text).filter(Boolean);

// A fictional person on a two-column page: a side column at x 40 (to 190), a main one at x 230
// (to 550). No baseline of one column is on a baseline of the other.
const SIDE = [
  item('Robin Vale', 40, 800, 110, 18), item('Product Designer', 40, 780, 90),
  item('CONTACT', 40, 750, 45), item('robin@example.org', 40, 735, 95), item('+1 555 0100', 40, 720, 60),
  item('SKILLS', 40, 690, 35), item('Figma, Sketch', 40, 675, 70),
  item('LANGUAGES', 40, 650, 55), item('English: Native', 40, 635, 80),
];
const MAIN = [
  item('PROFILE', 230, 795, 45, 11),
  item('I design calm tools for people who work with data all day, and', 230, 772, 320, 11),
  item('ships them.', 230, 757, 55, 11),
  item('EXPERIENCE', 230, 727, 65, 11),
  item('Lead Designer', 230, 709, 70, 11), item('Mar 2021 – Present', 470, 709, 80, 11),
  item('Fabrikam Studio', 230, 695, 80, 11),
  item('• Shipped the new editor.', 230, 681, 120, 11),
];

describe('a two-column PDF page reads a column at a time', () => {
  test('the side column, then the main one; a paragraph wrapped in its column joined back', () => {
    assert.deepEqual(texts([[...SIDE, ...MAIN]]), [
      'Robin Vale', 'Product Designer', 'CONTACT', 'robin@example.org', '+1 555 0100', 'SKILLS', 'Figma, Sketch',
      'LANGUAGES', 'English: Native',
      'PROFILE', 'I design calm tools for people who work with data all day, and ships them.', 'EXPERIENCE',
      'Lead Designer\tMar 2021 – Present', 'Fabrikam Studio', '• Shipped the new editor.',
    ], 'before: "Robin Vale\\tPROFILE", "Product Designer", "I design calm tools …", …, line by line across both columns');
  });

  test('read into a résumé: the name, the job title, the contacts, the summary and the job', () => {
    const r = resumeFromText(pdfLinesOfPages([[...SIDE, ...MAIN]]));
    assert.deepEqual([r.personal.name, r.personal.title, r.personal.email, r.personal.phone], ['Robin Vale', 'Product Designer', 'robin@example.org', '+1 555 0100']);
    assert.equal(r.personal.summary, '<p>I design calm tools for people who work with data all day, and ships them.</p>');
    assert.deepEqual(r.sections.map((s) => s.type), ['skills', 'languages', 'experience']);
    const [job] = r.sections[2].items;
    assert.deepEqual([job.role, job.company, job.startDate, job.current], ['Lead Designer', 'Fabrikam Studio', 'Mar 2021', true]);
  });

  test('a full-width header over the two columns is read first, across the page', () => {
    const header = [item('Robin Vale — Product Designer', 40, 830, 400, 18)];
    const side = SIDE.slice(2); // the name and title now in the header
    assert.deepEqual(texts([[...header, ...side, ...MAIN]]).slice(0, 3), ['Robin Vale — Product Designer', 'CONTACT', 'robin@example.org']);
    assert.equal(texts([[...header, ...side, ...MAIN]])[side.length + 1], 'PROFILE');
  });
});

describe('one column with fields at the right margin stays line by line', () => {
  test('a date at the right of each entry\'s title line', () => {
    const page = [];
    ['Northwind Analytics', 'Contoso Freight', 'Fabrikam Studio'].forEach((company, k) => {
      const y = 760 - k * 60;
      page.push(item(company, 40, y, 100), item(`Jan 20${10 + k} – Dec 20${11 + k}`, 470, y, 85));
      page.push(item('Engineer', 40, y - 13, 45), item('Portland, OR', 490, y - 13, 60));
      page.push(item('•', 44, y - 26, 4), item('Built things.', 56, y - 26, 60));
    });
    assert.deepEqual(texts([page]), [
      'Northwind Analytics\tJan 2010 – Dec 2011', 'Engineer\tPortland, OR', '• Built things.',
      'Contoso Freight\tJan 2011 – Dec 2012', 'Engineer\tPortland, OR', '• Built things.',
      'Fabrikam Studio\tJan 2012 – Dec 2013', 'Engineer\tPortland, OR', '• Built things.',
    ]);
  });

  test('a location alone under each date, at the right (Executive\'s layout), is not a column', () => {
    const page = [];
    ['Northwind Analytics', 'Contoso Freight', 'Fabrikam Studio'].forEach((company, k) => {
      const y = 760 - k * 60;
      page.push(item(`Engineer, ${company}`, 40, y, 160), item(`Jan 20${10 + k} – Dec 20${11 + k}`, 470, y, 85));
      page.push(item('Portland, OR', 495, y - 15, 60));
      page.push(item('• Built the thing that everyone uses.', 40, y - 30, 200));
      page.push(item('• Kept it running.', 40, y - 44, 100));
    });
    assert.deepEqual(texts([page]).slice(0, 4), ['Engineer, Northwind Analytics\tJan 2010 – Dec 2011', 'Portland, OR', '• Built the thing that everyone uses.', '• Kept it running.']);
    assert.equal(texts([page])[4], 'Engineer, Contoso Freight\tJan 2011 – Dec 2012');
  });

  test('two contacts and a grid\'s two cells on a line stay one line of fields', () => {
    const page = [
      item('Avery Quinn', 40, 800, 120, 18),
      item('avery@example.com', 40, 780, 90), item('+1 555 0142', 300, 780, 60),
      item('LANGUAGES', 40, 750, 60),
      item('English', 40, 735, 35), item('Native', 90, 735, 32), item('Spanish', 300, 735, 38), item('Professional', 350, 735, 55),
      item('German', 40, 720, 35), item('Basic', 90, 720, 28), item('French', 300, 720, 34), item('Conversational', 350, 720, 70),
      item('Italian', 40, 705, 32), item('Basic', 90, 705, 28), item('Dutch', 300, 705, 28), item('Basic', 350, 705, 28),
    ];
    assert.deepEqual(texts([page]), ['Avery Quinn', 'avery@example.com\t+1 555 0142', 'LANGUAGES',
      'English\tNative\tSpanish\tProfessional', 'German\tBasic\tFrench\tConversational', 'Italian\tBasic\tDutch\tBasic']);
    const r = resumeFromText(pdfLinesOfPages([page]));
    assert.deepEqual(r.sections[0].items.map((i) => [i.language, i.proficiency]), [
      ['English', 'Native'], ['Spanish', 'Professional'], ['German', 'Basic'], ['French', 'Conversational'], ['Italian', 'Basic'], ['Dutch', 'Basic'],
    ], 'before: each level read as a language of its own');
  });
});

test('the name and the job title on one line in two sizes (Compact\'s Inline layout) are two fields', () => {
  const line = [item('Avery Quinn', 34, 795, 105, 17), item('Senior Data Engineer', 145, 795, 91, 9)];
  assert.deepEqual(pdfPageLines(line).map((l) => l.text), ['Avery Quinn\tSenior Data Engineer'], 'before: "Avery Quinn Senior Data Engineer"');
  const r = resumeFromText([...pdfPageLines(line), { text: 'avery@example.com' }]);
  assert.deepEqual([r.personal.name, r.personal.title, r.personal.email], ['Avery Quinn', 'Senior Data Engineer', 'avery@example.com']);
  // A word gap in one size stays a space.
  assert.deepEqual(pdfPageLines([item('Senior', 40, 700, 38), item('Data', 81, 700, 26)]).map((l) => l.text), ['Senior Data']);
});
