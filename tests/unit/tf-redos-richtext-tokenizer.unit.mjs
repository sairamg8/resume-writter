// Typing-freeze finding 7a: richText.js buildTree read the HTML of a paste or an import with one regex that
// backtracked over the rest of the text from every "<" that never closed, and walked its stack of open
// elements for every tag. '<p' x 1500 took 6 s (time cubed), '<a"' x 1000 6 s, '<!', '<?', '<a ' and '</p'
// x 30 000 seconds (time squared), '<span>' x n then '<section>' x n and '<b>' x n then '</x>' x n too.
// Pinned here: each of those is read in a fraction of a second, and every document the old reader read
// quickly is read to the same blocks and the same sanitised HTML (the old file is kept in
// tests/fixtures/typing-freeze-reference as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRichText, sanitizeRichText, richTextToPlain } from '../../src/utils/richText.js';
import * as before from '../fixtures/typing-freeze-reference/richText.mjs';
import { joinAnchors } from '../fixtures/typing-freeze-reference/joinAnchors.mjs';

/** The old reader took 3 to 40 s on each; this one takes a few milliseconds to a hundred. */
const LIMIT_MS = 1000;

function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

const SLOW = {
  "'<p' x 1500 (time cubed)": '<p'.repeat(1500),
  "'<a\"' x 800 and a space (time cubed)": `${'<a"'.repeat(800)} x`,
  "'<!' x 60 000": '<!'.repeat(60_000),
  "'<?' x 60 000": '<?'.repeat(60_000),
  "'<a ' x 30 000": '<a '.repeat(30_000),
  "'</p' x 30 000": '</p'.repeat(30_000),
  "'<span>' x 20 000 then '<section>' x 20 000": '<span>'.repeat(20_000) + '<section>'.repeat(20_000),
  "'<b>' x 40 000 then '</x>' x 40 000": '<b>'.repeat(40_000) + '</x>'.repeat(40_000),
};

for (const [name, html] of Object.entries(SLOW)) {
  test(`${name}: parsed and sanitised in linear time`, () => {
    const { ms } = timed(() => sanitizeRichText(html));
    assert.ok(ms < LIMIT_MS, `sanitizeRichText took ${ms.toFixed(0)} ms on ${html.length} characters`);
  });
}

test('text is kept when a "<" never closes', () => {
  assert.equal(richTextToPlain('a <! b'), 'a <! b');
  assert.equal(richTextToPlain('1 < 2 and <p'), '1 < 2 and <p');
  assert.equal(richTextToPlain('<p>x</p><a'), 'x\n<a');
});

test('a quote inside a tag name opens the attributes, as it always did', () => {
  const table = ['<a"b c" d>x</a>', '<p"x>y</p>', '<a"x" href="http://q.io">link</a>', '<b/ >bold</b>', "<i'a'>it</i>"];
  for (const html of table) {
    assert.equal(sanitizeRichText(html), joinAnchors(before.sanitizeRichText(html)), html);
    assert.deepEqual(parseRichText(html), before.parseRichText(html), html);
  }
});

// A seeded corpus of small documents built from the pieces that make tokens and tags interesting: the old and
// the new reader must agree on every one of them.
const PIECES = [
  '<p>', '</p>', '<b>', '</b>', '<i>', '</i>', '<div>', '</div>', '<ul>', '</ul>', '<ol>', '<ol type="a" start="3">', '<li>', '</li>',
  '<br>', '<br/>', '<br />', '<a href="http://x.io">', "<a href='y' title=\"a>b\">", '</a>', 'text ', ' more', '&amp;', '&lt;', '<', '>',
  '"', "'", '/', '<!-- c -->', '<!--', '-->', '<![CDATA[x]]>', '<![if !supportLists]>', '<![endif]>', '<!--[if !supportLists]-->',
  '<!--[endif]-->', '<?xml x?>', '<!DOCTYPE html>', '<script>', '</script>', '<style>', '</style>', '<span style="font-weight:bold">',
  '</span>', '<p style="mso-list:l0 level1 lfo1">', '<p style="mso-list:l0 level2 lfo1">', '1.', 'a)', '<o:p>', '</o:p>',
  '<a"b c" d>', '<a"x>', '<b/ >', '<td>', '<section>', '</x>', '<hr>', '\n', '  ', '<h1>', '<blockquote>', '<dl>', '<dt>', '<dd>',
  '<img src="a">', '<a ', '<p', '</p', '<!', '<?', 'x"y', "a'b", '<button>', '</button>', '<svg/>', '<textarea>',
];

test('the same blocks and the same HTML as the old reader on 4000 seeded documents', () => {
  let seed = 20261005;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let doc = 0; doc < 4000; doc += 1) {
    let html = '';
    const count = 1 + Math.floor(random() * 14);
    for (let i = 0; i < count; i += 1) html += PIECES[Math.floor(random() * PIECES.length)];
    assert.deepEqual(parseRichText(html), before.parseRichText(html), JSON.stringify(html));
    assert.equal(sanitizeRichText(html), joinAnchors(before.sanitizeRichText(html)), JSON.stringify(html));
  }
});
