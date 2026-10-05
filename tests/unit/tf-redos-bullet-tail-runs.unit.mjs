// Typing-freeze finding 7b: bulletOptimizer.js trimmed the punctuation off a first word with /^[^a-zA-Z]+|[^a-zA-Z]+$/g
// and split a statement from its closing punctuation with /^([\s\S]*?)([.!?;:]*)$/. Each tried the trailing run
// again from every character of a long run that did not end the text: 'http://' and 100 000 slashes and an 'x'
// took 7.5 s in leadsWithActionVerb and analyzeBullet (the optimizer modal and the ATS score run them on every
// keystroke and on every pasted bullet), 'Led x' and 100 000 dots and a 'y' took seconds in insertMetric. Both are
// index scans now, and read what the patterns read (the old file is kept in tests/fixtures/typing-freeze-reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBullet, insertActionVerb, insertMetric, leadsWithActionVerb } from '../../src/utils/bulletOptimizer.js';
import * as before from '../fixtures/typing-freeze-reference/bulletOptimizer.mjs';

const N = 100_000;
/** The old patterns took 3 to 8 s on these; the scans read them in a few milliseconds. */
const LIMIT_MS = 1000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a first word with a long run of punctuation inside it is read in linear time', () => {
  const text = `http://${'/'.repeat(N)}x`;
  const lead = timed(() => leadsWithActionVerb(text));
  assert.equal(lead.out, false);
  assert.ok(lead.ms < LIMIT_MS, `leadsWithActionVerb took ${lead.ms.toFixed(0)} ms on ${text.length} characters`);
  const analysis = timed(() => analyzeBullet(text));
  assert.equal(analysis.out.firstWord, text);
  assert.ok(analysis.ms < LIMIT_MS, `analyzeBullet took ${analysis.ms.toFixed(0)} ms on ${text.length} characters`);
  const verb = timed(() => insertActionVerb(text, 'Led'));
  assert.ok(verb.ms < LIMIT_MS, `insertActionVerb took ${verb.ms.toFixed(0)} ms on ${text.length} characters`);
});

test('a closing run of punctuation is split from the text in linear time', () => {
  const text = `Led x${'.'.repeat(N)}y`;
  const { out, ms } = timed(() => insertMetric(text, 'by 35%'));
  assert.equal(out, `${text} by 35%`);
  assert.ok(ms < LIMIT_MS, `insertMetric took ${ms.toFixed(0)} ms on ${text.length} characters`);
  assert.equal(insertMetric('Reduced latency for checkout.', 'by 35%'), 'Reduced latency for checkout by 35%.');
  assert.equal(insertMetric('Shipped it?!', 'by 3%'), 'Shipped it by 3%?!');
  assert.equal(insertMetric('...', 'by 3%'), 'by 3%');
});

test('a first word loses the characters that are no ASCII letter at both ends, and only those', () => {
  const table = [['"Led,"', 'Led'], ['•Engineered', 'Engineered'], ['Co-authored,', 'Co-authored'], ['123', ''], ['a', 'a'], ['--a--b--', 'a--b'], ['élan', 'lan'], ['a\u00e9', 'a']];
  for (const [word, first] of table) {
    assert.equal(analyzeBullet(word).firstWord, first, JSON.stringify(word));
    assert.equal(analyzeBullet(word).firstWord, before.analyzeBullet(word).firstWord, JSON.stringify(word));
  }
});

const PIECES = ['Led', 'led', 'Was', 'responsible for', 'handled', 'Manage', 'Worked with', 'engineer', 'to', 'the', 'team', '.', '!', '?', ';', ':', '...', '\n', ' ', '-', '•', '"', '(', "'",
  '2021', '10%', '$5k', 'x10', 'etc.', 'Inc.', 'e.g', 'U.S.', 'http://', '//', '/', ',', 'Took', 'part', 'in', 'Spearheaded', 'Co-authored', 'élan', '*', '__', '12'];

test('the same answers as the old patterns on 6000 seeded statements', () => {
  let seed = 4242;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 6000; doc += 1) {
    let text = '';
    const count = 1 + Math.floor(random() * 10);
    for (let i = 0; i < count; i += 1) text += PIECES[Math.floor(random() * PIECES.length)] + (random() < 0.6 ? ' ' : '');
    const label = JSON.stringify(text);
    assert.equal(leadsWithActionVerb(text), before.leadsWithActionVerb(text), label);
    assert.deepEqual(analyzeBullet(text), before.analyzeBullet(text), label);
    assert.equal(insertMetric(text, 'by 35%'), before.insertMetric(text, 'by 35%'), label);
    assert.equal(insertActionVerb(text, 'Spearheaded'), before.insertActionVerb(text, 'Spearheaded'), label);
  }
});
