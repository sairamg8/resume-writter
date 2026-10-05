// Typing-freeze finding 7 (the sweep of what an import reaches): the PDF import read a page's text items with work that grew
// with the square of the rows: each item looked through every row so far for its line (16 000 rows, eight seconds),
// each wrapped line rebuilt the paragraph's text to read its last character (a column of 20 000 lines, four), and a link's
// label was trimmed with /^[\s|•·]+|[\s|•·,.;:!?]+$/g, which read a long run of punctuation inside the label again
// from each of its characters (a label of 100 000 dots, sixteen). A page of 135 000 items also threw a RangeError (its
// extremes were found with Math.min(...list)), and the import failed. Each is read once now, and a page's lines come out
// as they did (the old file is kept in tests/fixtures/typing-freeze-reference as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfLines, pdfLinesOfPages } from '../../src/utils/importFile.js';
import * as before from '../fixtures/typing-freeze-reference/importFile.mjs';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}
const items = (rows, cols) => {
  const out = [];
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) out.push({ str: `word${r} ${c}`, x: 50 + c * 60, y: 800 - r * 12, w: 40, h: 10 });
  return out;
};

test('a page of 16 000 rows is read in linear time', () => {
  const { out, ms } = timed(() => pdfLinesOfPages([items(16_000, 3)]));
  assert.ok(out.length >= 16_000);
  assert.ok(ms < LIMIT_MS, `pdfLinesOfPages took ${ms.toFixed(0)} ms`);
});

test('a column of 20 000 lines that wrap into one paragraph is read in linear time', () => {
  const { out, ms } = timed(() => pdfLinesOfPages([items(20_000, 1)]));
  assert.ok(out.length >= 1);
  assert.ok(ms < LIMIT_MS, `pdfLinesOfPages took ${ms.toFixed(0)} ms`);
});

test('a page of 135 000 text items is read, not refused', () => {
  const { out, ms } = timed(() => pdfLinesOfPages([items(45_000, 3)]));
  assert.ok(out.length >= 45_000);
  assert.ok(ms < 3 * LIMIT_MS, `pdfLinesOfPages took ${ms.toFixed(0)} ms`);
});

/** A stand-in for pdf.js: one page of the given text items and link annotations. */
const fakePdf = (content, annotations) => ({
  getDocument: () => ({
    promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: content }), getAnnotations: async () => annotations }) }),
    destroy: async () => {},
  }),
});

test('a link whose label has 100 000 dots in it is read in linear time, its address kept', async () => {
  const label = `x${'.'.repeat(100_000)}y`;
  const content = [{ str: label, transform: [10, 0, 0, 10, 50, 700], width: 400, height: 10 }, { str: 'more', transform: [10, 0, 0, 10, 50, 650], width: 40, height: 10 }];
  const annotations = [{ subtype: 'Link', url: 'https://x.io', rect: [50, 695, 450, 712] }];
  const start = performance.now();
  const lines = await pdfLines(new Uint8Array(4), fakePdf(content, annotations));
  const ms = performance.now() - start;
  assert.equal(lines[0].text, `${label} (https://x.io)`);
  assert.deepEqual(lines[0].links, [{ label, url: 'https://x.io' }]);
  assert.ok(ms < LIMIT_MS, `pdfLines took ${ms.toFixed(0)} ms`);
  const small = await pdfLines(new Uint8Array(4), fakePdf([{ str: '| My profile, ', transform: [10, 0, 0, 10, 50, 700], width: 60, height: 10 }], [{ subtype: 'Link', url: 'https://x.io/me', rect: [50, 695, 110, 712] }]));
  assert.equal(small[0].text, '| My profile (https://x.io/me),');
});

const STRINGS = ['•', '–', '·', '1.', 'a)', 'Experience', 'Acme Corp', 'Senior Engineer', 'Jan 2020 – Present', 'built the data-', 'pipeline for all', 'Skills', 'Python', 'Page 1', 'Page 2 of 3',
  'Pat Doe — Page 2', 'x', 'Austin, TX', '| a |', 'end.'];

test('the same lines as the old reader on 4000 seeded pages', () => {
  let seed = 21;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (list) => list[Math.floor(random() * list.length)];
  for (let n = 0; n < 4000; n += 1) {
    const pages = [];
    for (let p = 0, np = 1 + Math.floor(random() * 3); p < np; p += 1) {
      const page = [];
      let y = 780;
      for (let r = 0, rows = 3 + Math.floor(random() * 25); r < rows; r += 1) {
        y -= random() < 0.15 ? 20 + random() * 10 : (random() < 0.2 ? 0.5 + random() * 2 : 11 + random() * 3);
        let x = random() < 0.3 ? 50 + Math.floor(random() * 3) * 14 : 50;
        if (random() < 0.2) x = 320;
        for (let c = 0, cols = 1 + Math.floor(random() * 3); c < cols; c += 1) {
          const str = pick(STRINGS);
          const w = str.length * (4.5 + random());
          page.push({ str, x, y: y + (random() < 0.2 ? (random() - 0.5) * 2 : 0), w, h: random() < 0.1 ? 14 : 10 });
          x += w + (random() < 0.5 ? 6 : 40 + random() * 100);
        }
      }
      pages.push(page);
    }
    const copy = () => pages.map((page) => page.map((item) => ({ ...item })));
    assert.deepEqual(pdfLinesOfPages(copy()), before.pdfLinesOfPages(copy()), JSON.stringify(pages).slice(0, 200));
  }
});
