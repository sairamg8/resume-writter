// A pay range in a job posting ("$150K–$180K") became the keywords "150K" and "180K"
// (R5-HUNT2-ats-jd-salary-figures-as-keywords): only plain numbers and "5+" were skipped, so the
// figures were always missing from the résumé, lowered the match and "+" wrote them into Skills.
// A number with a scale suffix (K, M, B) is now no keyword either.
//
// Run: node --test tests/unit/r5-hunt2-ats-jd-salary-figures.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());

test('pay figures are no keywords', () => {
  const got = keywords('Pay: $150K–$180K, or 120k-140k (150-180K) plus $1.5M equity and a 2B+ market. Build CI/CD.');
  for (const junk of ['150k', '180k', '120k-140k', '150-180k', '120k', '140k', '1.5m', '2b+', '2b']) assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  assert.ok(got.includes('ci/cd'), got.join(', '));
});

test('pay figures are never missing keywords', () => {
  const resume = {
    id: 'sal', template: 'classic', settings: {},
    personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
    sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {}, items: [{ id: 's1', category: 'Core', skills: 'CI/CD' }] }],
  };
  const m = matchResumeWithJob(resume, 'Pay: $150K–$180K. Build CI/CD.');
  assert.ok(!m.missingKeywords.some((k) => /^\d/.test(k)), JSON.stringify(m));
});

test('tech names with digits stay keywords (the guard)', () => {
  const got = keywords('We use S3, EC2, Python 3, 5G networks and Web3.');
  for (const kw of ['s3', 'ec2', '5g', 'web3']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
});
