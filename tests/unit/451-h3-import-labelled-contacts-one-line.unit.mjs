// H3-451: contacts that carry their labels and sit one after another on a line with a single space between
// ("Email: ana@example.com Phone: +34 600 123 456", how Word and plain text set them) were one piece: the
// line became the job title, or went to "Additional Information", and neither the e-mail nor the phone was
// kept. Each label now starts its own contact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

test('Email: and Phone: on one line are both read, and the line is not the job title', () => {
  const r = resumeFromText(`Ana Ruiz
Email: ana@example.com Phone: +34 600 123 456
Address: Calle Mayor 5, Madrid

EXPERIENCE
Engineer\tAcme\t2020 - Present
- Did things
`);
  assert.equal(r.personal.name, 'Ana Ruiz');
  assert.equal(r.personal.email, 'ana@example.com');
  assert.equal(r.personal.phone, '+34 600 123 456');
  assert.equal(r.personal.title, '');
});

test('Tel: and Email: after a title line, and a Mobile: after a bar, are all read', () => {
  const r = resumeFromText(`Oliver J. Whitfield
Audit Manager
Tel: 0113 496 0123 Email: o.whitfield@example.co.uk | Mobile: 07700 900123

SKILLS
Audit, Excel
`);
  assert.equal(r.personal.title, 'Audit Manager');
  assert.equal(r.personal.email, 'o.whitfield@example.co.uk');
  assert.equal(r.personal.phone, '0113 496 0123');
  assert.ok(!JSON.stringify(r.sections).includes('o.whitfield'), 'no contact is left in Additional Information');
});

test('a sentence that mentions a label is not cut', () => {
  const r = resumeFromText(`Ana Ruiz
ana@example.com
Please reach me by email: any time works for me and I reply the same day.

SKILLS
Go
`);
  assert.ok(JSON.stringify(r).includes('Please reach me by email: any time works'), 'the sentence stays whole');
});
