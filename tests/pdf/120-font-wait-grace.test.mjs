// A CDN wait that starts once its build's font deadline is spent still gets a grace (R2-142, review of
// 38e7b70e). Every CDN face and metadata lookup of a build shares one deadline (pdfFontLoader.js
// FONT_LOAD_MS), and a wait that started after earlier steps had used it up — a slow network, a CJK face
// prepared on a weak phone — got a 0 ms timer: a face that would have landed in 100 ms lost the race, the
// font printed in Noto Sans with a false "could not be loaded" notice, and the preview built again when it
// landed. Now such a wait gets a grace (15 % of the wait), bounded: no wait ends later than two graces past
// the deadline, so it cannot pile up family after family and stays inside the PDF worker's budget.
// Fonts come from a stand-in fetch (fictional "Testface" families, drawn with the bundled Noto Sans).
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, teardown, loadModule } from './harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NOTO = readFileSync(path.join(ROOT, 'node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
const realFetch = globalThis.fetch;
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * The CDN for the "Testface" packages: metadata answers at once; a face of a package in `stall` never
 * answers, any other face answers after 40 ms (a real network's round trip). Anything else is offline.
 */
function network({ stall = [] } = {}) {
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
      if (stall.includes(pkg)) return new Promise(() => {});
      await wait(40);
      return new Response(NOTO, { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
}

const primaryOf = (fontFamily) => (Array.isArray(fontFamily) ? fontFamily[0] : fontFamily);
const WAIT_MS = 3000; // the test's FONT_LOAD_MS: a grace of 450 ms, no wait past 3,900 ms

describe('a CDN wait that starts with the deadline spent still gets a grace, bounded (R2-142)', () => {
  let loader;
  before(async () => {
    await setup();
    // A module that does not load (fail-first) fails the tests rather than this hook, which would skip `after`.
    loader = await loadModule('/src/templates/pdf/shared/pdfFontLoader.js').catch(() => null);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    loader?._setFontLoadWaitForTest?.();
  });
  after(teardown);

  it('the body\'s faces spend the deadline; the Name Font, 40 ms away, still prints in itself and is not named', { timeout: 30_000 }, async () => {
    loader._setFontLoadWaitForTest(WAIT_MS);
    network({ stall: ['testface-late'] });
    const settings = { customFont: 'Testface Late', nameFont: 'Testface Prompt' };

    const t0 = Date.now();
    const out = await loader.resolvePdfFonts(settings, 'Pat Example');
    const took = Date.now() - t0;
    assert.ok(took >= WAIT_MS - 50, `the body's stalled faces held the build to its deadline (${took} ms)`);
    assert.equal(primaryOf(out.fontFamily), 'NotoSans', 'the body, which never answered, prints in Noto Sans');
    assert.equal(primaryOf(out.nameFontFamily), 'Testface Prompt',
      'the Name Font, asked for after the deadline and 40 ms away, prints in itself (was: a 0 ms wait, Noto Sans)');
    assert.equal(out.fallback, 'Testface Late', 'only the font that never came is named: no false notice for the Name Font');
  });

  it('three CDN families that never answer: the grace does not pile up, no wait ends past two graces after the deadline', { timeout: 30_000 }, async () => {
    loader._setFontLoadWaitForTest(WAIT_MS);
    network({ stall: ['testface-north', 'testface-south', 'testface-east'] });
    const settings = { customFont: 'Testface North', nameFont: 'Testface South', headingFont: 'Testface East' };

    const t0 = Date.now();
    const out = await loader.resolvePdfFonts(settings, 'Pat Example');
    const took = Date.now() - t0;
    assert.ok(took < WAIT_MS * 1.3 + 700, `the build waited ${took} ms: at most 1.3 × the wait (${WAIT_MS * 1.3} ms), not a grace per family on top`);
    assert.deepEqual([out.fontFamily, out.nameFontFamily, out.headingFontFamily].map(primaryOf), ['NotoSans', 'NotoSans', 'NotoSans']);
    assert.equal(out.fallback, 'Testface North and Testface South and Testface East');
  });
});
