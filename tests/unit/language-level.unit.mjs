// R2-147 — Section Options → Level for Languages reads a proficiency's words as a level of five
// (src/utils/languageLevel.js): the editor's own five words, LinkedIn's / the ILR's scale, CEFR's letters
// and the everyday words beside them; text it does not know draws nothing (null). Level Text, unset, or
// a value this build does not know draws nothing either.
//
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mod from '../../src/utils/languageLevel.js';

const { languageLevel, languageLevelStyle } = mod;

test('the editor\'s five proficiencies: Native 5, Fluent 4, Professional 3, Intermediate 3, Basic 1', () => {
  assert.deepEqual(['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'].map(languageLevel), [5, 4, 3, 3, 1]);
});

test('LinkedIn\'s / the ILR\'s scale, CEFR\'s letters and everyday words', () => {
  const cases = {
    'Native or bilingual proficiency': 5, Bilingual: 5, 'Mother tongue': 5, C2: 5, 'c2 (Mastery)': 5,
    'Full professional proficiency': 4, 'Fluent': 4, Advanced: 4, C1: 4, 'Upper-intermediate': 4, 'Upper intermediate': 4, B2: 4,
    'Professional working proficiency': 3, Conversational: 3, 'intermediate': 3, B1: 3,
    'Limited working proficiency': 2, Elementary: 2, 'Elementary proficiency': 2, 'Pre-intermediate': 2, A2: 2,
    Beginner: 1, basic: 1, A1: 1,
  };
  for (const [text, level] of Object.entries(cases)) assert.equal(languageLevel(text), level, text);
});

test('text the scale does not know, and none, draws nothing', () => {
  for (const text of ['', '   ', undefined, null, 'Some', 'Reading only', 'Nativeish', 'B3']) assert.equal(languageLevel(text), null, String(text));
});

test('Level: Dots and Bar draw; Text, unset and unknown values draw nothing', () => {
  assert.equal(languageLevelStyle({ levelStyle: 'dots' }), 'dots');
  assert.equal(languageLevelStyle({ levelStyle: 'bar' }), 'bar');
  for (const s of [{ levelStyle: 'text' }, {}, undefined, null, { levelStyle: 'constructor' }, { levelStyle: 'stars' }]) assert.equal(languageLevelStyle(s), null, JSON.stringify(s));
  assert.equal(mod.LEVEL_STEPS, 5);
});

// The review of R2-147: "Non-native" drew five dots, the Native step's, since `\bnative\b` matches after
// the hyphen. A speaker saying they are not native names no level by that word.
test('"Non-native" is not Native: no level unless its other words name one', () => {
  for (const text of ['Non-native', 'non native speaker', 'Non-Native']) assert.equal(languageLevel(text), null, text);
  assert.equal(languageLevel('Non-native, fluent'), 4);
  assert.equal(languageLevel('Native'), 5);
  assert.equal(languageLevel('Bilingual (native)'), 5);
});
