// R5-HUNT12-REVIEW-TEL-EXT-BRACKET-COMMA: the phone link (contactHref → telHref) read an extension only
// when it followed the number directly, so "+1 555 123 4567 (ext 12)" still linked to tel:+1555123456712
// (the extension's digits glued onto the number, the bug R5-HUNT12-PHONE-TEL-LINK-MERGES-EXTENSION set
// out to end) and "(555) 123-4567, ext. 890" cut at the comma and lost its extension. Both are this
// number's extension: the link dials the number with ";ext=".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactHref } from '../../src/utils/contacts.js';

const tel = (phone) => contactHref('phone', { phone });

test('an extension in brackets is not glued onto the number', () => {
  assert.equal(tel('+1 555 123 4567 (ext 12)'), 'tel:+15551234567;ext=12');
  assert.equal(tel('+1 (555) 123-4567 (ext. 890)'), 'tel:+15551234567;ext=890');
  assert.equal(tel('555-123-4567 [x890]'), 'tel:5551234567;ext=890');
});

test('an extension after a comma or a slash stays the number\'s', () => {
  assert.equal(tel('(555) 123-4567, ext. 890'), 'tel:5551234567;ext=890');
  assert.equal(tel('+44 20 7946 0958, x22'), 'tel:+442079460958;ext=22');
  assert.equal(tel('555-123-4567 / ext 5'), 'tel:5551234567;ext=5');
});

test('a second number after a comma is still no extension, and a bracketed area code is kept', () => {
  assert.equal(tel('+1 555 010 0000, +1 555 010 0001'), 'tel:+15550100000');
  assert.equal(tel('(555) 123-4567'), 'tel:5551234567');
  assert.equal(tel('+1 (555) 123-4567 ext. 890'), 'tel:+15551234567;ext=890');
});
