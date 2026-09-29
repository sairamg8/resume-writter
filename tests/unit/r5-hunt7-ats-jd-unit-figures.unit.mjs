// A job posting's figures with a unit, a rank or an ordinal — "3x", "10x", "200ms", "#1", "1st" — were
// keywords (R5-HUNT7-ATS-JD-UNIT-FIGURES-AS-KEYWORDS): only plain numbers and K/M/B figures were
// skipped (R5-HUNT2), so they were listed as missing, lowered the match and "+" wrote them into
// Skills. bulletOptimizer's hasMetric reads "3x" and "200ms" as numbers; the scanner now agrees.
//
// Run: node --test tests/unit/r5-hunt7-ats-jd-unit-figures.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());
const JD = 'We are the #1 payments platform. You will cut p99 latency below 200ms and grow throughput 10x. '
  + '3x faster releases, 2-3x cheaper, 5s builds on 16GB boxes. 1st line support rota, 2nd and 3rd shifts, 4th floor.';

test('figures with a unit, a rank or an ordinal are no keywords', () => {
  const got = keywords(JD);
  for (const junk of ['#1', '1', '200ms', '10x', '3x', '2-3x', '5s', '16gb', '1st', '2nd', '3rd', '4th']) assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  for (const kw of ['payments', 'latency', 'throughput', 'p99']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
});

test('they are never missing keywords, so "+" never writes them into Skills', () => {
  const resume = {
    id: 'u', template: 'classic', settings: {},
    personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
    sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {}, items: [{ id: 's1', category: 'Core', skills: 'Payments' }] }],
  };
  const m = matchResumeWithJob(resume, JD);
  assert.ok(!m.missingKeywords.some((k) => /^#?\d/.test(k)), JSON.stringify(m.missingKeywords));
});

test('tech names with digits stay keywords (the guard)', () => {
  const got = keywords('We use S3, EC2, 5G networks, Web3, 3D rendering, 2FA, C# and C++.');
  for (const kw of ['s3', 'ec2', '5g', 'web3', '3d', '2fa', 'c#', 'c++']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
});
