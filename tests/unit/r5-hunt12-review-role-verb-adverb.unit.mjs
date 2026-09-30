// Review of R5-HUNT12-AUTOFIX-HELPER-GAP-THEN-BECAME: Auto-Fix and the power-verb chip took a verb that
// puts someone in the role ("Became", "Was made") only right before the phrase. With an adverb after it,
// or before "involved in" under the chip, the broken grammar stayed: "Became solely responsible for
// payroll" read "Became solely led payroll", "Was made fully responsible for the budget" "Was made fully
// led the budget", and the chip wrote "Spearheaded Became solely responsible for payroll" and
// "Spearheaded Got involved in hiring".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases, insertActionVerb } from '../../src/utils/bulletOptimizer.js';

test('Auto-Fix keeps an adverb after the role verb in front of the new verb', () => {
  assert.equal(autoFixWeakPhrases('Became solely responsible for payroll'), 'Solely led payroll');
  assert.equal(autoFixWeakPhrases('Was made fully responsible for the budget'), 'Fully led the budget');
  assert.equal(autoFixWeakPhrases('Shipped v2; later became directly responsible for QA'), 'Shipped v2; later directly led QA');
  assert.equal(autoFixWeakPhrases('Was later made solely responsible for QA'), 'Later solely led QA');
});

test('a negated one is still left as it is', () => {
  for (const t of ['Was not made solely responsible for billing', 'Never became fully responsible for billing'])
    assert.equal(autoFixWeakPhrases(t), t);
});

test('the chip replaces the whole opening, the adverb kept in front', () => {
  assert.equal(insertActionVerb('Became solely responsible for payroll', 'Spearheaded'), 'Solely spearheaded payroll');
  assert.equal(insertActionVerb('- Was made fully responsible for the budget', 'Directed'), '- Fully directed the budget');
  assert.equal(insertActionVerb('Got involved in hiring', 'Spearheaded'), 'Spearheaded hiring');
  assert.equal(insertActionVerb('Became involved in the migration', 'Drove'), 'Drove the migration');
  assert.equal(insertActionVerb('Became responsible for payroll', 'Spearheaded'), 'Spearheaded payroll');
});
