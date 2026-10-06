// A-4: hasDataUrlInTag reads the text in one pass (typing-freeze 7a) in place of the regex it replaced. Pinned here:
// it answers as a plain reading of the rule does, on seeded random texts built from the pieces that matter (angle
// brackets, "data:" in any case, the payload's end characters, ";base64,"), and as the regex it replaced does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDataUrlInTag } from '../../src/utils/dataUrlInTag.js';

const isWord = (c) => c !== undefined && /[A-Za-z0-9_]/.test(c);

// The rule, read slowly: some "data:" that starts a word, has a "<" before it with no ">" between the two, and is
// followed by payload characters (not white space, quotes, ">", "," or ";") and then ";base64," in any case.
function naive(text) {
  for (let i = 0; i + 5 <= text.length; i += 1) {
    if (!/^data:$/i.test(text.slice(i, i + 5)) || isWord(text[i - 1])) continue;
    let inTag = false;
    for (let j = 0; j < i; j += 1) {
      if (text[j] !== '<') continue;
      if (!text.slice(j + 1, i).includes('>')) inTag = true;
    }
    if (!inTag) continue;
    let k = i + 5;
    while (k < text.length && !/[\s"'>,;]/.test(text[k])) k += 1;
    if (/^;base64,$/i.test(text.slice(k, k + 8))) return true;
  }
  return false;
}

const regex = (text) => /<[^>]*\bdata:[^\s"'>,;]*;base64,/i.test(text);

const PIECES = ['<', '<', '>', 'data:', 'data:', 'DATA:', 'Data:', ';base64,', ';BASE64,', ';base64', ';', ',', ' ', '\n', ' ', '"', "'",
  'a', 'x', 'image/png', 'xdata:', '_data:', '-data:', '9data:', 'dat', 'data', ':', '<img src="', '<a href=', 'base64,', '=', '/', '<>', '><', 'data:image/png', '<img src="data:'];

test('hasDataUrlInTag answers as the plain reading of its rule on 40 000 seeded texts', () => {
  let seed = 4004;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let yes = 0;
  for (let n = 0; n < 40_000; n += 1) {
    let text = '';
    for (let i = 0, k = 1 + Math.floor(random() * 16); i < k; i += 1) text += PIECES[Math.floor(random() * PIECES.length)];
    const want = naive(text);
    assert.equal(hasDataUrlInTag(text), want, JSON.stringify(text));
    assert.equal(regex(text), want, `the reading and the old regex agree: ${JSON.stringify(text)}`);
    if (want) yes += 1;
  }
  assert.ok(yes > 300 && yes < 39_000, `${yes} of 40 000 texts were a yes: the corpus must hold both answers`);
});

test('hasDataUrlInTag on the pictures a browser pastes, and on text that only looks like one', () => {
  assert.equal(hasDataUrlInTag('<img src="data:image/png;base64,iVBOR">'), true);
  assert.equal(hasDataUrlInTag("<IMG SRC='DATA:image/gif;BASE64,R0lG'>"), true);
  assert.equal(hasDataUrlInTag('data:image/png;base64,iVBOR'), false, 'outside a tag');
  assert.equal(hasDataUrlInTag('<p>a</p> data:image/png;base64,iVBOR'), false, 'after the tag closed');
  assert.equal(hasDataUrlInTag('<img src="data:text/plain,hello">'), false, 'not base64');
  assert.equal(hasDataUrlInTag('<a href="mydata:image/png;base64,x">'), false, 'not at the start of a word');
});
