// Typing-freeze finding 7b (review round 1): the parser view's `bare()` (/[\s|·•,:;–—-]+$/ over the text a PDF holds)
// read a long run of separators again from each of its characters when something else ended the run ('x' + 40 000 "-" +
// 'y' took 2.3 s). It scans from the ends now, and reads what it read before. (The job posting's keyword reader has the
// same shape; it is in the job-description box's cluster, finding 6.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobFields } from '../../src/utils/parserText.js';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

const job = { role: 'Engineer' };

test('a parser-view run with 40 000 separators in the middle is read in linear time', () => {
  for (const mark of ['-', ',', '|', ' ', '·', '–']) {
    const run = `x${mark.repeat(40_000)}y`;
    const { out, ms } = timed(() => jobFields([[[run]]], [job]));
    assert.equal(out[0].title, 'missing', mark);
    assert.ok(ms < LIMIT_MS, `jobFields took ${ms.toFixed(0)} ms on a run of ${JSON.stringify(mark)}`);
  }
});

test('a parser-view run that is the title and nothing but separators around it is its own field, as before', () => {
  const run = `${'- '.repeat(20_000)}Engineer${' , |'.repeat(20_000)}`;
  const { out, ms } = timed(() => jobFields([[[run]]], [job]));
  assert.equal(out[0].title, 'own');
  assert.ok(ms < LIMIT_MS, `jobFields took ${ms.toFixed(0)} ms`);
});

// The old `bare`, for the seeded corpus: the title is 'own' when the run less its separators is the title.
const SEP = /^[\s|·•,:;–—-]+|[\s|·•,:;–—-]+$/g;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const RUN_PIECES = ['Engineer', 'engineer', 'x', ' ', '  ', '-', '–', '—', '|', '·', '•', ',', ':', ';', ' - ', ', ', 'Acme', ' ', '\t'];

test('a run is its own field, joined or missing as the old reader said, on 20 000 seeded runs', () => {
  let seed = 41;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 20_000; n += 1) {
    let run = '';
    for (let i = 0, k = 1 + Math.floor(random() * 8); i < k; i += 1) run += RUN_PIECES[Math.floor(random() * RUN_PIECES.length)];
    const want = norm(run).replace(SEP, '') === 'engineer' ? 'own' : norm(run).includes('engineer') ? 'joined' : 'missing';
    assert.equal(jobFields([[[run]]], [job])[0].title, want, JSON.stringify(run));
  }
});
