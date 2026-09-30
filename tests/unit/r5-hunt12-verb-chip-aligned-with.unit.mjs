// R5-HUNT12-VERB-CHIP-ALIGNED-NEGOTIATED-WITH: "Aligned", "Negotiated" and "Integrated" take "with" (they
// are in the chip's own list of verbs that do), but a statement opening with one of them and "with" was
// not treated as "Worked with…" is: a chip swapped only the verb and kept "with" — "Aligned with
// stakeholders on the Q3 roadmap" read "Spearheaded with stakeholders on the Q3 roadmap", and no rewrite
// tip showed. Now only a verb that takes "with" replaces it; any other leaves it for a rewrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary, opensWithVerbWith } from '../../src/utils/bulletOptimizer.js';

const OPENINGS = ['Aligned with stakeholders on the Q3 roadmap', 'Negotiated with vendors to cut costs', '- Integrated with Stripe API', 'Align with design on specs'];

test('a chip verb that does not take "with" leaves the statement for a rewrite', () => {
  for (const t of OPENINGS) {
    for (const verb of ['Spearheaded', 'Engineered']) {
      assert.equal(insertActionVerb(t, verb), t, `${verb} on "${t}"`);
      assert.equal(opensWithAuxiliary(t, verb), true, `${verb} on "${t}" gets the tip`);
    }
    assert.equal(opensWithVerbWith(t), true, t);
  }
});

test('a chip verb that takes "with" replaces the verb and keeps "with"', () => {
  assert.equal(insertActionVerb('Aligned with stakeholders on the Q3 roadmap', 'Partnered'), 'Partnered with stakeholders on the Q3 roadmap');
  assert.equal(insertActionVerb('- Integrated with Stripe API', 'Coordinated'), '- Coordinated with Stripe API');
  assert.equal(opensWithAuxiliary('Negotiated with vendors', 'Liaised'), false);
});

test('the same verbs without "with" are replaced as before', () => {
  assert.equal(insertActionVerb('Aligned 4 teams on one roadmap', 'Spearheaded'), 'Spearheaded 4 teams on one roadmap');
  assert.equal(insertActionVerb('Negotiated a 20% discount', 'Secured'), 'Secured a 20% discount');
  assert.equal(opensWithAuxiliary('Integrated Stripe'), false);
});
