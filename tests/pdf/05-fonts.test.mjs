// Fonts: every character prints, and a font choice can never break the PDF.
// The web fonts these cases print in (Gelasio, Bebas Neue, the picker's, the symbol fonts) come from a stand-in
// for Fontsource's CDN (fake-fontsource.mjs), not from the network: the file fetched them from the live CDN,
// and when the CDN was slow (8.1 s, on one gate) the app fell back to Noto Sans on purpose and "Georgia prints
// with an embedded Unicode font (Gelasio)" failed on the weather. Every case now runs, offline or not, with
// the assertions it always had; a URL the stand-in does not know fails the case that asked for it, and the
// last cases pin that nothing left the machine.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { setup, teardown, resume, experience, render, read, allText, allItems, loadModule } from './harness.mjs';
import { fakeFontsource } from './fake-fontsource.mjs';

before(setup);
after(teardown);

// 'No Such Font Anywhere 123' is the name that is no font: the CDN answers 404 for its package.
let cdn;
before(() => { cdn = fakeFontsource({ missing: ['no-such-font-anywhere-123'] }); });
after(() => cdn?.restore());
// After each case of a suite: a URL the stand-in does not know, or a connection it refused, fails that case.
const clean = () => cdn?.assertClean();

const fontsOf = (pages) => new Set(allItems(pages).map((t) => t.font.replace(/^[A-Z]{6}\+/, '')));

describe('characters outside Latin-1 (FIDA-65)', () => {
  afterEach(clean);

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

  it('prints arrows and check marks (symbol fonts, fetched on demand)', async () => {
    const pages = await read(await render(resume({ sections: [experience([{ description: '<p>Grew revenue → 2× ✓ done ★</p>' }])] })));
    const text = allText(pages);
    for (const ch of ['→', '✓', '★']) assert.ok(text.includes(ch), `${ch} in: ${text}`);
  });
});

describe('font choices never break the PDF', () => {
  afterEach(clean);

  it('a custom Google font with no bold and no italic renders bold and italic text (Bebas Neue)', async () => {
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

  it('Georgia prints with an embedded Unicode font (Gelasio), not the WinAnsi Times fallback (FIDA-64)', async () => {
    const pages = await read(await render(resume({
      settings: { font: 'georgia' },
      sections: [experience([{ description: '<p>Kraków “quotes” — dash</p>' }])],
    })));
    assert.ok(allText(pages).includes('Kraków “quotes” — dash'), allText(pages));
    assert.ok([...fontsOf(pages)].some((f) => /Gelasio/.test(f)), [...fontsOf(pages)].join(', '));
  });

  for (const template of ['classic', 'executive', 'minimal']) {
    it(`${template}: the job title in the inline header prints medium weight (FIDA-22)`, async () => {
      const pages = await read(await render(resume({ template, settings: { headerLayout: 'inline' }, personal: { title: 'Staff Engineer' } })));
      const title = allItems(pages).find((t) => t.str.includes('Staff Engineer'));
      assert.match(title.font, /NotoSans-Medium/, title.font);
    });
  }

  for (const font of ['inter', 'opensans', 'firasans', 'ibmplexsans', 'asap', 'roboto', 'lato', 'sourcesans', 'sourceserif', 'ptserif', 'literata']) {
    it(`picker font "${font}" renders regular, bold and italic`, async () => {
      const pages = await read(await render(resume({
        settings: { font },
        sections: [experience([{ description: '<p>Plain <strong>bold</strong> <em>italic</em> <strong><em>both</em></strong></p>' }])],
      })));
      const embedded = [...fontsOf(pages)];
      assert.ok(embedded.some((f) => /Bold/.test(f)) && embedded.some((f) => /Italic/.test(f)), embedded.join(', '));
    });
  }
});

// What the cases above ran on. Last in the file: `served` holds every request they made.
describe('the stand-in was all the network these cases used', () => {
  afterEach(clean);

  const FONTS = ['gelasio', 'bebas-neue', 'inter', 'open-sans', 'fira-sans', 'ibm-plex-sans', 'asap', 'roboto', 'lato',
    'source-sans-3', 'source-serif-4', 'pt-serif', 'literata', 'noto-sans-math', 'noto-sans-symbols-2'];

  it('every font they printed in was answered by it, and no connection left this machine', () => {
    assert.deepEqual(cdn.unexpected, [], 'a URL the stand-in does not know');
    assert.deepEqual(cdn.refused, [], 'a connection to another machine');
    const asked = new Set(cdn.served.map((url) => url.match(/@fontsource\/([^@]+)@/)[1]));
    assert.deepEqual(FONTS.filter((pkg) => !asked.has(pkg)), [], 'a font no case asked the stand-in for: that case did not run on it');
  });

  it('the face of a weight and style is a font fontkit reads, named for it: Gelasio (Georgia)', async () => {
    await render(resume({ settings: { font: 'georgia' } })); // registers and loads Gelasio, if no case before did
    const { Font } = await loadModule('/tests/fixtures/reactPdfFont.js');
    const names = Object.fromEntries(Font.getRegisteredFonts().Gelasio.sources.map((s) => [`${s.fontWeight} ${s.fontStyle}`, s.data?.postscriptName]));
    assert.deepEqual(names, {
      '400 normal': 'Gelasio-Regular', '500 normal': 'Gelasio-Medium', '700 normal': 'Gelasio-Bold',
      '400 italic': 'Gelasio-Italic', '500 italic': 'Gelasio-MediumItalic', '700 italic': 'Gelasio-BoldItalic',
    });
  });

  // The two that follow try the stand-in's refusals on a second one, restored at once: the first one's lists
  // (above) and its hook after each case are not touched by them.
  it('a URL it does not know fails loudly and is listed: a font fetch cannot slip back in unseen', async () => {
    const probe = fakeFontsource();
    try {
      const face = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-450-normal.woff'; // no such weight
      await assert.rejects(fetch(face), /inter-latin-450-normal\.woff is not served by the font CDN stand-in/);
      await assert.rejects(fetch('https://fonts.example.com/inter.woff'), /fonts\.example\.com\/inter\.woff is not served/);
      assert.deepEqual(probe.unexpected, [face, 'https://fonts.example.com/inter.woff']);
      assert.throws(() => probe.assertClean(), /reached for the network: .*inter-latin-450-normal\.woff is not served/, 'what the hook after each case turns into a red case');
      probe.assertClean(); // once: the next case is not failed for it again
    } finally { probe.restore(); }
  });

  it('a connection to another machine is refused and listed', () => {
    const probe = fakeFontsource();
    try {
      assert.throws(() => net.connect({ host: 'fonts.example.com', port: 443 }), /connection to fonts\.example\.com:443 was refused/);
      assert.deepEqual(probe.refused, ['fonts.example.com:443']);
      assert.throws(() => probe.assertClean(), /a connection to fonts\.example\.com:443/);
    } finally { probe.restore(); }
  });
});
