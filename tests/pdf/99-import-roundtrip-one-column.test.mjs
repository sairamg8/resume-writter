// R2-148 review: the PDF import now splits a page at a gutter into two columns (pdfPageBlocks) for
// the Sidebar template. A single-column template must still be read across the page, a line at a
// time, as before: a date at the right margin, the Timeline's date beside its entry and a location
// under a date stay on their entry's lines. Each single-column template exports a fictional résumé
// with the app's own react-pdf code; pdf.js reads each page's text, and no page is split into columns.
// The import then finds the name and both jobs with their dates.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render } from './harness.mjs';
import { pdfLines, pdfPageBlocks } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const ONE_COLUMN = ['classic', 'modern', 'minimal', 'executive', 'timeline', 'banner', 'academic'];

const content = () => ({
  personal: {
    name: 'Avery Quinn', title: 'Senior Data Engineer', email: 'avery.quinn@example.com', phone: '+1 555 0142',
    location: 'Portland, OR', linkedin: 'linkedin.com/in/avery-quinn-sample',
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
    section('languages', [{ language: 'English', proficiency: 'Native' }, { language: 'Spanish', proficiency: 'Professional' }]),
  ],
});

let ctx;
const got = {};
before(async () => {
  ctx = await setup();
  for (const template of ONE_COLUMN) {
    const { personal, sections } = content();
    const pdf = await render(resume({ template, personal, sections }));
    const doc = await ctx.pdfjs.getDocument({ data: pdf.slice(), isEvalSupported: false, verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const text = await (await doc.getPage(i)).getTextContent();
      pages.push(text.items.filter((it) => typeof it.str === 'string' && it.transform).map((it) => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]),
      })));
    }
    await doc.destroy();
    const lines = await pdfLines(pdf, ctx.pdfjs);
    got[template] = { pages, resume: resumeFromText(lines), seen: lines.map((x) => x.text).join('\n') };
  }
}, { timeout: 180_000 });
after(teardown);

describe('Import reads a single-column PDF across the page, as before the column split', () => {
  for (const template of ONE_COLUMN) {
    describe(template, () => {
      const why = () => `\n--- what the ${template} PDF reads as ---\n${got[template].seen}`;
      it('no page is split into columns', () => {
        got[template].pages.forEach((page, i) => {
          const blocks = pdfPageBlocks(page);
          assert.equal(blocks.some((b) => b.column), false, `page ${i + 1} split into ${blocks.length} blocks${why()}`);
        });
      });
      it('the name and each job with its company and dates', () => {
        const r = got[template].resume;
        assert.equal(r.personal.name, 'Avery Quinn', why());
        const jobs = r.sections.find((s) => s.type === 'experience')?.items || [];
        assert.deepEqual(jobs.map((j) => [j.company, j.startDate, j.endDate, j.current]), [
          ['Northwind Analytics', 'Mar 2021', '', true],
          ['Contoso Freight', 'Jun 2017', 'Feb 2021', false],
        ], why());
      });
    });
  }
});
