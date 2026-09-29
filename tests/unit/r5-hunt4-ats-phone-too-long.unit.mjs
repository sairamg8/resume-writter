// R5-HUNT4-ATS-PHONE-OVER-15-DIGITS-CALLED-SHORT: ATS Check passes a phone of 10–15 digits, and
// everything else of 7 or more fell into its "Short phone number format — Include area code and
// country code" warning, more than 15 digits included: two numbers or an extension in the field were
// called short and told to add a country code. More than 15 digits now gets its own warning (one
// number, please), with the same 2 of 4 points; 7–9 digits keep the short-number warning.
//
// Run: node --test tests/unit/r5-hunt4-ats-phone-too-long.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const phoneItem = (phone) => analyzeAtsScore({
  personal: { name: 'Jane Doe', email: 'jane@example.com', phone, location: 'Pune, India', hiddenFields: [] },
  sections: [], settings: {},
}).categories.contact.items.find((i) => i.id === 'phone');

test('two numbers or an extension (more than 15 digits) are not called short', () => {
  for (const phone of ['+91 98765 43210 / +91 91234 56789', '+1 (555) 123-4567 ext. 890123']) {
    const item = phoneItem(phone);
    assert.equal(item.status, 'warn', phone);
    assert.doesNotMatch(item.text, /short/i, phone);
    assert.doesNotMatch(item.detail, /area code|country code/i, phone);
    assert.match(`${item.text} ${item.detail}`, /more than one number|single reachable number/i, phone);
  }
});

test('10–15 digits still pass and 7–9 digits are still called short', () => {
  assert.equal(phoneItem('+1 (555) 234-5678').status, 'pass');
  assert.equal(phoneItem('+44 20 7946 0958 12').status, 'pass'); // 14 digits
  const short = phoneItem('555-1234');
  assert.equal(short.status, 'warn');
  assert.match(short.text, /Short phone number format/);
});
