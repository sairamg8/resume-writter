// R5-HUNT6-JSON-RESUME-IGNORES-LINK-URL-OVERRIDE: Export → JSON Resume writes a website / LinkedIn /
// GitHub's Link URL override into the schema's url fields (basics.url, basics.profiles[].url). It wrote
// the value as typed ('jdoe', 'My site'), so any other JSON Resume tool printed a dead link, while the
// PDF, Word, Markdown and ATS text link to the override. The app's own round trip still brings back the
// typed value, the label and the Link URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { contactItems } from '../../src/utils/contacts.js';

const resumeWith = (personal) => ({ personal: { name: 'Jo Doe', hiddenFields: [], ...personal }, template: 'classic', settings: {}, sections: [] });
const exportOf = (resume) => JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume)));

const PERSONAL = {
  website: 'My site', websiteUrl: 'https://jdoe.dev',
  linkedin: 'jdoe', linkedinUrl: 'https://www.linkedin.com/in/jdoe',
  github: '@jdoe', githubLabel: 'My code', githubUrl: 'https://github.com/jdoe',
};

test('the schema\'s url fields hold the Link URL override, not the typed value', () => {
  const { basics } = exportOf(resumeWith(PERSONAL));
  assert.equal(basics.url, 'https://jdoe.dev');
  assert.deepEqual(basics.profiles.map((p) => p.url), ['https://www.linkedin.com/in/jdoe', 'https://github.com/jdoe']);
});

test('the app\'s round trip brings back each typed value, label and Link URL', () => {
  const back = jsonResumeToCpwtResume(exportOf(resumeWith(PERSONAL))).personal;
  for (const k of Object.keys(PERSONAL)) assert.equal(back[k], PERSONAL[k], k);
  assert.deepEqual(contactItems(back), contactItems(resumeWith(PERSONAL).personal));
});

test('no override, or one the PDF would not follow: the typed value, and no extra key', () => {
  const { basics } = exportOf(resumeWith({ website: 'https://jdoe.dev', github: 'github.com/jdoe', githubUrl: 'javascript:alert(1)' }));
  assert.equal(basics.url, 'https://jdoe.dev');
  assert.deepEqual(basics.profiles.map((p) => p.url), ['github.com/jdoe']);
  assert.deepEqual(Object.keys(basics).filter((k) => k.endsWith('Text')), []);
});

test('a hidden field\'s Link URL is still not in the file', () => {
  const text = JSON.stringify(cpwtResumeToJsonResume(resumeWith({ ...PERSONAL, hiddenFields: ['linkedin'] })));
  assert.ok(!text.includes('linkedin.com/in/jdoe'));
  assert.ok(!text.includes('"jdoe"'));
});
