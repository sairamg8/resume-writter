// Review of R5-HUNT12-VERB-CHIP-WORKED-CLOSELY-WITH-TWO-VERBS: any word ending in -ly between the verb
// and "with" was taken for an adverb, so a statement whose object is a noun ending in -ly ("Aligned supply
// with demand forecasts", "Coordinated assembly with 3 plants") was treated as "Worked closely with…":
// a chip that does not take "with" left it unchanged, with a tip that only such a verb could go there.
// "supply" is the verb's object, as "4 teams" is in "Aligned 4 teams…": the chip replaces the verb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary, opensWithVerbWith } from '../../src/utils/bulletOptimizer.js';

test('a noun ending in -ly before "with" is the object, and a chip replaces the verb', () => {
  assert.equal(insertActionVerb('Aligned supply with demand forecasts', 'Spearheaded'), 'Spearheaded supply with demand forecasts');
  assert.equal(opensWithAuxiliary('Aligned supply with demand forecasts', 'Spearheaded'), false);
  assert.equal(opensWithVerbWith('Aligned supply with demand forecasts'), false);
  assert.equal(insertActionVerb('- Coordinated assembly with 3 plants', 'Orchestrated'), '- Orchestrated assembly with 3 plants');
  assert.equal(opensWithAuxiliary('Integrated anomaly with alerting', 'Engineered'), false);
});

test('an adverb ending in -ly is still one', () => {
  assert.equal(insertActionVerb('Worked closely with PMs', 'Spearheaded'), 'Worked closely with PMs');
  assert.equal(opensWithAuxiliary('Aligned quarterly with finance', 'Spearheaded'), true);
  assert.equal(insertActionVerb('Coordinated daily with vendors', 'Partnered'), 'Partnered daily with vendors');
});
