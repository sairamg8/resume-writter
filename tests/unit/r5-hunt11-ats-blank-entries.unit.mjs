// R5-HUNT11-ATS-SCORES-BLANK-ENTRIES: an Experience or Education entry added and left blank prints
// nothing (entryPrints / printedEntries: PDF, Word, Markdown, ATS text), yet the ATS Check read it:
// "All roles have Job Title and Company Name" turned into "Some roles missing Job Title or Company",
// "All roles have clear employment dates" into "Missing employment dates on some roles" (5 points
// off), Education warned about a missing institution, and "What a parser reads" (printedJobs) showed
// an empty job that split a company's grouped roles. The score now reads only the entries that print.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore, printedJobs } from '../../src/utils/atsChecker.js';

// A new entry, as Add entry makes it (SectionEditorLeafItems.jsx NEW_ITEM).
const blankJob = { id: 'e_blank', company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '', bullets: [] };
const blankDegree = { id: 'd_blank', institution: '', degree: '', fieldOfStudy: '', location: '', startDate: '', endDate: '', gpa: '', description: '', bullets: [] };

const sample = ({ blank = false, grouped = false } = {}) => ({
  id: 'r5h11', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: grouped ? { groupRoles: true } : {}, items: [
      { id: 'e1', company: 'Northwind Traders', role: 'Staff Engineer', startDate: '2021-01', current: true,
        bullets: ['Built a billing service handling 10k requests per second.'] },
      ...(blank ? [blankJob] : []),
      ...(grouped ? [{ id: 'e2', company: 'Northwind Traders', role: 'Engineer', startDate: '2018-01', endDate: '2020-12',
        bullets: ['Cut deploy time by 40% for 12 services.'] }] : []),
    ] },
    { id: 'edu', type: 'education', title: 'Education', visible: true, items: [
      { id: 'd1', institution: 'State University', degree: 'B.S.', fieldOfStudy: 'Computer Science', endDate: '2017-05' },
      ...(blank ? [blankDegree] : []),
    ] },
    { id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [{ id: 's1', category: 'Languages', skills: 'Go, Python' }] },
  ],
});

const items = (r, cat) => Object.fromEntries(analyzeAtsScore(r).categories[cat].items.map((i) => [i.id, i]));

test('a blank Experience entry changes no experience item and no score', () => {
  const before = analyzeAtsScore(sample());
  const after = analyzeAtsScore(sample({ blank: true }));
  const exp = items(sample({ blank: true }), 'experience');
  assert.equal(exp.role_company.status, 'pass', exp.role_company.text);
  assert.equal(exp.exp_dates.status, 'pass', exp.exp_dates.text);
  assert.equal(after.categories.experience.score, before.categories.experience.score);
  assert.equal(after.categories.education.score, before.categories.education.score);
  assert.equal(after.totalScore, before.totalScore);
});

test('a blank Education entry is not a degree missing its institution', () => {
  const edu = items(sample({ blank: true }), 'education');
  for (const item of Object.values(edu)) assert.notEqual(item.status, 'fail', `${item.id}: ${item.text}`);
  assert.deepEqual(
    Object.values(edu).map((i) => [i.id, i.status]),
    Object.values(items(sample(), 'education')).map((i) => [i.id, i.status]),
  );
});

test('"What a parser reads" lists no blank job, and a blank entry does not split grouped roles', () => {
  assert.equal(printedJobs(sample({ blank: true })).length, 1);
  const jobs = printedJobs(sample({ blank: true, grouped: true }));
  assert.equal(jobs.length, 2);
  assert.equal(jobs[1].groupLead, 0, 'the later role still reads its company from the employer header');
});

test('an Experience section with only a blank entry has no roles', () => {
  const r = sample();
  r.sections[0].items = [blankJob];
  assert.ok(items(r, 'experience').exp_empty, 'no experience entries found');
});
