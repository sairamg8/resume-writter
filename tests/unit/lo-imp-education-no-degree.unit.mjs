// R4-LO-06: the exports print an education entry with no degree as its field and school, "Computer
// Science - MIT" (the ATS text; Markdown's "**Computer Science** — *MIT*"), and a degree the import does
// not know with its field, "Bootcamp, Full Stack - GA". The text import read the field as the degree
// ("Computer Science") and the unknown degree and its field as one degree ("Bootcamp, Full Stack").
// A subject alone is the field of study now, and an unknown degree's field is split off at its comma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const schools = (r) => (r.sections.find((s) => s.type === 'education')?.items || [])
  .map((e) => [e.degree, e.fieldOfStudy, e.institution]);

const text = (entries) => `Robin Sample\nrobin.sample@example.com\n\nEDUCATION\n----------\n${entries.join('\n\n')}\n`;

test('ATS text: "Computer Science - MIT" is a field of study at MIT, no degree', () => {
  assert.deepEqual(schools(resumeFromText(text(['Computer Science - MIT\n2012 - 2016']))), [['', 'Computer Science', 'MIT']]);
});

test('ATS text: "Bootcamp, Full Stack - GA" is the degree Bootcamp in Full Stack at GA', () => {
  assert.deepEqual(schools(resumeFromText(text(['Bootcamp, Full Stack - GA\n2019']))), [['Bootcamp', 'Full Stack', 'GA']]);
});

test('a known degree and the forms that worked before are unchanged', () => {
  assert.deepEqual(schools(resumeFromText(text([
    'BSc, Computer Science - MIT\n2012 - 2016',
    'MBA - Lakeside University\n2018 - 2020',
    'Lakeside University\t2013 - 2017\nB.S., Computer Science',
    'Lakeside University\t2012 - 2016\nB.F.A., Graphic Design',
  ]))), [['BSc', 'Computer Science', 'MIT'], ['MBA', '', 'Lakeside University'], ['B.S.', 'Computer Science', 'Lakeside University'],
    ['B.F.A.', 'Graphic Design', 'Lakeside University']]);
});

test('the PDF\'s order, the school first: "GA" over "Bootcamp, Full Stack", "MIT" over "Computer Science"', () => {
  assert.deepEqual(schools(resumeFromText(text(['GA\t2019\nBootcamp, Full Stack', 'MIT\t2012 – 2016\nComputer Science']))),
    [['Bootcamp', 'Full Stack', 'GA'], ['', 'Computer Science', 'MIT']]);
});

test('round trip through the ATS text and the Markdown: the fields come back where they were', () => {
  const resume = {
    personal: { name: 'Robin Sample', email: 'robin.sample@example.com' },
    sections: [{ id: 's', type: 'education', title: 'Education', visible: true, items: [
      { id: 'a', institution: 'MIT', degree: '', fieldOfStudy: 'Computer Science', startDate: '2012', endDate: '2016' },
      { id: 'b', institution: 'GA', degree: 'Bootcamp', fieldOfStudy: 'Full Stack', startDate: '2019', endDate: '2019' },
    ] }],
  };
  const want = [['', 'Computer Science', 'MIT'], ['Bootcamp', 'Full Stack', 'GA']];
  const ats = generateAtsPlainText(resume);
  assert.deepEqual(schools(resumeFromText(ats)), want, ats);
  const md = generateMarkdownResume(resume);
  assert.deepEqual(schools(resumeFromText(markdownLines(md))), want, md);
});
