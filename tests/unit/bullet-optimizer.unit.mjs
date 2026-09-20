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
