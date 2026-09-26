// R2-148: the PDF import reads a two-column page column by column. The Sidebar template sets the
// name, the contacts and the short sections in a coloured side column beside the main one; read by
// baseline across the whole page, the two columns came back interleaved line by line ("Senior Data
// Engineer ⇥ Data engineer with nine years…", "EMAIL" a section of its own), and the résumé was
// named "About Me". Compact sets the job title on the name's line and its short sections as a grid,
// two cells to a row: the name read as "Avery Quinn Senior Data Engineer" and each language's level
// as a language. A fictional résumé exported by the app's own react-pdf code and read back by the
// import's pdf.js reader must give the name, the job title, every contact, the summary, each
// section under its heading in the order the template prints them, the jobs' fields and dates, the
// school's, and each language with its level.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
const read = {};

const content = {
  personal: {
    name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142',
    location: 'Portland, OR', website: 'averyquinn.example.com', linkedin: 'linkedin.com/in/avery-quinn-sample',
    github: 'github.com/avery-quinn-sample',
    summary: '<p>Data engineer with nine years of building reliable pipelines and warehouses for analytics teams, from streaming ingestion to the dashboards people read every morning.</p>',
  },
  sections: () => [
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
};

// The sections in the order each template prints them: Sidebar's side column (education, skills,
// languages, certifications, under the contacts) is read before its main column.
const ORDER = {
  sidebar: [['education', 'education'], ['skills', 'skills'], ['languages', 'languages'], ['certifications', 'certifications'],
    ['experience', 'professional experience'], ['projects', 'projects']],
  compact: [['experience', 'professional experience'], ['education', 'education'], ['skills', 'skills'],
    ['projects', 'projects'], ['languages', 'languages'], ['certifications', 'certifications']],
};

before(async () => {
  ctx = await setup();
  for (const template of Object.keys(ORDER)) {
    const pdf = await render(resume({ template, personal: content.personal, sections: content.sections() }));
    const lines = await pdfLines(pdf, ctx.pdfjs);
    read[template] = { resume: resumeFromText(lines), seen: lines.map((x) => x.text).join('\n') };
  }
}, { timeout: 120_000 });
after(teardown);

const lower = (s) => String(s || '').toLowerCase();

describe('Import reads back a two-column and a grid PDF', () => {
  for (const template of Object.keys(ORDER)) {
    describe(template, () => {
      const got = () => read[template].resume;
      const why = () => `\n--- what the ${template} PDF reads as ---\n${read[template].seen}\n--- imported ---\n${JSON.stringify({ personal: got().personal, sections: got().sections.map((s) => [s.type, s.title, s.items]) }, null, 1)}`;
      const items = (type) => got().sections.find((s) => s.type === type)?.items || [];

      it('the name, the job title and the summary', () => {
        assert.equal(got().personal.name, 'Avery Quinn', why());
        assert.equal(got().personal.title, 'Senior Data Engineer', why());
        assert.match(got().personal.summary, /^<p>Data engineer with nine years of building reliable pipelines and warehouses for analytics teams, from streaming ingestion to the dashboards people read every morning\.<\/p>$/, why());
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

      it('each section under its heading, of its type, in the order the template prints them, and nothing left over', () => {
        assert.deepEqual(got().sections.map((s) => [s.type, lower(s.title)]), ORDER[template], why());
      });

      it('each job: company, role, location, dates, and its list', () => {
        const jobs = items('experience');
        assert.deepEqual(jobs.map((j) => [j.company, j.role, j.location, j.startDate, j.endDate, j.current]), [
          ['Northwind Analytics', 'Senior Data Engineer', 'Portland, OR', 'Mar 2021', '', true],
          ['Contoso Freight', 'Data Engineer', 'Remote', 'Jun 2017', 'Feb 2021', false],
        ], why());
        assert.equal(jobs[0].description, '<ul><li>Built the streaming pipeline that feeds every product dashboard.</li><li>Cut warehouse costs by a third with partitioning and caching.</li></ul>', why());
        assert.equal(jobs[1].description, '<ul><li>Moved the nightly batch jobs to Airflow.</li></ul>', why());
      });

      it('the school, the skills, each language with its level, the certificate and the project', () => {
        const [school] = items('education');
        assert.deepEqual([school?.institution, school?.degree, school?.fieldOfStudy, school?.location, school?.startDate, school?.endDate],
          ['Lakeside University', 'B.S.', 'Computer Science', 'Seattle, WA', '2013', '2017'], why());
        assert.deepEqual(items('skills').map((i) => [lower(i.category), i.skills]), [['programming', 'Python, SQL, Scala'], ['platforms', 'Spark, Airflow, AWS']], why());
        assert.deepEqual(items('languages').map((i) => [i.language, i.proficiency]), [['English', 'Native'], ['Spanish', 'Professional']], why());
        assert.deepEqual(items('certifications').map((i) => [i.name, i.issuer, i.date, i.expiry]), [['AWS Certified Data Engineer', 'Amazon Web Services', 'Jun 2022', 'Jun 2025']], why());
        assert.deepEqual(items('projects').map((i) => [i.name, i.startDate, i.endDate]), [['Tidewater', 'Jan 2020', 'Dec 2020']], why());
      });
    });
  }
});
