// The job scanner read a posting's tech phrase and each of its words as separate keywords
// (R5-HUNT2-ats-jd-phrase-and-its-words-counted-separately): "CI/CD" was also "CI" and "CD", "machine
// learning" also "machine" and "learning", so one requirement counted two or three times in the match
// percentage and "+" offered the fragments for Skills. A phrase now counts once; a word the posting
// also uses on its own stays a keyword.
//
// Run: node --test tests/unit/r5-hunt2-ats-jd-phrase-words.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());

test('a phrase\'s words are not keywords of their own', () => {
  const got = keywords('Experience with machine learning and CI/CD required.');
  assert.deepEqual([...got].sort(), ['ci/cd', 'machine learning'], got.join(', '));
});

const resume = (skills) => ({
  id: 'pw', template: 'classic', settings: {},
  personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
  sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {}, items: [
    { id: 's1', category: 'Core', skills },
  ] }],
});

test('the match counts each phrase once and offers no fragment', () => {
  const jd = 'Experience with machine learning and CI/CD required.';
  const miss = matchResumeWithJob(resume('Python'), jd);
  assert.deepEqual(miss.missingKeywords.map((k) => k.toLowerCase()).sort(), ['ci/cd', 'machine learning'], JSON.stringify(miss));
  const hit = matchResumeWithJob(resume('CI/CD, Machine Learning'), jd);
  assert.equal(hit.totalJdKeywords, 2, JSON.stringify(hit));
  assert.equal(hit.matchPercentage, 100, JSON.stringify(hit));
});

test('a word the posting also uses on its own stays a keyword (the guard)', () => {
  const got = keywords('Machine learning and deep learning. Learning is continuous: learning daily. Kubernetes too.');
  for (const kw of ['machine learning', 'deep learning', 'learning', 'kubernetes']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
  assert.ok(!got.includes('machine') && !got.includes('deep'), got.join(', '));
});

test('a one-word phrase ("frontend") stays a keyword (the guard)', () => {
  assert.ok(keywords('Frontend and backend work in React.').includes('frontend'));
});
