// Typing-freeze 7b: pasting a very long text into a description made the build take time squared in
// its length — Classic 1.3 s at 50 000 characters, 12.7 s at 200 000 — and later previews queued
// behind it. textkit lays one paragraph out in one piece (Knuth-Plass keeps more breaks the longer
// it runs, and each width and line cut copies the run); a paragraph of more than 12 000 characters
// now reaches it as paragraphs of a few thousand (splitHugeBlock.js). Pinned: the time of 200 000
// characters against that of 30 000 (the old build took ~16 times as long, a linear one ~7; the
// limit leaves room for a loaded machine), and that every word of a long paste still prints, in order.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText } from './harness.mjs';

before(setup);
after(teardown);

function words(n, seed = 7) {
  let a = seed;
  const rand = () => { a = (Math.imul(a, 1103515245) + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  let out = '';
  while (out.length < n) {
    let w = '';
    for (let i = 2 + Math.floor(rand() * 9); i > 0; i -= 1) w += String.fromCharCode(97 + Math.floor(rand() * 26));
    out += `${w} `;
  }
  return out.slice(0, n).trim();
}

const paste = (text) => resume({ template: 'classic', sections: [experience([{ description: `<p>${text}</p>` }])] });

async function timed(text) {
  const start = performance.now();
  await render(paste(text));
  return performance.now() - start;
}

describe('a very long paste builds in time that follows its length (typing-freeze 7b)', () => {
  it('200 000 characters take less than 8 times as long as 30 000', async () => {
    await timed(words(5000)); // fonts and code loaded
    const small = Math.min(await timed(words(30000, 1)), await timed(words(30000, 2)));
    const big = await timed(words(200000, 3));
    assert.ok(big < small * 8 + 500, `30 000 characters ${small.toFixed(0)} ms, 200 000 characters ${big.toFixed(0)} ms (${(big / small).toFixed(1)}x)`);
  });

  it('prints every word of a long paste, in order', async () => {
    const text = words(40000, 5);
    const pages = await read(await render(paste(text)));
    const printed = allText(pages).replace(/\s+/g, '');
    assert.ok(printed.includes(text.replace(/\s+/g, '')), 'the pasted words, in order, on the pages');
  });
});
