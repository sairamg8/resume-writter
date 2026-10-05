// Typing-freeze finding 7b (review round 1): clean() put only a no-break space, a figure space and a narrow no-break space
// down to a plain one and collapsed runs of plain spaces, so a run of any other white space "\s" matches (an em space
// U+2003, an ideographic space U+3000, U+2000-U+200A, U+1680, U+205F, U+FEFF) reached the importer's "\s+" and "\s*" patterns
// as it was, and each read the run again from every character of it: 20 000 em spaces in a job line took 12 s, in a degree
// line 18 s, in a skills line 2 s (time squared). Every run of white space but a tab is one space after clean() now,
// as a run of plain ones always was. And the second line of a Word paragraph that starts at a tab and has no other
// (/^\t[^\t]*\S[^\t]*$/) tried every split of a line of 40 000 characters (1.8 s): it is read by index now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import * as before from '../fixtures/typing-freeze-reference/importText.mjs';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}
const EM = ' ';
const IDEO = '　';

test('a job line with 20 000 em spaces or ideographic spaces in it is read in linear time', () => {
  for (const sp of [EM, IDEO, ' ', ' ', '﻿']) {
    const text = `Jane Doe\n\nExperience\nEngineer at Acme${sp.repeat(20_000)}x, Berlin, DE\nJan 2020 - Present\n`;
    const { ms } = timed(() => resumeFromText(text));
    assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms on ${JSON.stringify(sp)}`);
  }
});

test('a degree line with runs of white space around its separators is read in linear time', () => {
  for (const sp of [EM, IDEO]) {
    const text = `Jane Doe\n\nEducation\nBSc${sp.repeat(20_000)}x ${sp.repeat(20_000)}: MIT (2018${sp.repeat(20_000)})\n`;
    const { ms } = timed(() => resumeFromText(text));
    assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms on ${JSON.stringify(sp)}`);
  }
});

test('a skills line with a run of em spaces inside a word is read in linear time', () => {
  for (const sp of [EM, IDEO]) {
    const text = `Jane Doe\n\nSkills\na${sp.repeat(20_000)}b\n`;
    const { ms } = timed(() => resumeFromText(text));
    assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms on ${JSON.stringify(sp)}`);
  }
});

test('the second line of a Word paragraph that starts at a tab, 40 000 characters long, is read in linear time', () => {
  const { out, ms } = timed(() => resumeFromText([{ text: `Acme\t2019\n\t${'a'.repeat(40_000)}\t` }]));
  assert.ok(out);
  assert.ok(ms < LIMIT_MS, `resumeFromText took ${ms.toFixed(0)} ms`);
});

test('a run of em spaces reads as the one space it is, the résumé as the old reader read it with plain ones', () => {
  const text = `Jane Doe\n\nExperience\nEngineer${EM}${EM}at${IDEO}Acme, Berlin, DE\nJan${EM}2020${EM}-${EM}Present\n`;
  const plain = text.replace(/[^\S\t\n]/g, ' ');
  assert.equal(bare(resumeFromText(text)), bare(before.resumeFromText(plain)));
});

// A résumé's own ids and times differ from one read to the next: compared without them.
const bare = (resume) => JSON.stringify(resume).replace(/[a-z]+_[0-9a-f]{8}-[0-9a-f-]{27}/g, '#').replace(/"(updatedAt|createdAt)":\d+/g, '"$1":0');
const LINES = ['Pat Doe', 'Experience', 'Education', 'Skills', 'Languages', 'Acme Corp', 'Senior Engineer', 'Engineer, Payments', ' — ', ' - ', ' | ', ', ', ': ', '2019', '2019 - 2021', 'Jan 2020 – Present',
  '(2018, 2019)', 'GPA: 3.8', 'a@b.io', 'Austin, TX', 'BSc', 'University of Porto', 'Python', 'English: Native', 'Spanish (Fluent)', '• ', '- ', ' ', ' ', EM, IDEO, ' ', ' ', ' ', ' ', '﻿', ' ', '\t', ' '];

test('the same résumé as the old reader on 4000 seeded texts, with its exotic white space as plain spaces', () => {
  let seed = 11;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 4000; doc += 1) {
    const lines = [];
    for (let l = 0, count = 2 + Math.floor(random() * 9); l < count; l += 1) {
      let line = '';
      for (let i = 0, k = 1 + Math.floor(random() * 7); i < k; i += 1) line += LINES[Math.floor(random() * LINES.length)];
      lines.push(line.replace(/^\s+/, '')); // not indented: a list item's indent counts plain spaces and tabs only, as it did
    }
    const text = lines.join('\n');
    assert.equal(bare(resumeFromText(text)), bare(before.resumeFromText(text.replace(/[^\S\t\n]/g, ' '))), JSON.stringify(text));
  }
});

const TAB_PIECES = ['\t', '\t', 'a', ' ', 'Acme', '2019', 'Porto', '\n', '\n\t', 'University', 'BSc', 'Engineer', 'x'];

test('a line under a first line set with a tab is "end" or not as the old reader says, on 6000 seeded paragraphs', () => {
  let seed = 23;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 6000; n += 1) {
    let text = `Acme\t2019\n`;
    for (let i = 0, k = 1 + Math.floor(random() * 6); i < k; i += 1) text += TAB_PIECES[Math.floor(random() * TAB_PIECES.length)];
    const input = [{ text: 'Pat Doe' }, { text: 'Experience', hint: 'heading' }, { text }, { text: '• did things' }];
    assert.equal(bare(resumeFromText(input)), bare(before.resumeFromText(input)), JSON.stringify(text));
  }
});
