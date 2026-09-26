// R2-148: Import reads each job's company, role and location back from the Executive and Timeline
// PDFs, as from Classic's. Executive prints a job inline — "Role, Company" in one line, the date at
// its right, the location alone at the right margin under it — and the import read the location as
// the company and "Role, Company" as the role. The Timeline prints the date above the title, "Role ⇥
// Company" side by side under it and the location under that, and the import found each job by its
// date but left its company and role empty (they went into its description). A fictional résumé is
// exported by the app's own react-pdf code on each template and read back by the import's pdf.js
// reader. The same layouts built item by item: tests/unit/import-pdf-entry-layouts.unit.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const TEMPLATES = ['classic', 'executive', 'timeline'];

const content = () => ({
  personal: {
    name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142',
    location: 'Portland, OR',
    summary: '<p>Data engineer with nine years of building reliable pipelines and warehouses for analytics teams.</p>',
  },
  sections: [
    experience([
      { company: 'Northwind Analytics', role: 'Senior Data Engineer', location: 'Portland, OR', startDate: 'Mar 2021', endDate: '', current: true,
        description: '<ul><li>Built the streaming pipeline that feeds every product dashboard.</li><li>Cut warehouse costs by a third with partitioning and caching.</li></ul>' },
      { company: 'Contoso Freight', role: 'Data Engineer', location: 'Remote', startDate: 'Jun 2017', endDate: 'Feb 2021',
        description: '<ul><li>Moved the nightly batch jobs to Airflow.</li></ul>' },
    ]),
    section('skills', [{ category: 'Programming', skills: 'Python, SQL, Scala' }]),
  ],
});

let ctx;
const got = {};
before(async () => {
  ctx = await setup();
  for (const template of TEMPLATES) {
    const { personal, sections } = content();
    const pdf = await render(resume({ template, personal, sections }));
    const lines = await pdfLines(pdf, ctx.pdfjs);
    got[template] = { resume: resumeFromText(lines), seen: lines.map((x) => `${x.text}${x.hint ? `  [${x.hint}]` : ''}`).join('\n') };
  }
}, { timeout: 120_000 });
after(teardown);

describe('Import reads each job\'s company, role and location back from the PDF', () => {
  for (const template of TEMPLATES) {
    describe(template, () => {
      const jobs = () => got[template].resume.sections.find((s) => s.type === 'experience')?.items || [];
      const why = () => `\n--- what the ${template} PDF reads as ---\n${got[template].seen}\n--- jobs ---\n${JSON.stringify(jobs(), null, 1)}`;

      it('each job: company, role, location and dates', () => {
        assert.deepEqual(jobs().map((j) => [j.company, j.role, j.location, j.startDate, j.endDate, j.current]), [
          ['Northwind Analytics', 'Senior Data Engineer', 'Portland, OR', 'Mar 2021', '', true],
          ['Contoso Freight', 'Data Engineer', 'Remote', 'Jun 2017', 'Feb 2021', false],
        ], why());
      });

      it('its description holds its list, not its header', () => {
        const [first, second] = jobs();
        assert.match(first?.description || '', /^<ul><li>Built the streaming pipeline that feeds every product dashboard\.<\/li>/, why());
        assert.doesNotMatch(first?.description || '', /Northwind|Portland/, why());
        assert.doesNotMatch(second?.description || '', /Contoso|Remote/, why());
      });
    });
  }
});
