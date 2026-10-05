// Typing-freeze finding 7 (the sweep of what a paste or an import reaches): normalizeJob's notesToHtml asked a pattern whether
// a job's note held a tag (<\/?(p|div|…)(\s[^>]*)?\/?>), which read each "<a " that no ">" followed to the end of the note
// (100 000 characters of them took seconds; time squared). It looks for each ">" once now, and answers as the pattern did
// (kept below as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notesToHtml } from '../../src/utils/normalizeJob.js';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a note of "<a " repeated, with no ">", is read in linear time and kept as the plain text it is', () => {
  const note = '<a '.repeat(34_000);
  const { out, ms } = timed(() => notesToHtml(note));
  assert.equal(out, note.replace(/</g, '&lt;'));
  assert.ok(ms < LIMIT_MS, `notesToHtml took ${ms.toFixed(0)} ms on ${note.length} characters`);
});

const OLD_NOTES = /<\/?(p|div|br|ul|ol|li|strong|b|em|i|u|s|strike|del|ins|a|span|font|h[1-6]|blockquote|pre|code|sub|sup|hr)(\s[^>]*)?\/?>|&(amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-f]+);/i;

const NOTE_PIECES = ['<', '>', '</', '/', '<p', '<b', '<br', '<br/', '<a ', '<a href="x">', '<div class="a">', '<DIV>', '<h1>', '<h7>', '<tbd>', '<span', '<pre>', '<hr/>', '<hr />',
  '<b/>', '<b/ >', '<b-x>', '&amp;', '&nbsp;', '&#38;', '&#x26;', '&foo;', '&amp', ' ', '\n', 'x', '<>', '< >', 'e', '1'];

test('notes are HTML or plain exactly as the old pattern said, on 20 000 seeded notes', () => {
  let seed = 4242;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let note = 0; note < 20_000; note += 1) {
    let text = '';
    const count = 1 + Math.floor(random() * 10);
    for (let i = 0; i < count; i += 1) text += NOTE_PIECES[Math.floor(random() * NOTE_PIECES.length)];
    if (!text.trim()) continue;
    // HTML comes back as it is; plain text comes back escaped (a note with nothing to escape is the same either way).
    const html = OLD_NOTES.test(text);
    const out = notesToHtml(text);
    if (html) assert.equal(out, text, JSON.stringify(text));
    else assert.equal(out, text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r\n?|\n/g, '<br>'), JSON.stringify(text));
  }
});
