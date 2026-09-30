// R5-HUNT11-VERB-CHIP-ON-WORKED-WITH: a power-verb chip on "Worked with product managers to define the
// roadmap" swapped the whole phrase — "Spearheaded product managers to define the roadmap", the
// colleagues made the thing led — and on "Collaborated with PMs" (what Auto-Fix writes), "Partnered
// with", "Coordinate with" it kept the "with": "Spearheaded with PMs". A chip verb that takes "with"
// now replaces the verb and keeps it; any other leaves the statement for a rewrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary, autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';

test('a chip verb that does not take "with" leaves the statement as it is, and the tip asks for a rewrite', () => {
  for (const t of [
    'Worked with product managers to define the roadmap',
    'Collaborated with PMs on the Q3 launch',
    'Partnered with PMs',
    '- Coordinate with vendors',
    'Liaised with legal',
    autoFixWeakPhrases('Worked with product managers to define the roadmap'),
  ]) {
    for (const verb of ['Spearheaded', 'Directed', 'Architected']) {
      assert.equal(insertActionVerb(t, verb), t, `${verb} on "${t}"`);
      assert.equal(opensWithAuxiliary(t, verb), true, `${verb} on "${t}" gets the tip`);
    }
    assert.equal(opensWithAuxiliary(t), true, `"${t}" gets the tip`);
  }
});

test('a chip verb that takes "with" replaces the verb and keeps the people after "with"', () => {
  assert.equal(insertActionVerb('Worked with product managers to define the roadmap', 'Partnered'), 'Partnered with product managers to define the roadmap');
  assert.equal(insertActionVerb('Collaborated with PMs', 'Liaised'), 'Liaised with PMs');
  assert.equal(insertActionVerb('- Coordinate with vendors', 'Coordinated'), '- Coordinated with vendors');
  assert.equal(opensWithAuxiliary('Collaborated with PMs', 'Partnered'), false);
});

test('other openings keep their behaviour', () => {
  assert.equal(insertActionVerb('Worked on the SDK', 'Spearheaded'), 'Spearheaded the SDK');
  assert.equal(insertActionVerb('Coordinated the launch of 3 products', 'Spearheaded'), 'Spearheaded the launch of 3 products');
  assert.equal(insertActionVerb('Workflow tooling for 12 teams', 'Built'), 'Built Workflow tooling for 12 teams');
  assert.equal(opensWithAuxiliary('Coordinated the launch'), false);
});
