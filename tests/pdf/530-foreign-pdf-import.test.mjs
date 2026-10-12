// Résumé PDFs that do not come from this app (Word, LaTeX, a design tool's sidebar, a CV table with a date
// column) read into the right fields. Each fixture in tests/fixtures/foreign-pdfs is a small PDF written
// with another tool's layout; pdf.js reads it and the import turns it into a résumé. What broke before:
//  - a skill label and its list a tab apart ("Languages:⇥Python, Go") became two skills, the label one;
//  - a side column's contacts, bold labels and bold degrees were joined to the line above as if wrapped;
//  - a date column beside the title ("Jan 2020 – Present ⇥ Engineer", the company under it) put the title
//    in the location and the company in the description;
//  - a table row's spacing (a blank line between "Company ⇥ dates" and "Role") split one job into two.
// Run: node --test tests/pdf/530-foreign-pdf-import.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, teardown } from './harness.mjs';
import { pdfLines } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

let ctx;
before(async () => { ctx = await setup(); });
after(teardown);

const DIR = new URL('../fixtures/foreign-pdfs/', import.meta.url);
const read = async (name) => resumeFromText(await pdfLines(new Uint8Array(fs.readFileSync(new URL(name, DIR))), ctx.pdfjs));
const section = (r, type) => r.sections.find((s) => s.type === type);
const plain = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const SKILLS = [
  ['Languages', 'Python, JavaScript, TypeScript, Go, SQL'],
  ['Frameworks', 'React, Node.js, Django, FastAPI'],
  ['Tools', 'AWS, Docker, Kubernetes, Git, Terraform'],
];
const skillsOf = (r) => section(r, 'skills').items.map((i) => [i.category, i.skills]);
const jobs = (r) => section(r, 'experience').items.map((i) => [i.company, i.role, i.location, i.startDate, i.endDate]);
const JOBS = [
  ['Acme Corp', 'Senior Software Engineer', 'San Francisco, CA', 'Jan 2020', ''],
  ['Globex Inc', 'Software Engineer', 'Austin, TX', 'Jun 2016', 'Dec 2019'],
];

describe('PDFs from other tools', () => {
  it('a Word-style page with "Label:⇥list" skills gives one skill group a line', async () => {
    const r = await read('01-classic-word.pdf');
    assert.deepEqual(skillsOf(r), SKILLS);
    assert.deepEqual(jobs(r).map((j) => j.slice(0, 2)), JOBS.map((j) => j.slice(0, 2)));
    assert.equal(r.personal.email, 'jane.doe@example.com');
  });

  it('a date column with the title beside it and the company under it (no colon in the skills)', async () => {
    const r = await read('08-timeline-datecol.pdf');
    assert.deepEqual(jobs(r), JOBS);
    const edu = section(r, 'education').items[0];
    assert.equal(edu.institution, 'University of Texas at Austin');
    assert.equal(edu.degree, 'B.S. Computer Science');
    assert.deepEqual([edu.startDate, edu.endDate], ['2012', '2016']);
    assert.deepEqual(skillsOf(r), SKILLS);
  });

  for (const name of ['06-sidebar-left.pdf', '07-sidebar-right.pdf']) {
    it(`${name}: a side column's contacts, labels and degree stay on their own lines`, async () => {
      const r = await read(name);
      assert.equal(r.personal.name, 'Jane Doe');
      assert.equal(r.personal.location, 'San Francisco, CA');
      assert.equal(r.personal.linkedin, 'linkedin.com/in/janedoe');
      assert.equal(r.personal.github, 'github.com/janedoe');
      assert.deepEqual(skillsOf(r), SKILLS);
      const edu = section(r, 'education').items[0];
      assert.equal(edu.institution, 'University of Texas at Austin');
      assert.equal(edu.degree, 'B.S. Computer Science');
      assert.deepEqual(jobs(r).map((j) => j.slice(0, 2)), JOBS.map((j) => j.slice(0, 2)));
      assert.ok(!r.sections.some((s) => s.type === 'custom'), 'nothing was left over for Additional Information');
    });
  }

  it('a LaTeX page (role and dates over company and place) keeps each job whole', async () => {
    const r = await read('05-latex-jake.pdf');
    assert.deepEqual(jobs(r).map((j) => j.slice(0, 3)), JOBS.map((j) => j.slice(0, 3)));
    assert.deepEqual(skillsOf(r), SKILLS);
    const edu = section(r, 'education').items[0];
    assert.deepEqual([edu.institution, edu.startDate, edu.endDate], ['University of Texas at Austin', 'Aug. 2012', 'May 2016']);
  });

  it('a table row with spacing between "Company ⇥ dates" and "Role" is one job, a school one entry', async () => {
    const r = await read('10-word-table-rows.pdf');
    const items = section(r, 'experience').items;
    assert.equal(items.length, 2, 'two jobs, not four half entries');
    assert.deepEqual(items.map((i) => [i.company, i.role]), [['Acme Corp', 'Senior Software Engineer'], ['Globex Inc', 'Software Engineer']]);
    assert.match(plain(items[0].description), /^Led a team of 6 engineers/);
    const edu = section(r, 'education').items;
    assert.equal(edu.length, 1);
    assert.equal(edu[0].degree, 'Bachelor of Science in Computer Science');
    assert.equal(edu[0].gpa, '3.8/4.0');
  });
});
