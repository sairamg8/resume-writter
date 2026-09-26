// R4-LO-10: "did" is the one weak word that is also a helper verb. Auto-Fix read "did not" as the weak
// "did" and wrote "Delivered not meet the deadline"; the optimizer flagged it as weak too. "did" is now
// weak only as a main verb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';

test('Auto-Fix leaves "did not" alone and still replaces "did" as a main verb', () => {
  assert.equal(autoFixWeakPhrases('Did not miss a deadline in 3 years'), 'Did not miss a deadline in 3 years');
  assert.equal(autoFixWeakPhrases('Shipped 4 releases and did not miss one'), 'Shipped 4 releases and did not miss one');
  assert.equal(autoFixWeakPhrases('Did the quarterly audit; did not miss one'), 'Delivered the quarterly audit; did not miss one');
});

test('the optimizer does not call "did not" a weak phrase', () => {
  assert.deepEqual(analyzeBullet('Shipped 4 releases a year and did not miss one deadline').weakPhrases, []);
  assert.deepEqual(analyzeBullet('Did the quarterly audit for 12 teams').weakPhrases.map((w) => w.phrase), ['Did']);
});
