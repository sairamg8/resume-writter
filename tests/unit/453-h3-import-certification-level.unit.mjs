// H3-453: "AWS Certified Solutions Architect – Associate (2023)" was split at its dash into the certification
// "AWS Certified Solutions Architect" and the issuer "Associate". A level word after the dash belongs to the
// name; a real issuer after a dash ("PMP – Project Management Institute") is still the issuer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

test('a level after the dash stays in the certification name', () => {
  const r = resumeFromText(`Ana Ruiz
ana@example.com

CERTIFICATIONS
AWS Certified Solutions Architect – Associate (2023)
AWS Certified Data Analytics - Specialty (2022)
PMP – Project Management Institute, 2021
Google Data Analytics Professional Certificate – Coursera (2020)
`);
  const items = r.sections.find((s) => s.type === 'certifications').items;
  assert.equal(items.length, 4);
  assert.equal(items[0].name, 'AWS Certified Solutions Architect – Associate');
  assert.equal(items[0].issuer, '');
  assert.equal(items[0].date, '2023');
  assert.equal(items[1].name, 'AWS Certified Data Analytics - Specialty');
  assert.equal(items[1].issuer, '');
  assert.equal(items[2].name, 'PMP');
  assert.equal(items[2].issuer, 'Project Management Institute');
  assert.equal(items[3].issuer, 'Coursera');
});

test('a level and an issuer after the name: the level stays, the issuer is the issuer', () => {
  const r = resumeFromText(`Ana Ruiz
ana@example.com

CERTIFICATIONS
AWS Certified Solutions Architect – Associate – Amazon Web Services (2023)
`);
  const [c] = r.sections.find((s) => s.type === 'certifications').items;
  assert.equal(c.name, 'AWS Certified Solutions Architect – Associate');
  assert.equal(c.issuer, 'Amazon Web Services');
});
