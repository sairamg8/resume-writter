// R4-SW-WT-03 (review): a power-verb chip left a statement opening with a helper verb or not/never as
// it is and asked for a rewrite, but another negative first word still took the verb in front:
// "Spearheaded no customer data was lost during the migration". "No", "Nobody", "None", "Nothing",
// "Neither", "Nor" and "Zero" now get the rewrite tip too; "No-code" and "Zero-downtime" are a
// noun's first word and still take a verb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb, opensWithAuxiliary } from '../../src/utils/bulletOptimizer.js';

const NEGATIVE = [
  'No customer data was lost during the migration',
  'Nobody on the team missed a release',
  'None of the 12 audits found an issue',
  'Nothing shipped late in 2023',
  'Neither release slipped',
  'Nor did the budget grow',
  'Zero outages across 3 launches',
  '- No customer data was lost during the migration',
];

test('a chip leaves a statement opening with a negative as it is, and asks for a rewrite', () => {
  for (const text of NEGATIVE) {
    assert.equal(insertActionVerb(text, 'Spearheaded'), text, `"${text}"`);
    assert.equal(opensWithAuxiliary(text), true, `"${text}" gets the rewrite tip`);
  }
});

test('a noun that starts with No or Zero still takes the verb', () => {
  assert.equal(insertActionVerb('No-code platform rollout for 200 users', 'Spearheaded'), 'Spearheaded no-code platform rollout for 200 users');
  assert.equal(opensWithAuxiliary('No-code platform rollout for 200 users'), false);
  assert.equal(insertActionVerb('Zero-downtime migration of 40 services', 'Spearheaded'), 'Spearheaded Zero-downtime migration of 40 services');
  assert.equal(insertActionVerb('Northwind data platform for 3 teams', 'Led'), 'Led Northwind data platform for 3 teams');
  assert.equal(opensWithAuxiliary('Zero-downtime migration of 40 services'), false);
});
