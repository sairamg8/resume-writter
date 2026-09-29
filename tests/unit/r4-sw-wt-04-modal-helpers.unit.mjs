// R4-SW-WT-04 (review): a power-verb chip leaves a statement that opens with a helper verb or a negation
// as it is, and the optimizer asks for a rewrite — but the modal helper verbs were left out, so
// "Could not reproduce the bug until 2023" took the chip's verb in front: "Spearheaded Could not
// reproduce…". Can/cannot/can't, could, will/won't, would, shall, should, must, may and might are
// helper verbs too. "May" before a number is the month, and a statement opening with it still takes a verb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary } from '../../src/utils/bulletOptimizer.js';

const MODAL = [
  'Could not reproduce the bug until 2023',
  "Couldn't reproduce the bug until 2023",
  "Can't ship without a review",
  'Can’t ship without a review',
  'Cannot ship without a review',
  'Can deploy to 3 regions',
  "Won't miss a release",
  'Will own the billing roadmap',
  "Wouldn't sign off on the audit",
  'Should cut costs by 20%',
  "Shouldn't need a pager",
  'Shall report to the CTO',
  'Must keep 99.9% uptime',
  'Might double revenue',
  'May need a second region',
  '- Could not reproduce the bug until 2023',
];

test('a chip leaves a statement opening with a modal helper verb as it is, and asks for a rewrite', () => {
  for (const text of MODAL) {
    assert.equal(insertActionVerb(text, 'Spearheaded'), text, `"${text}"`);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the rewrite tip`);
  }
});

test('a word that only starts like a modal, and May the month, still take the verb', () => {
  assert.equal(insertActionVerb('May 2023: shipped the billing API', 'Spearheaded'), 'Spearheaded May 2023: shipped the billing API');
  assert.equal(opensWithAuxiliary('May 2023: shipped the billing API'), false);
  assert.equal(insertActionVerb('Canary releases for 40 services', 'Spearheaded'), 'Spearheaded Canary releases for 40 services');
  assert.equal(insertActionVerb('Willow data platform for 3 teams', 'Spearheaded'), 'Spearheaded Willow data platform for 3 teams');
  assert.equal(opensWithAuxiliary('Mustang fleet tooling'), false);
});
