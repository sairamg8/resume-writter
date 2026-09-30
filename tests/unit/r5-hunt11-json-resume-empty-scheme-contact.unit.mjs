// R5-HUNT11-JSON-RESUME-EMPTY-SCHEME-CONTACT: Export → JSON Resume wrote a website, LinkedIn or GitHub
// typed as just "https://" or "www." as basics.url or a profile's url, and an e-mail or phone of only
// spaces as " ", while the PDF, Word, Markdown, ATS text and cover letter print none of them
// (contactItems, R5-HUNT8-EMPTY-WEBSITE-CONTACT): other JSON Resume tools printed links to nothing.
// Now the file holds a contact only when the résumé prints it (contactItems).
//
// Run: node --test tests/unit/r5-hunt11-json-resume-empty-scheme-contact.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

const resumeWith = (personal) => ({
  id: 'r5h11c', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Engineer', summary: '', hiddenFields: [], ...personal },
  sections: [],
});

test('a bare scheme or "www." writes no url and no profile', () => {
  const { basics } = cpwtResumeToJsonResume(resumeWith({ linkedin: 'https://', website: 'www.', github: ' http://www. ' }));
  assert.equal(basics.url, '');
  assert.deepEqual(basics.profiles, []);
});

test('an e-mail or phone of only spaces is written as none', () => {
  const { basics } = cpwtResumeToJsonResume(resumeWith({ email: '   ', phone: ' ' }));
  assert.equal(basics.email, '');
  assert.equal(basics.phone, '');
});

test('printed contacts are still written', () => {
  const { basics } = cpwtResumeToJsonResume(resumeWith({
    email: 'maria@example.com', phone: '555 0100', website: 'maria.dev', linkedin: 'linkedin.com/in/maria',
    github: 'github.com/maria', githubLabel: 'My GitHub',
  }));
  assert.equal(basics.email, 'maria@example.com');
  assert.equal(basics.phone, '555 0100');
  assert.equal(basics.url, 'maria.dev');
  assert.deepEqual(basics.profiles.map((p) => p.url), ['linkedin.com/in/maria', 'github.com/maria']);
  assert.equal(basics.githubLabel, 'My GitHub');
});
