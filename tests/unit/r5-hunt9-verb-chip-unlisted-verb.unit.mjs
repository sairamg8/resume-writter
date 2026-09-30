// R5-HUNT9-OPTIMIZER-VERB-CHIP-DOUBLES-UNLISTED-VERB: the verb list lacked common strong verbs
// ("Launched", "Shipped", "Ran", "Introduced", "Owned"…). A statement opening with one read "Verb
// Missing", and a power-verb chip went in front of it: "Spearheaded Launched automated bill…", from the
// Product Manager starter's own bullet, and "Spearheaded Shipped every release on time", the modal's
// own rewrite tip. The chip now replaces such a verb, and the badge and ATS Check count it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, analyzeBullet, leadsWithActionVerb } from '../../src/utils/bulletOptimizer.js';
import { STARTER_TEMPLATES } from '../../src/utils/starterTemplates.js';

test('a chip replaces a strong verb the list lacked, and does not put a second verb before it', () => {
  const cases = [
    ['Launched automated bill negotiation feature from ideation to delivery.', 'Spearheaded automated bill negotiation feature from ideation to delivery.'],
    ['Shipped every release on time', 'Spearheaded every release on time'],
    ['Ran 12 experiments on protein folding', 'Spearheaded 12 experiments on protein folding'],
    ['Introduced end-to-end tests for the checkout', 'Spearheaded end-to-end tests for the checkout'],
    ['Owned the payments roadmap', 'Spearheaded the payments roadmap'],
    ['- Drove adoption across 3 teams', '- Spearheaded adoption across 3 teams'],
    ['Fine-tuned open-source LLMs', 'Spearheaded open-source LLMs'],
  ];
  for (const [before, after] of cases) assert.equal(insertActionVerb(before, 'Spearheaded'), after, before);
});

test('the badge counts those verbs as action verbs', () => {
  for (const t of ['Launched a feature for 350K users', 'Shipped every release on time', 'Ran 12 experiments']) {
    assert.equal(analyzeBullet(t).hasActionVerb, true, t);
  }
});

test('every starter bullet opens with a verb the optimizer knows', () => {
  for (const starter of STARTER_TEMPLATES) {
    for (const m of JSON.stringify(starter).matchAll(/<li>(?:<p>)?([^<]+)/g)) {
      assert.ok(leadsWithActionVerb(m[1]), `${starter.id}: ${m[1]}`);
    }
  }
});

test('a non-verb opening still takes the verb in front, and weak verbs stay weak', () => {
  assert.equal(insertActionVerb('Kubernetes cluster rollout', 'Spearheaded'), 'Spearheaded Kubernetes cluster rollout');
  for (const t of ['Handled 40 tickets a day', 'Ensured uptime', 'Changed the build']) {
    assert.equal(analyzeBullet(t).hasActionVerb, false, t);
  }
});
