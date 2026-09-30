// R5-HUNT12-VERB-CHIP-WORKED-CLOSELY-WITH-TWO-VERBS: "Worked with PMs" takes only a chip verb that takes
// "with" (R5-HUNT11), but with an adverb before "with" ("Worked closely with PMs"), "alongside" for
// "with", or "Teamed up with", the chip went in front of the verb: "Spearheaded Worked closely with PMs to
// ship…", "Partnered Worked closely with…", "Spearheaded Teamed up with sales". They now go as "Worked
// with…" does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary, opensWithVerbWith } from '../../src/utils/bulletOptimizer.js';

const OPENINGS = [
  'Worked closely with PMs to ship the checkout redesign',
  'Worked alongside designers',
  'Teamed up with sales',
  '- Worked cross-functionally with legal',
  'Coordinated closely with vendors',
];

test('a chip verb that does not take "with" leaves the statement for a rewrite', () => {
  for (const t of OPENINGS) {
    for (const verb of ['Spearheaded', 'Architected']) {
      assert.equal(insertActionVerb(t, verb), t, `${verb} on "${t}"`);
      assert.equal(opensWithAuxiliary(t, verb), true, `${verb} on "${t}" gets the tip`);
    }
    assert.equal(opensWithVerbWith(t), true, t);
  }
});

test('a chip verb that takes "with" replaces the verb and keeps the adverb', () => {
  assert.equal(insertActionVerb('Worked closely with PMs to ship the checkout redesign', 'Partnered'), 'Partnered closely with PMs to ship the checkout redesign');
  assert.equal(insertActionVerb('Teamed up with sales', 'Partnered'), 'Partnered with sales');
  assert.equal(insertActionVerb('- Worked cross-functionally with legal', 'Liaised'), '- Liaised cross-functionally with legal');
  assert.equal(opensWithAuxiliary('Worked alongside designers', 'Collaborated'), false);
});

test('other openings keep their behaviour', () => {
  assert.equal(insertActionVerb('Worked on the SDK', 'Spearheaded'), 'Spearheaded the SDK');
  assert.equal(insertActionVerb('Workflow tooling with 12 teams', 'Built'), 'Built Workflow tooling with 12 teams');
  assert.equal(insertActionVerb('Coordinated the launch of 3 products', 'Spearheaded'), 'Spearheaded the launch of 3 products');
});
