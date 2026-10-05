// R5-HUNT12-PHONE-TEL-LINK-MERGES-EXTENSION: contactHref kept every digit and '+' of the whole Phone
// field as the dial string, so "+1 (555) 123-4567 ext. 890" linked to tel:+15551234567890 (a number
// that does not exist) and "+91 98765 43210 / +91 91234 56789" to tel:+919876543210+919123456789 (no
// valid tel URI) — in the PDF, the .docx and the Markdown, which all link through contactHref. The
// link now dials the first number only, its extension as RFC 3966's ";ext=".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactItems } from '../../src/utils/contacts.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const tel = (phone) => contactHref('phone', { phone });

test('an extension is not glued onto the number', () => {
  assert.equal(tel('+1 (555) 123-4567 ext. 890'), 'tel:+15551234567;ext=890');
  assert.equal(tel('+1 555 123 4567 extension 12'), 'tel:+15551234567;ext=12');
  assert.equal(tel('555-123-4567 x 890'), 'tel:5551234567;ext=890');
  assert.equal(tel('555-123-4567x890'), 'tel:5551234567;ext=890');
  assert.equal(tel('+44 20 7946 0958 #22'), 'tel:+442079460958;ext=22');
});

test('of two numbers, the link dials the first', () => {
  assert.equal(tel('+91 98765 43210 / +91 91234 56789'), 'tel:+919876543210');
  assert.equal(tel('+1 555 010 0000, +1 555 010 0001'), 'tel:+15550100000');
  assert.equal(tel('555-0100; 555-0101'), 'tel:5550100');
  assert.equal(tel('555 0100 or 555 0101'), 'tel:5550100');
  assert.equal(tel('+1 555 010 0000 | +1 555 010 0001'), 'tel:+15550100000');
});

test('a slash inside one number still dials all of it, and a simple number is unchanged', () => {
  assert.equal(tel('030/12345678'), 'tel:03012345678');
  assert.equal(tel('+1 (555) 010-0000'), 'tel:+15550100000');
  assert.equal(tel('+15550100'), 'tel:+15550100');
  assert.equal(tel('On request'), null);
  assert.equal(tel('12'), null);
});

test('the printed text is unchanged and the Markdown link dials the first number', () => {
  const personal = { name: 'Jane', phone: '+1 (555) 123-4567 ext. 890' };
  assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]),
    [['+1 (555) 123-4567 ext. 890', 'tel:+15551234567;ext=890']]);
  const md = generateMarkdownResume({ personal: { name: 'Jane', phone: '+91 98765 43210 / +91 91234 56789' }, settings: {}, sections: [] });
  assert.ok(md.includes('](tel:+919876543210)'), md);
});
