// A JSON Resume round trip keeps the résumé's Design → Date format. The file carried none, so the
// import gave every résumé its starter's (Classic's "MMM YYYY"): one printing its dates As entered
// ("2021-03") or as MM/YYYY came back printing "Mar 2021" in the PDF, Word and every text export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { DATE_FORMATS } from '../../src/utils/dates.js';

const roundTrip = (resume) => jsonResumeToCpwtResume(JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume))));
const resumeIn = (settings) => ({
  personal: { name: 'Pat Sample' }, template: 'classic', settings,
  sections: [{ id: 's', type: 'experience', title: 'Work', items: [{ id: 'i', company: 'Acme', role: 'Dev', startDate: '2021-03', endDate: '2023-06' }] }],
});

test('every Date format comes back as it was, and the dates print as before', () => {
  for (const dateFormat of DATE_FORMATS) {
    const resume = resumeIn({ dateFormat });
    const back = roundTrip(resume);
    assert.equal(back.settings.dateFormat, dateFormat);
    assert.equal(generateAtsPlainText(back), generateAtsPlainText(resume), dateFormat);
  }
});

test('a résumé that never set one (As entered) comes back As entered, not in the starter\'s format', () => {
  const resume = resumeIn({});
  const back = roundTrip(resume);
  assert.equal(back.settings.dateFormat, 'asEntered');
  assert.match(generateAtsPlainText(back), /2021-03 - 2023-06/);
});

test('a file with no Date format, or one this build does not know, takes the starter\'s', () => {
  const file = cpwtResumeToJsonResume(resumeIn({ dateFormat: 'MM/YYYY' }));
  delete file.meta.dateFormat;
  assert.equal(jsonResumeToCpwtResume(file).settings.dateFormat, 'MMM YYYY');
  file.meta.dateFormat = 'DD-MM-YY';
  assert.equal(jsonResumeToCpwtResume(file).settings.dateFormat, 'MMM YYYY');
});
