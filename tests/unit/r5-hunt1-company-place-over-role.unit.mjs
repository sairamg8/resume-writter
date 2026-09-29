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

// Review: a title with no role word before a company with a legal ending ("Barista — Blue Bottle, LLC")
// read the company as the job's location after the place rule (and as its role before it): "LLC",
// "Inc." after a comma is no place, and names the company.
test('"Title — Company, LLC" with no role word keeps its company', () => {
  const [a] = jobs('Barista — Blue Bottle, LLC\nOakland store\nJan 2020 - Present');
  assert.deepEqual([a.company, a.role, a.location], ['Blue Bottle, LLC', 'Barista', '']);
  assert.equal(a.description, '<p>Oakland store</p>');
  const [b] = jobs('Member of Technical Staff — Acme, Inc.\nPlatform\nJan 2020 - Present');
  assert.deepEqual([b.company, b.role, b.location], ['Acme, Inc.', 'Member of Technical Staff', '']);
});

test('a state code like a legal ending is still a place', () => {
  const [job] = jobs('Google — Denver, CO\nSoftware Engineer\nJan 2020 - Present');
  assert.deepEqual([job.company, job.role, job.location], ['Google', 'Software Engineer', 'Denver, CO']);
});

// Review: the same title line over a role line that carries the dates ("Software Engineer ⇥ Jan 2020 –
// Present") read the employer line as two fields of a job title, so it went to the description and the
// job had no company. It is the employer and its place now, over each of its roles.
test('"Company — City, ST" over "Role ⇥ dates": the company and its place', () => {
  const [a, b] = jobs('Google — Mountain View, CA\nSenior Engineer\tJan 2021 - Present\n• x\nEngineer\tJan 2019 - Dec 2020\n• y\n\nMeta — Menlo Park, CA\nIntern\tJun 2018 - Aug 2018\n• z');
  assert.deepEqual([a.company, a.role, a.location, a.description], ['Google', 'Senior Engineer', 'Mountain View, CA', '<ul><li>x</li></ul>']);
  assert.deepEqual([b.company, b.role, b.location], ['Google', 'Engineer', 'Mountain View, CA']);
  const [, , c] = jobs('Google — Mountain View, CA\nSenior Engineer\tJan 2021 - Present\n• x\nEngineer\tJan 2019 - Dec 2020\n• y\n\nMeta — Menlo Park, CA\nIntern\tJun 2018 - Aug 2018\n• z');
  assert.deepEqual([c.company, c.role, c.location], ['Meta', 'Intern', 'Menlo Park, CA']);
});

test('"Acme - Engineer ⇥ dates" is still one job title', () => {
  const [job] = jobs('Acme - Engineer\tJan 2020 - Present\n• x');
  assert.deepEqual([job.company, job.role, job.location], ['Acme', 'Engineer', '']);
});
