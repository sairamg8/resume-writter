// Typing-freeze finding 7b (the same shape as the trailing-run patterns): three more patterns in bulletOptimizer.js
// read back over text they had read, once per start. /<[^>]+>/g in analyzeBullet read to the end of the text from
// every "<" that had no ">" after it ('<' x 100 000: seconds); the fiscal-year pattern's two \s* around an
// optional mark split a run of spaces every way ('FY' and 60 000 spaces); and the lookbehind of "a digit that is no
// part of a name" read back over the whole run of digits before each of them ('a' and 100 000 digits). They are
// scans now and answer as the patterns did (the old file is kept in tests/fixtures/typing-freeze-reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, hasMetric, stripTags } from '../../src/utils/bulletOptimizer.js';
import * as before from '../fixtures/typing-freeze-reference/bulletOptimizer.mjs';

/** The old patterns took 4 to 12 s on these; the scans read them in a few milliseconds. */
const LIMIT_MS = 1000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a long run of "<" with no ">" is read in linear time', () => {
  const text = '<'.repeat(100_000);
  const { out, ms } = timed(() => analyzeBullet(text));
  assert.equal(out.clean, text);
  assert.ok(ms < LIMIT_MS, `analyzeBullet took ${ms.toFixed(0)} ms on ${text.length} characters`);
  const mixed = timed(() => stripTags('<>'.repeat(50_000) + '<'.repeat(50_000)));
  assert.ok(mixed.ms < LIMIT_MS, `stripTags took ${mixed.ms.toFixed(0)} ms`);
});

test('a fiscal-year mark followed by a long run of spaces is read in linear time', () => {
  const text = `FY${' '.repeat(60_000)}x`;
  const { out, ms } = timed(() => hasMetric(text));
  assert.equal(out, false);
  assert.ok(ms < LIMIT_MS, `hasMetric took ${ms.toFixed(0)} ms on ${text.length} characters`);
  assert.equal(hasMetric(`Grew sales in FY${' '.repeat(5000)}2021`), false);
  assert.equal(hasMetric(`Grew sales in FY' 21 by 40%`), true);
});

test('a long number after a letter is read in linear time, and is part of a name', () => {
  const glued = timed(() => hasMetric(`a${'1'.repeat(100_000)}`));
  assert.equal(glued.out, false);
  assert.ok(glued.ms < LIMIT_MS, `hasMetric took ${glued.ms.toFixed(0)} ms on a glued number`);
  const free = timed(() => hasMetric(`a ${'1'.repeat(100_000)}`));
  assert.equal(free.out, true);
  assert.ok(free.ms < LIMIT_MS, `hasMetric took ${free.ms.toFixed(0)} ms on a number`);
  const table = [['Built S3 buckets', false], ['Upgraded to v2.0', false], ['Cut costs 45%', true], ['Led 12 engineers', true], ['EC2 and Web3', false], ['Grew a1,5', false], ['Saved $1.2M', true]];
  for (const [text, metric] of table) assert.equal(hasMetric(text), metric, text);
});

test('stripTags cuts what /<[^>]+>/g cut', () => {
  const table = [['<b>x</b>', 'x'], ['a<b', 'a<b'], ['<>x', '<>x'], ['a<>b<i>c', 'a<>bc'], ['<<a>b', 'b'], ['1 < 2 > 1', '1  1'], ['', ''], ['plain', 'plain']];
  for (const [text, stripped] of table) {
    assert.equal(stripTags(text), stripped, JSON.stringify(text));
    assert.equal(stripTags(text), text.replace(/<[^>]+>/g, ''), JSON.stringify(text));
  }
});

const PIECES = ['<', '>', '<>', '<b>', '</b>', 'a', 'S3', 'v2.0', '1', '12', '2021', '2019–22', 'FY', "FY'", 'FY21', 'FY 2021', '$', '%', 'k', 'x', 'x10', '.', ',', ' ', '  ', '\n', '-', '/',
  'é', 'Led', 'cut', 'costs', '45', '3.5', 'rs.', '500', 'Web3', 'ec2'];

test('the same answers as the old patterns on 8000 seeded statements', () => {
  let seed = 90210;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 8000; doc += 1) {
    let text = '';
    const count = 1 + Math.floor(random() * 12);
    for (let i = 0; i < count; i += 1) text += PIECES[Math.floor(random() * PIECES.length)] + (random() < 0.4 ? ' ' : '');
    const label = JSON.stringify(text);
    assert.equal(hasMetric(text), before.hasMetric(text), label);
    assert.deepEqual(analyzeBullet(text), before.analyzeBullet(text), label);
  }
});
