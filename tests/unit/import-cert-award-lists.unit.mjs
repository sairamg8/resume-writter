// R4-IMP-01: a bulleted Certifications list imported as one certificate, the first bullet, with no
// date (a date was read only off a line that was no list item); every other certificate went into its
// `description`, which a certificate has nowhere — not in the editor, the PDF or Word: lost from view.
// A bulleted Awards list became one award too. Each list item is its own entry now, with its date; and
// a certificate's text with no field for it lands in "Additional Information" under its name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

// A fictional person.
const head = 'Jordan Ellery\njordan.ellery@example.com | Leeds, United Kingdom\n\n';
const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a bulleted Certifications list: a certificate per bullet, each with its date', () => {
  const r = resumeFromText(`${head}CERTIFICATIONS\n• AWS Certified Solutions Architect – 2022\n• Certified Kubernetes Administrator – 2021\n• PMP`);
  assert.deepEqual(items(r, 'certifications').map((c) => [c.name, c.date]), [
    ['AWS Certified Solutions Architect', '2022'],
    ['Certified Kubernetes Administrator', '2021'],
    ['PMP', ''],
  ]);
  assert.ok(items(r, 'certifications').every((c) => c.description === undefined), 'no hidden description');
});

test('a Markdown list with issuers and a date line under an item', () => {
  const r = resumeFromText(`${head}CERTIFICATIONS\n- Google Data Analytics Certificate - Coursera - Mar 2021\n- Scrum Master (PSM I) - Scrum Alliance\nJun 2020\n- ITIL Foundation`);
  assert.deepEqual(items(r, 'certifications').map((c) => [c.name, c.issuer, c.date]), [
    ['Google Data Analytics Certificate', 'Coursera', 'Mar 2021'],
    ['Scrum Master (PSM I)', 'Scrum Alliance', 'Jun 2020'],
    ['ITIL Foundation', '', ''],
  ]);
});

test('a bulleted Awards list: an award per bullet', () => {
  const r = resumeFromText(`${head}AWARDS\n• Employee of the Year – 2022\n• Hackathon winner, Northwind Hack Week – 2020\n• Dean's List`);
  assert.deepEqual(items(r, 'awards').map((a) => [a.title, a.date]), [
    ['Employee of the Year', '2022'],
    ['Hackathon winner, Northwind Hack Week', '2020'],
    ["Dean's List", ''],
  ]);
});

test('a certificate\'s lines with no field for them: in "Additional Information" under its name, not a hidden description', () => {
  const r = resumeFromText(`${head}CERTIFICATIONS\nAWS Certified Data Engineer - Amazon Web Services - Jun 2022\nPassed with a score of 920 out of 1000.`);
  const [cert] = items(r, 'certifications');
  assert.deepEqual([cert.name, cert.issuer, cert.date], ['AWS Certified Data Engineer', 'Amazon Web Services', 'Jun 2022']);
  assert.equal(cert.description, undefined);
  const extra = r.sections.find((s) => s.title === 'Additional Information');
  assert.ok(extra, 'an "Additional Information" section');
  const aside = extra.items.find((i) => i.title === 'AWS Certified Data Engineer');
  assert.match(aside?.description || '', /Passed with a score of 920 out of 1000\./);
});
