// R4-IMP-11: a Languages line was split only at tabs, | • and ·, so "English, Spanish, French" became
// one language of that name, and in "English (Native), Spanish (Fluent)" the lazy match gave English
// the level "Native), Spanish (Fluent". Commas and semicolons outside brackets now part languages too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

// A fictional person.
const langs = (body) => (resumeFromText(`Jordan Ellery\njordan.ellery@example.com\n\nLANGUAGES\n${body}`)
  .sections.find((s) => s.type === 'languages')?.items || []).map((l) => [l.language, l.proficiency]);

test('"English, Spanish, French": three languages', () => {
  assert.deepEqual(langs('English, Spanish, French'), [['English', ''], ['Spanish', ''], ['French', '']]);
});

test('"English (Native), Spanish (Fluent)": each with its level', () => {
  assert.deepEqual(langs('English (Native), Spanish (Fluent)'), [['English', 'Native'], ['Spanish', 'Fluent']]);
});

test('semicolons and "Language: level" pairs; a level with a comma inside brackets stays whole', () => {
  assert.deepEqual(langs('English: Native; German: Intermediate'), [['English', 'Native'], ['German', 'Intermediate']]);
  assert.deepEqual(langs('French (Professional, C1)'), [['French', 'Professional, C1']]);
  assert.deepEqual(langs('English: Full professional, C2'), [['English', 'Full professional, C2']]);
});

test('the layouts read before read as before: a line each, and a grid of cells', () => {
  assert.deepEqual(langs('English: Native\nSpanish — Professional'), [['English', 'Native'], ['Spanish', 'Professional']]);
  assert.deepEqual(langs('English\tNative\tSpanish\tConversational'), [['English', 'Native'], ['Spanish', 'Conversational']]);
});

// The review of R4-IMP-11: a level's own comma, its rest in lower case, is no language.
test('"Spanish: Working knowledge, written": one language, its level whole', () => {
  assert.deepEqual(langs('Spanish: Working knowledge, written'), [['Spanish', 'Working knowledge, written']]);
});
