// A font face that never answers must not hold every build behind it (R2-142). react-pdf's own fetch
// has no timeout and keeps the promise it started for good, so a captive portal, or a CDN that took the
// connection and said nothing, stopped resolvePdfFonts — and the PDF worker's every job behind it —
// until the page was reloaded. Now a build waits for a face's first fetch only so long (FONT_LOAD_MS):
// past it the face counts as not loaded and the font prints in Noto Sans with its name in the editor's
// notice, as offline. The wait is paid once, not on every build (a face that stalled counts as not
// loaded for a minute); a face whose data arrives after the wait is used by the next build.
// Fonts come from a stand-in fetch (a fictional "Testface" family, drawn with the bundled Noto Sans).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;

/**
 * The CDN for the "Testface" packages: the metadata answers; a face's file answers when `faces` says so —
 * 'stall' never, or `gate` (a promise) once it resolves. Anything else on the CDN is offline.
 */
function network({ faces = 'ok', gate = null } = {}) {
  let faceFetches = 0;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (!pkg?.startsWith('testface')) throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return new Response(JSON.stringify({ family, weights: [400], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    if (u.endsWith('.woff')) {
      faceFetches += 1;
      if (faces === 'stall') return new Promise(() => {});
      if (gate) { await gate; return new Response(NOTO, { status: 200 }); }
      return new Response(NOTO, { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
  return { faceFetches: () => faceFetches };
}

const primaryOf = (fontFamily) => (Array.isArray(fontFamily) ? fontFamily[0] : fontFamily);
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

describe('a face that never answers is waited for only so long (R2-142)', () => {
  let loader;
  let store;
  before(async () => {
    await setup();
    // A module that does not load (fail-first, without the fix) fails the tests rather than this hook: a failed hook skipped `after`.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    store = await loadModule('/src/utils/fontFallback.js').catch(() => null);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    loader?._setFontLoadWaitForTest?.();
  });
  after(teardown);

  it('the build goes on in Noto Sans, naming the font, once the wait is over; the next build does not wait again', { timeout: 8000 }, async () => {
    loader._setFontLoadWaitForTest?.(400);
    network({ faces: 'stall' });
    const settings = { customFont: 'Testface Serif' };

    const t0 = Date.now();
    const first = await loader.resolvePdfFonts(settings, 'Pat Example');
    const waited = Date.now() - t0;
    assert.ok(waited >= 350, `it waited for the face (${waited} ms)`);
    assert.equal(primaryOf(first.fontFamily), 'NotoSans');
    assert.equal(first.fallback, 'Testface Serif');
    assert.equal(store.fontFallback(), 'Testface Serif', 'the editor learns of it');

    const t1 = Date.now();
    const second = await loader.resolvePdfFonts(settings, 'Pat Example');
    const again = Date.now() - t1;
    assert.ok(again < 250, `the second build waited ${again} ms: the stalled face counts as not loaded for a while`);
    assert.equal(second.fallback, 'Testface Serif');
  });

  it('a face whose data arrives after the wait is used by the next build', { timeout: 8000 }, async () => {
    loader._setFontLoadWaitForTest?.(150);
    let open;
    const net = network({ gate: new Promise((resolve) => { open = resolve; }) });
    const settings = { customFont: 'Testface Mono' };
    let told = 0;
    const stop = store.onFaceFetched(() => { told += 1; });

    try {
      const first = await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(primaryOf(first.fontFamily), 'NotoSans');
      assert.equal(first.fallback, 'Testface Mono');
      assert.equal(told, 0, 'nothing has arrived yet');

      open();
      await wait(400); // the fetches the first build gave up on finish (a family's six faces together)
      assert.equal(told, 1, 'the preview is told to build again, once: the notice does not wait for the next edit');
      const fetches = net.faceFetches();
      const next = await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(primaryOf(next.fontFamily), 'Testface Mono', 'its own data is in');
      assert.equal(next.fallback, null);
      assert.equal(store.fontFallback(), null, 'the notice clears');
      assert.equal(net.faceFetches(), fetches, 'the data that arrived is used, not fetched again');
      // react-pdf's own load (layout asks for it) must not fetch it again either: the face is marked loaded.
      const { Font } = await import('@react-pdf/renderer');
      await Font.getRegisteredFonts()['Testface Mono'].sources[0].load();
      assert.equal(net.faceFetches(), fetches, 'nor does react-pdf\'s own load');
    } finally { stop(); }
  });
});
