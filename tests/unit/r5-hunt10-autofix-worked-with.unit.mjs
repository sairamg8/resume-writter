// R5-HUNT10-AUTOFIX-WORKED-WITH-ENGINEERED: "worked with" shared "worked on"'s replacement, so Auto-Fix
// wrote "Engineered product managers to define the roadmap": "worked with" takes people or a team as its
// object. It now writes "Collaborated with", and the badges still read a strong verb and no weak words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases, analyzeBullet } from '../../src/utils/bulletOptimizer.js';

test('Auto-Fix on "Worked with <people>" writes "Collaborated with"', () => {
  const cases = [
    ['Worked with product managers to define the roadmap', 'Collaborated with product managers to define the roadmap'],
    ['Worked with 5 clients weekly', 'Collaborated with 5 clients weekly'],
    ['Worked with the design team on onboarding', 'Collaborated with the design team on onboarding'],
    ['Shipped v2 and worked with QA on releases', 'Shipped v2 and collaborated with QA on releases'],
  ];
  for (const [before, after] of cases) {
    assert.equal(autoFixWeakPhrases(before), after, before);
    const a = analyzeBullet(after);
    assert.equal(a.weakPhrases.length, 0, after);
  }
  assert.equal(analyzeBullet('Collaborated with product managers to define the roadmap').hasActionVerb, true);
  const tip = analyzeBullet('Worked with product managers to define the roadmap').suggestions.join(' ');
  assert.match(tip, /"Collaborated with"/);
  assert.doesNotMatch(tip, /Engineered/);
});

test('"Worked on" still becomes "Engineered"', () => {
  assert.equal(autoFixWeakPhrases('Worked on the payments API'), 'Engineered the payments API');
});
