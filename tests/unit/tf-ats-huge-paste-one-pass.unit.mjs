// C-2 (typing-freeze hunt, "5.7 MB plain paste: 6.8 s + 6.9 s stall"): pasted into the ATS
// job-description box, a multi-megabyte posting is read on the page's one thread by extractJobKeywords
// (and matchResumeWithJob, which calls it). It composed the posting (normalize) and blanked its
// addresses (a regex pass over every word) twice, once for the tokens and once for the phrase finds.
// It reads the posting once now. The work is counted, not timed: the posting is composed once whatever
// its size, and the keywords are the same as the ones read from the same text with its addresses
// blanked by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const LINE = 'Seeking a senior engineer with React, machine learning and AWS experience; see https://jobs.example.com/a?b=1 or mail hr@example.com.\n';

// How many times a string of at least `min` characters is composed while `run` runs.
function composedPasses(min, run) {
  const original = String.prototype.normalize;
  let passes = 0;
  String.prototype.normalize = function counted(...args) {
    if (this.length >= min) passes += 1;
    return original.apply(this, args);
  };
  try { run(); } finally { String.prototype.normalize = original; }
  return passes;
}

test('a large posting is composed once by extractJobKeywords, at any size', () => {
  for (const copies of [2_000, 4_000, 8_000]) {
    const text = LINE.repeat(copies);
    assert.equal(composedPasses(text.length, () => extractJobKeywords(text)), 1, `${text.length} characters`);
  }
});

test('matchResumeWithJob composes the posting once too', () => {
  const text = LINE.repeat(4_000);
  const resume = { personal: { fullName: 'A B' }, sections: [] };
  assert.equal(composedPasses(text.length, () => matchResumeWithJob(resume, text)), 1);
});

test('the keywords are unchanged: the phrase is found, the addresses are blanked', () => {
  const names = extractJobKeywords(LINE.repeat(50)).map((k) => k.keyword.toLowerCase());
  assert.ok(names.includes('machine learning'));
  assert.ok(names.includes('react'));
  assert.ok(!names.some((k) => k.includes('example') || k.includes('http')));
});
