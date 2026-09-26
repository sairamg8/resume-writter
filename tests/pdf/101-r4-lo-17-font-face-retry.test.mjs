// R4-LO-17: a face of a loaded font that failed once (a bold on a network hiccup) was given a donor
// face's data (prepareFonts, pdfFontLoader.js) for the rest of the session: the bold printed as the
// regular until the tab was reloaded. Pinned: the face is fetched again a minute later (not on every
// build, so a face the CDN lacks is not re-downloaded per preview build), and then prints with its
// own data; meanwhile facesBorrowed() says a face is borrowing, so the preview builds again when the
// browser is back online.
// Run: node --test tests/pdf/101-r4-lo-17-font-face-retry.test.mjs
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;
const realNow = Date.now;

/** The CDN: one font, "Testface Bold", with a 400 and a 700; its 700 file fails while `boldFails`. */
let boldFails = false;
const boldFetches = [];
function network() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    if (u.endsWith('/testface-bold@5/metadata.json')) {
      return new Response(JSON.stringify({ family: 'Testface Bold', weights: [400, 700], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    if (u.includes('/testface-bold@5/files/') && u.endsWith('.woff')) {
      if (u.includes('-700-')) {
        boldFetches.push(u);
        if (boldFails) throw new TypeError('fetch failed');
      }
      return new Response(NOTO, { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
}

describe('a face that failed once is fetched again later, not borrowed for the session (R4-LO-17)', () => {
  let loader;
  let fallback;
  let Font;
  before(async () => {
    await setup();
    // A module that does not load (fail-first) fails the tests rather than this hook, which would
    // skip `after` and leave the harness's servers up.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    fallback = await loadModule('/src/utils/fontFallback.js').catch(() => null);
    ({ Font } = await loadModule('/tests/fixtures/reactPdfFont.js'));
  });
  afterEach(() => { globalThis.fetch = realFetch; Date.now = realNow; });
  after(teardown);

  it('the bold borrows the regular after a failed fetch, and gets its own data a minute on', async () => {
    const settings = { customFont: 'Testface Bold' };
    network();
    boldFails = true;
    const first = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal([first.fontFamily].flat()[0], 'Testface Bold', 'the font itself loads');
    const sources = Font.getRegisteredFonts()['Testface Bold'].sources;
    const regular = sources.find((s) => s.fontWeight === 400 && s.fontStyle === 'normal');
    const bold = sources.find((s) => s.fontWeight === 700 && s.fontStyle === 'normal');
    assert.ok(regular.data, 'the regular loaded');
    assert.equal(bold.data, regular.data, 'the failed bold prints with the regular for now');
    assert.equal(fallback.facesBorrowed(), true, 'the preview learns a face is borrowing');

    // The network is back, but a build right after does not fetch the bold again (a face the CDN
    // lacks would otherwise be re-downloaded on every preview build).
    boldFails = false;
    const tries = boldFetches.length;
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(boldFetches.length, tries, 'not fetched again within the minute');
    assert.equal(bold.data, regular.data);

    // A minute on, the next build fetches it, and the bold prints with its own data.
    const later = realNow() + 61_000;
    Date.now = () => later;
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.ok(boldFetches.length > tries, 'the bold is fetched again');
    assert.ok(bold.data, 'the bold has data');
    assert.notEqual(bold.data, regular.data, 'the bold prints with its own face, not the regular');
    assert.equal(typeof bold.data.glyphForCodePoint, 'function', 'a fontkit font');
    assert.equal(fallback.facesBorrowed(), false, 'nothing borrows any more');
  });
});
