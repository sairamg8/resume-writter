// R5-HUNT12-AUTOFIX-HELPER-GAP-THEN-BECAME: Auto-Fix dropped a helper verb before "responsible for",
// "tasked with" and "in charge of" only when the phrase followed it directly or after an adverb ending
// in -ly (or "also"). Other adverbs, and a verb that puts someone in the role, still left broken
// grammar: "Was later tasked with rebuilding the API" read "Was later led rebuilding the API",
// "Became responsible for payroll" "Became led payroll", "Was put in charge of QA" "Was put oversaw QA",
// and the power-verb chip wrote "Spearheaded Became responsible for payroll".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases, insertActionVerb } from '../../src/utils/bulletOptimizer.js';

test('an adverb that does not end in -ly goes in front of the verb, as one that does', () => {
  assert.equal(autoFixWeakPhrases('Was later tasked with rebuilding the API'), 'Later led rebuilding the API');
  assert.equal(autoFixWeakPhrases('Was often responsible for on-call'), 'Often led on-call');
  assert.equal(autoFixWeakPhrases('Was then put in charge of hiring'), 'Then oversaw hiring');
  assert.equal(autoFixWeakPhrases('Shipped v2; was soon responsible for QA'), 'Shipped v2; soon led QA');
});

test('a verb that puts someone in the role goes with the phrase', () => {
  assert.equal(autoFixWeakPhrases('Put in charge of the rollout'), 'Oversaw the rollout');
  assert.equal(autoFixWeakPhrases('Became responsible for payroll'), 'Led payroll');
  assert.equal(autoFixWeakPhrases('Got tasked with migrating'), 'Led migrating');
  assert.equal(autoFixWeakPhrases('Held responsible for audits'), 'Led audits');
  assert.equal(autoFixWeakPhrases('Was made responsible for the budget'), 'Led the budget');
  assert.equal(autoFixWeakPhrases('I was put in charge of QA'), 'I oversaw QA');
  assert.equal(autoFixWeakPhrases('Shipped v2; later became responsible for QA'), 'Shipped v2; later led QA');
});

test('a negated one is left as it is, and what was fixed before is fixed the same way', () => {
  for (const t of ['Was not put in charge of QA', "Wasn't made responsible for billing", 'Was not responsible for billing'])
    assert.equal(autoFixWeakPhrases(t), t);
  assert.equal(autoFixWeakPhrases('Was solely responsible for the budget'), 'Solely led the budget');
  assert.equal(autoFixWeakPhrases('Was directly involved in hiring'), 'Was directly involved in hiring');
});

test('the power-verb chip replaces the whole opening, not only goes in front of it', () => {
  assert.equal(insertActionVerb('Became responsible for payroll', 'Spearheaded'), 'Spearheaded payroll');
  assert.equal(insertActionVerb('- Was put in charge of QA', 'Directed'), '- Directed QA');
  assert.equal(insertActionVerb('Got tasked with migrating', 'Spearheaded'), 'Spearheaded migrating');
});
