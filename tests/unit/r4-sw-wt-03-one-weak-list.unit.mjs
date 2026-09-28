// R4-SW-WT-03: the ATS score and the STAR Optimizer kept two weak-phrase lists. "Tasked with rebuilding the
// billing API for 12 teams" was passive language to the score while the optimizer said "No Weak Words"
// and Auto-Fix could not touch it; "Ensured 99.9% uptime across 40 services" was weak to the optimizer
// and clean to the score. There is one list now (bulletOptimizer.js), which the ATS score reads: every
// phrase is weak to both or neither, and what Auto-Fix writes clears both. "did not" stays out of both
// (R4-LO-10), and a phrase inside a longer word is still no phrase (R4-LO-11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';
import { analyzeAtsScore, WEAK_PHRASES } from '../../src/utils/atsChecker.js';

/** Whether the ATS score counts `bullet`, as a résumé's only statement, as passive language. */
function atsWeak(bullet) {
  const r = {
    id: 'wt03', template: 'classic', settings: {}, personal: { name: 'Kim Park', hiddenFields: [] },
    sections: [{ id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', current: true, bullets: [bullet] },
    ] }],
  };
  return analyzeAtsScore(r).categories.experience.items.some((i) => i.id === 'weak_phrases');
}
const optimizerWeak = (bullet) => analyzeBullet(bullet).weakPhrases.length > 0;

// Every phrase either list had before they became one.
const UNION = [
  'was responsible for', 'responsible for', 'responsibilities included', 'duties included', 'tasked with',
  'worked on', 'worked with', 'helped with', 'helped to', 'assisted with', 'assisted in', 'handled',
  'did', 'made sure', 'ensured that', 'ensured', 'changed', 'participated in', 'was involved in',
  'in charge of', 'tried to', 'attempted to',
];
const capitalised = (p) => p[0].toUpperCase() + p.slice(1);

test('the two repros get one verdict from both', () => {
  for (const bullet of ['Tasked with rebuilding the billing API for 12 teams', 'Ensured 99.9% uptime across 40 services']) {
    assert.equal(optimizerWeak(bullet), true, `the optimizer flags "${bullet}"`);
    assert.equal(atsWeak(bullet), true, `the ATS score counts "${bullet}"`);
  }
});

test('every weak phrase is weak to both, and Auto-Fix clears both', () => {
  for (const phrase of UNION) {
    for (const bullet of [`${capitalised(phrase)} the billing service for 3 teams`, `Shipped 4 releases and ${phrase} the billing service`]) {
      assert.equal(optimizerWeak(bullet), true, `optimizer: "${bullet}"`);
      assert.equal(atsWeak(bullet), true, `ATS: "${bullet}"`);
      const fixed = autoFixWeakPhrases(bullet);
      assert.equal(optimizerWeak(fixed), false, `optimizer after Auto-Fix: "${fixed}"`);
      assert.equal(atsWeak(fixed), false, `ATS after Auto-Fix: "${fixed}"`);
    }
  }
  assert.deepEqual([...WEAK_PHRASES].sort(), [...UNION].sort(), 'the ATS list is the union, nothing more');
});

// What Auto-Fix writes for the phrases only the ATS score had. "Tasked with", like "Responsible for" before
// it (tests/unit/bullet-optimizer-ats-agree), becomes "Led", with a gerund after it as its object when
// one followed: grammatical but plain; rewriting "rebuilding" as "Rebuilt" would need verb forms Auto-Fix
// does not have, and misreads "-ing" nouns ("Responsible for engineering at Acme").
test('Auto-Fix replaces the phrases only the ATS score had', () => {
  assert.equal(autoFixWeakPhrases('Tasked with rebuilding the billing API'), 'Led rebuilding the billing API');
  assert.equal(autoFixWeakPhrases('Tried to cut hosting costs by 20%'), 'Led efforts to cut hosting costs by 20%');
  assert.equal(autoFixWeakPhrases('Was involved in the SOC 2 audit'), 'Contributed to the SOC 2 audit');
  assert.equal(analyzeBullet('Led efforts to cut hosting costs by 20%').hasActionVerb, true);
});

test('what is weak to neither stays so', () => {
  for (const bullet of ['Did not miss a deadline in 3 years', 'Networked with 40 hiring managers', 'Fixed 120 unhandled exceptions', 'Shipped 12 releases for 3 teams']) {
    assert.equal(optimizerWeak(bullet), false, `optimizer: "${bullet}"`);
    assert.equal(atsWeak(bullet), false, `ATS: "${bullet}"`);
  }
});
