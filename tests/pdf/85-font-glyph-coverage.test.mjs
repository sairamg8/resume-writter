// R2-045: characters in the Latin subset's Unicode range that the Latin face does not draw.
// ↑ ↓ printed as curly quotes, the hyphens ‐ ‑ vanished and U+202F printed as '/': the range
// said "Latin", so no fallback font was ever asked, and the face drew its .notdef glyph. Now a
// dash or space the face lacks is drawn with the face's own stand-in ('-', ' '), and an arrow
// brings in Noto Sans Math like any other arrow.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText, allItems } from './harness.mjs';
import { pdftotext, wordGaps } from './extractors.mjs';

before(setup);
after(teardown);

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
let online = null;
async function isOnline() {
  if (online === null) {
    online = await fetch(`${CDN}/lato@5/metadata.json`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false);
  }
  return online;
}

const fontsOf = (pages) => [...new Set(allItems(pages).map((t) => t.font.replace(/^[A-Z]{6}\+/, '')))];

const LINE = 'Built an e‐mail queue, non‑stop, 10 000 jobs a day';
const READS = ['e-mail', 'non-stop', '10 000', 'jobs a day'];

async function renderLine(line, settings = {}) {
  return render(resume({ settings, sections: [experience([{ description: `<p>${line}</p>` }])] }));
}

async function assertDashesAndSpaces(settings) {
  const bytes = await renderLine(LINE, settings);
  const text = allText(await read(bytes)).replace(/\s+/g, ' ');
  for (const word of READS) assert.ok(text.includes(word), `pdf.js reads "${word}" in: ${text}`);
  for (const [mode, out] of pdftotext(bytes)) {
    const plain = out.replace(/\s+/g, ' ');
    for (const word of READS) assert.ok(plain.includes(word), `${mode} reads "${word}" in: ${plain}`);
  }
  // Poppler 26.01's -raw joins two words across a gap under ~0.201 em ("jobsa day" on CI, where the
  // default face draws its own U+2009 at 0.2 em); Poppler 24.02 does not, so the gap itself is the proof.
  const narrow = (await wordGaps(bytes)).filter((g) => g.em < 0.21).map((g) => `${g.em.toFixed(3)} em ${g.at}`);
  assert.deepEqual(narrow, [], 'every word gap clears -raw\'s word break');
}

describe('dashes and spaces the Latin face lacks print as its own stand-ins (R2-045)', () => {
  it('the default font, offline', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (url, ...rest) => (String(url).startsWith('https://') ? Promise.reject(new Error('offline')) : realFetch(url, ...rest));
    try {
      await assertDashesAndSpaces({});
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('a Fontsource font (Lato)', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    await assertDashesAndSpaces({ font: 'lato' });
  });
});

describe('arrows in the Latin range print as arrows (R2-045)', () => {
  it('↑ and ↓ bring in Noto Sans Math, as → does', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await read(await renderLine('Revenue ↑ 40%, churn ↓ 12%, 3∕4 time'));
    const text = allText(pages);
    for (const s of ['Revenue ↑ 40%', 'churn ↓ 12%', '3∕4']) assert.ok(text.includes(s), `${s} in: ${text}`);
    assert.doesNotMatch(text, /[‘’“”]/, text);
    assert.ok(fontsOf(pages).some((f) => /NotoSansMath/.test(f)), fontsOf(pages).join(', '));
  });
});
