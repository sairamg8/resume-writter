// R5-IMP-02: the Markdown export writes an entry heading as "**primary** — *secondary*", and a dash the
// user typed inside a field ("Deloitte - Consulting") is left as typed. The import took the marks off
// and split the heading at every " - " and " — ": three fields, so the company lost "- Consulting", the
// role became "Consulting" and the real role "Engineer" led the description. The bold and italic runs
// show where each field ends: each comes back whole. A heading with no such marks splits as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const fromMd = (md) => resumeFromText(markdownLines(md));
const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('"**Deloitte - Consulting** — *Engineer*": the company and the role as typed, nothing in the description', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### **Deloitte - Consulting** — *Engineer*\n*Mar 2021 – Present | Leeds*\n\n- Built it.\n');
  const [job] = items(r, 'experience');
  assert.deepEqual([job.company, job.role, job.location], ['Deloitte - Consulting', 'Engineer', 'Leeds']);
  assert.equal(job.description, '<ul><li>Built it.</li></ul>');
});

test('a dash in the italic part, or in a bold part alone, stays in its field', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### **Acme** — *Engineer — Backend*\n*2020 – 2021*\n\n### **Globex – East**\n*2019*\n');
  const [a, b] = items(r, 'experience');
  assert.deepEqual([a.company, a.role, a.description || ''], ['Acme', 'Engineer — Backend', '']);
  assert.deepEqual([b.company, b.role, b.description || ''], ['Globex – East', '', '']);
});

test('a heading without the export\'s marks is split at its dashes as before', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### Northwind — Engineer\n*2020 – 2021*\n');
  const [job] = items(r, 'experience');
  assert.deepEqual([job.company, job.role], ['Northwind', 'Engineer']);
});

test('the export\'s own Markdown round-trips a dash in a company, a role, a degree and a grouped employer', () => {
  const md = generateMarkdownResume({
    personal: { name: 'Pat Sample' },
    sections: [
      { id: 's1', type: 'experience', title: 'Experience', settings: {}, items: [
        { id: 'e1', company: 'Deloitte - Consulting', role: 'Engineer', startDate: 'Mar 2021', current: true, description: '<p>Built it.</p>' },
        { id: 'e2', company: 'Acme', role: 'Engineer — Backend', startDate: 'Jan 2019', endDate: 'Feb 2021', description: '' },
      ] },
      { id: 's2', type: 'education', title: 'Education', settings: {}, items: [
        { id: 'd1', degree: 'B.S. - Honors', fieldOfStudy: '', institution: 'MIT', startDate: '2015', endDate: '2019' },
      ] },
    ],
  });
  const r = fromMd(md);
  const [a, b] = items(r, 'experience');
  assert.deepEqual([a.company, a.role, a.description], ['Deloitte - Consulting', 'Engineer', '<p>Built it.</p>'], md);
  assert.deepEqual([b.company, b.role, b.description || ''], ['Acme', 'Engineer — Backend', ''], md);
  const [school] = items(r, 'education');
  assert.deepEqual([school.degree, school.institution], ['B.S. - Honors', 'MIT'], md);
});

test('"Group roles by company": an employer with a dash is still the group\'s company', () => {
  const r = fromMd('# Pat Sample\n\n## Experience\n### **Deloitte - Consulting**\n*Portland, OR*\n\n#### **Senior Engineer**\n*2022 – Present*\n\n#### **Engineer**\n*2020 – 2022*\n');
  assert.deepEqual(items(r, 'experience').map((j) => [j.company, j.role]), [
    ['Deloitte - Consulting', 'Senior Engineer'], ['Deloitte - Consulting', 'Engineer'],
  ]);
});

// A heading wholly bold or italic is the export's single field only where the file shows it is the
// export's (its entry headings in "**primary** — *secondary*", or a grouped employer or role). A
// hand-written or AI-written "### **Software Engineer — Google**" holds role and company in one run,
// and is split at its dash as before; keeping it whole left the company empty.
test('a hand-written heading wholly in bold or italics is still split at its dash', () => {
  const at = (heading) => items(fromMd(`# Robin Vale\n\n## Experience\n\n### ${heading}\n*Jan 2020 – Present*\n\n- Built things\n`), 'experience')[0];
  const a = at('**Software Engineer — Google**');
  assert.deepEqual([a.company, a.role, a.description], ['Google', 'Software Engineer', '<ul><li>Built things</li></ul>']);
  assert.deepEqual(['**Acme - Senior Engineer**', '*Acme – Engineer*'].map((h) => [at(h).company, at(h).role]),
    [['Acme', 'Senior Engineer'], ['Acme', 'Engineer']]);
});
