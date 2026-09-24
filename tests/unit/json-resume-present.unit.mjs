// An education, project or volunteering role can be current since R2-150, printing
// '<start> – Present'. A JSON Resume trip lost the flag: the file held no end date and nothing else,
// the import read the entry back as past, and it printed its start date alone. The flag now goes out
// with the entry and comes back; a past entry, and another tool's entry with no flag, stay past.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { endDateOf } from '../../src/utils/dates.js';

const resume = {
  personal: { name: 'Mira Tidewell' }, template: 'classic', settings: {},
  sections: [
    { id: 's1', type: 'education', title: 'Education', items: [
      { id: 'e1', institution: 'Harbor College', degree: 'BSc', startDate: 'Sep 2022', endDate: '', current: true },
      { id: 'e2', institution: 'Cove School', degree: 'Diploma', startDate: 'Sep 2018', endDate: 'Jun 2022' },
    ] },
    { id: 's2', type: 'projects', title: 'Projects', items: [
      { id: 'p1', name: 'Tidewatch', startDate: 'Jan 2023', endDate: '', current: true },
    ] },
    { id: 's3', type: 'volunteering', title: 'Volunteering', items: [
      { id: 'v1', org: 'Shore Crew', role: 'Warden', startDate: 'Mar 2021', endDate: '', current: true },
    ] },
  ],
};

const ends = (r, type) => r.sections.find((s) => s.type === type).items.map((i) => endDateOf(i, {}) || '');

test('a current education, project or volunteering role comes back current (R2-150)', () => {
  const file = cpwtResumeToJsonResume(resume);
  assert.deepEqual(file.education.map((e) => [e.endDate, Boolean(e.current)]), [['', true], ['2022-06', false]]);
  const back = jsonResumeToCpwtResume(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(ends(back, 'education'), ['Present', '2022-06']);
  assert.deepEqual(ends(back, 'projects'), ['Present']);
  assert.deepEqual(ends(back, 'volunteering'), ['Present']);
});

test("another tool's education with no end date and no flag stays as it was read", () => {
  const back = jsonResumeToCpwtResume({ basics: { name: 'X' }, education: [{ institution: 'Elsewhere', startDate: '2020-09' }] });
  assert.deepEqual(ends(back, 'education'), ['']);
});
