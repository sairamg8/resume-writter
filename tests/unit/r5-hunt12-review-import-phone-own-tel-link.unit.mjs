// R5-HUNT12-REVIEW-IMPORT-PHONE-OWN-TEL-LINK: the import kept a linked phone's text only when the link
// held exactly its digits. Since the phone link dials the first number alone and leaves a bracketed
// trunk 0 out (R5-HUNT12-PHONE-TEL-LINK-MERGES-EXTENSION, R5-HUNT12-REVIEW-TEL-TRUNK-ZERO), the app's own
// Markdown, PDF or Word export of "+44 (0) 20 7946 0958" or "+91 98765 43210 / +91 91234 56789" imported
// as the link's bare digits ("+442079460958", "+919876543210"): the typed text and its format lost. A
// link that is the one the app writes for the text now brings the text back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkText, markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';
import { contactHref } from '../../src/utils/contacts.js';

const roundTrip = (phone) => {
  const md = generateMarkdownResume({ personal: { name: 'Pat Sample', email: 'pat@example.com', phone }, settings: {}, sections: [] });
  return resumeFromText(markdownLines(md)).personal;
};

test('a phone linked the way the app links it reads as its text', () => {
  for (const phone of ['+44 (0) 20 7946 0958', '+91 98765 43210 / +91 91234 56789', '555-0100']) {
    assert.equal(linkText(phone, contactHref('phone', { phone })), phone);
  }
});

test('the app\'s own Markdown brings the typed phone back', () => {
  assert.equal(roundTrip('+44 (0) 20 7946 0958').phone, '+44 (0) 20 7946 0958');
  assert.equal(roundTrip('+91 98765 43210 / +91 91234 56789').phone, '+91 98765 43210');
  assert.equal(roundTrip('+1 (555) 010-0000').phone, '+1 (555) 010-0000');
});

test('a phone label linked somewhere else still shows its link', () => {
  assert.equal(linkText('Call me', 'tel:+15550100000'), 'Call me (tel:+15550100000)');
  assert.equal(linkText('+1 555 010 0001', 'tel:+15550100000'), '+1 555 010 0001 (tel:+15550100000)');
});
