// Typing-freeze leftover (cluster A, A-3): extractJobKeywords on 12 000 repeats of one token. The night's review saw 2 to 5
// seconds there (the posting-address leftovers). Four times the repeats must cost about four times as long (a ratio of the
// same run at two sizes, so the machine's speed cancels), for each kind of token and with or without a space between them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords } from '../../src/utils/atsChecker.js';

const TOKENS = ['https://careers.acme.com/jobs', 'jobs@acme.com', 'www.acme.org', 'acme.co.uk', '#LI-Remote', 'a://', 'x.', 'Node.js', 'C++', 'ci/cd', 'machine learning',
  'front end', 'AWS', '5k', '12.5%', "we're", 'ü', 'a.com/', 'http://', '...', '-', 'Zürich', 'a+', 'e@', '@x'];
const SEPARATORS = [' ', '', ', ', '\n'];
const best = (fn) => { let min = Infinity; for (let k = 0; k < 3; k += 1) { const t = performance.now(); fn(); min = Math.min(min, performance.now() - t); } return min; };

for (const token of TOKENS) {
  for (const sep of SEPARATORS) {
    test(`${JSON.stringify(token)} repeated with ${JSON.stringify(sep)} between is read in linear time`, () => {
      const text = (n) => `Senior engineer, React. ${Array.from({ length: n }, () => token).join(sep)}`;
      const small = best(() => extractJobKeywords(text(6000)));
      const large = best(() => extractJobKeywords(text(24_000)));
      // Linear: 4x. Squared: 16x. The floor keeps a few milliseconds of noise from reading as growth.
      assert.ok(large < 9 * Math.max(small, 15), `6 000 repeats took ${small.toFixed(0)} ms, 24 000 took ${large.toFixed(0)} ms`);
      assert.ok(extractJobKeywords(text(12_000)).some(({ keyword }) => keyword === 'React'), 'the posting around the run is still read');
    });
  }
}
