// R5-HUNT1-jsonresume-legacy-schema-fields-lost: a JSON Resume file written to the pre-1.0 schema
// (resume-cli's v0.0.x, which many hosted files still use) names a job's employer `company`, an
// education's grade `gpa`, the website `basics.website`, the photo `basics.picture` and a
// publication's link `website`. The import read only the v1.0.0 names, so every job came in with no
// company and the rest was dropped, silently. A profile with a username and no url (valid in either
// schema) left LinkedIn and GitHub empty. The v1 name still wins when a file has both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';

const section = (r, type) => r.sections.find((s) => s.type === type);

test('a pre-1.0 file keeps its company, GPA, website and photo', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'Richard Hendriks', website: 'http://piedpiper.example.com', picture: 'https://example.com/me.png' },
    work: [{ company: 'Pied Piper', position: 'CEO', startDate: '2013-12-01' }],
    education: [{ institution: 'University of Oklahoma', studyType: 'Bachelor', gpa: '4.0' }],
    publications: [{ name: 'Video compression', publisher: 'IEEE', website: 'http://pub.example.com' }],
  });
  assert.equal(r.personal.website, 'http://piedpiper.example.com');
  assert.equal(r.personal.photo, 'https://example.com/me.png');
  assert.equal(section(r, 'experience').items[0].company, 'Pied Piper');
  assert.equal(section(r, 'education').items[0].gpa, '4.0');
  const pubs = r.sections.find((s) => s.title === 'Publications');
  assert.match(pubs.items[0].description, /pub\.example\.com/);
});

test('the v1.0.0 names win over the legacy ones', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'A', url: 'https://new.example.com', website: 'https://old.example.com' },
    work: [{ name: 'New Co', company: 'Old Co', position: 'Dev' }],
    education: [{ institution: 'U', score: '3.9', gpa: '3.1' }],
  });
  assert.equal(r.personal.website, 'https://new.example.com');
  assert.equal(section(r, 'experience').items[0].company, 'New Co');
  assert.equal(section(r, 'education').items[0].gpa, '3.9');
});

test('a profile with only a username gets its address', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'A', profiles: [{ network: 'GitHub', username: 'rhendriks' }, { network: 'LinkedIn', username: 'richard-h' }, { network: 'Twitter', username: 'rh' }] },
  });
  assert.equal(r.personal.github, 'github.com/rhendriks');
  assert.equal(r.personal.linkedin, 'linkedin.com/in/richard-h');
});

test('a profile url still wins over its username', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'A', profiles: [{ network: 'GitHub', username: 'x', url: 'https://github.com/real' }] } });
  assert.equal(r.personal.github, 'https://github.com/real');
});

// Review: a username that is the address already is used as it is, not appended to the site's
// address ("linkedin.com/in/https://…"), and a display name that is no handle builds no broken link.
test('a username that is an address, or no handle, builds no broken link', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'A', profiles: [{ network: 'LinkedIn', username: 'https://www.linkedin.com/in/jane' }, { network: 'GitHub', username: 'Jane Doe' }] },
  });
  assert.equal(r.personal.linkedin, 'https://www.linkedin.com/in/jane');
  assert.equal(r.personal.github, '');
});
