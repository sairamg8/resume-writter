// R4-DOUT-13: the ATS plain-text export's contact line printed LinkedIn before Website (email, phone,
// location, linkedin, website, github), while the PDF, Word and Markdown print them in contactItems /
// CONTACT_FIELDS order (email, phone, location, website, linkedin, github). It now follows that order
// and that set of fields (a hidden one, or one holding only spaces, stays out), and keeps each value
// as typed — a full URL, not the "Display label" — since plain text carries no links.
//
// Run: node --test tests/unit/r4-dout-13-ats-contact-order.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';
import { CONTACT_KEYS, contactItems } from '../../src/utils/contacts.js';

const personal = (extra = {}) => ({
  name: 'Robin Vale', title: 'Platform Engineer',
  email: 'robin@example.com', phone: '+1 555 0199', location: 'Leeds, UK',
  website: 'https://robinvale.example.com', linkedin: 'https://www.linkedin.com/in/robin-vale-sample/',
  github: 'github.com/robin-vale-sample', summary: '', hiddenFields: [],
  ...extra,
});
const contactLine = (p) => generateAtsPlainText({ personal: p, sections: [], settings: {} }).split('\n')[2];

test('the ATS text prints the contact fields in the order every other export prints them', () => {
  const p = personal();
  assert.deepEqual(CONTACT_KEYS, ['email', 'phone', 'location', 'website', 'linkedin', 'github']);
  assert.equal(contactLine(p), [
    'robin@example.com', '+1 555 0199', 'Leeds, UK',
    'https://robinvale.example.com', 'https://www.linkedin.com/in/robin-vale-sample/', 'github.com/robin-vale-sample',
  ].join(' | '));
  // The same fields, in the same order, as contactItems (the PDF / Word / Markdown source).
  assert.deepEqual(contactLine(p).split(' | '), contactItems(p).map(({ key }) => p[key]));
});

test('a hidden field and a blank one stay out; a Display label does not replace the URL', () => {
  const p = personal({ hiddenFields: ['phone', 'github'], location: '   ', linkedinLabel: 'LinkedIn' });
  assert.equal(contactLine(p), 'robin@example.com | https://robinvale.example.com | https://www.linkedin.com/in/robin-vale-sample/');
});
