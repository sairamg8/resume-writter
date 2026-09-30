// R5-HUNT11 review of R5-HUNT11-TITLECASE-UNKNOWN-HEADING-BECOMES-ENTRY: a Title-Case line after a blank
// line that ends in a section word ("Research", "Service") started a custom section even where it was an
// entry's own title right over its lines: an employer "Microsoft Research" over "Research Intern ⇥ Jun
// 2019", "Internal Revenue Service" over its role, a project "Customer Churn Research" over its list.
// The job left its Experience section for a section named after the firm. Such a title is its entry's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const shape = (r) => r.sections.map((s) => [s.type, s.items.map((x) => x.company || x.name || x.institution || '')]);

test('an employer "Microsoft Research" over its role and dates stays a job of Experience', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nExperience\n\nAcme Corp\nSenior Engineer\tJan 2021 – Present\n• Led a team\n\nMicrosoft Research\nResearch Intern\tJun 2019 – Aug 2019\n• Published a paper\n\nEducation\n\nMIT\t2014 – 2018\nB.S. Computer Science\n');
  assert.deepEqual(shape(r), [['experience', ['Acme Corp', 'Microsoft Research']], ['education', ['MIT']]]);
  assert.equal(r.sections[0].items[1].role, 'Research Intern');
});

test('"Internal Revenue Service" over its role, and a project "Customer Churn Research" over its list, are entries', () => {
  const jobs = resumeFromText('Pat Lee\npat@x.com\n\nExperience\n\nAcme\tJan 2021 – Present\nEngineer\n• x\n\nInternal Revenue Service\nAnalyst\tJun 2018 – Dec 2020\n• y\n');
  assert.deepEqual(shape(jobs), [['experience', ['Acme', 'Internal Revenue Service']]]);
  const projects = resumeFromText('Pat Lee\npat@x.com\n\nProjects\n\nCustomer Churn Research\n• Built a model\n\nWeather App\n• React app\n');
  assert.deepEqual(shape(projects), [['projects', ['Customer Churn Research', 'Weather App']]]);
});

test('a section named so, with a blank line under it, or "…Experience" over its first entry, is still a section', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nEducation\n\nStanford University\t2018 – 2024\nPh.D. Computer Science\n\nLeadership and Service\n\nFood Bank\t2019 – 2020\nOrganizer\n\nTeaching Experience\nStanford University\t2020 – 2021\nTeaching Assistant\n');
  assert.deepEqual(r.sections.map((s) => [s.type, s.title]), [['education', 'Education'], ['custom', 'Leadership and Service'], ['custom', 'Teaching Experience']]);
});
