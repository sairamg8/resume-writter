// The job scanner found its fixed tech phrases ("front end", "system design", "rest api", …) with a
// bare indexOf in the posting and a bare includes in the résumé (R5-HUNT1-ats-jd-phrase-substring-match):
// "storefront endpoints" read as "front end", "ecosystem design" as "system design", so a posting that
// named neither listed them as missing (and "+" wrote them into Skills), and a résumé that only said
// "ecosystem design" matched "system design". The phrase's casing was sliced from the raw posting at an
// index found in its lowercased copy, which a posting's "İ" (two characters lowercased) shifted. Phrases
// are now whole words in both, cased from the text they were found in.
//
// Run: node --test tests/unit/r5-hunt1-ats-jd-phrases.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());

test('a phrase inside other words is no keyword of the posting', () => {
  const got = keywords('You will own our storefront endpoints and ecosystem design reviews, a fallback endpoint and interest API.');
  for (const junk of ['front end', 'system design', 'back end', 'rest api']) assert.ok(!got.includes(junk), `"${junk}" in ${got.join(', ')}`);
});

test('a phrase the posting names is still a keyword (the guard)', () => {
  const got = keywords('Front end work, system design interviews and a REST API. Back end too; CI/CD pipelines.');
  for (const phrase of ['front end', 'system design', 'rest api', 'back end', 'ci/cd']) assert.ok(got.includes(phrase), `${phrase} in ${got.join(', ')}`);
});

test('the phrase keeps the posting\'s casing when the posting holds an "İ"', () => {
  const kws = extractJobKeywords('Based in İstanbul. Machine Learning experience required.').map((k) => k.keyword);
  assert.ok(kws.includes('Machine Learning'), kws.join(' | '));
});

const resumeSaying = (bullet) => ({
  id: 'ph', template: 'classic', settings: {},
  personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
  sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
    { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
  ] }],
});

test('a résumé phrase inside other words does not match the posting\'s phrase', () => {
  const m = matchResumeWithJob(resumeSaying('Led ecosystem design workshops'), 'Strong system design skills.');
  assert.ok(m.missingKeywords.some((k) => k.toLowerCase() === 'system design'), JSON.stringify(m));
  assert.ok(!m.matchedKeywords.some((k) => k.toLowerCase() === 'system design'), JSON.stringify(m));
});

test('a résumé that says the phrase matches it (the guard)', () => {
  const m = matchResumeWithJob(resumeSaying('Ran system design reviews on Node.js and CI/CD.'), 'Strong system design skills. Node.js, CI/CD.');
  for (const kw of ['system design', 'node.js', 'ci/cd']) assert.ok(m.matchedKeywords.some((k) => k.toLowerCase() === kw), `${kw}: ${JSON.stringify(m)}`);
});
