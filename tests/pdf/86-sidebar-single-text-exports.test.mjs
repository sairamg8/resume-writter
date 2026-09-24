// The Sidebar's Single · ATS-safe page and the two text exports — ATS Text and Markdown — print the
// résumé in the same order: the sections as stored (one column, no side column pulled ahead of the
// main one) and each entry's fields as the PDF leads them with the Order unset (the Sidebar's role
// first, R2-012). Every word is already covered by 65-ats-text-parity and 70-markdown-parity; this
// pins the order. Left out, as R2-060's on every template: a user-set Order (Co. / Role), and an
// education entry's, whose unset Order prints the institution before the degree in every PDF and Word
// file (Classic's too) while both text exports print the degree first — one education mark is checked.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, read, render, loadModule, resume, section, allText } from './harness.mjs';

before(setup);
after(teardown);

/** Sections in a stored order the two-column page would split: side-column ones before and between the main ones. */
const cv = () => resume({
  template: 'sidebar',
  settings: { sidebarSingleColumn: true, dateFormat: 'as-entered' },
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', summary: '<p>Summaryword here.</p>' },
  sections: [
    section('skills', [{ category: 'Toolsq', skills: 'Golangz' }]),
    section('experience', [
      { role: 'Roleone', company: 'Companyone', startDate: '01/2020', endDate: '12/2021', description: '<p>Didone.</p>' },
      { role: 'Roletwo', company: 'Companytwo', startDate: '01/2018', endDate: '12/2019', description: '<p>Didtwo.</p>' },
    ]),
    section('languages', [{ language: 'Frenchq', proficiency: 'Fluentq' }]),
    section('education', [{ degree: 'Degreeq', institution: 'Schoolq', startDate: '2013', endDate: '2017' }]),
    section('volunteering', [{ role: 'Mentorq', org: 'Clubq', startDate: '2019', endDate: '2019' }]),
  ],
});
/** Marker words, each printed once, in the order the stored résumé holds them. */
const MARKS = ['Summaryword', 'Toolsq', 'Golangz', 'Roleone', 'Companyone', 'Didone', 'Roletwo', 'Companytwo', 'Didtwo', 'Frenchq', 'Schoolq', 'Mentorq', 'Clubq'];

/** The marks in the order `text` prints them (a mark it does not print is left out). */
const orderIn = (text) => MARKS.filter((m) => text.includes(m)).sort((a, b) => text.indexOf(a) - text.indexOf(b));

describe('Sidebar Single · ATS-safe: ATS Text and Markdown print in the PDF\'s order', () => {
  it('the PDF prints every mark, sections as stored, role before company', async () => {
    const pdf = orderIn(allText(await read(await render(cv()))));
    assert.deepEqual(pdf, MARKS);
  });

  for (const [name, module, fn] of [['ATS Text', '/src/utils/atsChecker.js', 'generateAtsPlainText'], ['Markdown', '/src/utils/markdownExport.js', 'generateMarkdownResume']]) {
    it(`${name} prints them in the same order`, async () => {
      const r = cv();
      const pdf = orderIn(allText(await read(await render(r))));
      const text = (await loadModule(module))[fn](r);
      assert.deepEqual(orderIn(text), pdf, `${name}:\n${text}`);
    });
  }
});
