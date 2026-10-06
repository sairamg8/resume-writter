// Typing-freeze leftovers (cluster A): the PDF import's withLinks copied an item's whole link list for each link
// ([...kept.links, one]) and put each address into the item's text one at a time (a new string per address), so a line
// set as one run of text with N links cost N². The list is copied once and pushed to, the text is cut once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLines } from '../../src/utils/importFile.js';

/** pdf.js, as far as pdfLines uses it: one page of one text item and its link annotations. */
const fakePdf = (content, annotations) => ({
  getDocument: () => ({
    promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: content }), getAnnotations: async () => annotations }) }),
    destroy: async () => {},
  }),
});

/** One line of `n` two-letter words, each a link ("ab" at 3 points a character). */
async function lineOfLinks(n) {
  const str = 'ab '.repeat(n).trimEnd();
  const content = [{ str, transform: [10, 0, 0, 10, 50, 700], width: str.length, height: 10 }];
  const annotations = Array.from({ length: n }, (_, k) => ({ subtype: 'Link', url: `https://x.io/${k}`, rect: [50 + 3 * k, 695, 52 + 3 * k, 712] }));
  const start = performance.now();
  const lines = await pdfLines(new Uint8Array(4), fakePdf(content, annotations));
  return { lines, ms: performance.now() - start };
}

test('a line of 40 000 links keeps every address and is read in time that grows linearly', async () => {
  const small = await lineOfLinks(200);
  const text = small.lines.map((l) => l.text).join(' ');
  assert.equal((text.match(/\(https:\/\/x\.io\/\d+\)/g) || []).length, 200, 'every address is written after its label');
  assert.ok(text.startsWith('ab (https://x.io/0) ab (https://x.io/1) ab (https://x.io/2)'), text.slice(0, 80));
  assert.equal(small.lines.flatMap((l) => l.links || []).length, 200);
  // Four times the links: 4x the time when linear, 16x when squared. The same run, so the machine's speed cancels.
  const best = async (n) => {
    let min = Infinity;
    for (let k = 0; k < 3; k += 1) min = Math.min(min, (await lineOfLinks(n)).ms);
    return min;
  };
  const base = await best(10_000);
  const big = await best(40_000);
  const all = await lineOfLinks(40_000);
  assert.equal(all.lines.flatMap((l) => l.links || []).length, 40_000);
  assert.ok(big < 8 * Math.max(base, 20), `10 000 links took ${base.toFixed(0)} ms, 40 000 took ${big.toFixed(0)} ms`);
});
