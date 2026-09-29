// R5-HUNT7-ROLE-AT-FIRM (review of R5-HUNT7-ROLE-AT-COMPANY): "Role at Company" is split into the role
// and the company, but when the company's name holds a firm's plural role word ("Gensler Architects",
// "Summit Partners") the two fields' words told nothing, and a section that leads with the company (the
// default for jobs) swapped them back: the role "Gensler Architects", the company "Senior Engineer". With
// a place after it, "Chicago, IL" became the company. The role is what comes before "at", whatever the
// words say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => r.sections.find((s) => s.type === 'experience').items.map((j) => [j.role, j.company, j.location]);
const doc = (...headers) => `Jane Doe\njane@x.com\n\nExperience\n${headers.map((h) => `${h}\n• Built things`).join('\n\n')}`;

test('"Role at Firm" keeps the role first when the firm\'s name has a plural role word', () => {
  assert.deepEqual(jobs(resumeFromText(doc('Senior Engineer at Gensler Architects\tJan 2020 – Present'))), [['Senior Engineer', 'Gensler Architects', '']]);
  assert.deepEqual(jobs(resumeFromText(doc('Associate @ Summit Partners\t2018 – 2020'))), [['Associate', 'Summit Partners', '']]);
});

test('with a place after it, set apart or after a comma, the place is the location', () => {
  assert.deepEqual(jobs(resumeFromText(doc('Senior Engineer at Gensler Architects | Chicago, IL\tJan 2020 – Present'))), [['Senior Engineer', 'Gensler Architects', 'Chicago, IL']]);
  assert.deepEqual(jobs(resumeFromText(doc('Senior Engineer at Gensler Architects, Chicago, IL\tJan 2020 – Present'))), [['Senior Engineer', 'Gensler Architects', 'Chicago, IL']]);
});

test('in a section that leads with the company, "Role at Company" is still role first', () => {
  const r = resumeFromText(doc('Acme Corp — Software Engineer\tJan 2021 – Present', 'Designer at Pentagram Partners\t2018 – 2020', 'Data Analyst at Globex, Austin, TX\t2016 – 2018'));
  assert.deepEqual(jobs(r), [['Software Engineer', 'Acme Corp', ''], ['Designer', 'Pentagram Partners', ''], ['Data Analyst', 'Globex', 'Austin, TX']]);
});
