// Review of R5-HUNT2 (tools): two cases the first fixes left.
// - A figure with no K/M/B scale was still a keyword: "$120000-150000" read "120000-150000", a pay
//   range "120,000-150,000" read "000-150", and "3-5 years" read "3-5" — always missing from the
//   résumé, lowering the match, and "+" wrote them into Skills (R5-HUNT2-ats-jd-salary-figures-as-keywords).
// - A phrase took a time off a word it did not read as a token: in "machine learning-based" the token
//   is "learning-based", so the posting's own "continuous learning" lost its keyword "learning"
//   (R5-HUNT2-ats-jd-phrase-and-its-words-counted-separately).
//
// Run: node --test tests/unit/r5-hunt2-review-ats-jd-figures-phrase-tokens.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());

test('a range of plain numbers is no keyword', () => {
  const got = keywords('Pay $120000-150000 or 120,000-150,000 a year, 3-5 years of Kubernetes, 12-15 LPA.');
  for (const junk of ['120000-150000', '000-150', '3-5', '12-15']) assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  assert.ok(got.includes('kubernetes'), got.join(', '));
});

test('a phrase takes no time off a word it did not read as a token', () => {
  const got = keywords('Build machine learning-based ranking with a continuous learning culture.');
  assert.ok(got.includes('learning'), got.join(', '));
  assert.ok(got.includes('machine learning') && !got.includes('machine'), got.join(', '));
  const tag = keywords('Post #machine learning demos and run machine vision.');
  assert.ok(tag.includes('machine'), tag.join(', '));
});
