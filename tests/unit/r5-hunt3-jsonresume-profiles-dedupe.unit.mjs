// R5-HUNT3-JSONRESUME-OTHER-PROFILES-DROPPED (review): a Portfolio profile at the address the file
// already gives as basics.url was listed again under "Profiles", and two profiles at one address were
// listed twice. The website is not listed again now, and each address once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';

const profiles = (r) => r.sections.find((s) => s.title === 'Profiles')?.items.map((i) => [i.title, i.subtitle]) || [];

test('the website is not listed again under Profiles, and one address is listed once', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'Ann', url: 'https://ann.dev', profiles: [
    { network: 'Portfolio', url: 'https://ann.dev' },
    { network: 'GitLab', url: 'https://gitlab.com/ann' },
    { network: 'GitLab', url: 'https://gitlab.com/ann' },
  ] } });
  assert.equal(r.personal.website, 'https://ann.dev');
  assert.deepEqual(profiles(r), [['GitLab', 'https://gitlab.com/ann']]);
});

test('a Website and a Portfolio profile at one address fill the Website and add no section', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'Ann', profiles: [
    { network: 'Website', url: 'https://ann.dev' }, { network: 'Portfolio', url: 'https://ann.dev' },
  ] } });
  assert.equal(r.personal.website, 'https://ann.dev');
  assert.equal(r.sections.some((s) => s.title === 'Profiles'), false);
});
