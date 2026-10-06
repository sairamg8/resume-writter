// R2-148-c settled at HEAD (50b95664 re-landed it): a PDF of an Executive or a Timeline résumé imports
// every job's company, role, location and dates. 99-import-roundtrip-entry-layouts pins two jobs; this
// pins three, the oldest at a company with a comma of its own ("Tailspin Toys, Inc.") and a place with
// a region ("Austin, TX"): Executive prints "Role, Company" as one line, split at the comma that has a
// job title's word on one side only, so the company's own comma must not cut it. Each résumé is
// exported by the app's own react-pdf code and read back by the import's pdf.js reader, with Classic as
// the control. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const TEMPLATES = ['classic', 'executive', 'timeline'];

const jobs = () => [
  { company: 'Northwind Analytics', role: 'Senior Data Engineer', location: 'Portland, OR', startDate: 'Mar 2021', endDate: '', current: true,
    description: '<ul><li>Built the streaming pipeline that feeds every product dashboard.</li></ul>' },
  { company: 'Contoso Freight', role: 'Data Engineer', location: 'Remote', startDate: 'Jun 2017', endDate: 'Feb 2021',
    description: '<ul><li>Moved the nightly batch jobs to Airflow.</li></ul>' },
  { company: 'Tailspin Toys, Inc.', role: 'Data Analyst', location: 'Austin, TX', startDate: 'Jun 2013', endDate: 'May 2017',
    description: '<ul><li>Wrote the weekly sales reports.</li></ul>' },
];

const got = {};
before(async () => {
  const ctx = await setup();
  for (const template of TEMPLATES) {
    const pdf = await render(resume({
      template,
      personal: { name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142', location: 'Portland, OR' },
      sections: [experience(jobs())],
    }));
    const lines = await pdfLines(pdf, ctx.pdfjs);
    got[template] = { resume: resumeFromText(lines), seen: lines.map((x) => `${x.text}${x.hint ? `  [${x.hint}]` : ''}`).join('\n') };
  }
}, { timeout: 120_000 });
after(teardown);

describe('Import gives every job its company, role, location and dates', () => {
  for (const template of TEMPLATES) {
    it(`${template}: three jobs, one at a company with a comma in its name`, () => {
      const read = got[template].resume.sections.find((s) => s.type === 'experience')?.items || [];
      const why = `\n--- what the ${template} PDF reads as ---\n${got[template].seen}\n--- jobs ---\n${JSON.stringify(read, null, 1)}`;
      assert.deepEqual(read.map((j) => [j.company, j.role, j.location, j.startDate, j.endDate, j.current]), [
        ['Northwind Analytics', 'Senior Data Engineer', 'Portland, OR', 'Mar 2021', '', true],
        ['Contoso Freight', 'Data Engineer', 'Remote', 'Jun 2017', 'Feb 2021', false],
        ['Tailspin Toys, Inc.', 'Data Analyst', 'Austin, TX', 'Jun 2013', 'May 2017', false],
      ], why);
      assert.deepEqual(read.map((j) => /<li>/.test(j.description || '')), [true, true, true], why);
      assert.doesNotMatch(read.map((j) => j.description || '').join(' '), /Tailspin|Contoso|Northwind|Austin/, why);
    });
  }
});
