// R2-148: Import reads a résumé from a PDF, a Word file, Markdown or plain text, not only JSON. The
// round trip: a fictional résumé is exported by the app's own code — the PDF (react-pdf, read back by
// the import's pdf.js reader), the Word export (the .docx unzipped by the import), Markdown and the ATS
// text — and each file read back must give the name, the job title, every contact, the summary, each
// section under its heading, and each job's and school's title fields and dates.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, loadModule } from './harness.mjs';
import { pdfLines, docxLines } from '../../src/utils/importFile.js';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

let ctx;
let fixture;
const read = {};

before(async () => {
  ctx = await setup();
  fixture = resume({
    personal: {
      name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142',
      location: 'Portland, OR', website: 'averyquinn.example.com', linkedin: 'linkedin.com/in/avery-quinn-sample',
      github: 'github.com/avery-quinn-sample',
      summary: '<p>Data engineer with nine years of building reliable pipelines and warehouses for analytics teams, from streaming ingestion to the dashboards people read every morning.</p>',
    },
    sections: [
      experience([
        { company: 'Northwind Analytics', role: 'Senior Data Engineer', location: 'Portland, OR', startDate: 'Mar 2021', endDate: '', current: true,
          description: '<ul><li>Built the streaming pipeline that feeds every product dashboard.</li><li>Cut warehouse costs by a third with partitioning and caching.</li></ul>' },
        { company: 'Contoso Freight', role: 'Data Engineer', location: 'Remote', startDate: 'Jun 2017', endDate: 'Feb 2021',
          description: '<ul><li>Moved the nightly batch jobs to Airflow.</li></ul>' },
      ]),
      section('education', [{ institution: 'Lakeside University', degree: 'B.S.', fieldOfStudy: 'Computer Science', location: 'Seattle, WA', startDate: '2013', endDate: '2017' }]),
      section('skills', [{ category: 'Programming', skills: 'Python, SQL, Scala' }, { category: 'Platforms', skills: 'Spark, Airflow, AWS' }]),
      section('projects', [{ name: 'Tidewater', technologies: 'Rust, Kafka', startDate: 'Jan 2020', endDate: 'Dec 2020', description: '<p>An open-source change-data-capture tool.</p>' }]),
      section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'Spanish', proficiency: 'Professional' }]),
      section('certifications', [{ name: 'AWS Certified Data Engineer', issuer: 'Amazon Web Services', date: 'Jun 2022', expiry: 'Jun 2025' }]),
    ],
  });
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const { generateMarkdownResume } = await loadModule('/src/utils/markdownExport.js');
  const { generateAtsPlainText } = await loadModule('/src/utils/atsPlainText.js');
  const pdf = await render(fixture);
  const docx = new Uint8Array(await (await renderResumeDocx(fixture)).arrayBuffer());
  const lines = {
    PDF: await pdfLines(pdf, ctx.pdfjs),
    Word: await docxLines(docx),
    Markdown: markdownLines(generateMarkdownResume(fixture)),
    'ATS text': generateAtsPlainText(fixture),
  };
  for (const [kind, l] of Object.entries(lines)) {
    // What the reader saw, for the failure messages.
    const seen = typeof l === 'string' ? l : l.map((x) => x.text).join('\n');
    read[kind] = { resume: resumeFromText(l), seen };
  }
}, { timeout: 120_000 });
after(teardown);

const lower = (s) => String(s || '').toLowerCase();

describe('Import reads back the app\'s own exports', () => {
  for (const kind of ['PDF', 'Word', 'Markdown', 'ATS text']) {
    describe(kind, () => {
      const got = () => read[kind].resume;
      const why = () => `\n--- what the ${kind} reads as ---\n${read[kind].seen}\n--- imported ---\n${JSON.stringify({ personal: got().personal, sections: got().sections.map((s) => [s.type, s.title, s.items]) }, null, 1)}`;

      it('the name, the job title and the summary', () => {
        assert.equal(got().personal.name, 'Avery Quinn', why());
        assert.equal(got().personal.title, 'Senior Data Engineer', why());
        assert.match(got().personal.summary, /Data engineer with nine years/, why());
      });

      it('every contact', () => {
        const p = got().personal;
        assert.equal(p.email, 'avery.quinn@example.com', why());
        assert.equal(p.phone, '+1 555 0142', why());
        assert.equal(p.location, 'Portland, OR', why());
        assert.match(p.linkedin, /linkedin\.com\/in\/avery-quinn-sample$/, why());
        assert.match(p.github, /github\.com\/avery-quinn-sample$/, why());
        assert.match(p.website, /averyquinn\.example\.com$/, why());
      });

      it('each section under its heading, of its type, in order', () => {
        const want = [['experience', 'professional experience'], ['education', 'education'], ['skills', 'skills'],
          ['projects', 'projects'], ['languages', 'languages'], ['certifications', 'certifications']];
        assert.deepEqual(got().sections.map((s) => [s.type, lower(s.title)]), want, why());
      });

      it('each job: company, role, dates, and its list', () => {
        const jobs = got().sections.find((s) => s.type === 'experience')?.items || [];
        assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current]), [
          ['Northwind Analytics', 'Senior Data Engineer', 'Mar 2021', '', true],
          ['Contoso Freight', 'Data Engineer', 'Jun 2017', 'Feb 2021', false],
        ], why());
        assert.match(jobs[0].description, /<li>Built the streaming pipeline that feeds every product dashboard\.<\/li>/, why());
        assert.match(jobs[1].description, /Moved the nightly batch jobs to Airflow/, why());
      });

      it('the school: institution, degree, field and dates; a project, the skills and the certificate by name', () => {
        const items = (type) => got().sections.find((s) => s.type === type)?.items || [];
        const [school] = items('education');
        assert.deepEqual([school?.institution, school?.degree, school?.fieldOfStudy, school?.startDate, school?.endDate],
          ['Lakeside University', 'B.S.', 'Computer Science', '2013', '2017'], why());
        assert.equal(items('projects')[0]?.name, 'Tidewater', why());
        assert.deepEqual(items('skills').map((i) => i.category), ['Programming', 'Platforms'], why());
        assert.equal(items('certifications')[0]?.name, 'AWS Certified Data Engineer', why());
        assert.equal(items('certifications')[0]?.date, 'Jun 2022', why());
      });
    });
  }
});
