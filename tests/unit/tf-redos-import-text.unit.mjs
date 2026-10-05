// Typing-freeze finding 7b (the sweep of what an import reaches): importText.js read the lines of a text, Word or PDF
// résumé with patterns and loops that did the work again for every separator or bracket of a long line. A date's
// closing marks (/[)*_\]]+$/), the check for an unclosed "(" (/\([^)]*$/), a job line's commas (each tested against
// the rest of the line for a job title), a language line's commas (each looked ahead to the next bracket), and a
// certificate's separators (each tested against the rest) took seconds on a pasted line of 40 000 to 100 000
// characters (time squared). Each is read once now, with the same résumé out; the one limit is a certificate's or an
// award's line over 1 000 characters, a paragraph and no title with years, which is no longer searched for them.
// The old file is kept in tests/fixtures/typing-freeze-reference as the reference.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';
import * as before from '../fixtures/typing-freeze-reference/importText.mjs';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a date with a long run of closing marks in the middle of the text is read in linear time', () => {
  for (const mark of [')', '*', '_', ']']) {
    const text = `2019${mark.repeat(100_000)}x`;
    const { out, ms } = timed(() => readDateRange(text));
    assert.equal(out, null, mark);
    assert.ok(ms < LIMIT_MS, `readDateRange took ${ms.toFixed(0)} ms on a run of ${mark}`);
  }
});

test('a long run of "(" before a ")" is checked for an unclosed one in linear time', () => {
  const text = `a${'('.repeat(100_000)})b`;
  const { out, ms } = timed(() => readDateRange(text));
  assert.equal(out, null);
  assert.ok(ms < LIMIT_MS, `readDateRange took ${ms.toFixed(0)} ms on ${text.length} characters`);
  assert.equal(readDateRange('May 2025 (Expected').end, 'May 2025');
});

const resumeOf = (section, line) => resumeFromText(`Pat Doe\npat@x.io\n\n${section}\n${line}\n• did things\n`);

test('a job line of 60 000 characters of commas is read in linear time', () => {
  const { ms } = timed(() => resumeOf('Experience', ', '.repeat(30_000)));
  assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms`);
});

test('a language line of 60 000 characters of commas is read in linear time, one language to a comma', () => {
  const { out, ms } = timed(() => resumeFromText(`Pat Doe\npat@x.io\n\nLanguages\n${'a, '.repeat(20_000)}z\n`));
  assert.equal(out.sections.find((s) => s.type === 'languages').items.length, 20_001);
  assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms`);
});

test('a certificate line of 40 000 characters of commas is read in linear time', () => {
  const { ms } = timed(() => resumeOf('Certifications', ', '.repeat(20_000)));
  assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms`);
});

test('a certificate with its years after it still has them in brackets', () => {
  const years = resumeFromText('Pat Doe\npat@x.io\n\nAwards\nDean’s List, 2014 and 2015\n');
  assert.equal(JSON.stringify(years).includes('Dean’s List (2014 and 2015)'), true);
});

// A résumé's own ids and times differ from one read to the next: compared without them.
const bare = (resume) => JSON.stringify(resume).replace(/[a-z]+_[0-9a-f]{8}-[0-9a-f-]{27}/g, '#').replace(/"(updatedAt|createdAt)":\d+/g, '"$1":0');
const PIECES = ['Languages', 'English: Native', 'Spanish (Fluent)', 'C2', 'Native', 'german', 'French — Working knowledge, written', ';', ' | ', '2014, 2015, 2016', 'Dean’s List, 2014 and 2015', 'Dean’s List\t2014',
  'Certifications', 'Awards', 'AWS (2020)', 'Projects', 'Volunteering', 'Interests', 'Publications', 'References', 'Email: a@b.io', 'Pat Doe', 'Experience', 'Education', 'Skills', 'Acme Corp',
  'Senior Engineer', 'Engineer, Payments', 'Lead, Acme', ' — ', ' - ', ', ', ',', ' at ', ' @ ', '2019', '2019 - 2021', 'Jan 2020 – Present', '(2018, 2019)', '(Remote, Jan 2020 – Present)', '(', ')', '*', '_', '[', ']',
  'Austin, TX', 'Remote', 'BSc', 'University of Porto', 'Python', '\t', '  ', ' ', '• ', '- ', '1. '];

test('the same résumé as the old reader on 6000 seeded text résumés', () => {
  let seed = 31;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 6000; doc += 1) {
    const lines = [];
    for (let l = 0, count = 2 + Math.floor(random() * 9); l < count; l += 1) {
      let line = '';
      for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) line += PIECES[Math.floor(random() * PIECES.length)] + (random() < 0.4 ? ' ' : '');
      lines.push(line);
    }
    const text = lines.join('\n');
    assert.equal(bare(resumeFromText(text)), bare(before.resumeFromText(text)), JSON.stringify(text));
  }
});
