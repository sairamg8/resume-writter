// Typing-freeze finding 7b (review round 1): the letter's closing was cut of its trailing commas and white space with
// /[\s,]+$/, which read a long run again from each of its characters when a letter followed it (40 000 commas then "x":
// 2.3 s, on every render, PDF and Word export of the letter). It is scanned from the end now, with the same closing out.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const LIMIT_MS = 1000;

test('a closing with 40 000 commas, spaces or line breaks before a letter is cut in linear time', async () => {
  const { letterSignature } = await loadModule('/src/utils/coverLetter.js');
  for (const run of [',', ' ', '\n', ', ']) {
    const closing = `a${run.repeat(40_000)}b`;
    const start = performance.now();
    const out = letterSignature({ closing }, {});
    const ms = performance.now() - start;
    assert.equal(out.closing, `${closing},`, JSON.stringify(run));
    assert.ok(ms < LIMIT_MS, `letterSignature took ${ms.toFixed(0)} ms on a run of ${JSON.stringify(run)}`);
  }
});

test('a closing of nothing but commas and white space is the default, and a trailing run is cut as before', async () => {
  const { letterSignature } = await loadModule('/src/utils/coverLetter.js');
  assert.equal(letterSignature({ closing: ',,, \n ,' }, {}).closing, 'Sincerely,');
  assert.equal(letterSignature({ closing: `Best regards${' ,'.repeat(40_000)}` }, {}).closing, 'Best regards,');
  assert.equal(letterSignature({ closing: 'Thank you!' }, {}).closing, 'Thank you!');
  assert.equal(letterSignature({ closing: `  Warmly ,${'\n'.repeat(1000)} ,` }, {}).closing, 'Warmly,');
});

test('the closing is the old expression\'s on 5000 seeded closings', async () => {
  const { letterSignature } = await loadModule('/src/utils/coverLetter.js');
  const PIECES = ['Best', ' ', ',', '\n', '\t', 'regards', '!', '.', '\u2003', '\u00a0', 'x', ', '];
  let seed = 3;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 5000; n += 1) {
    let closing = '';
    for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) closing += PIECES[Math.floor(random() * PIECES.length)];
    const cut = closing.trim().replace(/[\s,]+$/, '') || 'Sincerely';
    const want = /[\p{Term}…]$/u.test(cut) ? cut : `${cut},`;
    assert.equal(letterSignature({ closing }, {}).closing, want, JSON.stringify(closing));
  }
});
