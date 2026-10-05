// Typing-freeze finding 7 (the sweep of what a paste or an import reaches): the ATS check cut the tags from each of an
// entry's bullets with /<[^>]+>/g, which read each "<" that no ">" followed to the end of the bullet ('<' x 100 000, seconds:
// time squared), and asked its list of bullets whether each was in it already (includes), which read the whole list for
// each bullet of a description (40 000 bullets, seconds). Both read once now, and the bullets are the old ones (the old
// extraction is kept below as the reference).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBulletsFromItem } from '../../src/utils/atsChecker.js';
import { decodeEntities, parseRichText } from '../../src/utils/richText.js';

const LIMIT_MS = 1000;
function timed(fn) {
  const start = performance.now();
  const out = fn();
  return { out, ms: performance.now() - start };
}

test('a bullet of "<" repeated is read in linear time', () => {
  const bullet = '<'.repeat(100_000);
  const { out, ms } = timed(() => extractBulletsFromItem({ bullets: [bullet] }));
  assert.deepEqual(out, [bullet]);
  assert.ok(ms < LIMIT_MS, `extractBulletsFromItem took ${ms.toFixed(0)} ms on ${bullet.length} characters`);
});

test('a description of 100 000 bullets is read in linear time, each once', () => {
  // 100 000 distinct ones: the old includes() takes some 28 s here, so a slow machine cannot hide it (40 000 took 2 s).
  const lines = Array.from({ length: 130_000 }, (_, i) => `• bullet ${i % 100_000}`);
  const { out, ms } = timed(() => extractBulletsFromItem({ description: lines.join('\n') }));
  assert.equal(out.length, 100_000);
  assert.equal(out[0], 'bullet 0');
  assert.ok(ms < LIMIT_MS, `extractBulletsFromItem took ${ms.toFixed(0)} ms on 130 000 lines`);
});

test('a list item with 40 000 continuation paragraphs is read in linear time, as one bullet', () => {
  // Each paragraph was glued on with `${text} ${next}`.trim(): the string flattened again each time (7 s here).
  const description = `<ul><li>a${'<p>bbbbbbbbbb</p>'.repeat(40_000)}</li></ul>`;
  const { out, ms } = timed(() => extractBulletsFromItem({ description }));
  assert.equal(out.length, 1);
  assert.equal(out[0], `a${' bbbbbbbbbb'.repeat(40_000)}`);
  assert.ok(ms < 2500, `extractBulletsFromItem took ${ms.toFixed(0)} ms on ${description.length} characters`);
});

// The old bullet extraction, as it was, for the seeded corpus.
function oldBullets(item) {
  const bullets = [];
  if (Array.isArray(item.bullets)) for (const b of item.bullets) { const clean = String(b || '').replace(/<[^>]+>/g, '').trim(); if (clean) bullets.push(clean); }
  if (item.description && typeof item.description === 'string') {
    const desc = item.description;
    if (/<li[\s>]/i.test(desc)) {
      const items = [];
      const openAt = [];
      for (const block of parseRichText(desc)) {
        const text = block.runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
        if (!block.inList) openAt.length = 0;
        else if (block.marker) { openAt.length = block.indent; openAt[block.indent] = items.push(text) - 1; }
        else if (block.indent >= 1) {
          const at = openAt.slice(0, block.indent + 1).findLast((i) => i !== undefined);
          if (at !== undefined) items[at] = `${items[at]} ${text}`.trim();
        }
      }
      for (const clean of items) if (clean && !bullets.includes(clean)) bullets.push(clean);
    } else {
      const textWithNewlines = desc.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|tr|blockquote)>/gi, '\n').replace(/<[^>]+>/g, '');
      const lines = decodeEntities(textWithNewlines).split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      const hasBulletMarkers = lines.some((l) => /^[\s•\-*–—◦▪▸‣⁃]/.test(l) || /^\d+[.)]\s/.test(l));
      if (hasBulletMarkers) {
        for (const line of lines) {
          const stripped = line.replace(/^[\s•\-*–—◦▪▸‣⁃]+/, '').replace(/^\d+[.)]\s*/, '').trim();
          if (stripped && !bullets.includes(stripped)) bullets.push(stripped);
        }
      } else if (lines.length > 1) {
        for (const line of lines) if (line && !bullets.includes(line)) bullets.push(line);
      }
    }
  }
  return bullets;
}

const BULLET_PIECES = ['<li>', '</li>', '<ul>', '</ul>', '<p>', '</p>', '<br>', '<b>', '</b>', 'Led ', 'Cut costs', 'x', ' ', '\n', '• ', '- ', '1. ', '<', '>', '<>', '&amp;', '&lt;', 'same', 'same\n'];

test('the bullets of an entry are the old ones, on 6000 seeded entries', () => {
  let seed = 99;
  const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const piece = () => BULLET_PIECES[Math.floor(random() * BULLET_PIECES.length)];
  for (let n = 0; n < 6000; n += 1) {
    let description = '';
    for (let i = 0, k = Math.floor(random() * 12); i < k; i += 1) description += piece();
    const bullets = random() < 0.3 ? [piece() + piece(), 'same', 'same'] : undefined;
    const item = { description, ...(bullets ? { bullets } : {}) };
    assert.deepEqual(extractBulletsFromItem(item), oldBullets(item), JSON.stringify(item));
  }
});
