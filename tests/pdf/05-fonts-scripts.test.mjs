// Fonts, part 2: scripts beyond Latin, Cyrillic, Greek and Devanagari — CJK, Korean, Arabic, Hebrew,
// Thai — and emoji print as their own characters in the PDF (which is also the editor preview), in the
// default font and in a custom font that has the script (R2-010). They used to fall through every
// registered face to react-pdf's last resort, Helvetica, whose WinAnsi encoding drew mojibake:
// pdf.js read '王小明 東京大学' as "‹q¬'f" and 'Rocket 🚀 Star' as 'Rocket =€' over 'Star'.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { setup, teardown, resume, experience, render, renderCover, read, allText, allItems, loadModule, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
let online = null;
async function isOnline() {
  if (online === null) {
    online = await fetch(`${CDN}/inter@5/metadata.json`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  }
  return online;
}

const fontsOf = (pages) => [...new Set(allItems(pages).map((t) => t.font.replace(/^[A-Z]{6}\+/, '')))];
// pdf.js may split a run of CJK or RTL glyphs into items with spaces between them: compare without spaces.
const squash = (s) => s.replace(/\s+/g, '');

const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2],
  t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];

/**
 * Every glyph page 1 draws, in drawing order: { ch, x0, x1, y, em } — ch its text (ToUnicode), x0–x1
 * its own advance on the page, y its baseline, em its font size — from pdf.js's operator list: the
 * CTM, the text matrix (a positioned mark moves it) and the TJ adjustments. The same walk as
 * extractors.mjs's wordGaps, per glyph.
 */
async function firstPageGlyphs(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const { fnArray, argsArray } = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const O = pdfjs.OPS;
  const glyphs = [];
  const stack = [];
  const identity = [1, 0, 0, 1, 0, 0];
  let [ctm, tm, tlm, size, tc, tw] = [identity, identity, identity, 0, 0, 0];
  fnArray.forEach((fn, k) => {
    const a = argsArray[k];
    if (fn === O.save) stack.push(ctm);
    else if (fn === O.restore) ctm = stack.pop() || ctm;
    else if (fn === O.transform) ctm = times(a, ctm);
    else if (fn === O.beginText) tm = tlm = [1, 0, 0, 1, 0, 0];
    else if (fn === O.setTextMatrix) tm = tlm = a.length === 6 ? [...a] : Array.from(a[0]);
    else if (fn === O.moveText || fn === O.setLeadingMoveText) tm = tlm = times([1, 0, 0, 1, a[0], a[1]], tlm);
    else if (fn === O.setFont) size = a[1];
    else if (fn === O.setCharSpacing) tc = a[0];
    else if (fn === O.setWordSpacing) tw = a[0];
    else if (fn === O.showText) {
      const m = times(tm, ctm);
      const em = size * Math.hypot(m[0], m[1]);
      let x = 0;
      for (const g of a[0]) {
        if (typeof g === 'number') { x -= (g / 1000) * size; continue; }
        if (!g) continue;
        const w = (g.width / 1000) * size;
        glyphs.push({ ch: g.unicode, x0: x * m[0] + m[4], x1: (x + w) * m[0] + m[4], y: x * m[1] + m[5], em });
        x += w + tc + (g.isSpace ? tw : 0);
      }
      tm = times([1, 0, 0, 1, x, 0], tm);
    }
  });
  return glyphs;
}

/** Render the name, the company and a bullet in `sample`, and read the PDF back. */
async function renderSample({ name, company, line }, settings = {}) {
  return read(await render(resume({
    settings,
    personal: { name },
    sections: [experience([{ company, description: `<p>${line}</p>` }])],
  })));
}

function assertPrinted(pages, words, fontPattern) {
  const text = squash(allText(pages));
  for (const word of words) assert.ok(text.includes(squash(word)), `${word} in: ${allText(pages)}`);
  const fonts = fontsOf(pages);
  for (const f of fonts) assert.doesNotMatch(f, /Helvetica/, `no character falls through to Helvetica: ${fonts.join(', ')}`);
  if (fontPattern) assert.ok(fonts.some((f) => fontPattern.test(f)), `a ${fontPattern} face is embedded: ${fonts.join(', ')}`);
}

const SAMPLES = {
  chinese:  { name: '王小明', company: '北京大学', line: '负责后端开发' },
  japanese: { name: '山田太郎', company: '東京大学', line: 'ソフトウェア開発を担当' },
  korean:   { name: '김민준', company: '서울대학교', line: '백엔드 개발 담당' },
  arabic:   { name: 'محمد أحمد', company: 'جامعة القاهرة', line: 'مهندس برمجيات في شركة' }, // في, شر: ligatures
  hebrew:   { name: 'דוד כהן', company: 'אוניברסיטת תל אביב', line: 'מהנדס תוכנה' },
  thai:     { name: 'สมชาย ใจดี', company: 'จุฬาลงกรณ์มหาวิทยาลัย', line: 'วิศวกรซอฟต์แวร์' },
};

describe('scripts outside the bundled Noto Sans subsets print as themselves (R2-010)', () => {
  for (const [script, sample] of Object.entries(SAMPLES)) {
    it(`${script}, default font: the name, the company and the text read back, and nothing is Helvetica`, async (t) => {
      if (!(await isOnline())) return t.skip('offline');
      const pages = await renderSample(sample);
      assertPrinted(pages, [sample.name, sample.company, sample.line]);
      assert.ok(allText(pages).includes('Role 1'), 'the Latin text around it still prints');
    });
  }

  it('emoji and other characters beyond U+FFFF print whole, with an ordinary space after them', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await renderSample({ name: 'Test Person', company: 'Launch 🚀 Co', line: 'Rocket 🚀 Star ⭐ and ✅ done 𝗕𝗼𝗹𝗱' });
    assertPrinted(pages, ['🚀', 'Star', '⭐', '✅'], /NotoEmoji/);
    // 𝗕𝗼𝗹𝗱 (pasted "bold" letters, U+1D5D5…) comes from Noto Sans Math, which draws the sans and the
    // serif bold letters with one glyph, so a PDF can map it back to only one of them: NFKC, as ATS
    // parsers normalise, reads both as 'Bold'.
    assert.ok(allText(pages).normalize('NFKC').includes('done Bold'), allText(pages));
    // textkit gave each half of a surrogate pair Helvetica: 'Rocket =€' drawn over 'Star'. And Noto
    // Emoji's own space is 1.27 em wide, so the space after an emoji stays in the text's font.
    const items = allItems(pages);
    for (const [before, after] of [['🚀', 'Co'], ['🚀', 'Star']]) {
      const emoji = items.find((i) => i.str.includes(before) && items.some((j) => j.str.includes(after) && Math.abs(j.y - i.y) < 1));
      const word = items.find((j) => j.str.includes(after) && Math.abs(j.y - emoji.y) < 1);
      const gap = word.x + (word.str.indexOf(after) ? word.w * (word.str.indexOf(after) / word.str.length) : 0) - (emoji.x + emoji.w);
      assert.ok(gap > 0 && gap < 6, `'${after}' starts one ordinary space after ${before} (${gap.toFixed(2)} pt): ${JSON.stringify([emoji, word])}`);
    }
  });

  it('a long right-to-left bullet reads back line by line in the order it was typed', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const words = 'פיתחתי מערכת תשלומים חדשה עבור לקוחות הבנק ושיפרתי את זמני התגובה של השרתים בצורה משמעותית מאוד לאורך כל השנה'.split(' ');
    const line = [...words, ...words].join(' ');
    const pages = await renderSample({ name: 'דוד כהן', company: 'בנק הפועלים', line });
    const lines = pages[0].items.filter((i) => /[\u0590-\u05FF]/.test(i.str) && i.y < pages[0].items.find((j) => j.str.includes('Role 1')).y);
    assert.ok(lines.length >= 2, `the bullet wraps: ${JSON.stringify(lines)}`);
    const read = lines.map((i) => i.str.trim()).join(' ').split(/\s+/);
    assert.deepEqual(read, line.split(' '), 'every wrapped line reads right to left, in order');
  });

  it('Hebrew points and Arabic vowels sit on their letters and read back after them', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const bytes = await render(resume({ personal: { name: 'שָׁלוֹם כהן' }, sections: [experience([{ company: 'مُحَمَّد 2020 Ltd' }])] }));
    assertPrinted(await read(bytes), ['שָׁלוֹם כהן', 'مُحَمَّد']);
    // A mark's offset reached the page ~1/100 as large (textkit scaled it to points, the renderer
    // scaled it again), so every mark was drawn after its letter instead of on it.
    const glyphs = await firstPageGlyphs(bytes);
    for (const [mark, letter] of [['\u05B8', 'ש'], ['\u05B9', 'ו'], ['\u064F', 'م'], ['\u0651', 'م']]) {
      const m = glyphs.find((g) => g.ch.includes(mark));
      const base = glyphs.filter((g) => g.ch === letter && Math.abs(g.y - m.y) < m.em / 2)
        .sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - m.x0) - Math.abs((b.x0 + b.x1) / 2 - m.x0))[0];
      assert.ok(m.x0 > base.x0 + 0.5 && m.x0 < base.x1 - 0.5, `U+${mark.codePointAt(0).toString(16)} at ${m.x0.toFixed(2)} sits on ${letter} [${base.x0.toFixed(2)}, ${base.x1.toFixed(2)}]`);
    }
  });

  it('textWidth (the letterhead fit) measures CJK words and the spaces between them as they print', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const line = '山田 太郎 東京 大学';
    const r = resume({ sections: [experience([{ description: `<p>${line}</p>` }])] });
    const item = allItems(await read(await render(r))).find((i) => i.str.includes('太郎'));
    assert.equal(item.str.trim(), line, 'the words and their spaces are one run, in Noto Sans JP');
    const { resolvePdfFonts, collectText } = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js');
    const { textWidth } = await loadModule('/src/templates/pdf/shared/pdfMeasure.js');
    const { fontFamily } = await resolvePdfFonts(r.settings, collectText(r));
    const width = textWidth(line, { fontFamily, fontSize: item.h });
    assert.ok(Math.abs(width - item.w) < 0.05, `textWidth ${width.toFixed(2)} pt, printed ${item.w.toFixed(2)} pt`);
  });

  it('a custom font that has the script draws it: Noto Sans JP prints the Japanese name in Noto Sans JP', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await renderSample(SAMPLES.japanese, { customFont: 'Noto Sans JP' });
    assertPrinted(pages, [SAMPLES.japanese.name, SAMPLES.japanese.company, SAMPLES.japanese.line], /NotoSansJP/);
  });

  it('a custom font that has the script draws it: IBM Plex Sans Arabic prints the Arabic name in itself', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await renderSample(SAMPLES.arabic, { customFont: 'IBM Plex Sans Arabic' });
    assertPrinted(pages, [SAMPLES.arabic.name, SAMPLES.arabic.company, SAMPLES.arabic.line], /IBMPlexSansArabic/);
  });

  it('Noto Sans Arabic as the custom font draws the Arabic, not Helvetica', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    // Its text layer is the font's own limit: it draws a letter as a dotless skeleton plus a dot
    // glyph, shared by several letters (pdfFontCoverage.js), so only the drawing is asserted here.
    const pages = await renderSample(SAMPLES.arabic, { customFont: 'Noto Sans Arabic' });
    assertPrinted(pages, [], /NotoSansArabic/);
    assert.ok(allItems(pages).some((i) => /NotoSansArabic/.test(i.font) && /[\u0600-\u06FF]/.test(i.str)), 'Arabic letters are drawn in Noto Sans Arabic');
  });

  it('a picker font with no CJK still prints a Chinese name (Inter + Noto Sans SC)', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await renderSample(SAMPLES.chinese, { font: 'inter' });
    assertPrinted(pages, [SAMPLES.chinese.name, SAMPLES.chinese.company], /Inter/);
  });
});

describe('every template, and its cover letter, prints every script (R2-010)', () => {
  // The font stack is resolved once per document from all of its text (pdfExportReactPDF), so each
  // template — and the letter, whose text is collected apart — must carry the same fallbacks.
  for (const template of TEMPLATES) {
    it(`${template}: CJK, Korean, Arabic, Hebrew, Thai and emoji in the header, an entry and the letter`, async (t) => {
      if (!(await isOnline())) return t.skip('offline');
      const r = resume({
        template,
        personal: { name: '王小明', location: '서울' },
        sections: [experience([{ company: 'جامعة القاهرة', role: 'מהנדס תוכנה', description: '<p>สมชาย 🚀 東京大学</p>' }])],
        coverLetter: { recipientName: '김민준', company: '東京大学', subject: 'שלום עולם', body: '<p>مرحبا 🚀 สวัสดี</p>' },
      });
      assertPrinted(await read(await render(r)), ['王小明', '서울', 'جامعة القاهرة', 'מהנדס תוכנה', 'สมชาย', '🚀', '東京大学']);
      assertPrinted(await read(await renderCover(r)), ['王小明', '김민준', '東京大学', 'שלום עולם', 'مرحبا', '🚀', 'สวัสดี']);
    });
  }
});
