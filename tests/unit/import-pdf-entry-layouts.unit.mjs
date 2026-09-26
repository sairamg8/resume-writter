// R2-148: a PDF's job header read into the right fields on the layouts that do not set "Company ⇥
// date" over "Role ⇥ location". Executive prints a job inline, "Role, Company ⇥ date", the role bold
// and the company in italics in one line, with the location alone at the right margin under the date:
// the import read the location as the company and the whole line as the role. The Timeline prints the
// date above the title, "Role ⇥ Company" side by side under it and the location under that: the
// import found each job by its date but gave it no title, and its role and company went into its
// description. pdf.js items are built here as those templates place them; the round trip through the
// templates themselves is tests/pdf/99-import-roundtrip-entry-layouts.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLinesOfPages } from '../../src/utils/importFile.js';
import { resumeFromText } from '../../src/utils/importText.js';

const item = (str, x, y, w, h = 10) => ({ str, x, y, w, h });
const JOBS = [
  { company: 'Northwind Analytics', role: 'Senior Data Engineer', place: 'Portland, OR', dates: 'Mar 2021 – Present' },
  { company: 'Contoso Freight', role: 'Data Engineer', place: 'Remote', dates: 'Jun 2017 – Feb 2021' },
];
const WANT = [
  ['Northwind Analytics', 'Senior Data Engineer', 'Portland, OR', 'Mar 2021', '', true],
  ['Contoso Freight', 'Data Engineer', 'Remote', 'Jun 2017', 'Feb 2021', false],
];
const head = [item('Avery Quinn', 40, 800, 110, 18), item('EXPERIENCE', 40, 770, 65)];
const jobsOf = (page) => {
  const r = resumeFromText(pdfLinesOfPages([page]));
  return (r.sections.find((s) => s.type === 'experience')?.items || []);
};
const fields = (jobs) => jobs.map((j) => [j.company, j.role, j.location, j.startDate, j.endDate, j.current]);

test('Executive: "Role, Company ⇥ date" over the location alone at the right margin', () => {
  const page = [...head];
  JOBS.forEach((job, k) => {
    const y = 750 - k * 70;
    page.push(item(`${job.role}, ${job.company}`, 40, y, 200), item(job.dates, 470, y, 85));
    page.push(item(job.place, 555 - job.place.length * 5, y - 15, job.place.length * 5));
    page.push(item('• Built the thing.', 40, y - 30, 100));
  });
  const jobs = jobsOf(page);
  assert.deepEqual(fields(jobs), WANT, 'before: the company read as the location, the role as "Role, Company"');
  assert.equal(jobs[0].description, '<ul><li>Built the thing.</li></ul>');
});

test('Timeline: the date above "Role ⇥ Company", then the location', () => {
  const page = [...head];
  JOBS.forEach((job, k) => {
    const y = 750 - k * 80;
    page.push(item(job.dates, 60, y, 80));
    const w = job.role.length * 5;
    page.push(item(job.role, 60, y - 14, w), item(job.company, 60 + w + 8, y - 14, 90));
    page.push(item(job.place, 60, y - 28, job.place.length * 5));
    page.push(item('• Built the thing.', 60, y - 42, 100));
  });
  const jobs = jobsOf(page);
  assert.deepEqual(fields(jobs), WANT, 'before: no company, no role — they were in the description');
  assert.equal(jobs[0].description, '<ul><li>Built the thing.</li></ul>');
});

// The Timeline's Title "Inline": the date, then "Role — Company" as one run (", " for an italic sub),
// then the location under it where the title starts. A job's list runs on to the right margin.
for (const [style, join] of [['Inline', ' — '], ['Inline with an italic sub', ', ']]) {
  test(`Timeline, Title "${style}": the date above "Role${join}Company", then the location`, () => {
    const page = [...head];
    JOBS.forEach((job, k) => {
      const y = 750 - k * 80;
      const title = `${job.role}${join}${job.company}`;
      page.push(item(job.dates, 60, y, 80), item(title, 60, y - 14, title.length * 5));
      page.push(item(job.place, 60, y - 28, job.place.length * 5));
      page.push(item('• Built the streaming pipeline that feeds every product dashboard and report.', 60, y - 42, 490));
    });
    const jobs = jobsOf(page);
    assert.deepEqual(fields(jobs), WANT, 'before: no company, no role — they were in the description');
    assert.equal(jobs[0].description, '<ul><li>Built the streaming pipeline that feeds every product dashboard and report.</li></ul>');
  });
}

test('Classic\'s "Company ⇥ date" over "Role ⇥ location" reads as before', () => {
  const page = [...head];
  JOBS.forEach((job, k) => {
    const y = 750 - k * 60;
    page.push(item(job.company, 40, y, 100), item(job.dates, 470, y, 85));
    page.push(item(job.role, 40, y - 13, 100), item(job.place, 555 - job.place.length * 5, y - 13, job.place.length * 5));
    page.push(item('• Built the thing.', 40, y - 26, 100));
  });
  assert.deepEqual(fields(jobsOf(page)), WANT);
});

test('a company\'s own comma and a job with no role stay whole', () => {
  const r = resumeFromText([
    { text: 'Avery Quinn' }, { text: 'EXPERIENCE' },
    { text: 'Acme, Inc.\tMar 2021 – Present' }, { text: 'Senior Data Engineer\tPortland, OR' },
  ]);
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.location], ['Acme, Inc.', 'Senior Data Engineer', 'Portland, OR']);
  const alone = resumeFromText([{ text: 'Avery Quinn' }, { text: 'EXPERIENCE' }, { text: 'Northwind, Portland\tMar 2021 – Present' }]);
  assert.equal(alone.sections.find((s) => s.type === 'experience').items[0].company, 'Northwind, Portland');
});

// The Sidebar's side column stacks a school's degree, school, field of study and place a line each
// over its dates. The place alone under two fields is the Timeline's job location only for a job: in
// an education it is the school's place, and the line above it its field of study (gate 36221038666
// read "Computer Science" into the entry's description when the first landing of this fix took any
// place alone under two fields as the location).
test('the Sidebar\'s stacked school keeps its field of study and its place', () => {
  const r = resumeFromText([
    { text: 'Avery Quinn' }, { text: 'EDUCATION' },
    { text: 'B.S.' }, { text: 'Lakeside University' }, { text: 'Computer Science' }, { text: 'Seattle, WA' }, { text: '2013 – 2017' },
  ]);
  const [school] = r.sections.find((s) => s.type === 'education').items;
  assert.deepEqual([school.institution, school.degree, school.fieldOfStudy, school.location, school.startDate, school.endDate, school.description],
    ['Lakeside University', 'B.S.', 'Computer Science', 'Seattle, WA', '2013', '2017', '']);
});
