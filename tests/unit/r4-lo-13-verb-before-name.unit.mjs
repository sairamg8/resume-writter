// R4-LO-13: a power verb chip put before a first word that is no verb lowercased any capitalised word,
// names too: "Kubernetes cluster…" became "Spearheaded kubernetes cluster…". Only a word that is never
// a name (an article, a preposition, a pronoun…) is lowercased now; any other keeps its case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertActionVerb } from '../../src/utils/bulletOptimizer.js';

test('a name leading the statement keeps its capital', () => {
  assert.equal(insertActionVerb('Kubernetes cluster rollout for 40 services', 'Spearheaded'), 'Spearheaded Kubernetes cluster rollout for 40 services');
  assert.equal(insertActionVerb('Salesforce migration', 'Orchestrated'), 'Orchestrated Salesforce migration');
  assert.equal(insertActionVerb('New Relic rollout for 40 services', 'Spearheaded'), 'Spearheaded New Relic rollout for 40 services');
  assert.equal(insertActionVerb('I led a team of 5', 'Spearheaded'), 'Spearheaded I led a team of 5');
  assert.equal(insertActionVerb('- Stripe integration', 'Architected'), '- Architected Stripe integration');
});

test('a function word is still lowercased, and an acronym stays as it is', () => {
  assert.equal(insertActionVerb('In 2023, built a billing API', 'Spearheaded'), 'Spearheaded in 2023, built a billing API');
  assert.equal(insertActionVerb('The checkout flow', 'Redesigned'), 'Redesigned the checkout flow');
  assert.equal(insertActionVerb('AWS migration', 'Architected'), 'Architected AWS migration');
});
