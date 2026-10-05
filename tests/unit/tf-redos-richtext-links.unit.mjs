// Typing-freeze finding 7a (review round 1): the sanitizer wrote the whole <a href="..."> around every run of a link,
// so a link whose text alternates bold and plain wrote its address once per run: a link of 10 000 characters with 1 000
// bold and plain words in it came out as 20 MB (19 kB in), and the editor takes the result with insertHTML. It writes the
// address once around each run of runs that share it now, and a link that a block carries on into many more blocks is
// written again only while what the document holds in addresses stays within its own size (the rest is text alone).
// Output is the old one with adjacent anchors to one address joined, on a seeded corpus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText } from '../../src/utils/richText.js';
import * as before from '../fixtures/typing-freeze-reference/richText.mjs';

const anchors = (html) => (html.match(/<a href=/g) || []).length;

test('a link of 20 000 characters with 2 000 bold and plain words in it is one anchor, and the output grows with the input', () => {
  const html = `<a href="http://x.io/${'a'.repeat(20_000)}">${'<b>x</b>y'.repeat(2000)}</a>`;
  const out = sanitizeRichText(html);
  assert.ok(out.length < html.length * 3, `${html.length} characters in, ${out.length} out`);
  assert.equal(anchors(out), 1);
  assert.ok(out.includes(`<a href="http://x.io/${'a'.repeat(20_000)}">`));
  assert.equal(sanitizeRichText(out), out);
});

test('output size is linear in the input: twice the runs, twice the output', () => {
  const sizeOf = (n) => sanitizeRichText(`<a href="http://x.io/${'a'.repeat(5000)}">${'<b>x</b>y'.repeat(n)}</a>`).length;
  const one = sizeOf(500);
  const two = sizeOf(1000);
  assert.ok(two < one * 1.5, `${one} then ${two}`);
});

test('a link carried on into 5 000 blocks keeps its text and writes its address only within the size of the document', () => {
  const href = `http://x.io/${'a'.repeat(10_000)}`;
  const html = `<a href="${href}"><p>first</p>${'<p>y</p>'.repeat(5000)}</a>`;
  const out = sanitizeRichText(html);
  assert.ok(out.length < html.length * 4, `${html.length} characters in, ${out.length} out`);
  assert.ok(out.includes(`<a href="${href}">first</a>`), 'the first block keeps the link');
  assert.equal((out.match(/<p>/g) || []).length, 5001, 'every block is kept');
  assert.equal(out.replace(/<[^>]+>/g, ''), `first${'y'.repeat(5000)}`);
  assert.equal(sanitizeRichText(out), out);
});

// The old output's adjacent anchors to one address joined into one, which is what the new one writes.
function joined(html) {
  let out = '';
  let open = null;
  let closed = null;
  for (const part of html.split(/(<a href="[^"]*">|<\/a>)/)) {
    if (!part) continue;
    const tag = /^<a href="([^"]*)">$/.exec(part);
    if (tag) {
      if (closed === tag[1] && out.endsWith('</a>')) { out = out.slice(0, -4); open = tag[1]; closed = null; continue; }
      open = tag[1]; closed = null; out += part;
    } else if (part === '</a>') { out += part; closed = open; open = null; }
    else { out += part; closed = null; }
  }
  return out;
}
const hrefBytes = (html) => [...html.matchAll(/<a href="([^"]*)">/g)].reduce((n, m) => n + m[1].length, 0);

const PIECES = ['<a href="http://x.io">', '<a href="http://y.io">', '<a href="https://z.io/a?b=1&amp;c=2">', '<a href="javascript:x">', '</a>', '<b>', '</b>', '<i>', '</i>', '<u>', '<s>', '<strong>', '</em>',
  'a', 'b ', ' ', 'text', '<br>', '<p>', '</p>', '<ul>', '</ul>', '<li>', '</li>', '<ol>', '</ol>', '&amp;', '&lt;', '<div>', '</div>', '<span style="color:red">', '</span>'];

test('the same HTML as the old sanitizer, adjacent anchors to one address joined, on 15 000 seeded texts', () => {
  let seed = 61;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let compared = 0;
  for (let n = 0; n < 15_000; n += 1) {
    let html = '';
    for (let i = 0, k = 1 + Math.floor(random() * 14); i < k; i += 1) html += PIECES[Math.floor(random() * PIECES.length)];
    const old = before.sanitizeRichText(html);
    if (hrefBytes(old) > html.length) continue; // more addresses written than the text holds: the size bound applies
    compared += 1;
    const got = sanitizeRichText(html);
    assert.equal(got, joined(old), JSON.stringify(html));
    assert.equal(sanitizeRichText(got), got, `idempotent: ${JSON.stringify(html)}`);
  }
  assert.ok(compared > 12_000, `only ${compared} compared`);
});
