// A job posting's web and e-mail addresses and its hashtags were keywords
// (R5-HUNT8-ATS-JD-ADDRESSES-HASHTAGS-AS-KEYWORDS): "https://careers.acme.com/jobs" was read as
// "https" and "careers.acme.com", "jobs@acme.com" as "acme.com", and LinkedIn's "#LI-Remote" and
// "#hiring" stayed as written, so they were listed as missing, lowered the match and "+" wrote them
// into Skills. They are now read as no keyword; tech names with dots or a "#" stay.
//
// Run: node --test tests/unit/r5-hunt8-ats-jd-addresses-hashtags.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword.toLowerCase());
const JD = 'Senior React Developer. 5+ years React, TypeScript, Node.js. Apply at https://careers.acme.com/jobs '
  + 'or email jobs@acme.com. See www.acme.io/about and (acme.org). #LI-Remote #hiring';

test('addresses and hashtags in a posting are no keywords', () => {
  const got = keywords(JD);
  for (const junk of ['https', 'careers.acme.com', 'acme.com', 'www.acme.io', 'acme.io', 'acme.org', '#li-remote', '#hiring', 'li-remote', 'hiring']) {
    assert.ok(!got.includes(junk), `${junk} in ${got.join(', ')}`);
  }
  for (const kw of ['react', 'typescript', 'node.js']) assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
});

test('they are never missing keywords, so "+" never writes them into Skills', () => {
  const resume = {
    id: 'u', template: 'classic', settings: {},
    personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
    sections: [{ id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {}, items: [{ id: 's1', category: 'Core', skills: 'React' }] }],
  };
  const m = matchResumeWithJob(resume, JD);
  assert.ok(!m.missingKeywords.some((k) => /^#|\.(com|org|io)$|^https?$/i.test(k)), JSON.stringify(m.missingKeywords));
});

test('tech names with a dot or a "#" stay keywords (the guard)', () => {
  const got = keywords('We use ASP.NET, .NET, socket.io, Vue.js, C#, F#, C++, CI/CD and machine learning.');
  for (const kw of ['asp.net', '.net', 'socket.io', 'vue.js', 'c#', 'f#', 'c++', 'ci/cd', 'machine learning']) {
    assert.ok(got.includes(kw), `${kw} in ${got.join(', ')}`);
  }
});
