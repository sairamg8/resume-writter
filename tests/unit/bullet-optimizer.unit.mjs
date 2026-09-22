import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBullet,
  autoFixWeakPhrases,
  ACTION_VERBS_BY_CATEGORY,
  GOOGLE_XYZ_TEMPLATES
} from '../../src/utils/bulletOptimizer.js';

test('analyzeBullet: identifies action verbs and metrics correctly', () => {
  const result = analyzeBullet('Engineered high-throughput streaming pipeline, reducing query latency by 45% for 1M users.');
  assert.equal(result.hasActionVerb, true);
  assert.equal(result.hasMetric, true);
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.equal(result.weakPhrases.length, 0);
});

test('analyzeBullet: detects weak phrases and suggests improvements', () => {
  const weak = analyzeBullet('Was responsible for working on the database and helped with customer queries.');
  assert.equal(weak.hasActionVerb, false);
  assert.equal(weak.hasMetric, false);
  assert.ok(weak.weakPhrases.length >= 2, 'Should detect multiple weak phrases');
  assert.ok(weak.score < 60, `Expected low score for weak bullet, got ${weak.score}`);
});

test('autoFixWeakPhrases: replaces passive voice with active power verbs', () => {
  const text = 'Was responsible for the deployment and worked on the payment gateway';
  const fixed = autoFixWeakPhrases(text);
  assert.ok(!fixed.includes('Was responsible for'));
  assert.ok(!fixed.includes('worked on'));
  assert.ok(fixed.includes('Led') || fixed.includes('Engineered'));
});

test('ACTION_VERBS_BY_CATEGORY: has rich list across all critical domains', () => {
  const categories = Object.keys(ACTION_VERBS_BY_CATEGORY);
  assert.ok(categories.length >= 5);
  for (const cat of categories) {
    assert.ok(ACTION_VERBS_BY_CATEGORY[cat].length >= 8, `Category ${cat} has enough verbs`);
  }
});

test('GOOGLE_XYZ_TEMPLATES: covers multiple career paths', () => {
  assert.ok(GOOGLE_XYZ_TEMPLATES.length >= 5);
  for (const t of GOOGLE_XYZ_TEMPLATES) {
    assert.ok(t.template.includes('['));
    assert.ok(t.template.includes(']'));
  }
});

// The weak-phrase patterns are global, and RegExp#test on a global pattern starts where its last
// match ended: the same statement was weak on one call and not on the next. The modal runs
// analyzeBullet on every render, so its badge, score and Auto-Fix flickered (bug audit 2026-09-22).
test('analyzeBullet: the same text gets the same verdict every time it is read', () => {
  const text = 'Was responsible for the payments team of 5 engineers and 3 designers';
  const runs = [1, 2, 3, 4, 5].map(() => analyzeBullet(text));
  assert.deepEqual(runs.map((r) => r.weakPhrases.length), [1, 1, 1, 1, 1]);
  assert.deepEqual(new Set(runs.map((r) => r.score)).size, 1);
  // And after reading another statement in between.
  analyzeBullet('Worked on the ledger and handled refunds');
  assert.equal(analyzeBullet(text).weakPhrases.length, 1);
});

test('analyzeBullet: names the words it found weak, as written', () => {
  assert.deepEqual(analyzeBullet('Was responsible for the payments team').weakPhrases.map((w) => w.phrase), ['Was responsible for']);
  assert.deepEqual(analyzeBullet('Helped with onboarding and worked on the API').weakPhrases.map((w) => w.phrase), ['worked on', 'Helped with']);
});
