// Typing-freeze finding 7a: the rich-text reader walked its tree by recursion, so a pasted or imported document
// nested about 25 000 tags deep threw a RangeError (the text was lost), and it read the text of a Word list
// marker again for every marker nested above it (time squared). It walks with a stack of its own now, and a
// marker's text is read once. Pinned here: deep documents keep their text, nested Word markers are read in
// linear time, and Word lists with ordinary nesting read as they did (the old reader is kept in
// tests/fixtures/typing-freeze-reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText, sanitizeRichText, richTextToPlain, hasRichText } from '../../src/utils/richText.js';
import * as before from '../fixtures/typing-freeze-reference/richText.mjs';
import { joinAnchors } from '../fixtures/typing-freeze-reference/joinAnchors.mjs';

const DEPTH = 60_000;
const LIMIT_MS = 2000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('inline tags nested 60 000 deep keep their text', () => {
  const html = `${'<b>'.repeat(DEPTH)}deep text${'</b>'.repeat(DEPTH)}`;
  const { out, ms } = timed(() => sanitizeRichText(html));
  assert.equal(out, '<p><strong>deep text</strong></p>');
  assert.ok(ms < LIMIT_MS, `took ${ms.toFixed(0)} ms`);
  assert.equal(hasRichText(html), true);
});

test('block tags nested 60 000 deep keep their text, and a cut-off paste (no closing tags) too', () => {
  for (const tag of ['div', 'blockquote', 'span', 'section']) {
    const html = `${`<${tag}>`.repeat(DEPTH)}one<br>two`;
    const { out, ms } = timed(() => richTextToPlain(html));
    assert.equal(out, 'one\ntwo', tag);
    assert.ok(ms < LIMIT_MS, `${tag}: took ${ms.toFixed(0)} ms`);
  }
});

test('lists nested 30 001 deep keep their items (the bullet is the top level\'s again at that depth)', () => {
  const html = `${'<ul><li>'.repeat(30_001)}item`;
  const { out, ms } = timed(() => richTextToPlain(html));
  assert.equal(out, '• item');
  assert.ok(ms < LIMIT_MS, `took ${ms.toFixed(0)} ms`);
  const numbered = `${'<ol><li>'.repeat(30_001)}item`;
  assert.equal(richTextToPlain(numbered), '1. item');
});

test('Word list markers nested 20 000 deep are read in linear time', () => {
  const item = '<div style="mso-list:l0 level1 lfo1"><![if !supportLists]>';
  const html = `${item.repeat(20_000)}1.${'<![endif]>'.repeat(20_000)}text`;
  const { out, ms } = timed(() => parseRichText(html));
  assert.ok(out.length > 0);
  assert.ok(ms < LIMIT_MS, `took ${ms.toFixed(0)} ms`);
});

test('ordinary Word lists read as before, on 3000 seeded documents', () => {
  const PIECES = [
    '<p style="mso-list:l0 level1 lfo1">', '<p style="mso-list:l0 level2 lfo1">', '<p style="mso-list:l1 level1 lfo2">',
    '<p class=MsoListBullet2>', '<![if !supportLists]>', '<![endif]>', '<!--[if !supportLists]-->', '<!--[endif]-->',
    '·', '1.', 'a)', 'iv.', '(c)', '&nbsp;', '</p>', 'item ', 'more text', '<b>', '</b>', '<ul>', '<ol>', '</ul>', '</ol>', '<li>',
    '</li>', '<div style="mso-list:l0 level1 lfo1">', '</div>', '<span style="mso-list:Ignore">', '</span>', '\n', ' ',
  ];
  let seed = 7771;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 3000; doc += 1) {
    let html = '';
    const count = 2 + Math.floor(random() * 16);
    for (let i = 0; i < count; i += 1) html += PIECES[Math.floor(random() * PIECES.length)];
    assert.deepEqual(parseRichText(html), before.parseRichText(html), JSON.stringify(html));
    assert.equal(sanitizeRichText(html), joinAnchors(before.sanitizeRichText(html)), JSON.stringify(html));
  }
});
