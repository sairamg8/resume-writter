// R5-HUNT6-ROLE-FIRST-SECTION: the Markdown and ATS-text exports of a role-first résumé (Sidebar,
// Executive and Timeline by default, or Design's Order) print "Sous Chef — Chez Panisse". The import
// read each job's order on its own, and with no role word on either side it always took the company
// first: every such job came back with its role and company swapped. The order the section's other
// jobs show (a role word on one side) now decides it for those.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const job = (id, company, role, start, end) => ({ id, company, role, location: '', startDate: start, endDate: end, current: false, description: '<ul><li>Served guests.</li></ul>' });
const resume = (template) => ({
  template,
  personal: { name: 'Robin Vale', email: 'robin.vale@example.com' },
  sections: [{
    id: 's1', type: 'experience', title: 'Experience', settings: {},
    items: [
      job('e1', 'Nopa', 'Kitchen Manager', 'Mar 2021', 'Jun 2023'),
      job('e2', 'Chez Panisse', 'Sous Chef', 'Jan 2019', 'Feb 2021'),
      job('e3', 'Blue Bottle', 'Barista', 'May 2017', 'Dec 2018'),
    ],
  }],
});
const WANT = [['Nopa', 'Kitchen Manager'], ['Chez Panisse', 'Sous Chef'], ['Blue Bottle', 'Barista']];
const pairs = (r) => r.sections.find((s) => s.type === 'experience').items.map((j) => [j.company, j.role]);

for (const template of ['sidebar', 'executive', 'timeline']) {
  test(`${template}: the Markdown export comes back with each role and company in place`, () => {
    const md = generateMarkdownResume(resume(template));
    assert.match(md, /\*\*Sous Chef\*\*/, 'the export leads with the role');
    assert.deepEqual(pairs(resumeFromText(markdownLines(md))), WANT, md);
  });

  test(`${template}: the ATS text comes back with each role and company in place`, () => {
    const text = generateAtsPlainText(resume(template));
    assert.match(text, /Sous Chef - Chez Panisse/, 'the export leads with the role');
    assert.deepEqual(pairs(resumeFromText(text)), WANT, text);
  });
}

test('classic: a company-first export still reads company first', () => {
  const md = generateMarkdownResume(resume('classic'));
  assert.deepEqual(pairs(resumeFromText(markdownLines(md))), WANT, md);
  assert.deepEqual(pairs(resumeFromText(generateAtsPlainText(resume('classic')))), WANT);
});
