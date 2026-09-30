// Review of R5-HUNT10-PRESENT-TENSE-VERBS-NOT-ACTION-VERBS. (1) Only "Lead" was checked for a title after
// it, so "Support engineer for the payments team" and "Build engineer on the CI team" read as a present
// verb and a power-verb chip deleted it: "Spearheaded engineer for the payments team". (2) "Contribute
// to…" and "Collaborate on…" — the present tense of two of the chip's own whole phrases — were read as
// a noun before a preposition: "Verb Missing", and a chip left "Spearheaded Contribute to open-source
// projects", the doubled verb the fix was for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, leadsWithActionVerb, analyzeBullet } from '../../src/utils/bulletOptimizer.js';

test('a present form before a title is a role: the chip keeps every word', () => {
  for (const t of ['Support engineer for the payments team', 'Build engineer on the CI team',
    'Support specialist for 3 enterprise accounts', 'Support lead for EMEA']) {
    assert.equal(leadsWithActionVerb(t), false, t);
    assert.equal(insertActionVerb(t, 'Spearheaded'), `Spearheaded ${t}`, t);
  }
  // A plural is the verb's object, and one word "Lead engineers" stays as it was.
  for (const t of ['Manage engineers across 3 teams', 'Support analysts in 4 regions', 'Support 200 customers daily']) {
    assert.equal(leadsWithActionVerb(t), true, t);
  }
  assert.equal(insertActionVerb('Support 200 customers daily', 'Resolved'), 'Resolved 200 customers daily');
  assert.equal(leadsWithActionVerb('Lead engineer for the payments team'), false);
});

test('"Contribute to" and "Collaborate on" are verbs, and a chip replaces the phrase as it does in the past tense', () => {
  for (const t of ['Contribute to open-source projects', 'Collaborate on the SDK with 3 teams']) {
    assert.equal(analyzeBullet(t).hasActionVerb, true, t);
  }
  assert.equal(insertActionVerb('Contribute to open-source projects', 'Spearheaded'), 'Spearheaded open-source projects');
  assert.equal(insertActionVerb('- Collaborate on the SDK', 'Architected'), '- Architected the SDK');
  assert.equal(insertActionVerb('Contributed to open-source projects', 'Spearheaded'), 'Spearheaded open-source projects');
  // A noun before a preposition is still not a verb.
  assert.equal(leadsWithActionVerb('Mentor to 5 interns'), false);
});
