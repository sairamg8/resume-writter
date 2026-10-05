// A font face whose first fetch outran its build's wait lands prepared, and not over the donor face it
// was lent (R2-142, review of 38e7b70e). The wait ends, the fetch goes on (react-pdf cannot abort it), and
// a face that stalled while the rest of its family loaded borrows a donor's data. When its own fetch
// landed, react-pdf wrote the new font straight into the live face (FontSource._load: `this.data = data`),
// before any prepareFonts had primed it: a build laying out then — an Export, the ATS view — took a face
// with ligatures on and no seeded glyph cache, and in a fallback subset family with the PostScript name
// every subset file shares ("NotoSans-Regular" here), so the PDF writer reused another subset's embedded
// font: wrong glyphs. And the face stayed "borrowing", so it was downloaded again a minute on.
// Pinned: until the next prepareFonts the face keeps its (prepared) donor; the preview is told once; the
// next build puts the face's own data in, prepared; nothing borrows; a minute on nothing is fetched again.
// Fonts come from a stand-in fetch (a fictional "Testface Duo" family, drawn with the bundled Noto Sans).
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

/**
 * The CDN for "Testface Duo" (400 and 700, latin and latin-ext): every face answers at once but the
 * latin-ext 700 file, which answers once `gate` resolves. Anything else on the CDN is offline.
 */
function network(gate) {
  const fetches = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    if (!u.includes('/testface-duo@5/')) throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      return new Response(JSON.stringify({ family: 'Testface Duo', weights: [400, 700], styles: ['normal'], subsets: ['latin', 'latin-ext'] }), { status: 200 });
    }
    if (u.endsWith('.woff')) {
      fetches.push(u);
      if (u.endsWith('-latin-ext-700-normal.woff')) await gate;
      return new Response(NOTO, { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
  return { fetches };
}

const tick = () => new Promise((r) => { setTimeout(r, 10); });
async function until(ready, what, ms = 5000) {
  const stop = realNow() + ms;
  while (!ready()) {
    if (realNow() > stop) assert.fail(`timed out waiting: ${what}`);
    await tick();
  }
}

const FAMILY = 'Testface Duo latin-ext'; // the chosen font's own latin-ext subset: a fallback family
const OWN_NAME = /-TestfaceDuolatinext$/; // the PostScript name prepareFonts gives that family's faces
const TEXT = 'Łukasz Example — Staff Engineer'; // Ł needs latin-ext

describe('a face that lands after its wait lands prepared, not over its donor (R2-142)', () => {
  let loader;
  let fonts;
  let Font;
  before(async () => {
    await setup();
    // A module that does not load (fail-first) fails the tests rather than this hook, which would skip `after`.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    fonts = await loadModule('/src/utils/fontFallback.js').catch(() => null);
    ({ Font } = await loadModule('/tests/fixtures/reactPdfFont.js'));
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    Date.now = realNow;
    loader?._setFontLoadWaitForTest?.();
  });
  after(teardown);

  it('a build laying out before the next prepareFonts keeps the prepared donor; the next build puts the face in, once', { timeout: 20_000 }, async () => {
    loader._setFontLoadWaitForTest(200);
    let open;
    const net = network(new Promise((resolve) => { open = resolve; }));
    const settings = { customFont: 'Testface Duo' };

    const first = await loader.resolvePdfFonts(settings, TEXT);
    assert.equal(first.fallback, null, 'the font itself loads');
    assert.ok([first.fontFamily].flat().includes(FAMILY), `its latin-ext subset is in the chain: ${[first.fontFamily].flat()}`);
    const sources = Font.getRegisteredFonts()[FAMILY].sources;
    const bold = sources.find((s) => s.fontWeight === 700 && s.fontStyle === 'normal');
    const donor = bold.data;
    assert.ok(donor && sources.some((s) => s !== bold && s.data === donor), 'the stalled bold prints with a loaded face\'s data for now');
    assert.match(donor.postscriptName, OWN_NAME, 'the donor is prepared');
    assert.equal(fonts.facesBorrowed(), true);

    let told = 0;
    const stop = fonts.onFaceFetched(() => { told += 1; });
    try {
      open(); // the bold's own fetch (and its italic's: the font has none, so the same file) lands now
      await until(() => told > 0, 'the preview is told the face landed');
      await new Promise((r) => { setTimeout(r, 150); });
      assert.equal(told, 1, 'told once for the faces that landed together, not once each');

      // The window: no prepareFonts has run since. Whatever a build laying out now takes for the bold
      // must be prepared — and it is still the donor, so one build never mixes the two.
      assert.match(bold.data.postscriptName, OWN_NAME,
        `the face a build lays out with now is prepared (was: the landed font, unprepared, "${bold.data.postscriptName}")`);
      assert.equal(bold.data, donor, 'the face keeps its donor until a build puts its own data in');

      const next = await loader.resolvePdfFonts(settings, TEXT);
      assert.equal(next.fallback, null);
      assert.notEqual(bold.data, donor, 'the next build puts the bold\'s own data in');
      assert.match(bold.data.postscriptName, OWN_NAME, 'prepared');
      assert.equal(fonts.facesBorrowed(), false, 'nothing borrows any more (was: the landed face still counted as borrowing)');

      // A minute on, the face is not fetched again: it has its own data.
      const fetches = net.fetches.length;
      const later = realNow() + 61_000;
      Date.now = () => later;
      await loader.resolvePdfFonts(settings, TEXT);
      await new Promise((r) => { setTimeout(r, 100); });
      assert.equal(net.fetches.length, fetches, 'no face is downloaded again');
      assert.equal(fonts.facesBorrowed(), false);
    } finally { stop(); }
  });
});
