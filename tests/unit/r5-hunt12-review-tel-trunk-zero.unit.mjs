// R5-HUNT12-REVIEW-TEL-TRUNK-ZERO: an international number written with its trunk prefix in brackets,
// as UK, German, Swiss and Dutch résumés write it ("+44 (0) 20 7946 0958"), linked to tel:+4402079460958:
// the 0 is dialled only from inside the country, never after its code, so the PDF's, the Word file's and
// the Markdown's phone link dialled no number. The link leaves the bracketed 0 out after a "+"; a
// national number keeps its 0, and the text prints as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref, contactItems } from '../../src/utils/contacts.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const tel = (phone) => contactHref('phone', { phone });

test('the bracketed trunk 0 after a country code is not dialled', () => {
  assert.equal(tel('+44 (0) 20 7946 0958'), 'tel:+442079460958');
  assert.equal(tel('+49 (0)30 1234567'), 'tel:+49301234567');
  assert.equal(tel('+41 (0) 44 668 18 00 ext. 12'), 'tel:+41446681800;ext=12');
});

test('a national number keeps its 0, and other brackets are kept', () => {
  assert.equal(tel('(0) 20 7946 0958'), 'tel:02079460958');
  assert.equal(tel('020 7946 0958'), 'tel:02079460958');
  assert.equal(tel('+1 (555) 010-0000'), 'tel:+15550100000');
});

test('the contact prints as typed and the Markdown links the dialable number', () => {
  const personal = { name: 'Jane', phone: '+44 (0) 20 7946 0958' };
  assert.deepEqual(contactItems(personal).map(({ value, href }) => [value, href]), [['+44 (0) 20 7946 0958', 'tel:+442079460958']]);
  assert.ok(generateMarkdownResume({ personal, settings: {}, sections: [] }).includes('](tel:+442079460958)'));
});
