// R5-HUNT12 review of R5-HUNT12-STACKED-PLACE-LINE-LOSES-COMPANY: a job's role and place a line each over
// its dates took any short line over them for its company, so the job above's last line of text
// ("Mentored junior engineers", "Kubernetes migration") became this job's role or company, and a job
// printed "Role", "Google, Mountain View, CA", dates lost Google into its location. The line over them is
// the company only when it reads as a name; else the job above keeps its text, and the place alone
// ("Mountain View, CA", "Remote") is still this job's location, never its company.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => (r.sections.find((s) => s.type === 'experience')?.items || []).map((j) => [j.company, j.role, j.location, j.startDate, j.description]);
const acme = 'John Smith\njohn@example.com\n\nEXPERIENCE\nSenior Engineer\nAcme Corp\nJan 2020 – Present\n';

test('the job above’s text over a role and its place stays the job above’s; the place is the location', () => {
  for (const [text, place] of [['Mentored junior engineers', 'Mountain View, CA'], ['Kubernetes migration', 'Remote']]) {
    const r = resumeFromText(`${acme}${text}\nSoftware Engineer\n${place}\n2017 – 2020\n- Search infra\n`);
    assert.deepEqual(jobs(r), [
      ['Acme Corp', 'Senior Engineer', '', 'Jan 2020', `<p>${text}</p>`],
      ['', 'Software Engineer', place, '2017', '<ul><li>Search infra</li></ul>'],
    ]);
  }
});

test('"Software Engineer" over "Google, Mountain View, CA": Google is the company, under the job above’s text', () => {
  const r = resumeFromText(`${acme}Mentored junior engineers\nSoftware Engineer\nGoogle, Mountain View, CA\n2017 – 2020\n- Search infra\n`);
  assert.deepEqual(jobs(r), [
    ['Acme Corp', 'Senior Engineer', '', 'Jan 2020', '<p>Mentored junior engineers</p>'],
    ['Google', 'Software Engineer', 'Mountain View, CA', '2017', '<ul><li>Search infra</li></ul>'],
  ]);
});
