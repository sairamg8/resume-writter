// Typing-freeze finding 7 (the sweep of what a paste reaches): the cover-letter generator turned the line breaks inside
// each paragraph into spaces with /\s*[\r\n]+\s*/g, which tried every character of a long run of white space as the
// start of a match (time squared): a company name pasted with 100 000 spaces in it took seconds, on each key in the
// modal. White space with a line break in it is one space, as before; the rest of a run stays as typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCoverLetter } from '../../src/utils/coverLetterGenerator.js';
import * as before from '../fixtures/typing-freeze-reference/coverLetterGenerator.mjs';

const resume = { personal: { name: 'Pat Doe', title: 'Engineer' }, sections: [] };
const LIMIT_MS = 1000;

test('a company name with a run of 100 000 spaces in it is written in linear time, the spaces as typed', () => {
  const company = `Acme${' '.repeat(100_000)}Corp`;
  const start = performance.now();
  const letter = generateCoverLetter({ resume, company });
  const ms = performance.now() - start;
  assert.ok(letter.body.includes(company), 'the run of spaces is kept');
  assert.ok(ms < LIMIT_MS, `generateCoverLetter took ${ms.toFixed(0)} ms`);
});

const PIECES = ['Acme', ' ', '  ', '\n', '\r\n', '\r', ' \n ', '\t', 'Corp', '<b>', '&', 'x'];

test('the letter is the old one on 3000 seeded company and role names', () => {
  let seed = 8;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const text = () => { let s = ''; for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) s += PIECES[Math.floor(random() * PIECES.length)]; return s; };
  for (let n = 0; n < 3000; n += 1) {
    const input = { resume, company: text(), role: text(), recipientName: text(), archetype: ['impact', 'leadership', 'growth'][n % 3] };
    assert.deepEqual(generateCoverLetter(input), before.generateCoverLetter(input), JSON.stringify(input));
  }
});
