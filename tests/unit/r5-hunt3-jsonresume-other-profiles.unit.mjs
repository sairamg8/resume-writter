// R5-HUNT3-JSONRESUME-OTHER-PROFILES-DROPPED: the JSON Resume import read only a LinkedIn and a GitHub
// profile; every other one (GitLab, X/Twitter, Stack Overflow, a portfolio, a second LinkedIn) was
// dropped, silently. A web page fills the Website when the file names none now, and the rest are kept
// in a "Profiles" section to review, as the text import keeps the contacts it cannot place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';

const profiles = (r) => r.sections.find((s) => s.title === 'Profiles')?.items.map((i) => [i.title, i.subtitle]) || [];

test('profiles the header has no field for are kept', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'Ann', profiles: [
      { network: 'GitLab', url: 'https://gitlab.com/ann' },
      { network: 'Twitter', url: 'https://twitter.com/ann' },
      { network: 'Portfolio', url: 'https://ann.dev' },
      { network: 'Stack Overflow', username: 'ann' },
    ] },
    work: [], education: [],
  });
  assert.equal(r.personal.website, 'https://ann.dev');
  assert.deepEqual(profiles(r), [['GitLab', 'https://gitlab.com/ann'], ['Twitter', 'https://twitter.com/ann'], ['Stack Overflow', '@ann']]);
  assert.equal(r.sections.find((s) => s.title === 'Profiles').type, 'custom');
});

test('a website in basics wins, and the portfolio is listed; a second LinkedIn is kept too', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'Ann', url: 'https://ann.example.com', profiles: [
    { network: 'LinkedIn', url: 'https://linkedin.com/in/ann' },
    { network: 'LinkedIn', url: 'https://linkedin.com/in/ann-two' },
    { network: 'GitHub', url: 'https://github.com/ann' },
    { network: 'Portfolio', url: 'https://ann.dev' },
  ] } });
  assert.equal(r.personal.website, 'https://ann.example.com');
  assert.equal(r.personal.linkedin, 'https://linkedin.com/in/ann');
  assert.equal(r.personal.github, 'https://github.com/ann');
  assert.deepEqual(profiles(r), [['LinkedIn', 'https://linkedin.com/in/ann-two'], ['Portfolio', 'https://ann.dev']]);
});

test('a file with only LinkedIn and GitHub adds no section', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'Ann', profiles: [
    { network: 'LinkedIn', url: 'https://linkedin.com/in/ann' }, { network: 'GitHub', username: 'ann' },
  ] } });
  assert.equal(r.personal.github, 'github.com/ann');
  assert.equal(r.sections.some((s) => s.title === 'Profiles'), false);
});
