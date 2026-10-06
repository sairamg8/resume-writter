// A-3 (review): extractJobKeywords on a run with no space in it that holds the no-space phrase "ci/cd" many times
// ("ci/cd/ci/cd/…"): every find walked out to both ends of the run (time squared), and read the whole run again.
// The finds that sit in one run share one reading of it. Four times the repeats must cost about four times as long
// (a ratio of the same run at two sizes, so the machine's speed cancels).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords } from '../../src/utils/atsChecker.js';

const best = (fn) => { let min = Infinity; for (let k = 0; k < 3; k += 1) { const t = performance.now(); fn(); min = Math.min(min, performance.now() - t); } return min; };

for (const sep of ['/', '-', '.', ',', ';', '|', '(']) {
  test(`"ci/cd" repeated with ${JSON.stringify(sep)} between, in one run, is read in linear time`, () => {
    const text = (n) => `Senior engineer, React. ${Array.from({ length: n }, () => 'ci/cd').join(sep)}`;
    const small = best(() => extractJobKeywords(text(6000)));
    const large = best(() => extractJobKeywords(text(24_000)));
    assert.ok(large < 9 * Math.max(small, 15), `6 000 repeats took ${small.toFixed(0)} ms, 24 000 took ${large.toFixed(0)} ms`);
    assert.ok(extractJobKeywords(text(12_000)).some(({ keyword }) => keyword === 'React'), 'the posting around the run is still read');
  });
}
