// TYPING-FREEZE 6: every key typed in the ATS job-description box reads the whole posting
// (extractJobKeywords, via blankPostingAddresses and the token reader), and two patterns took time
// squared in the length of one space-free run of it: POSTING_ADDRESS's "\S*[^\s@]@[^\s@]\S*" and its
// scheme branch (each start position read to the run's end), and jobKeywordOf's trailing "+$" strip
// (each dot of a run of dots tried). A pasted token of 10 000 characters cost about a second a key,
// 40 000 about four. They are linear now and read exactly what they read: the tests below keep the
// old pattern as the reference and compare the two on a seeded corpus, then pin the scaling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ats from '../../src/utils/atsChecker.js';

// A namespace import: the helpers are exported for this test, and the file still loads (and its
// scaling tests run, and fail on the time) where they are not.
const { extractJobKeywords } = ats;
const blankPostingAddresses = (text) => ats.blankPostingAddresses(text);
const trimTrailingNonWord = (word) => ats.trimTrailingNonWord(word);

// The pattern as it was (the e-mail and scheme branches are the slow ones).
const OLD_POSTING_ADDRESS = new RegExp([
  String.raw`(?:(?<![\p{L}\p{N}])[a-z][a-z0-9+.-]*:\/\/|(?<![\p{L}\p{N}.])www\.)\S*`,
  String.raw`\S*[^\s@]@[^\s@]\S*`,
  String.raw`(?<![\p{L}\p{M}\p{N}_.-])(?![bm]\.com(?![\p{L}\p{N}-]|\.[\p{L}\p{N}]))[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:(?:com|org|gov|edu)(?:\.\p{L}{2})?|(?:co|ac)\.\p{L}{2})(?![\p{L}\p{N}])(?:\/\S*)?`,
  String.raw`(?<![\p{L}\p{M}\p{N}_+#])#\p{L}[\p{L}\p{M}\p{N}_-]*`,
].join('|'), 'giu');
const oldBlank = (text) => text.replace(OLD_POSTING_ADDRESS, (m) => ' '.repeat(m.length));
const oldTrim = (word) => word.replace(/[^\p{L}\p{M}\p{N}_+#]+$/u, '');

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
const PIECES = ['a', 'B', 'x', 'é', '1', '.', '.', '-', '+', '_', '#', '#', '@', '@', '://', 'http', 'https', 'git+ssh', 'www.', 'com', '.com', '.org', '.co.uk',
  '.ac.uk', 'co', '/', '/', ' ', ' ', '\n', '\t', 'me@x', 'b.com', 'M.Com', 'ſ', '\u212A', '😀', '\u0301', '\ud800', '\udc00', "'", ',', '!', 'ß', '5', 'k8s', 'LI-Remote'];
function corpus(count, maxPieces) {
  const next = rng(20261005);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    let s = '';
    for (let n = Math.floor(next() * maxPieces); n >= 0; n -= 1) s += PIECES[Math.floor(next() * PIECES.length)];
    out.push(s);
  }
  return out;
}

test('blankPostingAddresses blanks exactly what the old pattern blanked', () => {
  for (const s of [...corpus(12000, 14), ...corpus(3000, 40)]) {
    assert.equal(blankPostingAddresses(s), oldBlank(s), JSON.stringify(s));
  }
  const table = [
    'Apply at https://careers.acme.com/jobs or jobs@acme.com, see www.acme.org. Tags #LI-Remote #hiring C# F#',
    'see:https://x.io/a(b) (git+ssh://h.io/x) a.b://c d@e@f http://a http:// x://y',
    'ASP.NET Node.js socket.io B.Com M.Com acme.co.uk ox.ac.uk seek.com.au acme.com/p?q=1 .com',
    'acme.com,foo@bar #tag@x.com -a://b a-b+c://d 1a://x',
  ];
  for (const s of table) assert.equal(blankPostingAddresses(s), oldBlank(s), s);
});

test('trimTrailingNonWord cuts what the old "+$" pattern cut, astral characters and lone surrogates included', () => {
  for (const s of corpus(12000, 10)) assert.equal(trimTrailingNonWord(s), oldTrim(s), JSON.stringify(s));
  for (const s of ['', '...', 'a..', '..a', 'a😀', '😀', 'a.😀.', 'C++', 'C#', "x'", "x-.", '\ud800', 'a\udc00', 'a\ud800\udc00.']) {
    assert.equal(trimTrailingNonWord(s), oldTrim(s), JSON.stringify(s));
  }
});

// The old code took 2.4-3.7 s on each of these at 40 000; the new, a few milliseconds. The cap is far
// above a loaded CI machine's slowest linear run and far below the old time at this size.
const N = 40_000;
const LIMIT_MS = 400;
const RUNS = {
  'letters': (n) => 'a'.repeat(n),
  'letters and dots': (n) => 'a.'.repeat(n / 2),
  'letters and plus signs': (n) => 'a+'.repeat(n / 2),
  'at signs': (n) => '@'.repeat(n),
  'letters and slashes': (n) => 'a/'.repeat(n / 2),
  'hash signs': (n) => '#'.repeat(n),
  'hosts and commas': (n) => 'a.com,'.repeat(n / 6),
  'a scheme at the end': (n) => `${'a.'.repeat(n / 2)}://x`,
  'a scheme at the end behind hosts': (n) => `${'a.com+'.repeat(n / 6)}://x`,
  'a run of dots after a letter, ended by a letter': (n) => `A${'.'.repeat(n)}a`,
  'a run of dashes after a letter, ended by a letter': (n) => `A${'-'.repeat(n)}a`,
};

for (const [name, make] of Object.entries(RUNS)) {
  test(`a job description of ${name} is read in linear time`, () => {
    const text = make(N);
    let start = performance.now();
    const blanked = ats.blankPostingAddresses ? ats.blankPostingAddresses(text) : text;
    const blankMs = performance.now() - start;
    assert.equal(blanked.length, text.length);
    start = performance.now();
    const keywords = extractJobKeywords(`Senior engineer, machine learning, React. ${text}`);
    const ms = performance.now() - start;
    assert.ok(blankMs < LIMIT_MS, `blankPostingAddresses took ${blankMs.toFixed(0)} ms on ${N} characters of ${name}`);
    assert.ok(ms < LIMIT_MS, `extractJobKeywords took ${ms.toFixed(0)} ms on ${N} characters of ${name}`);
    assert.ok(keywords.some(({ keyword }) => keyword === 'machine learning'), 'the posting around the run is still read');
  });
}

test('a 200 kB posting of ordinary lines is read in linear time and finds its keywords', () => {
  const line = 'Senior engineer with machine learning, React and AWS; apply at https://jobs.acme.com/x or jobs@acme.com #LI-Remote. ';
  const text = line.repeat(Math.ceil(200_000 / line.length));
  const start = performance.now();
  const keywords = extractJobKeywords(text).map(({ keyword }) => keyword);
  const ms = performance.now() - start;
  assert.ok(ms < 2000, `extractJobKeywords took ${ms.toFixed(0)} ms on ${text.length} characters`);
  for (const wanted of ['React', 'AWS', 'machine learning']) assert.ok(keywords.includes(wanted), wanted);
  assert.ok(!keywords.some((k) => /acme|https|LI-Remote/i.test(k)), keywords.join(' '));
});
