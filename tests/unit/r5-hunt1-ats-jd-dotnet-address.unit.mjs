// A posting's ".NET" is now the keyword ".NET" (R5-HUNT1-ats-jd-dotnet-stripped), found after letters
// too, as in "ASP.NET": and so at the end of every .net address the résumé prints. A résumé whose only
// ".net" was its e-mail "anna@weber.net", its website "annaweber.net", a project's link or a
// reference's e-mail listed ".NET" as matched, and "+" never offered it. A keyword that starts with a
// dot is now looked for without the résumé's e-mail and web addresses.
//
// Run: node --test tests/unit/r5-hunt1-ats-jd-dotnet-address.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchResumeWithJob, extractResumeCorpus } from '../../src/utils/atsChecker.js';

const JD = 'Requirements: .NET, C#, Azure. We ship .NET services.';

const resume = ({ personal = {}, bullet = 'Grew revenue by 20%', sections = [] } = {}) => ({
  id: 'dna', template: 'classic', settings: {},
  personal: { name: 'Anna Weber', title: 'Engineer', summary: '', hiddenFields: [], ...personal },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
    ] },
    ...sections,
  ],
});

const dotNetMatched = (r) => matchResumeWithJob(r, JD).matchedKeywords.includes('.NET');

test('a .net e-mail or website in the header does not match ".NET"', () => {
  assert.equal(dotNetMatched(resume({ personal: { email: 'anna@weber.net' } })), false);
  assert.equal(dotNetMatched(resume({ personal: { website: 'https://www.annaweber.net/' } })), false);
});

test('a project link or a reference e-mail on .net does not match ".NET"', () => {
  assert.equal(dotNetMatched(resume({ sections: [
    { id: 'pr', type: 'projects', title: 'Projects', visible: true, settings: {}, items: [{ id: 'p1', name: 'Shop', url: 'shop.net' }] },
  ] })), false);
  assert.equal(dotNetMatched(resume({ sections: [
    { id: 'rf', type: 'references', title: 'References', visible: true, settings: {}, items: [{ id: 'r1', name: 'Tom Lee', email: 'tom@lee.net' }] },
  ] })), false);
});

test('".NET" or "ASP.NET" in the words still matches, beside a .net address (the guard)', () => {
  assert.equal(dotNetMatched(resume({ personal: { email: 'anna@weber.net' }, bullet: 'Built ASP.NET Core APIs' })), true);
  assert.equal(dotNetMatched(resume({ personal: { website: 'annaweber.net', websiteLabel: 'My .NET blog' } })), true);
});

test('the corpus still holds the addresses for every other keyword (the guard)', () => {
  const r = resume({ personal: { email: 'anna@weber.net', github: 'https://github.com/anna' } });
  assert.match(extractResumeCorpus(r), /anna@weber\.net/);
  assert.ok(matchResumeWithJob(r, 'GitHub GitHub. Azure.').matchedKeywords.includes('GitHub'));
});
