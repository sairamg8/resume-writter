// Typing-freeze finding 7b: autoFixWeakPhrases asked, for every weak phrase it found, whether the text before it
// ended where a sentence starts and whether a negation stood before it, each time on a copy of all the text
// before the phrase (whole.slice(0, offset)) that the two patterns then read from its start: a long text with
// many weak phrases took time squared ('handled ' x 30 000 about 4 s), and a long run of line breaks read again
// from each of them ('handled', 60 000 line breaks, 'x handled') seconds. The two are lookbehinds read backwards
// from the phrase now, with no copy, and answer as they did (the old file is kept in
// tests/fixtures/typing-freeze-reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoFixWeakPhrases } from '../../src/utils/bulletOptimizer.js';
import * as before from '../fixtures/typing-freeze-reference/bulletOptimizer.mjs';

/** The old reading took 3 to 4 s on these; this one takes tens of milliseconds. */
const LIMIT_MS = 1000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a long text full of weak phrases is fixed in linear time', () => {
  const text = 'handled '.repeat(30_000);
  const { out, ms } = timed(() => autoFixWeakPhrases(text));
  assert.equal(out.startsWith('Managed managed managed '), true);
  assert.ok(ms < LIMIT_MS, `autoFixWeakPhrases took ${ms.toFixed(0)} ms on ${text.length} characters`);
  const helper = 'Was not responsible for the budget. '.repeat(10_000);
  const negated = timed(() => autoFixWeakPhrases(helper));
  assert.equal(negated.out, helper);
  assert.ok(negated.ms < LIMIT_MS, `autoFixWeakPhrases took ${negated.ms.toFixed(0)} ms on ${helper.length} characters`);
});

test('a long run of line breaks before a phrase is read in linear time', () => {
  const text = `handled${'\n'.repeat(60_000)}x handled`;
  const { out, ms } = timed(() => autoFixWeakPhrases(text));
  assert.equal(out, `Managed${'\n'.repeat(60_000)}x managed`);
  assert.ok(ms < LIMIT_MS, `autoFixWeakPhrases took ${ms.toFixed(0)} ms on ${text.length} characters`);
});

test('capitals and negations still follow the text before a phrase', () => {
  assert.equal(autoFixWeakPhrases('Engineered 4 APIs; handled QA'), 'Engineered 4 APIs; managed QA');
  assert.equal(autoFixWeakPhrases('Shipped it. Handled QA'), 'Shipped it. Managed QA');
  assert.equal(autoFixWeakPhrases('Was not responsible for billing'), 'Was not responsible for billing');
  assert.equal(autoFixWeakPhrases('Was later tasked with rebuilding the API'), 'Later led rebuilding the API');
});

const PIECES = ['was', 'were', 'is', 'not', 'never', "n't", 'responsible for', 'tasked with', 'in charge of', 'involved in', 'became', 'got', 'put', 'placed', 'made', 'solely', 'later', 'directly',
  'handled', 'worked with', 'worked on', 'did', 'tried to', 'helped to', 'Was', 'Handled', '.', '!', '? ', '\n', '  ', ' ', '-', '•', '"', '(', '2021', 'the budget', 'QA', 'helped with', 'ensured that', 'participated in'];

test('the same text as the old reading on 8000 seeded statements', () => {
  let seed = 31337;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 8000; doc += 1) {
    let text = '';
    const count = 1 + Math.floor(random() * 12);
    for (let i = 0; i < count; i += 1) text += PIECES[Math.floor(random() * PIECES.length)] + (random() < 0.7 ? ' ' : '');
    assert.equal(autoFixWeakPhrases(text), before.autoFixWeakPhrases(text), JSON.stringify(text));
  }
});
