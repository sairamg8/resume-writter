// R5-HUNT11-JSON-RESUME-BARE-SCHEME-URL-WITH-LABEL: a website, LinkedIn or GitHub typed as just "https://"
// (or "www.") that carries a Display label prints the label unlinked in the PDF (contactItems: no href),
// while Export → JSON Resume wrote basics.url "https://" — a link to nothing — next to it. A value with
// no host is no address: the file's url is '' (and a bare profile is left out), the label stays, and the
// value as typed rides as `${key}Text` so the app's own round trip still prints the label.
//
// Run: node --test tests/unit/r5-hunt11-json-resume-bare-scheme-label.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume, cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { contactItems } from '../../src/utils/contacts.js';

const resumeWith = (personal) => ({
  id: 'r5h11b', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Engineer', summary: '', hiddenFields: [], ...personal },
  sections: [],
});
const exportOf = (resume) => JSON.parse(JSON.stringify(cpwtResumeToJsonResume(resume)));

const BARE = { website: 'https://', websiteLabel: 'My site', linkedin: 'www.', linkedinLabel: 'Me', github: ' http:// ', githubLabel: 'My code' };

test('a bare scheme under a Display label writes no url and no profile, and keeps the label', () => {
  // The PDF prints each label with nothing to link to: the file names no address either.
  assert.deepEqual(contactItems(BARE).map(({ value, href }) => [value, href]), [['My site', null], ['Me', null], ['My code', null]]);
  const { basics } = exportOf(resumeWith(BARE));
  assert.equal(basics.url, '');
  assert.deepEqual(basics.profiles, []);
  assert.equal(basics.websiteLabel, 'My site');
  assert.equal(basics.linkedinLabel, 'Me');
  assert.equal(basics.githubLabel, 'My code');
});

test('the round trip brings back the typed value and the label: the same contact lines print', () => {
  const resume = resumeWith(BARE);
  const back = jsonResumeToCpwtResume(exportOf(resume)).personal;
  for (const k of Object.keys(BARE)) assert.equal(back[k], BARE[k], k);
  assert.deepEqual(contactItems(back), contactItems(resume.personal));
  assert.deepEqual(contactItems(back).map(({ value }) => value), ['My site', 'Me', 'My code']);
});

test('a bare field beside real ones: only the real ones are profiles, and every label survives', () => {
  const resume = resumeWith({ website: 'maria.dev', linkedin: 'https://', linkedinLabel: 'Me', github: 'github.com/maria' });
  const { basics } = exportOf(resume);
  assert.equal(basics.url, 'maria.dev');
  assert.deepEqual(basics.profiles.map((p) => p.url), ['github.com/maria']);
  const back = jsonResumeToCpwtResume(exportOf(resume)).personal;
  assert.equal(back.linkedin, 'https://');
  assert.equal(back.linkedinLabel, 'Me');
  assert.equal(back.github, 'github.com/maria');
  assert.deepEqual(contactItems(back), contactItems(resume.personal));
});

test('a real address, or a Link URL override the PDF follows, is still written', () => {
  const { basics } = exportOf(resumeWith({
    website: 'https://', websiteLabel: 'My site', websiteUrl: 'https://maria.dev',
    github: 'github.com/maria', githubLabel: 'My code',
  }));
  assert.equal(basics.url, 'https://maria.dev');
  assert.deepEqual(basics.profiles.map((p) => p.url), ['github.com/maria']);
  assert.equal(basics.githubText, undefined);
});

test('a bare scheme with no label is still no contact', () => {
  const { basics } = exportOf(resumeWith({ website: 'https://', linkedin: 'www.', github: 'http://' }));
  assert.equal(basics.url, '');
  assert.deepEqual(basics.profiles, []);
  assert.deepEqual(Object.keys(basics).filter((k) => /Label$|Text$|Url$/.test(k)), []);
});

test('a hand-written file: an empty url beside another tool\'s Portfolio profile keeps that profile', () => {
  const file = { basics: { name: 'Jo', url: '', websiteText: 'https://', websiteLabel: 'My site', profiles: [{ network: 'Portfolio', url: 'https://jo.dev' }] } };
  const back = jsonResumeToCpwtResume(file).personal;
  assert.equal(back.website, 'https://');
  assert.equal(back.websiteLabel, 'My site');
  assert.equal(jsonResumeToCpwtResume(file).sections.some((s) => JSON.stringify(s).includes('https://jo.dev')), true);
});
