// The job scanner stripped every token's leading punctuation, the dot of ".NET" too
// (R5-HUNT1-ats-jd-dotnet-stripped): a posting asking for ".NET" had the keyword "NET", which a
// résumé's "net revenue" matched, and which "+" wrote into Skills as "NET". The one dot that starts a
// name is now kept, and ".NET" matches ".NET" or "ASP.NET" only.
//
// Run: node --test tests/unit/r5-hunt1-ats-jd-dotnet.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const JD = 'Requirements: .NET, C#, Azure. We ship .NET services.';
const keywords = (jd) => extractJobKeywords(jd).map((k) => k.keyword);

test('".NET" in a posting is the keyword ".NET", not "NET"', () => {
  const got = keywords(JD);
  assert.ok(got.includes('.NET'), got.join(', '));
  assert.ok(!got.includes('NET'), got.join(', '));
});

test('an ellipsis or a lone dot before a word is still stripped (the guard)', () => {
  const got = keywords('Kotlin...Swift and . Rust ...Haskell');
  for (const word of ['Rust', 'Haskell']) assert.ok(got.includes(word), `${word} in ${got.join(', ')}`);
  assert.ok(!got.some((k) => k.startsWith('.')), got.join(', '));
});

const resumeSaying = (bullet) => ({
  id: 'dn', template: 'classic', settings: {},
  personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [] },
  sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
    { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
  ] }],
});

test('"net revenue" does not match ".NET"', () => {
  const m = matchResumeWithJob(resumeSaying('Grew net revenue by 20%'), JD);
  assert.ok(m.missingKeywords.includes('.NET'), JSON.stringify(m));
  assert.ok(!m.matchedKeywords.some((k) => k.toLowerCase().includes('net')), JSON.stringify(m));
});

test('".NET" and "ASP.NET" on the résumé match ".NET" (the guard)', () => {
  for (const bullet of ['Built .NET services', 'Built ASP.NET Core APIs']) {
    const m = matchResumeWithJob(resumeSaying(bullet), JD);
    assert.ok(m.matchedKeywords.includes('.NET'), `${bullet}: ${JSON.stringify(m)}`);
  }
});
