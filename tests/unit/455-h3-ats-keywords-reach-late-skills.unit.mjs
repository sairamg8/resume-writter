// H3-455: a posting's keywords are its 40 most frequent words, and most of a posting's words occur once, so the
// ones kept were the first 40 it said. A real posting opens with the title, the company's pitch and where
// the job is; the tools it asks for come in the requirements further down, and "Kafka", "Terraform", "C++" or
// "Scrum" were never listed (the match percentage and the missing-keyword list were of that opening).
// Among words of one count, a word that looks like a skill (a capital inside it, a digit or one of + # . /) now
// comes before a capitalised word, and that before a plain lower-case one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJobKeywords, matchResumeWithJob } from '../../src/utils/atsChecker.js';

const FILLER = ('apple bridge candle desert engine forest garden harbor island jungle kitchen ladder meadow nature ocean planet quarry '
  + 'river summit tunnel valley window yellow zephyr anchor barrel castle dragon eagle falcon glacier hammer igloo jacket kettle '
  + 'lantern marble needle orchard pebble quiver rabbit saddle timber umbrella violin').split(' ');

test('tools named after a long opening are still among the 40 keywords', () => {
  const posting = `${FILLER.join(' ')}. Requirements: we run Kubernetes, Terraform, Kafka, Redis, TypeScript, GraphQL and C++.`;
  const words = extractJobKeywords(posting).map((k) => k.keyword);
  assert.equal(words.length, 40);
  for (const tool of ['Kubernetes', 'Terraform', 'Kafka', 'Redis', 'TypeScript', 'GraphQL', 'C++']) assert.ok(words.includes(tool), `${tool} is a keyword`);
});

test('a word that occurs more often still comes first, and the order among equals is the posting\'s', () => {
  const kw = extractJobKeywords('We offer a generous budget. Docker and Python and Docker; Rust, Python, plus Zig.').map((k) => k.keyword);
  assert.deepEqual(kw.slice(0, 2), ['Docker', 'Python']);
  // Rust and Zig, read after "budget", come before it: it is a plain word, they are named tools.
  assert.ok(kw.indexOf('Rust') < kw.indexOf('Zig') && kw.indexOf('Zig') < kw.indexOf('budget'), kw.join(' '));
});

test('the match percentage counts the tools the posting asks for last', () => {
  const resume = { personal: { name: 'A B', email: 'a@b.co' }, sections: [{ type: 'skills', visible: true, items: [{ id: 's', category: 'Tools', skills: 'Kubernetes, Terraform, Kafka' }] }] };
  const posting = `${FILLER.join(' ')}. We run Kubernetes, Terraform and Kafka.`;
  const match = matchResumeWithJob(resume, posting);
  assert.deepEqual(['Kubernetes', 'Terraform', 'Kafka'].filter((t) => !match.matchedKeywords.includes(t)), []);
});
