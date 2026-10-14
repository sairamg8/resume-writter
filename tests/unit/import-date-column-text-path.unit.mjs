// A date column beside its title ("Jan 2020 – Present ⇥ Senior Engineer", the PDF importer's Europass and
// CV-table layout) takes the line under it as the title's second field (the company, the school). That rule
// reads typed, pasted, Markdown and Word text too, so it must not take what is no company: a label over the
// entry's list ("Key Responsibilities", "Main duties:"), a place alone ("Remote", "Portland, OR"), or the
// line under a title that already holds its company ("Audit Manager, Hargreaves & Co, Leeds"). Also pinned
// on the text path: the PDF reader's "loose" blank line (a table row's spacing) joining "Role" to
// "Company ⇥ dates", a degree after a date that has a named field under it, and a tabbed skills label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const section = (r, type) => r.sections.find((s) => s.type === type);
const jobs = (r) => section(r, 'experience').items;
const plain = (html) => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const HEAD = 'Pat Doe\npat@example.com\n\n';

test('a label under "Date ⇥ Role, Company, Place" stays in the description, the company stays in the title', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\n2019 - present\tAudit Manager, Hargreaves & Co, Leeds\nKey Responsibilities\n- Lead a team of 8`);
  assert.equal(jobs(r).length, 1);
  const [job] = jobs(r);
  assert.deepEqual([job.company, job.role, job.location, job.startDate, job.current], ['Hargreaves & Co, Leeds', 'Audit Manager', '', '2019', true]);
  assert.match(plain(job.description), /^Key Responsibilities Lead a team of 8$/);
});

test('a label with a colon under "Date | Role" is the description\'s, not the company', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\nMain duties:\n- Cut costs by a third`);
  assert.equal(jobs(r).length, 1);
  const [job] = jobs(r);
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['', 'Senior Engineer', 'Jan 2020', true]);
  assert.match(plain(job.description), /^Main duties: Cut costs by a third$/);
});

test('a place alone under "Date | Role" is not the company', () => {
  for (const place of ['Remote', 'Portland, OR']) {
    const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\n${place}\n- Built the pipeline`);
    assert.equal(jobs(r).length, 1, place);
    const [job] = jobs(r);
    assert.deepEqual([job.company, job.role, job.startDate, job.current], ['', 'Senior Engineer', 'Jan 2020', true], place);
  }
});

test('the date column\'s own shape still takes the company, the school and the place under the title', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present\tSenior Software Engineer\nAcme Corp, San Francisco, CA\n• Led a team of 6 engineers\n\nEDUCATION\n2012 – 2016\tB.S. Computer Science\nUniversity of Texas at Austin`);
  const [job] = jobs(r);
  assert.equal(jobs(r).length, 1);
  assert.deepEqual([job.company, job.role, job.location, job.startDate, job.endDate, job.current, job.description],
    ['Acme Corp', 'Senior Software Engineer', 'San Francisco, CA', 'Jan 2020', '', true, '<ul><li>Led a team of 6 engineers</li></ul>']);
  const [school] = section(r, 'education').items;
  assert.deepEqual([school.institution, school.degree, school.location, school.startDate, school.endDate],
    ['University of Texas at Austin', 'B.S. Computer Science', '', '2012', '2016']);
});

test('a company under the date column\'s title is taken too where a sentence of the job\'s text follows it', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present\tAudit Manager\nHargreaves & Co\nResponsible for audits of listed clients`);
  const [job] = jobs(r);
  assert.equal(jobs(r).length, 1);
  assert.deepEqual([job.company, job.role], ['Hargreaves & Co', 'Audit Manager']);
  assert.match(plain(job.description), /^Responsible for audits of listed clients$/);
});

// The PDF reader marks a blank line a little wider than a line step (a table row's or a paragraph's
// spacing) { text: '', loose: true }; a real gap is { text: '' }, as is a blank line of typed text.
const TABLE = (gap) => ['Pat Doe', 'pat@example.com', '', 'EXPERIENCE', 'Acme Corp\tJan 2020 – Present', ...gap, 'Senior Engineer', '• Built it'];

test('a loose blank line between "Company ⇥ dates" and "Role" keeps them one job when a list follows', () => {
  const r = resumeFromText(TABLE([{ text: '', loose: true }]));
  assert.equal(jobs(r).length, 1);
  const [job] = jobs(r);
  assert.deepEqual([job.company, job.role, job.startDate, job.current, job.description],
    ['Acme Corp', 'Senior Engineer', 'Jan 2020', true, '<ul><li>Built it</li></ul>']);
});

test('a real blank line (typed text, or a PDF\'s wide gap) between them still parts the role from the company', () => {
  for (const gap of [[''], [{ text: '' }]]) {
    const r = resumeFromText(TABLE(gap));
    assert.deepEqual(jobs(r).map((j) => [j.company, j.role]), [['Acme Corp', ''], ['', 'Senior Engineer']], JSON.stringify(gap));
  }
});

test('a loose blank line between a school and its degree keeps them one entry at the end of the section', () => {
  const r = resumeFromText(['Pat Doe', 'pat@example.com', '', 'EDUCATION', 'University of Leeds\t2011 – 2014', { text: '', loose: true }, 'BSc Accounting']);
  const items = section(r, 'education').items;
  assert.equal(items.length, 1);
  assert.deepEqual([items[0].institution, items[0].degree, items[0].startDate, items[0].endDate], ['University of Leeds', 'BSc Accounting', '2011', '2014']);
});

test('a degree after the date with its named field under it is the degree, not the location', () => {
  const r = resumeFromText(`${HEAD}EDUCATION\nSep 2012 – Jun 2016 | BSc Computer Science\nGPA: 3.8`);
  const [school] = section(r, 'education').items;
  assert.deepEqual([school.degree, school.institution, school.location, school.gpa, school.startDate, school.endDate],
    ['BSc Computer Science', '', '', '3.8', 'Sep 2012', 'Jun 2016']);
});

test('a role after the date with its named field under it is the role, not the location', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\nTechnologies: Go, SQL\n- Built the pipeline`);
  const [job] = jobs(r);
  assert.deepEqual([job.role, job.company, job.location], ['Senior Engineer', '', '']);
});

test('a capitalised label, a tab and a comma list is one category (a Word table\'s "Languages:  Python, Go"), where two words with no comma are two skills', () => {
  const r = resumeFromText(`${HEAD}SKILLS\nGit\tDocker, Kubernetes\nPython\tSQL`);
  assert.deepEqual(section(r, 'skills').items.map((i) => [i.category, i.skills]), [['Git', 'Docker, Kubernetes'], ['', 'Python'], ['', 'SQL']]);
});

// The company or school under a date column's title, and the lines that may follow it (where the entry's own text starts).
test('a school under "Date | Degree" is taken where a named field follows it ("GPA: 3.8")', () => {
  const r = resumeFromText(`${HEAD}EDUCATION\nSep 2012 – Jun 2016 | BSc Computer Science\nStanford University\nGPA: 3.8`);
  const items = section(r, 'education').items;
  assert.equal(items.length, 1);
  const [school] = items;
  assert.deepEqual([school.institution, school.degree, school.gpa, school.location, school.startDate, school.endDate, plain(school.description)],
    ['Stanford University', 'BSc Computer Science', '3.8', '', 'Sep 2012', 'Jun 2016', ''],
    'before: the institution and the GPA empty, the school and the GPA in the description');
});

test('a company under "Date | Role" is taken where its named field follows it ("Technologies: …", "Location: …")', () => {
  for (const named of ['Technologies: Go, SQL', 'Location: Leeds']) {
    const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\nAcme Corp\n${named}\n- Built the pipeline`);
    assert.equal(jobs(r).length, 1, named);
    const [job] = jobs(r);
    assert.deepEqual([job.company, job.role], ['Acme Corp', 'Senior Engineer'], named);
  }
});

test('a company under the date column\'s title is read in linear time where a line of 100 000 "(" follows it', () => {
  // A guard: the sentence test on the line after the company (a pattern that is time squared in a run of "(") is bounded now.
  // Only the time is asserted: a line of "(" is no sentence, so the company is not taken here; the call is reached all the same.
  const start = performance.now();
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\nAcme Corp\n${'('.repeat(100_000)}`);
  const ms = performance.now() - start;
  assert.ok(jobs(r).length >= 1, 'the job is read');
  assert.ok(ms < 1000, `resumeFromText took ${ms.toFixed(0)} ms`);
});

test('a school under "Date | High School Diploma" is the institution: the diploma names a degree and no school', () => {
  for (const after of ['', '\n• Graduated with honours']) {
    const r = resumeFromText(`${HEAD}EDUCATION\n2012 – 2016 | High School Diploma\nLincoln High School${after}`);
    const items = section(r, 'education').items;
    assert.equal(items.length, 1, JSON.stringify(after));
    const [school] = items;
    assert.deepEqual([school.institution, school.degree, school.startDate, school.endDate], ['Lincoln High School', 'High School Diploma', '2012', '2016'], JSON.stringify(after));
  }
});

test('a school with its region code under "Date | Degree" is the institution (as typed), not a place alone', () => {
  for (const name of ['Boston University, MA', 'Stanford University, CA']) {
    const r = resumeFromText(`${HEAD}EDUCATION\nJun 2016 | BSc Physics\n${name}`);
    const items = section(r, 'education').items;
    assert.equal(items.length, 1, name);
    const [school] = items;
    assert.deepEqual([school.institution, school.degree, school.location, plain(school.description)], [name, 'BSc Physics', '', ''], name);
  }
});

// The gates are pinned one at a time: each of these is read right with the other gates standing; with its own gate removed
// the line under the title would be taken for the company.
test('a label over the list is not the company (the SUBHEADING gate): "Key Responsibilities" under "Date | Role"', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\nJan 2020 – Present | Senior Engineer\nKey Responsibilities\n- Led a team`);
  assert.equal(jobs(r).length, 1);
  const [job] = jobs(r);
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['', 'Senior Engineer', 'Jan 2020', true]);
  assert.match(plain(job.description), /^Key Responsibilities Led a team$/);
});

test('a title that already holds its company takes no second one (the inlinePair gate): "Leeds Office" under "Date ⇥ Role, Company"', () => {
  const r = resumeFromText(`${HEAD}EXPERIENCE\n2019 - present\tAudit Manager, Hargreaves & Co\nLeeds Office\n- Led a team`);
  assert.equal(jobs(r).length, 1);
  const [job] = jobs(r);
  assert.deepEqual([job.company, job.role, job.location, job.startDate, job.current], ['Hargreaves & Co', 'Audit Manager', '', '2019', true]);
  assert.match(plain(job.description), /^Leeds Office Led a team$/);
});
