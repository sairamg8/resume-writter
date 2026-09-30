// R5-HUNT11-AUTOFIX-AFTER-HELPER-VERB: Auto-Fix replaced a weak phrase and left the helper verb before
// it: "Was tasked with rebuilding the billing API" read "Was led rebuilding the billing API", "Was in
// charge of onboarding" "Was oversaw onboarding", "Were responsible for payroll" "Were led payroll".
// Only "was responsible for" was listed with its helper verb. The helper verb now goes with the phrase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';

test('a helper verb before a weak phrase goes with it', () => {
  assert.equal(autoFixWeakPhrases('Was tasked with rebuilding the billing API'), 'Led rebuilding the billing API');
  assert.equal(autoFixWeakPhrases('Was in charge of onboarding 12 hires'), 'Oversaw onboarding 12 hires');
  assert.equal(autoFixWeakPhrases('Were responsible for payroll'), 'Led payroll');
  assert.equal(autoFixWeakPhrases('Have been responsible for QA'), 'Have led QA');
  assert.equal(autoFixWeakPhrases('Were involved in hiring'), 'Contributed to hiring');
  assert.equal(autoFixWeakPhrases('- Was tasked with X. Were in charge of Y'), '- Led X. Oversaw Y');
});

test('inside a sentence the replacement stays lowercase, and a passive keeps its helper verb', () => {
  assert.equal(autoFixWeakPhrases('I was responsible for QA'), 'I led QA');
  assert.equal(autoFixWeakPhrases('Shipped v2; was in charge of onboarding'), 'Shipped v2; oversaw onboarding');
  assert.equal(autoFixWeakPhrases('Was involved in hiring'), 'Contributed to hiring');
  assert.equal(autoFixWeakPhrases('The ticket was handled by me'), 'The ticket was managed by me');
});
