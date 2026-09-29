// The owner's idea (2026-09-29): a role starter on /new put a sample person's name and contacts
// ("Alex Morgan", alex.morgan@email.com, …) on the new résumé, even for a user with a résumé of their
// own. Now the starter takes the user's own name, contacts, links and photo from the résumé /new starts
// from, and keeps the role's job title and summary as its example. With no résumé yet it is unchanged.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResumeFromStarter } from '../../src/utils/starterTemplates.js';
import { starterFrom } from '../../src/utils/newResume.js';
import { CONTACT_KEYS } from '../../src/utils/contacts.js';

const mine = {
  id: 'r_mine', name: 'My résumé', updatedAt: 5,
  personal: {
    name: 'Pat Example', title: 'Staff Engineer', summary: 'My own summary.',
    email: 'pat@example.org', phone: '+44 20 7946 0000', location: 'London, UK',
    website: 'pat.example.org', linkedin: 'linkedin.com/in/pat-example', github: 'github.com/pat-example',
    photo: 'data:image/png;base64,AAAA', hiddenFields: ['phone', 'summary'],
  },
  sections: [],
};

test('a role starter takes the user’s own name, contacts and photo, not the sample person’s', () => {
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine);
  assert.equal(built.personal.name, 'Pat Example');
  for (const key of CONTACT_KEYS) assert.equal(built.personal[key], mine.personal[key], key);
  assert.equal(built.personal.photo, mine.personal.photo);
  assert.doesNotMatch(JSON.stringify(built.personal), /alex/i);
});

test('the role’s job title and summary stay as its example, and are shown', () => {
  const sample = buildResumeFromStarter('software-engineer', 'r_new');
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine);
  assert.equal(built.personal.title, sample.personal.title);
  assert.equal(built.personal.summary, sample.personal.summary);
  assert.deepEqual(built.personal.hiddenFields, ['phone']);
  assert.equal(built.id, 'r_new');
  assert.deepEqual(built.sections, sample.sections);
});

test('the user’s résumé is not changed, and no résumé leaves the starter as it was', () => {
  const before = JSON.stringify(mine);
  const built = starterFrom(buildResumeFromStarter('software-engineer', 'r_new'), mine);
  built.personal.hiddenFields.push('email');
  assert.equal(JSON.stringify(mine), before);
  const sample = buildResumeFromStarter('software-engineer', 'r_x');
  assert.deepEqual(starterFrom(sample, null), sample);
});
