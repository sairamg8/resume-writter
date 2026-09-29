// R5-HUNT7-DOCX-TABLE-ROW-CELLS: many Word résumé templates set each entry's header in a borderless
// two-column table ("Acme Corp" | "Jan 2020 – Present", "Software Engineer" | "Austin, TX"). The Word
// import read each cell as a line of its own, so the city went into the description, the next job took
// this one's company, and a school came in as the degree with no institution. A row whose cells hold a
// line apiece is one line now, its cells joined by tabs (the line a tab or a PDF's baseline gives); a
// row with a cell of several lines (a layout table's columns) is still read a line each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docxXmlLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const para = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const item = (text) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (...paras) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${paras.join('')}</w:tc>`;
const row = (...cells) => `<w:tr><w:trPr/>${cells.join('')}</w:tr>`;
const table = (...rows) => `<w:tbl><w:tblPr><w:tblBorders/></w:tblPr><w:tblGrid><w:gridCol/><w:gridCol/></w:tblGrid>${rows.join('')}</w:tbl>`;
const header = (a, b, c, d) => table(row(cell(para(a)), cell(para(b))), row(cell(para(c)), cell(para(d))));

const XML = '<w:document><w:body>'
  + para('Jane Doe', 'Title')
  + para('jane@example.com')
  + para('Experience', 'Heading1')
  + header('Acme Corp', 'Jan 2020 – Present', 'Software Engineer', 'Austin, TX')
  + item('Built things')
  + header('Globex', 'Feb 2017 – Dec 2019', 'Data Analyst', 'Remote')
  + item('Did stuff')
  + para('Education', 'Heading1')
  + table(row(cell(para('MIT')), cell(para('2013 – 2017'))))
  + para('BS Computer Science')
  + '<w:sectPr/></w:body></w:document>';

test('a table row of one line a cell reads as one line, its cells joined by tabs', () => {
  const texts = docxXmlLines(XML).map((l) => l.text).filter(Boolean);
  assert.deepEqual(texts.slice(3, 6), ['Acme Corp\tJan 2020 – Present', 'Software Engineer\tAustin, TX', '• Built things']);
  assert.ok(texts.includes('MIT\t2013 – 2017'));
});

test('each job keeps its own company, role, dates and place; the school is the institution', () => {
  const r = resumeFromText(docxXmlLines(XML));
  const jobs = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.location, j.startDate]), [
    ['Acme Corp', 'Software Engineer', 'Austin, TX', 'Jan 2020'],
    ['Globex', 'Data Analyst', 'Remote', 'Feb 2017'],
  ]);
  for (const j of jobs) assert.doesNotMatch(j.description, /Austin|Remote|Globex/);
  const [school] = r.sections.find((s) => s.type === 'education').items;
  assert.equal(school.institution, 'MIT');
  assert.equal(school.degree, 'BS Computer Science');
});

test('a row with a cell of several lines, or a list item, is still read a line a paragraph', () => {
  const dated = row(cell(para('Acme Corp')), cell(para('2019 – 2021')));
  const layout = `<w:body>${table(dated, row(cell(para('SKILLS'), para('Figma')), cell(para('EXPERIENCE'))))}</w:body>`;
  assert.deepEqual(docxXmlLines(layout).map((l) => l.text), ['Acme Corp\t2019 – 2021', 'SKILLS', 'Figma', 'EXPERIENCE']);
  const listed = `<w:body>${table(dated, row(cell(item('One')), cell(para('Two'))))}</w:body>`;
  assert.deepEqual(docxXmlLines(listed).map((l) => l.text), ['Acme Corp\t2019 – 2021', '• One', 'Two']);
});

test('a grid with no date in it (skills, certificates a cell each) is still read a line a cell', () => {
  const grid = `<w:body>${para('Certifications', 'Heading1')}${table(row(cell(para('AWS Architect')), cell(para('CKA'))), row(cell(para('PMP')), cell(para('Scrum Master'))))}</w:body>`;
  assert.deepEqual(docxXmlLines(grid).map((l) => l.text), ['Certifications', 'AWS Architect', 'CKA', 'PMP', 'Scrum Master']);
});

test('an empty cell is passed over, and a heading in the first cell stays a heading', () => {
  const xml = `<w:body>${table(row(cell(para('Experience', 'Heading1')), cell('<w:p/>')))}${table(row(cell(para('Projects', 'Heading1')), cell(para('2021'))))}</w:body>`;
  const lines = docxXmlLines(xml);
  assert.deepEqual(lines.map((l) => [l.text, l.hint]), [['Experience', 'heading'], ['Projects\t2021', 'heading']]);
});
