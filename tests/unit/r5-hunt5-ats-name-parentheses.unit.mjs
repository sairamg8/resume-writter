// R5-HUNT5-ATS-NAME-WITH-PARENTHESES-CRITICAL-FAIL: ATS Check passed a name only with 2+ words and
// none of [0-9@#$%^&*()_+=], and warned only on a single word, so "Jane Smith (she/her)" or
// "Robert (Bob) Smith" fell to a critical "Missing or invalid candidate name" with 0 of 4 points,
// scoring below a bare first name. Pronouns or a nickname in parentheses are now set aside and the
// words outside them are checked.
//
// Run: node --test tests/unit/r5-hunt5-ats-name-parentheses.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';

const nameItem = (name) => analyzeAtsScore({
  personal: { name, email: 'jane@example.com', phone: '+1 (555) 234-5678', location: 'Pune, India', hiddenFields: [] },
  sections: [], settings: {},
}).categories.contact.items.find((i) => i.id === 'name');

test('a full name with pronouns or a nickname in parentheses passes', () => {
  for (const name of ['Jane Smith (she/her)', 'Robert (Bob) Smith', 'Jane Smith (Jay)']) {
    const item = nameItem(name);
    assert.equal(item.status, 'pass', name);
    assert.doesNotMatch(item.text, /Missing/i, name);
  }
});

test('other names score as before', () => {
  assert.equal(nameItem('Jane Smith').status, 'pass');
  assert.equal(nameItem('Bob').status, 'warn');
  assert.equal(nameItem('Bob (he/him)').status, 'warn');
  assert.equal(nameItem('').status, 'fail');
  assert.equal(nameItem('Jane Smith2').status, 'fail');
});
