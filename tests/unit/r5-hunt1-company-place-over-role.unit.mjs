// R5-HUNT1-text-import-company-location-as-role: a job typed "Google — Mountain View, CA" over its
// title "Software Engineer" read the city as the role and moved the real title into the description.
// A place after the company on its title line is the job's location now, and the line under it the
// role. A company with a comma of its own after a role ("Senior Engineer — Acme, Inc.") stays the company.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (text) => (resumeFromText(`Jane Doe\njane@x.com\n\nEXPERIENCE\n${text}\n`).sections.find((s) => s.type === 'experience')?.items || []);

test('"Company — City, ST" over the role: the place is the location', () => {
  const [job] = jobs('Google — Mountain View, CA\nSoftware Engineer\nJan 2020 - Present\n• Built x');
  assert.deepEqual([job.company, job.role, job.location], ['Google', 'Software Engineer', 'Mountain View, CA']);
  assert.equal(job.description, '<ul><li>Built x</li></ul>');
});

test('a title with no role word under it is still the role', () => {
  const [job] = jobs('Blue Bottle — Oakland, CA\nBarista\nJan 2020 - Present');
  assert.deepEqual([job.company, job.role, job.location], ['Blue Bottle', 'Barista', 'Oakland, CA']);
});

test('"Role — Company, Inc." keeps its company', () => {
  const [job] = jobs('Senior Engineer — Acme, Inc.\nPayments team\nJan 2020 - Present');
  assert.deepEqual([job.company, job.role], ['Acme, Inc.', 'Senior Engineer']);
  assert.equal(job.location, '');
});
