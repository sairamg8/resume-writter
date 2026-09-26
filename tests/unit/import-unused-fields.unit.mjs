// R4-IMP-07: a line of named fields under an entry's title — "Technologies: React, Node.js, AWS",
// "Link: …", "ID: …" — was read into the entry's header as fields by name, and a type with no place
// for that name dropped it: a job's technologies, an award's link, a school's credential ID were lost
// without a trace. Such a field now leads the entry's description, as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';

// A fictional person.
const head = 'Jordan Ellery\njordan.ellery@example.com | Leeds, United Kingdom\n\n';
const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a job\'s "Technologies:" line: in its description, before its list', () => {
  const r = resumeFromText(`${head}EXPERIENCE\nAcme Corp — Senior Engineer | Mar 2021 – Present\nTechnologies: React, Node.js, AWS\n• Built the billing service.`);
  const [job] = items(r, 'experience');
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Acme Corp', 'Senior Engineer', 'Mar 2021', true]);
  assert.equal(job.description, '<p>Technologies: React, Node.js, AWS</p><ul><li>Built the billing service.</li></ul>');
});

test('Markdown: "### Entry" over "Technologies: …" keeps it too', () => {
  const r = resumeFromText(markdownLines('# Jordan Ellery\n\n## Volunteering\n### Code Club — Mentor\n*Technologies: Scratch, Python | Jan 2019 – Present*\n'));
  const [post] = items(r, 'volunteering');
  assert.deepEqual([post.role, post.org, post.startDate], ['Mentor', 'Code Club', 'Jan 2019']);
  assert.match(post.description, /<p>Technologies: Scratch, Python<\/p>/);
});

test('a school\'s credential ID and an award\'s link: in their descriptions; the fields a type has, in them', () => {
  const r = resumeFromText(`${head}EDUCATION\nLakeside University — B.S., Computer Science | 2013 – 2017\nGPA: 3.8 | ID: LU-2017-0042\n\nAWARDS\nEmployee of the Year – 2022\nLink: https://news.example.com/award`);
  const [school] = items(r, 'education');
  assert.equal(school.gpa, '3.8');
  assert.match(school.description, /ID: LU-2017-0042/);
  assert.doesNotMatch(school.description, /GPA/);
  const [award] = items(r, 'awards');
  assert.equal(award.title, 'Employee of the Year');
  // The address a link in the rich text (R4-LO-05).
  assert.match(award.description, /Link: <a href="https:\/\/news\.example\.com\/award">https:\/\/news\.example\.com\/award<\/a>/);
});

test('a certificate\'s field it has no place for: under its name in "Additional Information"', () => {
  const r = resumeFromText(`${head}CERTIFICATIONS\nAWS Certified Data Engineer - Amazon Web Services - Jun 2022\nID: DEA-12345 | GPA: 4.0`);
  const [cert] = items(r, 'certifications');
  assert.equal(cert.credentialId, 'DEA-12345');
  const aside = r.sections.find((s) => s.title === 'Additional Information')?.items.find((i) => i.title === 'AWS Certified Data Engineer');
  assert.match(aside?.description || '', /GPA: 4\.0/);
});
