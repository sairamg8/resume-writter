// R5-HUNT4-JSONRESUME-ROUNDTRIP-AS-ENTERED-DATES-ISO: a résumé on Design → Date format "As entered"
// (every new résumé's) prints each date as stored — the month picker's "Jan 2020". Its JSON Resume
// file holds ISO "2020-01" and meta.dateFormat "asEntered", so the import brought the résumé back
// printing "2020-01 – 2023-03" everywhere. The export now keeps each stored form in
// meta.enteredDates, and the import puts it back: the round trip prints what the résumé did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { dateRange, formatDate } from '../../src/utils/dates.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const roundTrip = (resume) => jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));
const resumeIn = (settings) => ({
  personal: { name: 'Pat Sample' }, template: 'classic', settings,
  sections: [
    { id: 'w', type: 'experience', title: 'Work', items: [{ id: 'i', company: 'Acme', role: 'Dev', startDate: 'Jan 2020', endDate: 'Mar 2023' }, { id: 'j', company: 'Bolt', role: 'Dev', startDate: '2018-05', endDate: 'Dec 2019' }] },
    { id: 'e', type: 'education', title: 'Education', items: [{ id: 'k', institution: 'MIT', degree: 'BSc', startDate: 'Sep 2014', endDate: 'Jun 2018' }] },
    { id: 'c', type: 'certifications', title: 'Certifications', items: [{ id: 'l', name: 'AWS', issuer: 'Amazon', date: 'Feb 2021', expiry: 'Feb 2024' }] },
    { id: 'a', type: 'awards', title: 'Awards', items: [{ id: 'm', title: 'Best', awarder: 'X', date: 'Nov 2022' }] },
  ],
});

test('As entered: an export imported back prints every date as the résumé did', () => {
  const resume = resumeIn({});
  const back = roundTrip(resume);
  assert.equal(back.settings.dateFormat, 'asEntered');
  const [work, school, cert, award] = back.sections;
  assert.deepEqual(work.items.map((i) => dateRange(i.startDate, i.endDate, back.settings)), ['Jan 2020 – Mar 2023', '2018-05 – Dec 2019']);
  assert.equal(dateRange(school.items[0].startDate, school.items[0].endDate, back.settings), 'Sep 2014 – Jun 2018');
  assert.deepEqual([cert.items[0].date, cert.items[0].expiry, award.items[0].date], ['Feb 2021', 'Feb 2024', 'Nov 2022']);
  assert.equal(generateAtsPlainText(back), generateAtsPlainText(resume));
});

test('the file itself still holds ISO dates; another Date format keeps them as the file has them', () => {
  const file = cpwtResumeToJsonResume(resumeIn({}));
  assert.deepEqual([file.work[0].startDate, file.work[0].endDate], ['2020-01', '2023-03']);
  const mmm = cpwtResumeToJsonResume(resumeIn({ dateFormat: 'MMM YYYY' }));
  assert.equal(mmm.meta.enteredDates, undefined);
  const back = jsonResumeToCpwtResume(mmm);
  assert.equal(back.sections[0].items[0].startDate, '2020-01');
  assert.equal(formatDate(back.sections[0].items[0].startDate, back.settings), 'Jan 2020');
});
