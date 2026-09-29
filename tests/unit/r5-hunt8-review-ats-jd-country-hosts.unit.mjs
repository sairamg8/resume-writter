// Review of R5-HUNT8-ATS-JD-ADDRESSES-HASHTAGS-AS-KEYWORDS: a bare host was blanked only up to its
// ".com" / ".org" / ".gov" / ".edu", so "seek.com.au" left the keyword ".au" (found after any word
// ending in "au", written into Skills by "+"), "acme.gov.in" left ".in", and a host under ".co." or
// ".ac." ("acme.co.uk") stayed a keyword. And one letter before ".com" read as a host: the degrees
// "B.Com" and "M.Com" (Bachelor / Master of Commerce), keywords before, were dropped from the match.
//
// Run: node --test tests/unit/r5-hunt8-review-ats-jd-country-hosts.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());

test('a host with a country ending is blanked whole, leaving no ".au" / ".in" keyword', () => {
  const got = keywords('Payroll Analyst, Excel. Apply at seek.com.au, acme.gov.in, acme.org.uk or acme.edu.au.');
  for (const junk of ['.au', '.in', '.uk', 'au', 'uk', 'seek.com.au', 'acme.gov.in']) {
    assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  }
  assert.ok(got.includes('excel'), got.join(', '));
});

test('a host under .co. or .ac. is no keyword', () => {
  const got = keywords('Data Engineer, Python. Details at careers.acme.co.uk, acme.co.in and ox.ac.uk.');
  for (const junk of ['careers.acme.co.uk', 'acme.co.in', 'ox.ac.uk', 'acme.co.uk']) {
    assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  }
  assert.ok(got.includes('python'), got.join(', '));
});

test('"+" never gets a country ending as a missing keyword', () => {
  const resume = {
    id: 'u', template: 'classic', settings: {},
    personal: { name: 'Anna Weber', title: 'Analyst', summary: '', hiddenFields: [] },
    sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {}, items: [{ id: 's1', category: 'Core', skills: 'Excel' }] }],
  };
  const m = matchResumeWithJob(resume, 'Payroll Analyst, Excel, SAP. Apply at seek.com.au.');
  assert.ok(!m.missingKeywords.some((k) => /^\./.test(k)), JSON.stringify(m.missingKeywords));
});

test('the degrees "B.Com" and "M.Com" stay keywords and match the résumé', () => {
  const jd = 'Accountant. Qualification: B.Com or M.Com (B.Sc/B.Com/BBA), with Tally. B.Com.';
  const got = keywords(jd);
  for (const kw of ['b.com', 'm.com', 'tally']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
  const resume = {
    id: 'u', template: 'classic', settings: {},
    personal: { name: 'Anna Weber', title: 'Accountant', summary: '', hiddenFields: [] },
    sections: [{ id: 'ed', type: 'education', title: 'Education', visible: true, settings: {}, items: [{ id: 'e1', degree: 'B.Com', institution: 'City College' }] }],
  };
  const m = matchResumeWithJob(resume, jd);
  assert.ok(m.matchedKeywords.map((k) => k.toLowerCase()).includes('b.com'), JSON.stringify(m));
});
