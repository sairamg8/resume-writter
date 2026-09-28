// R4-LO-17: a face of a loaded font that failed once (a bold on a network hiccup) was given a donor
// face's data (prepareFonts, pdfFontLoader.js) for the rest of the session: the bold printed as the
// regular until the tab was reloaded. Pinned: the face is fetched again a minute later (not on every
// build, so a face the CDN lacks is not re-downloaded per preview build), and then prints with its
// own data — fetched aside and put in only by a build, right before it primes it, so the face never
// lays out empty or unprimed; meanwhile facesBorrowed() says a face is borrowing, so the preview builds
// again when the browser is back online. Data that arrives after its build stopped waiting says so
// (onFaceFetched), so the preview builds again then rather than on the next edit. And an 'online'
// while a fetch is on its way does not start a second one (Node has no global 'online': the file
// catches the loader's listener with a stand-in addEventListener, as tests/unit/job-stages does).
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

// Before pdfFontLoader.js loads: it listens for 'online' on globalThis, which Node lacks.
const onlineListeners = [];
globalThis.addEventListener = (type, fn) => { if (type === 'online') onlineListeners.push(fn); };
const backOnline = () => onlineListeners.forEach((fn) => fn());

/**
 * The CDN: fonts "Testface Bold" and "Testface Stall", each with a 400 and a 700. A 700 file fails
 * while `boldFails`, and waits for `stall` (a promise) while one is set.
 */
let boldFails = false;
let stall = null;
const boldFetches = [];
function network() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/(testface-[a-z]+)@5\//)?.[1];
    if (pkg && u.endsWith('/metadata.json')) {
      const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return new Response(JSON.stringify({ family, weights: [400, 700], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    if (pkg && u.includes('/files/') && u.endsWith('.woff')) {
      if (u.includes('-700-')) {
        boldFetches.push(u);
        if (boldFails) throw new TypeError('fetch failed');
        if (stall) await stall;
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
  after(() => { delete globalThis.addEventListener; return teardown(); });

  it('the bold borrows the regular after a failed fetch, and gets its own data a minute on', async () => {
    const settings = { customFont: 'Testface Bold' };
    network();
    boldFails = true;
    const first = await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal([first.fontFamily].flat()[0], 'Testface Bold', 'the font itself loads');
    const sources = Font.getRegisteredFonts()['Testface Bold'].sources;
    const bold = sources.find((s) => s.fontWeight === 700 && s.fontStyle === 'normal');
    // The faces that load: 400, and 500 (the font has no 500, so its 400 file) in both styles.
    const others = sources.filter((s) => s.fontWeight !== 700);
    assert.ok(others.every((s) => s.data), 'the regular faces loaded');
    const donor = others.find((s) => s.data === bold.data);
    assert.ok(donor, 'the failed bold prints with a regular face\'s data for now');
    assert.equal(fallback.facesBorrowed(), true, 'the preview learns a face is borrowing');

    // The network is back, but a build right after does not fetch the bold again (a face the CDN
    // lacks would otherwise be re-downloaded on every preview build).
    boldFails = false;
    const tries = boldFetches.length;
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(boldFetches.length, tries, 'not fetched again within the minute');
    assert.equal(bold.data, donor.data);

    // A minute on, the next build fetches it, and the bold prints with its own data. It arrived
    // while that build waited: no build again is asked for.
    const later = realNow() + 61_000;
    Date.now = () => later;
    let asked = 0;
    const stop = fallback.onFaceFetched(() => { asked += 1; });
    try {
      await loader.resolvePdfFonts(settings, 'Pat Example');
      await new Promise((resolve) => { setTimeout(resolve, 50); });
    } finally { stop(); }
    assert.equal(asked, 0, 'the build that waited put it in itself');
    assert.ok(boldFetches.length > tries, 'the bold is fetched again');
    assert.ok(bold.data, 'the bold has data');
    assert.ok(others.every((s) => s.data !== bold.data), 'the bold prints with its own face, not a regular one');
    assert.equal(typeof bold.data.glyphForCodePoint, 'function', 'a fontkit font');
    assert.equal(fallback.facesBorrowed(), false, 'nothing borrows any more');
  });

  it('a fetch again that stalls does not hold the build: the bold is put in by a build after it arrives', { timeout: 20_000 }, async () => {
    const settings = { customFont: 'Testface Stall' };
    network();
    boldFails = true;
    await loader.resolvePdfFonts(settings, 'Pat Example');
    const sources = Font.getRegisteredFonts()['Testface Stall'].sources;
    const bold = sources.find((s) => s.fontWeight === 700 && s.fontStyle === 'normal');
    const others = sources.filter((s) => s.fontWeight !== 700);
    const donorData = bold.data;
    assert.ok(others.some((s) => s.data === donorData), 'borrowing');

    // A minute on, the CDN answers the bold only when `open` is called: a stalled connection.
    boldFails = false;
    let open;
    stall = new Promise((resolve) => { open = resolve; });
    const later = realNow() + 61_000;
    Date.now = () => later;
    const started = realNow();
    try {
      await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.ok(realNow() - started < 10_000, 'the build went on without the stalled face');
      assert.equal(bold.data, donorData, 'the face keeps the donor while its own is on its way');
    } finally { open(); stall = null; }
    // Waited for, not slept on: the fetch's reply goes through fontkit before the word comes.
    let asked = 0;
    let stop;
    await new Promise((resolve) => { stop = fallback.onFaceFetched(() => { asked += 1; resolve(); }); });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    stop();
    assert.equal(asked, 1, 'its arrival after the build asks for a build again, once');
    assert.equal(bold.data, donorData, 'arrived, but not put in until a build primes it');
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.ok(others.every((s) => s.data !== bold.data), 'the next build puts the bold\'s own data in');
    assert.equal(fallback.facesBorrowed(), false);
  });

  it('back online while a fetch again is on its way: no second fetch of the face', { timeout: 20_000 }, async () => {
    const settings = { customFont: 'Testface Online' };
    network();
    boldFails = true;
    await loader.resolvePdfFonts(settings, 'Pat Example');
    boldFails = false;
    let open;
    stall = new Promise((resolve) => { open = resolve; });
    const later = realNow() + 61_000;
    Date.now = () => later;
    try {
      await loader.resolvePdfFonts(settings, 'Pat Example'); // its fetch again stalls; the build goes on
      const tries = boldFetches.length;
      backOnline();
      await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(boldFetches.length, tries, 'the face on its way is not fetched a second time');
    } finally { open(); stall = null; }
    await new Promise((resolve) => { const stop = fallback.onFaceFetched(() => { stop(); resolve(); }); });
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(fallback.facesBorrowed(), false, 'the one fetch put it in');
  });
});
