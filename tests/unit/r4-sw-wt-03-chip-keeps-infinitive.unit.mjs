// R4-SW-WT-03 (review): Auto-Fix writes "Led efforts to cut hosting costs by 20%" for "Tried to cut…",
// so that a verb stays in front of "cut"; but a power-verb chip then swapped the whole phrase for its
// bare verb — "Spearheaded cut hosting costs by 20%" — the text the replacement was meant to prevent.
// A chip on "Tried to…", "Attempted to…" or "Helped to…" did the same. The chip now replaces only the
// verb and keeps "efforts to"; and Auto-Fix gives "Helped to…" an "efforts to" too, where it wrote
// "Facilitated cut hosting costs".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases, insertActionVerb, analyzeBullet } from '../../src/utils/bulletOptimizer.js';

test('the repro: Auto-Fix, then a power-verb chip, keeps a verb in front of the infinitive', () => {
  const fixed = autoFixWeakPhrases('Tried to cut hosting costs by 20%');
  assert.equal(fixed, 'Led efforts to cut hosting costs by 20%');
  assert.equal(insertActionVerb(fixed, 'Spearheaded'), 'Spearheaded efforts to cut hosting costs by 20%');
});

test('every "… efforts to" Auto-Fix offers keeps its "efforts to" under a chip', () => {
  for (const opener of ['Led', 'Drove', 'Spearheaded', 'Championed', 'Facilitated', 'Supported', 'Accelerated']) {
    assert.equal(insertActionVerb(`${opener} efforts to cut hosting costs by 20%`, 'Orchestrated'), 'Orchestrated efforts to cut hosting costs by 20%', opener);
  }
  assert.equal(insertActionVerb('- Led efforts to cut hosting costs', 'Spearheaded'), '- Spearheaded efforts to cut hosting costs');
});

test('a chip on the raw "Tried to", "Attempted to" or "Helped to" writes "<verb> efforts to"', () => {
  for (const opener of ['Tried to', 'Attempted to', 'Helped to', 'tried to']) {
    assert.equal(insertActionVerb(`${opener} cut hosting costs by 20%`, 'Spearheaded'), 'Spearheaded efforts to cut hosting costs by 20%', opener);
  }
});

test('Auto-Fix on "Helped to" writes a sentence, and a strong verb', () => {
  assert.equal(autoFixWeakPhrases('Helped to cut hosting costs by 20%'), 'Facilitated efforts to cut hosting costs by 20%');
  assert.equal(autoFixWeakPhrases('Shipped v2 and helped to cut hosting costs'), 'Shipped v2 and facilitated efforts to cut hosting costs');
  assert.equal(analyzeBullet('Facilitated efforts to cut hosting costs by 20%').hasActionVerb, true);
  assert.equal(analyzeBullet('Facilitated efforts to cut hosting costs by 20%').weakPhrases.length, 0);
});

test('other phrases a chip replaces are unchanged', () => {
  assert.equal(insertActionVerb('Contributed to the SOC 2 audit', 'Spearheaded'), 'Spearheaded the SOC 2 audit');
  assert.equal(insertActionVerb('Helped with the SOC 2 audit', 'Spearheaded'), 'Spearheaded the SOC 2 audit');
  assert.equal(insertActionVerb('Was responsible for the payments team', 'Spearheaded'), 'Spearheaded the payments team');
  assert.equal(insertActionVerb('Built the ledger service', 'Spearheaded'), 'Spearheaded the ledger service');
});
