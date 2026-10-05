// R5-HUNT11 review of R5-HUNT11-TITLECASE-HEADING-NO-BLANK-LINE: a known title in Title Case with no
// blank line before it starts its section, and "Volunteering" is one. In an interests list typed a
// hobby a line each ("Hiking", "Volunteering", "Photography") it started a Volunteering section, the
// hobbies after it its entries. A hobby there stays a hobby; another section after the list still starts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

test('"Volunteering" in an interests list a line each is a hobby, not a section', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nExperience\nAcme\tJan 2021 – Present\nEngineer\n• x\n\nInterests\nHiking\nVolunteering\nPhotography\n');
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'interests']);
  assert.match(JSON.stringify(r.sections[1].items), /Volunteering/);
  assert.match(JSON.stringify(r.sections[1].items), /Photography/);
});

test('a Title-Case "Certifications" after the interests list still starts its section', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nExperience\nAcme\tJan 2021 – Present\nEngineer\n• x\n\nInterests\nHiking\nVolunteering\nCertifications\nAWS Solutions Architect\n');
  assert.deepEqual(r.sections.map((s) => s.type), ['experience', 'interests', 'certifications']);
});
