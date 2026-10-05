// Typing-freeze finding 7(a): the Sidebar's breakToFit cut an unbreakable contact or label token
// into runs by measuring the run again with every character added (textWidth on each prefix of each
// run), and measured every character through a fresh face lookup. A 20 000-character token cost
// ~9 s of PDF build. runsThatFit now finds each run's end by doubling then halving, so the number
// of characters measured grows in step with the token. These tests pin (1) that scaling, counted in
// measured characters, not milliseconds, and (2) that what breakToFit cuts is what it always cut:
// the old loop is kept below as the reference, compared on a seeded corpus.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
let online = null;
async function isOnline() {
  if (online === null) online = await fetch(`${CDN}/inter@5/metadata.json`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  return online;
}

/** The loop breakToFit used before the fix: one measure per character, of the run so far plus it. */
function oldRunsThatFit(part, fits) {
  const runs = [''];
  for (const ch of part) {
    const last = runs.length - 1;
    if (runs[last] && !fits(runs[last] + ch)) runs.push(ch);
    else runs[last] += ch;
  }
  return runs;
}

/** mulberry32: the same corpus on every run. */
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABETS = {
  ascii: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  kerning: 'AVAWToYAWVTY',
  punct: 'ab/c.d-e_f@g?h&i=j#',
  cjk: '山田太郎東京大学王小明日本語',
  emoji: ['🚀', '✅', '😀', '👍🏽', '⭐', 'a', 'b'],
  combining: ['é', 'ä', 'ô', 'ñ', 'x', 'y', 'z'],
  hebrew: 'שלוםכהןאביב',
  arabic: 'مرحباأحمدمحمد',
  mixed: ['a', 'b', '山', '田', 'é', 'א', 'م', '🚀', '/', '.', '-', 'W', 'V'],
};

const sample = (rand, alphabet, length) => {
  const symbols = [...alphabet];
  let out = '';
  for (let i = 0; i < length; i += 1) out += symbols[Math.floor(rand() * symbols.length)];
  return out;
};

describe('Sidebar: breaking a long token to fit its column (typing-freeze 7a)', () => {
  it('measures a number of characters that grows with the token, not with its square', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const { runsThatFit } = await loadModule('/src/templates/pdf/shared/pdfMeasure.js');
    // A width that is a count: 0.5 pt a character, a 100 pt column fits 200.
    const measured = (length, fn) => {
      let chars = 0;
      let calls = 0;
      const fits = (s) => { calls += 1; chars += s.length; return s.length * 0.5 <= 100; };
      const runs = fn('a'.repeat(length), fits);
      assert.equal(runs.join(''), 'a'.repeat(length));
      return { chars, calls };
    };
    const small = measured(5000, runsThatFit);
    const big = measured(20000, runsThatFit);
    assert.ok(big.chars <= small.chars * 5, `4x the token measured ${(big.chars / small.chars).toFixed(1)}x the characters (${small.chars} -> ${big.chars})`);
    assert.ok(big.chars <= 20000 * 40, `measured ${big.chars} characters for a 20 000-character token`);
    // The loop it replaced measured 100 characters on average for every character.
    const before = measured(20000, oldRunsThatFit);
    assert.ok(before.chars > big.chars * 5, 'the reference loop measures far more (the test reads the defect)');
  });

  it('cuts every token into the runs the old loop cut, on a seeded corpus', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const r = resume({ template: 'sidebar', personal: { name: Object.values(ALPHABETS).map((a) => [].concat(...[a]).join('')).join(' ') } });
    const { resolvePdfFonts, collectText, BREAK_AFTER, BREAK_MARK } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const { textWidth, fitsOnLine, breakToFit } = await loadModule('/src/templates/pdf/shared/pdfMeasure.js');
    const { fontFamily } = await resolvePdfFonts(r.settings, collectText(r));
    const registered = (word) => [word];
    const oldBreakToFit = (style, maxWidth) => {
      const fits = (s) => textWidth(s, style) <= maxWidth - 1;
      return (word) => {
        if (fitsOnLine(word, style, maxWidth)) return registered(word);
        const parts = word.split(BREAK_AFTER).flatMap((part) => (fits(part) ? [part] : oldRunsThatFit(part, fits)));
        return parts.flatMap((part, i) => (i ? [BREAK_MARK, part] : [part]));
      };
    };
    const rand = rng(164);
    let cut = 0;
    const differences = [];
    for (const [name, alphabet] of Object.entries(ALPHABETS)) {
      for (let k = 0; k < 40; k += 1) {
        const style = { fontFamily, fontSize: 8 + Math.floor(rand() * 7), fontWeight: rand() < 0.3 ? 'bold' : 'normal', letterSpacing: rand() < 0.2 ? 0.4 : 0 };
        const maxWidth = 30 + Math.floor(rand() * 170);
        const word = sample(rand, alphabet, 1 + Math.floor(rand() * 250));
        const was = oldBreakToFit(style, maxWidth)(word).map(String);
        const now = breakToFit(style, maxWidth)(word).map(String);
        if (was.length > 1) cut += 1;
        if (JSON.stringify(was) !== JSON.stringify(now)) differences.push(`${name} ${maxWidth}pt ${JSON.stringify(word.slice(0, 40))}`);
        assert.equal(now.join(''), word, `${name}: the text reads as typed`);
      }
    }
    assert.ok(cut > 100, `the corpus breaks ${cut} tokens`);
    assert.deepEqual(differences, [], 'every token is cut where the old loop cut it');
  });

  it('breaks a 20 000-character token of one unbreakable run with every run inside its box', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const r = resume({ template: 'sidebar' });
    const { resolvePdfFonts, collectText } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const { textWidth, breakToFit } = await loadModule('/src/templates/pdf/shared/pdfMeasure.js');
    const { fontFamily } = await resolvePdfFonts(r.settings, collectText(r));
    const style = { fontFamily, fontSize: 9 };
    const token = 'x'.repeat(20000);
    const parts = breakToFit(style, 146)(token).map(String).filter(Boolean);
    assert.equal(parts.join(''), token);
    assert.ok(parts.length > 100);
    for (const part of parts.slice(0, -1)) assert.ok(textWidth(part, style) <= 145, 'a run fits the box');
  });
});
