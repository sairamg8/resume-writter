// R5-HUNT2: text, PDF and unstyled Word files whose entry prints its title on the line over its dated
// line ("Degree" over "School ⇥ 2014 – 2018", "Role" over "Company ⇥ Jan 2020 – Present"), or its
// employer or school in capitals over it ("ACME CORP" over "Senior Engineer ⇥ …"). Before, the title
// over went into the description (or the job above's), a job title was read as a grouped employer,
// and an employer in capitals started a custom section of its own, dropping Experience or Education.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const section = (r, type) => r.sections.find((s) => s.type === type);

test('a degree over "School ⇥ dates" is the entry\'s degree, not its description (R5-HUNT2-TEXT-IMPORT-DEGREE-OVER-SCHOOL-DATE-GOES-TO-DESCRIPTION)', () => {
  for (const dated of ['University of Oregon\t2014 – 2018', 'University of Oregon, 2014 – 2018']) {
    const r = resumeFromText(`Jane Doe\njane@x.com\n\nEducation\nBachelor of Science in Computer Science\n${dated}`);
    const [e, ...more] = section(r, 'education').items;
    assert.equal(more.length, 0);
    assert.deepEqual([e.institution, e.degree, e.startDate, e.endDate, e.description],
      ['University of Oregon', 'Bachelor of Science in Computer Science', '2014', '2018', ''], dated);
  }
});

test('"Role" over "Company ⇥ dates" is that job\'s role and company, not an employer over grouped roles (R5-HUNT2-TEXT-IMPORT-ROLE-OVER-COMPANY-DATE-READ-AS-EMPLOYER-GROUP)', () => {
  for (const [a, b] of [['Acme Corp\tJan 2020 – Present', 'Globex\t2017 – 2019'], ['Acme Corp, Jan 2020 – Present', 'Globex, 2017 – 2019']]) {
    const r = resumeFromText(`Jane Doe\njane@x.com\n\nExperience\nSenior Engineer\n${a}\n• Built things\nEngineer\n${b}\n• Did stuff`);
    const jobs = section(r, 'experience').items;
    assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current, j.description]), [
      ['Acme Corp', 'Senior Engineer', 'Jan 2020', '', true, '<ul><li>Built things</li></ul>'],
      ['Globex', 'Engineer', '2017', '2019', false, '<ul><li>Did stuff</li></ul>'],
    ], a);
  }
});

test('an employer with no role word over its roles is still the group\'s employer', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nExperience\nAcme Corp\nSenior Engineer\tJan 2020 – Present\n• Built things');
  const [job] = section(r, 'experience').items;
  assert.deepEqual([job.company, job.role], ['Acme Corp', 'Senior Engineer']);
});

test('an employer or school in capitals over its dated line is the entry\'s, not a section of its own (R5-HUNT2-TEXT-IMPORT-CAPS-EMPLOYER-BECOMES-SECTION)', () => {
  const r = resumeFromText('JANE DOE\nSoftware Engineer\njane@x.com | 555-123-4567\n\nEXPERIENCE\nACME CORP\nSenior Engineer\tJan 2020 – Present\n• Built things\n\nEDUCATION\nSTANFORD UNIVERSITY\nBSc Computer Science\t2014 – 2018');
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'education']);
  const [job] = section(r, 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.current, job.description], ['ACME CORP', 'Senior Engineer', 'Jan 2020', true, '<ul><li>Built things</li></ul>']);
  const [school] = section(r, 'education').items;
  assert.deepEqual([school.institution, school.startDate, school.endDate, school.description], ['STANFORD UNIVERSITY', '2014', '2018', '']);
  assert.match(school.degree, /^BSc/);
});

test('a heading in capitals after a gap still starts a section of its own, dated line under it or not', () => {
  const r = resumeFromText('JANE DOE\n\nEXPERIENCE\nSenior Engineer\tAcme\tJan 2020 – Present\n• x\n\nTEACHING\nLecturer\t2016\n• z');
  assert.deepEqual(r.sections.map((s) => [s.type, s.title]), [['experience', 'Experience'], ['custom', 'Teaching']]);
});
