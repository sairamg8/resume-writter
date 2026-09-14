// Fonts: every character prints, and a font choice can never break the PDF.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, read, allText, allItems } from './harness.mjs';

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

const fontsOf = (pages) => new Set(allItems(pages).map((t) => t.font.replace(/^[A-Z]{6}\+/, '')));

describe('characters outside Latin-1 (FIDA-65)', () => {
  it('prints Latin Extended, Cyrillic, Greek and Vietnamese text and ₹ with the default font — offline', async () => {
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = (url, ...rest) => {
      if (String(url).startsWith('https://')) { calls.push(String(url)); return Promise.reject(new Error('offline')); }
      return realFetch(url, ...rest);
    };
    try {
      const line = 'Salary ₹12,00,000 Łódź Привет Ωmega Tiếng Việt';
      const pages = await read(await render(resume({ sections: [experience([{ description: `<p>${line}</p>` }])] })));
      const text = allText(pages);
      for (const word of ['₹12,00,000', 'Łódź', 'Привет', 'Ωmega', 'Tiếng', 'Việt']) assert.ok(text.includes(word), `${word} in: ${text}`);
      assert.deepEqual(calls, [], 'the default font needs no network');
      for (const f of fontsOf(pages)) assert.match(f, /^NotoSans/, `embedded font ${f}`);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('prints arrows and check marks (symbol fonts, fetched on demand)', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await read(await render(resume({ sections: [experience([{ description: '<p>Grew revenue → 2× ✓ done ★</p>' }])] })));
    const text = allText(pages);
    for (const ch of ['→', '✓', '★']) assert.ok(text.includes(ch), `${ch} in: ${text}`);
  });
});

describe('font choices never break the PDF', () => {
  it('a custom Google font with no bold and no italic renders bold and italic text (Bebas Neue)', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await read(await render(resume({
      settings: { customFont: 'Bebas Neue' },
      sections: [experience([{ description: '<p><strong>Bold</strong> and <em>italic</em> text</p>' }])],
    })));
    assert.ok(allText(pages).includes('Bold'), allText(pages));
    assert.ok([...fontsOf(pages)].some((f) => /BebasNeue/i.test(f)), [...fontsOf(pages)].join(', '));
  });

  it('a name that is not a font falls back to Noto Sans instead of failing', async () => {
    const pages = await read(await render(resume({
      settings: { customFont: 'No Such Font Anywhere 123' },
      sections: [experience([{ description: '<p>Still renders</p>' }])],
    })));
    assert.ok(allText(pages).includes('Still renders'));
    for (const f of fontsOf(pages)) assert.match(f, /^NotoSans/);
  });

  it('Georgia prints with an embedded Unicode font (Gelasio), not the WinAnsi Times fallback (FIDA-64)', async (t) => {
    if (!(await isOnline())) return t.skip('offline');
    const pages = await read(await render(resume({
      settings: { font: 'georgia' },
      sections: [experience([{ description: '<p>Kraków “quotes” — dash</p>' }])],
    })));
    assert.ok(allText(pages).includes('Kraków “quotes” — dash'), allText(pages));
    assert.ok([...fontsOf(pages)].some((f) => /Gelasio/.test(f)), [...fontsOf(pages)].join(', '));
  });

  for (const font of ['inter', 'opensans', 'firasans', 'ibmplexsans', 'asap', 'roboto', 'lato', 'sourcesans', 'sourceserif', 'ptserif', 'literata']) {
    it(`picker font "${font}" renders regular, bold and italic`, async (t) => {
      if (!(await isOnline())) return t.skip('offline');
      const pages = await read(await render(resume({
        settings: { font },
        sections: [experience([{ description: '<p>Plain <strong>bold</strong> <em>italic</em> <strong><em>both</em></strong></p>' }])],
      })));
      const embedded = [...fontsOf(pages)];
      assert.ok(embedded.some((f) => /Bold/.test(f)) && embedded.some((f) => /Italic/.test(f)), embedded.join(', '));
    });
  }
});
