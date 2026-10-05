// A font's metadata lookup waits no longer than its build's font deadline (R2-142, review of 38e7b70e).
// A lookup has its own 8 s limit (src/utils/fontsource.js), but the build asked for its fonts' metadata in
// turn and outside the deadline its faces share: on a CDN that takes the connection and says nothing, a
// body, Name Font and Heading Font cost ~24 s before any face was asked for — past the PDF worker's 20 s
// budget (pdfBuild.js), so the build failed "took too long", and Retry, on a fresh worker, the same way.
// Now the lookups share the build's deadline: past it the font prints in Noto Sans and is named, as when the
// CDN has no answer. A lookup that was only slow goes on, and when it answers the preview is told to build
// again, and the next build prints in the font.
// The CDN is a stand-in fetch that honours the lookup's abort signal, as a real fetch does.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;

/** A fetch that never answers on its own: only its abort signal (the lookup's 8 s limit) ends it. */
const silence = (opts) => new Promise((_, reject) => {
  const signal = opts?.signal;
  if (signal?.aborted) { reject(signal.reason); return; }
  signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
});

/**
 * The CDN for the "Testface" packages. Metadata: `meta` 'silent' never answers; `gate` (a promise) answers
 * once it resolves. Faces answer at once. Anything else on the CDN is offline.
 */
function network({ meta = 'silent', gate = null } = {}) {
  let lookups = 0;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    const pkg = u.match(/@fontsource\/([^@/]+)@/)?.[1];
    if (!pkg?.startsWith('testface')) throw new TypeError('fetch failed');
    if (u.endsWith('/metadata.json')) {
      lookups += 1;
      if (meta === 'silent') return silence(opts);
      await Promise.race([gate, silence(opts)]);
      const family = pkg.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return new Response(JSON.stringify({ family, weights: [400], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    if (u.endsWith('.woff')) return new Response(NOTO, { status: 200 });
    throw new TypeError('fetch failed');
  };
  return { lookups: () => lookups };
}

const primaryOf = (fontFamily) => (Array.isArray(fontFamily) ? fontFamily[0] : fontFamily);

describe('a font\'s metadata is waited for no longer than the build\'s font deadline (R2-142)', () => {
  let loader;
  let store;
  before(async () => {
    await setup();
    // A module that does not load (fail-first) fails the tests rather than this hook, which would skip `after`.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
    store = await loadModule('/src/utils/fontFallback.js').catch(() => null);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    loader?._setFontLoadWaitForTest?.();
  });
  after(teardown);

  it('body, Name Font and Heading Font whose metadata never comes: Noto Sans by the deadline, each named', { timeout: 60_000 }, async () => {
    loader._setFontLoadWaitForTest(400);
    const net = network({ meta: 'silent' });
    const settings = { customFont: 'Testface Grotesk', nameFont: 'Testface Slab', headingFont: 'Testface Script' };

    const t0 = Date.now();
    const out = await loader.resolvePdfFonts(settings, 'Pat Example');
    const took = Date.now() - t0;
    assert.equal(net.lookups(), 3, 'each font\'s metadata was asked for');
    assert.ok(took < 3000, `the fonts took ${took} ms: by the 400 ms deadline (was: 8 s per lookup, in turn, ~24 s — past the worker's 20 s budget)`);
    assert.deepEqual([out.fontFamily, out.nameFontFamily, out.headingFontFamily].map(primaryOf), ['NotoSans', 'NotoSans', 'NotoSans']);
    assert.equal(out.fallback, 'Testface Grotesk and Testface Slab and Testface Script', 'each font is named');
  });

  it('metadata that was only slow: Noto Sans by the deadline, then the preview is told and the next build prints in the font', { timeout: 30_000 }, async () => {
    loader._setFontLoadWaitForTest(300);
    let open;
    network({ meta: 'gated', gate: new Promise((resolve) => { open = resolve; }) });
    const settings = { customFont: 'Testface Mono' };
    let told = 0;
    const stop = store.onFaceFetched(() => { told += 1; });
    try {
      const t0 = Date.now();
      const first = await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.ok(Date.now() - t0 < 3000, `the build went on by its deadline (${Date.now() - t0} ms)`);
      assert.equal(primaryOf(first.fontFamily), 'NotoSans');
      assert.equal(first.fallback, 'Testface Mono');
      assert.equal(told, 0);

      open(); // the lookup the build stopped waiting for answers now
      const stopAt = Date.now() + 5000;
      while (!told && Date.now() < stopAt) await new Promise((r) => { setTimeout(r, 20); });
      assert.equal(told, 1, 'the preview is told to build again: the notice does not wait for the next edit');

      const next = await loader.resolvePdfFonts(settings, 'Pat Example');
      assert.equal(primaryOf(next.fontFamily), 'Testface Mono', 'the next build prints in the font');
      assert.equal(next.fallback, null);
    } finally { stop(); }
  });
});
