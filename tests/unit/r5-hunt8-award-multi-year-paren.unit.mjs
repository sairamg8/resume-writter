// R5-HUNT8-AWARD-MULTI-YEAR-PAREN: an award or a certificate dated with several years in brackets
// ("Dean’s List (2018, 2019)") was split at the last comma inside the brackets: the title "Dean’s List
// (2018" with its bracket left open, and the last year alone as its date. A split inside brackets is no
// date's now: the years stay in the title, as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('an award with several years in brackets keeps them, its bracket closed', () => {
  const r = resumeFromText('Jane Doe\n\nAwards\n• Dean’s List (2017, 2018, 2019)\n• Dean’s List (Fall 2018, Spring 2019)\n• Hackathon Winner, 2019');
  const a = items(r, 'awards');
  assert.deepEqual(a.map((x) => [x.title, x.date]), [
    ['Dean’s List (2017, 2018, 2019)', ''],
    ['Dean’s List (Fall 2018, Spring 2019)', ''],
    ['Hackathon Winner', '2019'],
  ]);
});

test('a certificate with two years in brackets keeps them too; one year in brackets is still its date', () => {
  const r = resumeFromText('Jane Doe\n\nCertifications\n• AWS Certified (2018, 2021)\n• Certified ScrumMaster (2020)');
  const c = items(r, 'certifications');
  assert.deepEqual(c.map((x) => [x.name, x.date]), [['AWS Certified (2018, 2021)', ''], ['Certified ScrumMaster', '2020']]);
});
