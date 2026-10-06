// Typing-freeze finding 7a (A-1): the sanitizer wrote the whole <a href="..."> around every run of a link, so a link
// whose text alternates bold and plain wrote its address once per run: N runs of a link L characters long came out
// N x L characters (a link of 10 000 characters with 1 000 runs: 10 MB from 19 kB), and the editor takes the result
// with insertHTML. It writes the address once around each run of runs that share it now, and a link a block carries
// on into many blocks writes it for each only while the addresses written (escaped, as they come out) stay within
// 16 times the input and a little over; the rest is text alone. No link of an ordinary document is dropped.
// Sizes are counted in characters written, not milliseconds, so the checks do not depend on the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText } from '../../src/utils/richText.js';
import * as before from '../fixtures/typing-freeze-reference/richText.mjs';
import { joinAnchors } from '../fixtures/typing-freeze-reference/joinAnchors.mjs';

const anchors = (html) => (html.match(/<a href=/g) || []).length;

test('a link of 20 000 characters with 4 000 bold and plain runs in it is one anchor', () => {
  const html = `<a href="http://x.io/${'a'.repeat(20_000)}">${'<b>x</b>y'.repeat(2000)}</a>`;
  const out = sanitizeRichText(html);
  assert.equal(anchors(out), 1);
  assert.ok(out.includes(`<a href="http://x.io/${'a'.repeat(20_000)}">`));
  assert.ok(out.length < html.length * 3, `${html.length} characters in, ${out.length} out`);
  assert.equal(sanitizeRichText(out), out);
});

test('output size is linear in the input: a link and its runs both twice as long, twice the output', () => {
  // The address written once per run came to the address's length times the runs: four times the output for these.
  const sizeOf = (k) => sanitizeRichText(`<a href="http://x.io/${'a'.repeat(5000 * k)}">${'<b>x</b>y'.repeat(500 * k)}</a>`).length;
  const one = sizeOf(1);
  const two = sizeOf(2);
  const four = sizeOf(4);
  assert.ok(two < one * 2.2, `${one} then ${two}`);
  assert.ok(four < two * 2.2, `${two} then ${four}`);
});

test('two links that alternate through 400 runs are written once per change, and the output grows with the input', () => {
  const sizeOf = (n) => {
    const a = `http://x.io/${'a'.repeat(2000)}`;
    const b = `http://y.io/${'b'.repeat(2000)}`;
    const html = `${`<a href="${a}">x</a><a href="${b}">y</a>`.repeat(n)}`;
    const out = sanitizeRichText(html);
    assert.equal(anchors(out), 2 * n, 'every link is kept');
    return { in: html.length, out: out.length };
  };
  const one = sizeOf(100);
  const two = sizeOf(200);
  assert.ok(two.out < one.out * 2.2, `${one.out} then ${two.out}`);
  assert.ok(one.out < one.in * 1.2, `${one.in} in, ${one.out} out`);
});

test('an ordinary document keeps every link, however long the addresses and however much they grow when written', () => {
  // The address is 200 characters in the text and 400 once its "&" are written as "&amp;": a limit measured in the
  // characters read, not written, ran out after a third of these.
  const path = '&-'.repeat(100);
  let html = '';
  for (let i = 0; i < 200; i += 1) html += `<p><a href="http://a${i}.io/${path}">t${i}</a></p>`;
  const out = sanitizeRichText(html);
  assert.equal(anchors(out), 200, 'all 200 links are kept');
  for (let i = 0; i < 200; i += 1) {
    assert.ok(out.includes(`<a href="http://a${i}.io/${'&amp;-'.repeat(100)}">t${i}</a>`), `link ${i}`);
  }
  assert.equal(sanitizeRichText(out), out);
});

test('a link a block carries on into thousands of blocks keeps its text and writes its address only within a size bound', () => {
  const href = `http://x.io/${'a'.repeat(10_000)}`;
  const sizeOf = (n) => {
    const html = `<a href="${href}"><p>first</p>${'<p>y</p>'.repeat(n)}</a>`;
    const out = sanitizeRichText(html);
    assert.ok(out.includes(`<a href="${href}">first</a>`), 'the first block keeps the link');
    assert.equal((out.match(/<p>/g) || []).length, n + 1, 'every block is kept');
    assert.equal(out.replace(/<[^>]+>/g, ''), `first${'y'.repeat(n)}`);
    assert.ok(out.length < 20 * html.length + 8192, `${html.length} characters in, ${out.length} out`);
    return out.length;
  };
  // 5 000 blocks of a 10 000 character address would be 50 MB; it is the bound's size at most.
  const one = sizeOf(2500);
  const two = sizeOf(5000);
  assert.ok(two < one * 2.2, `${one} then ${two}`);
});

// The old output's adjacent anchors to one address joined into one is what the sanitizer writes.
const PIECES = ['<a href="http://x.io">', '<a href="http://y.io">', '<a href="https://z.io/a?b=1&amp;c=2">', '<a href="javascript:x">', '<a href="x.io">', '<a href="https://x.io">',
  '</a>', '<b>', '</b>', '<i>', '</i>', '<u>', '<s>', '<strong>', '</em>',
  'a', 'b ', ' ', 'text', '<br>', '<p>', '</p>', '<ul>', '</ul>', '<li>', '</li>', '<ol>', '</ol>', '&amp;', '&lt;', '<div>', '</div>', '<span style="color:red">', '</span>'];

test('the same HTML as the old sanitizer, adjacent anchors to one address joined, on 15 000 seeded texts', () => {
  let seed = 61;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < 15_000; n += 1) {
    let html = '';
    for (let i = 0, k = 1 + Math.floor(random() * 14); i < k; i += 1) html += PIECES[Math.floor(random() * PIECES.length)];
    assert.equal(sanitizeRichText(html), joinAnchors(before.sanitizeRichText(html)), JSON.stringify(html));
  }
});
