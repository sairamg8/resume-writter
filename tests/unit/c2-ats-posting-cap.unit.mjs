// C-2: a pasted job posting is kept and scanned up to MAX_POSTING_CHARS (200,000; a real posting is
// 5-20 kB), so a 5.7 MB paste cannot hold the page for seconds. Ordinary pastes are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { capPosting, MAX_POSTING_CHARS } from '../../src/utils/atsChecker.js';

test('an ordinary posting is returned as it is', () => {
  const posting = 'We need a React engineer. '.repeat(800);
  assert.deepEqual(capPosting(posting), { text: posting, capped: false });
  assert.deepEqual(capPosting(''), { text: '', capped: false });
  assert.equal(capPosting('a'.repeat(MAX_POSTING_CHARS)).capped, false, 'exactly the limit is kept whole');
});

test('a huge paste is cut to the limit and says so', () => {
  const r = capPosting('x'.repeat(5_700_000));
  assert.equal(r.capped, true);
  assert.equal(r.text.length, MAX_POSTING_CHARS);
});

test('the cut never splits a surrogate pair', () => {
  const r = capPosting('a'.repeat(MAX_POSTING_CHARS - 1) + '😀' + 'b');
  assert.equal(r.capped, true);
  assert.equal(r.text.length, MAX_POSTING_CHARS - 1);
});
