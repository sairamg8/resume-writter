// Typing-freeze finding 7b (the sweep of what an import reaches): importText.js read a Markdown line's inline marks with
// regexes that tried every "[", "![", " *", " _", "~~" or run of spaces of the line again to its end when it had
// no partner: a pasted line of 60 000 "[" took four seconds in markdownLines, 30 000 "![" four, 100 000 characters of
// " *a" four, a heading with 60 000 spaces after its text six, and a text of 40 000 "[" with a link definition above it
// five (time squared in each). Each is read in one pass now, with the same lines out. The old file is kept in
// tests/fixtures/typing-freeze-reference as the reference for a seeded corpus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import * as before from '../fixtures/typing-freeze-reference/importText.mjs';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}
const first = (md) => markdownLines(md)[0];

test('a line of "[" is read in linear time and kept as typed', () => {
  const md = '['.repeat(60_000);
  const { out, ms } = timed(() => markdownLines(md));
  assert.equal(out[0].text, md);
  assert.ok(ms < LIMIT_MS, `markdownLines took ${ms.toFixed(0)} ms on ${md.length} characters`);
});

test('a line of "![" is read in linear time and kept as typed', () => {
  const md = '!['.repeat(30_000);
  const { out, ms } = timed(() => markdownLines(md));
  assert.equal(out[0].text, md);
  assert.ok(ms < LIMIT_MS, `markdownLines took ${ms.toFixed(0)} ms on ${md.length} characters`);
});

test('italic marks with no closing mark are read in linear time and kept as typed', () => {
  for (const [name, md] of [['" *a"', ' *a'.repeat(33_000)], ['" _a"', ' _a'.repeat(33_000)], ['"~~a "', '~~a '.repeat(37_500)]]) {
    const { out, ms } = timed(() => markdownLines(md));
    assert.equal(out[0].text, md, name);
    assert.ok(ms < LIMIT_MS, `${name}: markdownLines took ${ms.toFixed(0)} ms on ${md.length} characters`);
  }
});

test('a heading or a line with a run of 100 000 spaces in it is read in linear time', () => {
  for (const md of [`### a${' '.repeat(60_000)}b`, `## a${'\t'.repeat(60_000)}b`, `a${' '.repeat(100_000)}b`]) {
    const { out, ms } = timed(() => markdownLines(md));
    assert.equal(out[0].text, md.replace(/^#+ /, ''));
    assert.ok(ms < LIMIT_MS, `markdownLines took ${ms.toFixed(0)} ms on ${md.length} characters`);
  }
});

test('reference-style links are looked for in linear time when a line has a run of "["', () => {
  const md = `[x]: https://x.io\n${'['.repeat(40_000)}`;
  const { out, ms } = timed(() => markdownLines(md));
  assert.equal(out[0].text, '['.repeat(40_000));
  assert.ok(ms < LIMIT_MS, `markdownLines took ${ms.toFixed(0)} ms on ${md.length} characters`);
});

test('links, images, references, emphasis and headings still read as they did', () => {
  const table = [
    ['[LinkedIn](https://linkedin.com/in/pat)', 'LinkedIn (https://linkedin.com/in/pat)'],
    ['![logo](x.png) and [a [b] c](https://x.io "t")', 'logo and a [b] c (https://x.io)'],
    ['*italic* and _also_ and ~~struck~~ and **bold** and snake_case_word', 'italic and also and struck and bold and snake_case_word'],
    ['a * b * c and 2 * 3', 'a * b * c and 2 * 3'],
    ['<https://x.io> and <mailto:a@b.io>', 'https://x.io and mailto:a@b.io'],
    ['text  ', 'text'],
    ['text ', 'text '],
  ];
  for (const [md, text] of table) {
    assert.equal(first(md).text, text, md);
    assert.equal(first(md).text, before.markdownLines(md)[0].text, md);
  }
  assert.equal(first('# Pat Doe ##').text, 'Pat Doe');
  assert.equal(first('## C#').text, 'C#');
  assert.equal(first('   ### Role   ###  ').text, 'Role');
});

const PIECES = ['![', '](', ']', '[', '(', ')', '![alt](x)', '[a](b c "t")', '[a](https://x.io)', '\\]', '\\[', '\\', '[[x]]', '[x]:', '[x](', '[x][y]', '[x] [y]', '[x][]', '[y]', '!', '~~', '~~x~~',
  '*', '**', '*x*', '_', '__', '_x_', ' *a', ' _a', 'a_b_c', '**b**', ' ', ' ', ' ', '  ', '\t', 'x', 'foo', '<https://x.io>', '<mailto:a@b.io>', '<http://', '<', '>', '`', '`code`',
  'https://x.com/a_b_', 'www.x.io', '#', '# ', '## ', '### ', '- ', '\\|', ' | ', ' — ', ',', ', ', 'Engineer', 'Acme', 'Lead', '2019'];
const DEFINITIONS = '\n[x]: https://x.io\n[y]: www.y.io "T"\n[note]: see below\n';

test('the same lines as the old reader on 12 000 seeded Markdown texts', () => {
  let seed = 5;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 12_000; doc += 1) {
    const lines = [];
    for (let l = 0, count = 1 + Math.floor(random() * 3); l < count; l += 1) {
      let line = '';
      for (let i = 0, k = 1 + Math.floor(random() * 12); i < k; i += 1) line += PIECES[Math.floor(random() * PIECES.length)];
      lines.push(line);
    }
    const md = lines.join('\n') + (random() < 0.5 ? DEFINITIONS : '');
    assert.deepEqual(markdownLines(md), before.markdownLines(md), JSON.stringify(md));
  }
});

// A résumé's own ids and times differ from one read to the next: compared without them.
const bare = (resume) => JSON.stringify(resume).replace(/[a-z]+_[0-9a-f]{8}-[0-9a-f-]{27}/g, '#').replace(/"(updatedAt|createdAt)":\d+/g, '"$1":0');
const LINES = ['# ', '## ', '### ', '#### ', '- ', '* ', '1. ', '> ', '  ', '\t', 'Pat Doe', 'Experience', 'Education', 'Skills', 'Acme Corp', 'Senior Engineer', 'Engineer, Payments', ' — ', ' - ', ' | ', ', ', '2019',
  '2019 - 2021', 'Jan 2020 – Present', '(2018, 2019)', '**', '*', '_', '`', '[LinkedIn](https://linkedin.com/in/pat)', '[x][1]', '[1]: https://x.io', 'a@b.io', '+1 555 010 0000', 'Austin, TX', 'BSc',
  'University of Porto', 'Python', 'Languages: English', ' ##', 'Lorem ipsum dolor sit amet', 'Languages', 'English: Native', 'Spanish (Fluent)', 'Certifications', 'Awards'];

test('the same résumé as the old reader on 1500 seeded Markdown résumés', () => {
  let seed = 77;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 1500; doc += 1) {
    const lines = [];
    for (let l = 0, count = 2 + Math.floor(random() * 9); l < count; l += 1) {
      let line = '';
      for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) line += LINES[Math.floor(random() * LINES.length)] + (random() < 0.4 ? ' ' : '');
      lines.push(line);
    }
    const md = lines.join('\n');
    assert.equal(bare(resumeFromText(markdownLines(md))), bare(before.resumeFromText(before.markdownLines(md))), JSON.stringify(md));
  }
});
