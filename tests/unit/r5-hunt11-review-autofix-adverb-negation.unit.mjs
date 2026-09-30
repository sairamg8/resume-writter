// Review of R5-HUNT11-AUTOFIX-AFTER-HELPER-VERB: the helper verb went only when it stood right before
// the phrase. With an adverb between them — the usual résumé wording — Auto-Fix still wrote broken
// grammar: "Was solely responsible for the budget" read "Was solely led the budget", "Was also tasked
// with hiring" "Was also led hiring". A negation read "Was not led billing" and "Wasn't oversaw QA".
// Now the adverb goes in front of the verb, and a negated phrase that is no verb is left as it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';

test('an adverb between the helper verb and the phrase goes in front of the verb', () => {
  assert.equal(autoFixWeakPhrases('Was solely responsible for the $2M budget'), 'Solely led the $2M budget');
  assert.equal(autoFixWeakPhrases('Was also tasked with hiring'), 'Also led hiring');
  assert.equal(autoFixWeakPhrases('Were jointly responsible for payroll'), 'Jointly led payroll');
  assert.equal(autoFixWeakPhrases('- Was fully in charge of QA'), '- Fully oversaw QA');
  assert.equal(autoFixWeakPhrases('Shipped v2; was primarily in charge of onboarding'), 'Shipped v2; primarily oversaw onboarding');
  assert.equal(autoFixWeakPhrases('I was solely responsible for QA'), 'I solely led QA');
});

test('a negated phrase that is no verb is left as it is', () => {
  for (const t of [
    'Was not responsible for billing',
    "Wasn't in charge of hiring",
    'Was never tasked with QA',
    'Was not directly responsible for the audit',
  ]) assert.equal(autoFixWeakPhrases(t), t);
});

test('what was fixed before is fixed the same way', () => {
  assert.equal(autoFixWeakPhrases('Was tasked with rebuilding the billing API'), 'Led rebuilding the billing API');
  assert.equal(autoFixWeakPhrases('Was involved in hiring'), 'Contributed to hiring');
  assert.equal(autoFixWeakPhrases('Was directly involved in hiring'), 'Was directly involved in hiring');
  assert.equal(autoFixWeakPhrases('The ticket was not handled by QA'), 'The ticket was not managed by QA');
  assert.equal(autoFixWeakPhrases('Responsible for QA; never handled billing'), 'Led QA; never managed billing');
});
