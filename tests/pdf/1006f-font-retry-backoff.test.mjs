// R4-PDF-02, what R4-LO-17 left: a font face that failed once on a hiccup of the CDN prints in its own
// face again once the CDN is back, and a face the CDN does not have is not asked for again.
// R4-LO-17 already fetched a BORROWING face again a minute on (a bold that printed as the regular):
// tests/pdf/101 pins it for a dropped connection; here it is pinned for a 429 and a 503 too, and for two
// builds at once. Two things were left, pinned here:
// - a face the CDN lacks (a 404) was fetched again every minute for the rest of the session, as a passing
//   failure is. Nothing about a 404 changes, and fetchMetadata already keeps one: now it is not fetched again;
// - a family that only backs the chosen font up — its own latin-ext, a symbol font — and failed WHOLE was
//   never fetched again: react-pdf keeps a failed load for good, and only the chosen font's own family was
//   forgotten, so one dropped connection left "Ł" in Noto Sans's latin-ext, or a ✓ unprinted, until the page
//   was reloaded. Now such a family is asked for again like a borrowing face: a minute on (at once when it
//   failed offline or the browser comes back online), and a face that STALLED gets a new fetch, not the
//   wait on the first, which never answers.
// And no build waits longer for it than before: a fetch again is waited for within the build's one deadline.
// Fonts come from a stand-in fetch (fictional "Testface" families drawn with the bundled Noto Sans, and a
// Noto Sans Symbols 2 of the same make) and a clock the test moves. The cases share the loader's state, so
// each prints in a font of its own and the one that leaves a fetch on its way for good comes last.
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
const realSetTimeout = globalThis.setTimeout;

// Before pdfFontLoader.js loads: it listens for 'online' on globalThis, which Node lacks.
const onlineListeners = [];
globalThis.addEventListener = (type, fn) => { if (type === 'online') onlineListeners.push(fn); };
const backOnline = () => onlineListeners.forEach((fn) => fn());

/** The CDN's packages: package → { family, weights, subsets }. A case adds the fonts it prints in. */
const CATALOG = {};
/** What a face's file gets: 200, an error status, 'offline' (a dropped connection) or 'stall' (it never answers). */
let answer = () => 200;
/** Every face file asked for, in turn. */
const fetches = [];

/** The CDN as `CATALOG` and `answer` have it; any other package is offline. The harness's own server answers as ever. */
function network() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const meta = CATALOG[u.match(/@fontsource\/([^@/]+)@5\//)?.[1]];
    if (!meta) throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      return new Response(JSON.stringify({ family: meta.family, weights: meta.weights, styles: ['normal'], subsets: meta.subsets }), { status: 200 });
    }
    if (!u.endsWith('.woff')) throw new TypeError('fetch failed');
    fetches.push(u);
    const reply = answer(u);
    if (reply === 'offline') throw new TypeError('fetch failed');
    if (reply === 'stall') return new Promise(() => {});
    return new Response(reply === 200 ? NOTO : '', { status: reply });
  };
}

/** Settings that print in a new fictional font `name`, whose package CATALOG then holds. */
function fontNamed(name, { weights = [400, 700], subsets = ['latin'] } = {}) {
  CATALOG[name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')] = { family: name, weights, subsets };
  return { customFont: name };
}

const TEXT = 'Łukasz Example'; // the Ł is in the font's latin-ext
const subsetFont = (name) => fontNamed(name, { weights: [400], subsets: ['latin', 'latin-ext'] });
const chain = (out) => [out.fontFamily].flat();
const asked = (part) => fetches.filter((u) => u.includes(part)).length;
/** The clock `minutes` minutes (and a second each) on: a face asked for again is scheduled a minute out. */
const later = (minutes) => {
  const at = realNow() + minutes * 61_000;
  Date.now = () => at;
};

describe('a font face is fetched again once its backoff has passed, and one the CDN lacks never is (R4-PDF-02)', () => {
  let loader;
  let store;
  let Font;
  before(async () => {
    await setup();
    // A module that does not load (fail-first) fails the tests rather than this hook, which would skip `after`.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    store = await loadModule('/src/utils/fontFallback.js').catch(() => null);
    ({ Font } = await loadModule('/tests/fixtures/reactPdfFont.js'));
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
    Date.now = realNow;
    loader?._setFontLoadWaitForTest?.();
    delete globalThis.navigator.onLine;
    answer = () => 200;
    fetches.length = 0;
  });
  after(() => { delete globalThis.addEventListener; return teardown(); });

  // A face of a loaded font that failed for a passing reason (R4-LO-17, as before).
  for (const [what, failure] of [['a dropped connection', 'offline'], ['a 429', 429], ['a 503', 503]]) {
    it(`${what} on the bold: it prints as the regular, is left alone for a minute, then prints in its own face, once`, async () => {
      const settings = fontNamed(`Testface Retry ${failure}`);
      let healed = false;
      answer = (u) => (u.includes('-700-') && !healed ? failure : 200);
      network();
      const first = await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(chain(first)[0], settings.customFont, 'the font itself loads');
      assert.equal(first.fallback, null, 'and no font is named as missing');
      const sources = Font.getRegisteredFonts()[settings.customFont].sources;
      const bold = sources.find((s) => s.fontWeight === 700 && s.fontStyle === 'normal');
      const regulars = sources.filter((s) => s.fontWeight !== 700);
      assert.ok(regulars.some((s) => s.data === bold.data), 'the failed bold prints with a regular face\'s data for now');
      assert.equal(store.facesBorrowed(), true, 'the preview learns a face is borrowing');

      healed = true;
      const tries = asked('-700-');
      await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(asked('-700-'), tries, 'not asked again within the minute');

      later(1);
      await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.ok(asked('-700-') > tries, 'asked again a minute on');
      assert.ok(bold.data && regulars.every((s) => s.data !== bold.data), 'the bold prints in its own face');
      assert.equal(store.facesBorrowed(), false, 'nothing borrows any more');

      const total = fetches.length;
      later(2);
      await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(fetches.length, total, 'a face that landed is not downloaded again');
    });
  }

  it('two builds at once fetch a due face once, not once each', async () => {
    const settings = fontNamed('Testface Twice');
    let healed = false;
    answer = (u) => (u.includes('-700-') && !healed ? 'offline' : 200);
    network();
    await loader.resolvePdfFonts(settings, 'Pat Example');
    healed = true;
    later(1);
    const tries = asked('-700-');
    await Promise.all([loader.resolvePdfFonts(settings, 'Pat Example'), loader.resolvePdfFonts(settings, 'Pat Example')]);
    assert.equal(asked('-700-') - tries, 2, 'the upright and the italic bold, once each: not four fetches for two builds');
  });

  // A family that only backs the font up, and failed whole, is asked for again.
  it('its latin-ext, lost to a dropped connection, is fetched again a minute on and prints; then it is not downloaded again', async () => {
    const settings = subsetFont('Testface Subset');
    const SUBSET = 'Testface Subset latin-ext';
    let healed = false;
    answer = (u) => (u.includes('-latin-ext-') && !healed ? 'offline' : 200);
    network();
    const first = await loader.resolvePdfFonts(settings, TEXT);
    assert.deepEqual(chain(first), ['Testface Subset', 'NotoSans latin-ext'], 'the font loads, its latin-ext is out: the bundled one draws the Ł');
    assert.equal(first.fallback, null, 'the font itself loaded: nothing is named as missing');

    healed = true;
    const tries = asked('-latin-ext-');
    await loader.resolvePdfFonts(settings, TEXT);
    assert.equal(asked('-latin-ext-'), tries, 'not asked again within the minute');

    later(1);
    const again = await loader.resolvePdfFonts(settings, TEXT);
    assert.deepEqual(chain(again), ['Testface Subset', SUBSET, 'NotoSans latin-ext'], 'a minute on it is fetched again, and the font prints the Ł in itself');
    assert.ok(asked('-latin-ext-') > tries);
    assert.equal(store.facesBorrowed(), false, 'nothing waits to be fetched again');

    const total = fetches.length;
    later(2);
    await loader.resolvePdfFonts(settings, TEXT);
    assert.equal(fetches.length, total, 'a face that landed is not downloaded again');
  });

  it('a symbol font, lost to a 503, is fetched again a minute on: a ✓ is not left unprinted for the session', async () => {
    CATALOG['noto-sans-symbols-2'] = { family: 'Noto Sans Symbols 2', weights: [400], subsets: ['symbols'] };
    let healed = false;
    answer = (u) => (u.includes('noto-sans-symbols-2') && !healed ? 503 : 200);
    network();
    const first = await loader.resolvePdfFonts({}, 'Done ✓');
    assert.ok(!chain(first).includes('Noto Sans Symbols 2'), `the symbols are out: ${chain(first)}`);

    healed = true;
    later(1);
    const again = await loader.resolvePdfFonts({}, 'Done ✓');
    assert.ok(chain(again).includes('Noto Sans Symbols 2'), `a minute on they are fetched again: ${chain(again)}`);
    assert.equal(store.facesBorrowed(), false);
  });

  it('a latin-ext that never answered gets a new fetch a minute on, not the wait on the first one', async () => {
    loader._setFontLoadWaitForTest(200);
    const settings = subsetFont('Testface Stalled');
    const SUBSET = 'Testface Stalled latin-ext';
    let healed = false;
    answer = (u) => (u.includes('-latin-ext-') && !healed ? 'stall' : 200);
    network();
    const first = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(!chain(first).includes(SUBSET), 'the build went on without the stalled family');

    healed = true;
    later(1);
    const again = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(chain(again).includes(SUBSET), `a minute on its new fetch is waited for and lands: ${chain(again)}`);
    assert.equal(store.facesBorrowed(), false);
  });

  it('lost while the browser was offline, it is fetched again by the very next build', async () => {
    const settings = subsetFont('Testface Offline');
    const SUBSET = 'Testface Offline latin-ext';
    let healed = false;
    answer = (u) => (u.includes('-latin-ext-') && !healed ? 'offline' : 200);
    network();
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
    let first;
    try {
      first = await loader.resolvePdfFonts(settings, TEXT);
    } finally { delete globalThis.navigator.onLine; }
    assert.ok(!chain(first).includes(SUBSET));

    healed = true; // back online: no minute to wait
    const again = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(chain(again).includes(SUBSET), `an offline failure is tried at the next build: ${chain(again)}`);
  });

  it('back online, it is fetched again at once', async () => {
    const settings = subsetFont('Testface Online');
    const SUBSET = 'Testface Online latin-ext';
    let healed = false;
    answer = (u) => (u.includes('-latin-ext-') && !healed ? 503 : 200);
    network();
    const first = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(!chain(first).includes(SUBSET));

    healed = true;
    backOnline();
    const again = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(chain(again).includes(SUBSET), `the browser's 'online' skips the minute: ${chain(again)}`);
  });

  it('one the CDN lacks (a 404) is not asked for again, and nothing waits for it', async () => {
    const settings = subsetFont('Testface Gone');
    answer = (u) => (u.includes('-latin-ext-') ? 404 : 200);
    network();
    const first = await loader.resolvePdfFonts(settings, TEXT);
    assert.ok(!chain(first).includes('Testface Gone latin-ext'));
    const tries = asked('-latin-ext-');
    assert.ok(tries > 0, 'it was asked for once');
    assert.equal(store.facesBorrowed(), false, 'no fetch would change a 404: nothing waits to be fetched again');

    later(1);
    await loader.resolvePdfFonts(settings, TEXT);
    later(2);
    const last = await loader.resolvePdfFonts(settings, TEXT);
    assert.equal(asked('-latin-ext-'), tries, 'a minute and two on: not asked again');
    assert.ok(!chain(last).includes('Testface Gone latin-ext'));
  });

  // A face the CDN lacks, in a family that loads.
  it('a 404 face stays as its donor while a face that failed for a passing reason in the same family is fetched again', async () => {
    const settings = fontNamed('Testface Missing', { weights: [400, 500, 700] });
    let healed = false;
    answer = (u) => (u.includes('-500-') ? 404 : u.includes('-700-') && !healed ? 503 : 200);
    network();
    await loader.resolvePdfFonts(settings, 'Pat Example');
    const sources = Font.getRegisteredFonts()[settings.customFont].sources;
    const [medium, bold] = [500, 700].map((w) => sources.find((s) => s.fontWeight === w && s.fontStyle === 'normal'));
    const donors = { medium: medium.data, bold: bold.data };
    assert.ok(sources.some((s) => s.fontWeight === 400 && s.fontStyle === 'normal' && s.data === donors.medium), 'the 404 medium prints as the regular');

    healed = true;
    const counts = { medium: asked('-500-'), bold: asked('-700-') };
    later(1);
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.ok(asked('-700-') > counts.bold, 'the bold, a 503, is fetched again a minute on');
    assert.notEqual(bold.data, donors.bold, 'and prints in its own face');
    assert.equal(asked('-500-'), counts.medium, 'the medium, a 404, is not fetched again');
    assert.equal(medium.data, donors.medium, 'it stays as its donor');

    later(2);
    await loader.resolvePdfFonts(settings, 'Pat Example');
    assert.equal(asked('-500-'), counts.medium, 'nor is it, two minutes on');
    assert.equal(store.facesBorrowed(), false, 'a face nothing would fix does not count as borrowing');
  });

  // Last: the fetch again below never answers, so its face stays "on its way" for the rest of the file.
  it('no build waits longer than before: a fetch again that stalls is waited for within the build\'s deadline, not the fixed 3 s', async () => {
    loader._setFontLoadWaitForTest(150); // this case's deadline: 150 ms
    const settings = fontNamed('Testface Patient');
    let reply = 'offline';
    answer = (u) => (u.includes('-700-') ? reply : 200);
    network();
    await loader.resolvePdfFonts(settings, 'Pat Example'); // the bold fails, and borrows

    reply = 'stall';
    later(1);
    const waits = [];
    globalThis.setTimeout = (fn, ms, ...rest) => { waits.push(ms); return realSetTimeout(fn, ms, ...rest); };
    try {
      await loader.resolvePdfFonts(settings, 'Pat Example');
    } finally { globalThis.setTimeout = realSetTimeout; }
    assert.ok(asked('-700-') > 2, 'the fetch again was started, and it never answers');
    assert.ok(waits.length > 0 && Math.max(...waits) <= 150, `no wait ran past the deadline (waits: ${waits.join(', ')} ms; was: a fixed 3000)`);
  });
});
